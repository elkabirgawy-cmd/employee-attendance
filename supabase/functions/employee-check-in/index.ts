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
      .select("id, branch_id, company_id, full_name, work_start_time, late_grace_min")
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

    // Check if employee has an active free task
    const { data: activeFreeTask } = await supabase
      .from("free_tasks")
      .select("id, notes")
      .eq("employee_id", employee_id)
      .eq("company_id", employee.company_id)
      .eq("is_active", true)
      .lte("start_at", new Date().toISOString())
      .gte("end_at", new Date().toISOString())
      .maybeSingle();

    const isFreeTask = !!activeFreeTask;
    let validation = { valid: true, status: 'FREE_TASK', distance: 0, code: '', message_ar: '', reason: '' };
    let branch = null;

    // Only validate geofence if NOT in free task mode
    if (!isFreeTask) {
      const { data: branchData, error: branchError } = await supabase
        .from("branches")
        .select("id, name, latitude, longitude, geofence_radius")
        .eq("id", employee.branch_id)
        .maybeSingle();

      branch = branchData;

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

      validation = validateGeofence(location, branch, { trustLastKnown: false });

      console.log({
        action: "check_in",
        employee_id,
        branch_id: employee.branch_id,
        distance: validation.distance,
        radius: branch?.geofence_radius,
        accuracy: location?.accuracy,
        valid: validation.valid,
        status: validation.status,
        reason: validation.reason,
        free_task: isFreeTask,
      });

      if (!validation.valid && validation.status === 'CONFIRMED_OUTSIDE') {
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

      if (validation.status === 'TRUST_LAST_KNOWN') {
        return new Response(
          JSON.stringify({
            ok: false,
            code: validation.code,
            message_ar: 'لا يمكن تسجيل الحضور بدون موقع دقيق',
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
        action: "check_in",
        employee_id,
        free_task: true,
        free_task_id: activeFreeTask.id,
        notes: activeFreeTask.notes,
      });
    }

    // CRITICAL: Always use server UTC time as primary source
    // Timezone resolution is OPTIONAL and should NEVER block check-in
    let resolvedTimezone = null;
    let utcCheckInTime = new Date();
    let localCheckInTime = utcCheckInTime;
    let timezoneMismatch = false;
    let mismatchDifferenceMinutes = 0;

    // Try to resolve timezone with timeout, but don't fail if it doesn't work
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

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
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (timezoneResponse.ok) {
        const timezoneData = await timezoneResponse.json();
        resolvedTimezone = timezoneData.timezone;
        timezoneMismatch = timezoneData.mismatchDetected || false;
        mismatchDifferenceMinutes = timezoneData.mismatchDifferenceMinutes || 0;

        try {
          localCheckInTime = new Date(utcCheckInTime.toLocaleString("en-US", { timeZone: resolvedTimezone }));
        } catch (tzError) {
          console.error("Invalid timezone, using UTC:", tzError);
          localCheckInTime = utcCheckInTime;
        }
      } else {
        console.log("Timezone resolution returned non-ok status, using UTC");
      }
    } catch (error) {
      // This is EXPECTED and OK - network issues, timeouts, API failures
      // Check-in should ALWAYS succeed regardless of timezone resolution
      console.log("Timezone resolution failed (expected/ok), using UTC:", error.message || error);
    }

    const today = new Date().toISOString().split("T")[0];

    // Check if employee already has an open session today
    const { data: existingSession, error: existingError } = await supabase
      .from("attendance_logs")
      .select("id, check_in_time")
      .eq("employee_id", employee_id)
      .eq("company_id", employee.company_id)
      .gte("check_in_time", `${today}T00:00:00`)
      .lte("check_in_time", `${today}T23:59:59`)
      .is("check_out_time", null)
      .order("check_in_time", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingSession) {
      console.log("Employee already has open session:", existingSession.id);
      return new Response(
        JSON.stringify({
          ok: false,
          code: "ALREADY_CHECKED_IN",
          message_ar: "لقد سجلت حضورك بالفعل اليوم",
          existing_session: existingSession,
        }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let lateMinutes = 0;
    if (employee.work_start_time && resolvedTimezone) {
      try {
        const checkInDate = new Date(localCheckInTime);
        const [hours, minutes, seconds] = employee.work_start_time.split(':');
        const scheduledStart = new Date(checkInDate);
        scheduledStart.setHours(parseInt(hours), parseInt(minutes), parseInt(seconds || '0'), 0);

        const diffMs = checkInDate.getTime() - scheduledStart.getTime();
        const diffMinutes = Math.floor(diffMs / 60000);
        const graceMinutes = employee.late_grace_min || 0;
        lateMinutes = Math.max(0, diffMinutes - graceMinutes);
      } catch (error) {
        console.error("Error calculating late minutes:", error);
      }
    }

    const now = utcCheckInTime.toISOString();
    const { data: attendanceLog, error: insertError } = await supabase
      .from("attendance_logs")
      .insert({
        employee_id: employee_id,
        company_id: employee.company_id,
        branch_id: isFreeTask ? null : branch.id,
        check_in_time: now,
        check_in_device_time: now,
        check_in_latitude: location.lat,
        check_in_longitude: location.lng,
        check_in_accuracy: location.accuracy || 0,
        status: "on_time",
        last_heartbeat_at: now,
        last_location_at: now,
        location_permission_state: "granted",
        checkout_reason: "MANUAL",
        resolved_timezone: resolvedTimezone,
        device_timezone: deviceTimezone,
        utc_check_in_time: now,
        local_check_in_time: localCheckInTime.toISOString(),
        timezone_mismatch: timezoneMismatch,
        late_minutes: lateMinutes,
        attendance_type: isFreeTask ? 'FREE' : 'NORMAL',
        location_check_type: isFreeTask ? 'FREE_TASK' : 'BRANCH',
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({
          ok: false,
          code: "DATABASE_ERROR",
          message_ar: "حدث خطأ أثناء تسجيل الحضور",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (timezoneMismatch && mismatchDifferenceMinutes >= 30) {
      const { data: settings } = await supabase
        .from("system_settings")
        .select("create_alert_on_timezone_mismatch, timezone_mismatch_threshold_minutes")
        .maybeSingle();

      const shouldCreateAlert = settings?.create_alert_on_timezone_mismatch !== false;
      const threshold = settings?.timezone_mismatch_threshold_minutes || 30;

      if (shouldCreateAlert && mismatchDifferenceMinutes >= threshold) {
        await supabase
          .from("timezone_alerts")
          .insert({
            employee_id: employee_id,
            attendance_log_id: attendanceLog.id,
            resolved_timezone: resolvedTimezone,
            device_timezone: deviceTimezone || "Unknown",
            gps_latitude: location.lat,
            gps_longitude: location.lng,
            time_difference_minutes: mismatchDifferenceMinutes,
            severity: mismatchDifferenceMinutes >= 120 ? "critical" : "warning",
          });

        await supabase
          .from("notifications")
          .insert({
            role: "admin",
            type: "fraud_alert",
            title: "تحذير: عدم تطابق المنطقة الزمنية",
            body: `الموظف ${employee.full_name} لديه اختلاف في المنطقة الزمنية بمقدار ${mismatchDifferenceMinutes} دقيقة`,
            data: {
              employee_id: employee_id,
              employee_name: employee.full_name,
              attendance_log_id: attendanceLog.id,
              time_difference_minutes: mismatchDifferenceMinutes,
            },
            priority: "high",
          });
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        data: attendanceLog,
        message_ar: "تم تسجيل الحضور بنجاح",
        timezone: resolvedTimezone,
        timezoneMismatch: timezoneMismatch,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Check-in error:", error);
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