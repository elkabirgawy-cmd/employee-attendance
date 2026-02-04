import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const {
      employee_id,
      company_id,
      location,
      permission_state
    } = body;

    if (!employee_id || !company_id) {
      return new Response(
        JSON.stringify({
          ok: false,
          code: "INVALID_REQUEST",
          message_ar: "بيانات غير صالحة",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const today = new Date().toISOString().split("T")[0];
    const { data: currentLog, error: logError } = await supabase
      .from("attendance_logs")
      .select("id, branch_id, company_id")
      .eq("employee_id", employee_id)
      .eq("company_id", company_id)
      .gte("check_in_time", `${today}T00:00:00`)
      .lte("check_in_time", `${today}T23:59:59`)
      .is("check_out_time", null)
      .maybeSingle();

    if (logError || !currentLog) {
      return new Response(
        JSON.stringify({
          ok: false,
          code: "NO_ACTIVE_SHIFT",
          message_ar: "لا يوجد دوام نشط",
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const now = new Date().toISOString();
    await supabase
      .from("attendance_logs")
      .update({
        last_heartbeat_at: now,
        location_permission_state: permission_state,
      })
      .eq("id", currentLog.id);

    let inBranch = false;
    let gpsOk = (permission_state === "granted");
    let reason = null;

    if (gpsOk && location && location.lat && location.lng) {
      const { data: branch } = await supabase
        .from("branches")
        .select("latitude, longitude, geofence_radius")
        .eq("id", currentLog.branch_id)
        .maybeSingle();

      if (branch) {
        const distance = calculateDistance(
          location.lat,
          location.lng,
          parseFloat(branch.latitude),
          parseFloat(branch.longitude)
        );
        inBranch = (distance <= branch.geofence_radius);
        if (!inBranch) {
          reason = "OUT_OF_BRANCH";
        }
      }
    } else {
      reason = "GPS_DISABLED";
    }

    const { data: heartbeatResult, error: rpcError } = await supabase.rpc(
      "record_heartbeat_and_check_auto_checkout",
      {
        p_employee_id: employee_id,
        p_attendance_log_id: currentLog.id,
        p_in_branch: inBranch,
        p_gps_ok: gpsOk,
        p_latitude: location?.lat || null,
        p_longitude: location?.lng || null,
        p_accuracy: location?.accuracy || null
      }
    );

    if (rpcError) {
      console.error("RPC Error:", rpcError);
    }

    // Diagnostic logging for countdown actions
    if (heartbeatResult?.pending_created) {
      console.log(`[COUNTDOWN_STARTED] New violation detected`, {
        reason: heartbeatResult.reason,
        in_branch: inBranch,
        gps_ok: gpsOk,
        ends_at: heartbeatResult.ends_at,
        seconds_remaining: heartbeatResult.seconds_remaining
      });
    } else if (heartbeatResult?.pending_cancelled) {
      console.log(`[COUNTDOWN_CANCELLED] Employee recovered`, {
        in_branch: inBranch,
        gps_ok: gpsOk
      });
    } else if (heartbeatResult?.auto_checkout_executed) {
      console.log(`[AUTO_CHECKOUT_EXECUTED]`, {
        reason: heartbeatResult.reason
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        message_ar: "تم التحديث بنجاح",
        in_branch: inBranch,
        gps_ok: gpsOk
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Heartbeat error:", error);
    return new Response(
      JSON.stringify({
        ok: false,
        code: "SERVER_ERROR",
        message_ar: "حدث خطأ في الخادم",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});