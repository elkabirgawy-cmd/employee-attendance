import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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

    const { data: allSettings } = await supabase
      .from("auto_checkout_settings")
      .select("*");

    if (!allSettings || allSettings.length === 0) {
      return new Response(
        JSON.stringify({
          ok: true,
          message: "No auto-checkout settings configured",
          processed: 0,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const now = new Date();
    const today = now.toISOString().split("T")[0];
    let totalProcessed = 0;
    let totalStarted = 0;
    let totalExecuted = 0;
    const details: any[] = [];

    for (const settings of allSettings) {
      if (!settings.auto_checkout_enabled) {
        continue;
      }

      const { data: activeLogs } = await supabase
        .from("attendance_logs")
        .select("id, employee_id, company_id, check_in_time, last_heartbeat_at")
        .eq("company_id", settings.company_id)
        .gte("check_in_time", `${today}T00:00:00`)
        .lte("check_in_time", `${today}T23:59:59`)
        .is("check_out_time", null);

      if (!activeLogs || activeLogs.length === 0) {
        continue;
      }

      for (const log of activeLogs) {
        totalProcessed++;

        const { data: heartbeat } = await supabase
          .from("employee_location_heartbeat")
          .select("last_seen_at, in_branch, gps_ok, reason")
          .eq("employee_id", log.employee_id)
          .maybeSingle();

        let shouldTrigger = false;
        let triggerReason = "";

        if (!heartbeat || !heartbeat.last_seen_at) {
          const checkInTime = new Date(log.check_in_time);
          const secondsSinceCheckIn = (now.getTime() - checkInTime.getTime()) / 1000;

          if (secondsSinceCheckIn >= settings.auto_checkout_after_seconds) {
            shouldTrigger = true;
            triggerReason = "NO_HEARTBEAT";
          }
        } else {
          const lastSeen = new Date(heartbeat.last_seen_at);
          const secondsSinceLastSeen = (now.getTime() - lastSeen.getTime()) / 1000;

          if (secondsSinceLastSeen >= settings.auto_checkout_after_seconds) {
            shouldTrigger = true;
            triggerReason = "HEARTBEAT_TIMEOUT";
          } else if (!heartbeat.gps_ok) {
            shouldTrigger = true;
            triggerReason = "GPS_DISABLED";
          } else if (!heartbeat.in_branch) {
            shouldTrigger = true;
            triggerReason = "OUT_OF_BRANCH";
          }
        }

        if (shouldTrigger) {
          const { data: existingPending } = await supabase
            .from("auto_checkout_pending")
            .select("id, ends_at, status")
            .eq("attendance_log_id", log.id)
            .eq("status", "PENDING")
            .maybeSingle();

          if (existingPending) {
            const endsAt = new Date(existingPending.ends_at);
            if (now >= endsAt) {
              const checkInTime = new Date(log.check_in_time);
              const hoursWorked = (now.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);

              await supabase
                .from("attendance_logs")
                .update({
                  check_out_time: now.toISOString(),
                  check_out_device_time: now.toISOString(),
                  total_working_hours: parseFloat(hoursWorked.toFixed(2)),
                  checkout_type: "AUTO",
                  checkout_reason: triggerReason,
                })
                .eq("id", log.id);

              await supabase
                .from("auto_checkout_pending")
                .update({
                  status: "DONE",
                  done_at: now.toISOString(),
                })
                .eq("id", existingPending.id);

              await supabase
                .from("employee_location_heartbeat")
                .delete()
                .eq("employee_id", log.employee_id);

              totalExecuted++;
              details.push({
                employee_id: log.employee_id,
                action: "EXECUTED",
                reason: triggerReason,
              });
            }
          } else {
            const endsAt = new Date(now.getTime() + settings.auto_checkout_after_seconds * 1000);

            await supabase
              .from("auto_checkout_pending")
              .insert({
                employee_id: log.employee_id,
                company_id: log.company_id,
                attendance_log_id: log.id,
                reason: triggerReason,
                ends_at: endsAt.toISOString(),
                status: "PENDING",
              });

            totalStarted++;
            details.push({
              employee_id: log.employee_id,
              action: "STARTED",
              reason: triggerReason,
              ends_at: endsAt.toISOString(),
            });
          }
        } else {
          const { data: existingPending } = await supabase
            .from("auto_checkout_pending")
            .select("id")
            .eq("attendance_log_id", log.id)
            .eq("status", "PENDING")
            .maybeSingle();

          if (existingPending) {
            await supabase
              .from("auto_checkout_pending")
              .update({
                status: "CANCELLED",
                cancelled_at: now.toISOString(),
                cancel_reason: "CONDITIONS_RESOLVED",
              })
              .eq("id", existingPending.id);

            details.push({
              employee_id: log.employee_id,
              action: "CANCELLED",
              reason: "CONDITIONS_RESOLVED",
            });
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        message: `Processed ${totalProcessed} sessions, started ${totalStarted} countdowns, executed ${totalExecuted} auto-checkouts`,
        processed: totalProcessed,
        started: totalStarted,
        executed: totalExecuted,
        details: details,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Auto-checkout enforcement error:", error);
    return new Response(
      JSON.stringify({
        ok: false,
        code: "SERVER_ERROR",
        message: "Server error during enforcement",
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});