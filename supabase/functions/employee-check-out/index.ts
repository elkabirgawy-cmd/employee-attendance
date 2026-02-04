import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { validateGeofence } from "./_shared/geofence.ts";

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

    const body = await req.json();
    const {
      employee_id,
      location,
      deviceTimezone
    } = body;

    if (!employee_id) {
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

    const { data: employee, error: empError } = await supabase
      .from("employees")
      .select("id, branch_id, company_id, full_name, work_start_time, work_end_time, early_grace_min")
      .eq("id", employee_id)
      .maybeSingle();

    if (empError || !employee) {
      return new Response(
        JSON.stringify({
          ok: false,
          code: "EMPLOYEE_NOT_FOUND",
          message_ar: "الموظف غير موجود",
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const today = new Date().toISOString().split("T")[0];
    const { data: currentLog, error: logError } = await supabase
      .from("attendance_logs")
      .select("id, check_in_time, attendance_type, location_check_type")
      .eq("employee_id", employee_id)
      .gte("check_in_time", `${today}T00:00:00`)
      .lte("check_in_time", `${today}T23:59:59`)
      .is("check_out_time", null)
      .maybeSingle();

    if (logError || !currentLog) {
      return new Response(
        JSON.stringify({
          ok: false,
          code: "NO_CHECK_IN",
          message_ar: "لم تسجل الحضور اليوم",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Determine if this is a free task checkout (based on check-in type)
    const isFreeTask = currentLog.attendance_type === 'FREE';
    let validation = { valid: true, status: 'FREE_TASK', distance: 0, code: '', message_ar: '', reason: '' };

    // Only validate geofence if NOT in free task mode
    if (!isFreeTask) {
      const { data: branch, error: branchError } = await supabase
        .from("branches")
        .select("id, name, latitude, longitude, geofence_radius")
        .eq("id", employee.branch_id)
        .maybeSingle();

      if (branchError || !branch) {
        return new Response(
          JSON.stringify({
            ok: false,
            code: "BRANCH_NOT_FOUND",
            message_ar: "الفرع غير موجود",
          }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      validation = validateGeofence(location, branch, { trustLastKnown: true });

      console.log({
        action: "check_out",
        employee_id,
        branch_id: branch.id,
        distance: validation.distance,
        radius: branch.geofence_radius,
        accuracy: location?.accuracy,
        valid: validation.valid,
        status: validation.status,
        reason: validation.reason,
      });

      if (validation.status === 'CONFIRMED_OUTSIDE') {
        return new Response(
          JSON.stringify({
            ok: false,
            code: validation.code,
            message_ar: validation.message_ar,
            distance: validation.distance > 0 ? Math.round(validation.distance) : undefined,
            radius: branch.geofence_radius,
          }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    } else {
      console.log({
        action: "check_out",
        employee_id,
        free_task: true,
        attendance_type: currentLog.attendance_type,
      });
    }
    const { data: currentLog, error: logError } = await supabase
      .from("attendance_logs")
      .select("id, check_in_time")
      .eq("employee_id", employee_id)
      .gte("check_in_time", `${today}T00:00:00`)
      .lte("check_in_time", `${today}T23:59:59`)
      .is("check_out_time", null)
      .maybeSingle();

    if (logError || !currentLog) {
      return new Response(
        JSON.stringify({
          ok: false,
          code: "NO_CHECK_IN",
          message_ar: "لم تسجل الحضور اليوم",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let resolvedTimezone = null;
    const utcCheckOutTime = new Date();
    let localCheckOutTime = utcCheckOutTime;

    try {
      const timezoneResponse = await fetch(`${supabaseUrl}/functions/v1/resolve-timezone`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          latitude: location.lat,
          longitude: location.lng,
          deviceTimezone: deviceTimezone,
        }),
      });

      if (timezoneResponse.ok) {
        const timezoneData = await timezoneResponse.json();
        resolvedTimezone = timezoneData.timezone;
        localCheckOutTime = new Date(utcCheckOutTime.toLocaleString("en-US", { timeZone: resolvedTimezone }));
      }
    } catch (error) {
      console.error("Timezone resolution failed on checkout, using UTC:", error);
    }

    const checkInTime = new Date(currentLog.check_in_time);
    const checkOutTime = utcCheckOutTime;
    const hoursWorked = (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);

    let earlyLeaveMinutes = 0;
    if (employee.work_end_time && resolvedTimezone) {
      try {
        const checkOutDate = new Date(localCheckOutTime);
        const [hours, minutes, seconds] = employee.work_end_time.split(':');
        let scheduledEnd = new Date(checkOutDate);
        scheduledEnd.setHours(parseInt(hours), parseInt(minutes), parseInt(seconds || '0'), 0);

        // Handle overnight shifts: if work_end_time < work_start_time, end is next day
        if (employee.work_start_time && employee.work_end_time < employee.work_start_time) {
          scheduledEnd.setDate(scheduledEnd.getDate() + 1);
        }

        const diffMs = scheduledEnd.getTime() - checkOutDate.getTime();
        const diffMinutes = Math.floor(diffMs / 60000);
        const graceMinutes = employee.early_grace_min || 0;
        earlyLeaveMinutes = Math.max(0, diffMinutes - graceMinutes);
      } catch (error) {
        console.error("Error calculating early leave minutes:", error);
      }
    }

    const { data: updatedLog, error: updateError } = await supabase
      .from("attendance_logs")
      .update({
        check_out_time: checkOutTime.toISOString(),
        check_out_device_time: checkOutTime.toISOString(),
        check_out_latitude: location.lat,
        check_out_longitude: location.lng,
        check_out_accuracy: location.accuracy || 0,
        total_working_hours: parseFloat(hoursWorked.toFixed(2)),
        checkout_reason: "MANUAL",
        utc_check_out_time: checkOutTime.toISOString(),
        local_check_out_time: localCheckOutTime.toISOString(),
        early_leave_minutes: earlyLeaveMinutes,
      })
      .eq("id", currentLog.id)
      .select()
      .single();

    if (updateError) {
      console.error("Update error:", updateError);
      return new Response(
        JSON.stringify({
          ok: false,
          code: "DATABASE_ERROR",
          message_ar: "حدث خطأ أثناء تسجيل الانصراف",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        data: updatedLog,
        message_ar: "تم تسجيل الانصراف بنجاح",
        timezone: resolvedTimezone,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Check-out error:", error);
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