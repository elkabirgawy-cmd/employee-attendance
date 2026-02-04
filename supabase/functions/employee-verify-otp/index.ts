import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { sanitizePhone } from "../_shared/phoneNormalization.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface VerifyOTPRequest {
  phone_number: string;
  otp_code: string;
  device_id: string;
}

function generateSessionToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
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

    const { phone_number, otp_code, device_id }: VerifyOTPRequest = await req.json();

    if (!phone_number || !otp_code || !device_id) {
      return new Response(
        JSON.stringify({ error: "Phone number, OTP code, and device ID are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const inputDigits = sanitizePhone(phone_number);

    console.log(`[DEBUG] OTP verification - Input phone (raw): ${JSON.stringify(phone_number)}`);
    console.log(`[DEBUG] Input digits: "${inputDigits}" (length: ${inputDigits.length})`);

    const { data: allEmployees, error: allEmployeesError } = await supabase
      .from("employees")
      .select("id, full_name, phone, employee_code, branch_id")
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

    for (const emp of (allEmployees || [])) {
      const isMatch = matchPhone(inputDigits, emp.phone);

      if (isMatch) {
        matchedEmployee = emp;
        const storedDigits = sanitizePhone(emp.phone);
        console.log(`[DEBUG] MATCH FOUND: ${emp.full_name}`);
        console.log(`[DEBUG] Stored phone (raw): ${JSON.stringify(emp.phone)}`);
        console.log(`[DEBUG] Stored digits: "${storedDigits}" (length: ${storedDigits.length})`);
        break;
      }
    }

    if (!matchedEmployee) {
      return new Response(
        JSON.stringify({
          error: "رقم الهاتف غير مسجل لدى الإدارة",
          error_en: "Phone number not registered"
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const employee = matchedEmployee;

    const { data: otpRecord, error: otpError } = await supabase
      .from("otp_logs")
      .select("id, otp_code, expires_at, is_verified")
      .eq("employee_id", employee.id)
      .eq("device_id", device_id)
      .eq("is_verified", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (otpError) {
      console.error("OTP query error:", otpError);
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

    if (!otpRecord) {
      return new Response(
        JSON.stringify({
          error: "لم يتم العثور على رمز تحقق صالح",
          error_en: "No valid OTP found"
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (new Date(otpRecord.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({
          error: "انتهت صلاحية رمز التحقق",
          error_en: "OTP has expired"
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (otpRecord.otp_code !== otp_code) {
      return new Response(
        JSON.stringify({
          error: "رمز التحقق غير صحيح",
          error_en: "Invalid OTP code"
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    try {
      await supabase
        .from("otp_logs")
        .update({
          is_verified: true,
          verified_at: new Date().toISOString(),
        })
        .eq("id", otpRecord.id);
    } catch (e) {
      console.error("OTP update error (non-critical):", e);
    }

    try {
      const { data: existingDevice } = await supabase
        .from("devices")
        .select("id")
        .eq("employee_id", employee.id)
        .eq("device_id", device_id)
        .maybeSingle();

      if (!existingDevice) {
        const { error: deviceError } = await supabase
          .from("devices")
          .insert({
            employee_id: employee.id,
            device_id: device_id,
            device_name: "Web Browser",
            os_type: "web",
            is_active: true,
            last_used_at: new Date().toISOString(),
          });

        if (deviceError) {
          console.error("Device insert error (non-critical):", deviceError);
        }
      } else {
        await supabase
          .from("devices")
          .update({
            last_used_at: new Date().toISOString(),
            is_active: true,
          })
          .eq("id", existingDevice.id);
      }
    } catch (e) {
      console.error("Device management error (non-critical):", e);
    }

    try {
      await supabase
        .from("employees")
        .update({
          bound_device_id: device_id,
          otp_verified_at: new Date().toISOString(),
          last_login_at: new Date().toISOString(),
        })
        .eq("id", employee.id);
    } catch (e) {
      console.error("Employee update error (non-critical):", e);
    }

    try {
      await supabase
        .from("employee_sessions")
        .update({ is_active: false })
        .eq("employee_id", employee.id)
        .eq("device_id", device_id)
        .eq("is_active", true);
    } catch (e) {
      console.error("Session deactivation error (non-critical):", e);
    }

    const sessionToken = generateSessionToken();

    try {
      const { error: sessionError } = await supabase
        .from("employee_sessions")
        .insert({
          employee_id: employee.id,
          device_id: device_id,
          session_token: sessionToken,
          is_active: true,
          expires_at: null,
        });

      if (sessionError) {
        console.error("Session creation error:", sessionError);
      }
    } catch (e) {
      console.error("Session exception (non-critical):", e);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Login successful",
        message_ar: "تم تسجيل الدخول بنجاح",
        session_token: sessionToken,
        employee: {
          id: employee.id,
          full_name: employee.full_name,
          employee_code: employee.employee_code,
          phone: employee.phone,
          branch_id: employee.branch_id,
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
