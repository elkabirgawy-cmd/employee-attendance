import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { sanitizePhone, normalizeEgyptPhone } from "../_shared/phoneNormalization.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SendOTPRequest {
  phone_number: string;
  device_id: string;
}

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function matchPhone(inputDigits: string, storedPhone: string): boolean {
  const storedDigits = sanitizePhone(storedPhone);

  if (inputDigits === storedDigits) {
    return true;
  }

  if (inputDigits.length === 11 && storedDigits.endsWith(inputDigits)) {
    return true;
  }

  if (storedDigits.length === 11 && inputDigits.endsWith(storedDigits)) {
    return true;
  }

  return false;
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
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { phone_number, device_id }: SendOTPRequest = await req.json();

    if (!phone_number || !device_id) {
      return new Response(
        JSON.stringify({ error: "Phone number and device ID are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const inputDigits = sanitizePhone(phone_number);

    console.log(`[DEBUG] Input phone (raw): ${JSON.stringify(phone_number)}`);
    console.log(`[DEBUG] Input digits: "${inputDigits}" (length: ${inputDigits.length})`);
    console.log(`[DEBUG] Input last 11 digits: "${inputDigits.slice(-11)}"`);

    const { data: allEmployees, error: allEmployeesError } = await supabase
      .from("employees")
      .select("id, full_name, phone, branch_id, bound_device_id, otp_verified_at")
      .eq("is_active", true);

    if (allEmployeesError) {
      console.error("Error fetching employees:", allEmployeesError);
      return new Response(
        JSON.stringify({
          error: "حدث خطأ مؤقت، حاول مرة أخرى",
          error_en: "Temporary error, please try again"
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let matchedEmployee = null;
    const debugMatches = [];

    for (const emp of (allEmployees || [])) {
      const storedDigits = sanitizePhone(emp.phone);
      const isMatch = matchPhone(inputDigits, emp.phone);

      const debugEntry = {
        employee_name: emp.full_name,
        stored_phone_raw: JSON.stringify(emp.phone),
        stored_digits: storedDigits,
        stored_length: storedDigits.length,
        stored_last_11: storedDigits.slice(-11),
        is_match: isMatch,
      };

      debugMatches.push(debugEntry);

      if (isMatch && !matchedEmployee) {
        matchedEmployee = emp;
        console.log(`[DEBUG] MATCH FOUND: ${emp.full_name}`);
        console.log(`[DEBUG] Stored phone (raw): ${JSON.stringify(emp.phone)}`);
        console.log(`[DEBUG] Stored digits: "${storedDigits}" (length: ${storedDigits.length})`);
        console.log(`[DEBUG] Stored last 11 digits: "${storedDigits.slice(-11)}"`);
      }
    }

    const debugInfo = {
      input_phone_raw: JSON.stringify(phone_number),
      input_digits: inputDigits,
      input_length: inputDigits.length,
      input_last_11: inputDigits.slice(-11),
      employees_checked: allEmployees?.length || 0,
      match_found: !!matchedEmployee,
      all_comparisons: debugMatches.slice(0, 10),
    };

    if (!matchedEmployee) {
      console.log(`[DEBUG] No match found for input digits: ${inputDigits}`);

      return new Response(
        JSON.stringify({
          error: "رقم الهاتف غير مسجل لدى الإدارة",
          error_en: "Phone number not registered with management",
          debug_info: debugInfo,
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const employee = matchedEmployee;

    if (!employee.branch_id) {
      return new Response(
        JSON.stringify({
          error: "حدث خطأ في بيانات الموظف",
          error_en: "Employee data error",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const isSameDevice = employee.bound_device_id === device_id;
    const isDifferentDevice = employee.bound_device_id && employee.bound_device_id !== device_id;

    if (isDifferentDevice) {
      try {
        const { error: upsertError } = await supabase
          .from("device_change_requests")
          .upsert({
            employee_id: employee.id,
            old_device_id: employee.bound_device_id,
            new_device_id: device_id,
            status: "pending",
            requested_at: new Date().toISOString(),
          }, {
            onConflict: "employee_id,new_device_id",
            ignoreDuplicates: false,
          });

        if (upsertError) {
          console.error("Device change request upsert error:", upsertError);
        }
      } catch (e) {
        console.error("Device change request exception:", e);
      }

      return new Response(
        JSON.stringify({
          error: "device_not_authorized",
          message: "This device is not authorized. Please contact your administrator.",
          message_ar: "هذا الجهاز غير مصرح. يرجى الاتصال بالإدارة.",
          requires_approval: true,
          debug_info: {
            ...debugInfo,
            matched_employee: employee.full_name,
            device_status: "different_device_pending_approval",
          },
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (isSameDevice) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Device recognized. Proceed with instant login.",
          message_ar: "تم التعرف على الجهاز. تسجيل دخول فوري.",
          requires_otp: false,
          employee_id: employee.id,
          debug_info: {
            ...debugInfo,
            matched_employee: employee.full_name,
            device_status: "same_device_instant_login",
          },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const otpCode = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    const normalizedPhone = normalizeEgyptPhone(phone_number);

    try {
      const { error: otpError } = await supabase.from("otp_logs").insert({
        employee_id: employee.id,
        phone_or_email: normalizedPhone,
        otp_code: otpCode,
        otp_type: "login",
        delivery_method: "in_app",
        device_id: device_id,
        expires_at: expiresAt.toISOString(),
        is_verified: false,
      });

      if (otpError) {
        console.error("OTP insert error:", otpError);
        return new Response(
          JSON.stringify({
            error: "حدث خطأ مؤقت، حاول مرة أخرى",
            error_en: "Temporary error, please try again"
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    } catch (e) {
      console.error("OTP exception:", e);
      return new Response(
        JSON.stringify({
          error: "حدث خطأ مؤقت، حاول مرة أخرى",
          error_en: "Temporary error, please try again"
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`OTP for ${normalizedPhone}: ${otpCode}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "OTP sent successfully",
        message_ar: "تم إرسال رمز التحقق بنجاح",
        requires_otp: true,
        employee_id: employee.id,
        dev_otp: otpCode,
        debug_info: {
          ...debugInfo,
          matched_employee: employee.full_name,
          device_status: "first_time_login_otp_required",
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        error: "حدث خطأ مؤقت، حاول مرة أخرى",
        error_en: "Temporary error, please try again"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
