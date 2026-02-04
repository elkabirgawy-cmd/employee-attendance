import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { sanitizePhone } from "../_shared/phoneNormalization.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface InstantLoginRequest {
  phone_number: string;
  device_id: string;
}

function generateSessionToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

function matchPhone(inputDigits: string, storedPhone: string): boolean {
  const storedDigits = sanitizePhone(storedPhone);
  if (inputDigits === storedDigits) return true;
  if (inputDigits.length === 11 && storedDigits.endsWith(inputDigits)) return true;
  if (storedDigits.length === 11 && inputDigits.endsWith(storedDigits)) return true;
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

    const { phone_number, device_id }: InstantLoginRequest = await req.json();

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
    console.log(`[DEBUG] Login - Input phone: ${phone_number}, digits: ${inputDigits}`);

    const { data: allEmployees, error: employeeError } = await supabase
      .from("employees")
      .select("id, full_name, phone, employee_code, branch_id, avatar_url, company_id")
      .eq("is_active", true);

    if (employeeError) {
      console.error("Error fetching employees:", employeeError);
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

    let employee = null;
    for (const emp of (allEmployees || [])) {
      if (matchPhone(inputDigits, emp.phone)) {
        employee = emp;
        break;
      }
    }

    if (!employee) {
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

    const { data: deviceRecord, error: deviceError } = await supabase
      .from("devices")
      .select("id, is_active")
      .eq("employee_id", employee.id)
      .eq("device_id", device_id)
      .eq("is_active", true)
      .maybeSingle();

    if (deviceError) {
      console.error("Error checking device:", deviceError);
    }

    if (!deviceRecord) {
      return new Response(
        JSON.stringify({
          error: "device_not_trusted",
          message: "This device is not trusted. Please activate it first.",
          message_ar: "هذا الجهاز غير موثوق. يرجى تفعيله أولاً.",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    try {
      const { data: existingDevice } = await supabase
        .from("devices")
        .select("id")
        .eq("employee_id", employee.id)
        .eq("device_id", device_id)
        .maybeSingle();

      if (existingDevice) {
        await supabase
          .from("devices")
          .update({
            last_used_at: new Date().toISOString(),
            is_active: true,
          })
          .eq("id", existingDevice.id);
      }
    } catch (e) {
      console.error("Device update error (non-critical):", e);
    }

    try {
      await supabase
        .from("employees")
        .update({
          last_login_at: new Date().toISOString(),
        })
        .eq("id", employee.id);
    } catch (e) {
      console.error("Update last_login error (non-critical):", e);
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
          avatar_url: employee.avatar_url,
          company_id: employee.company_id,
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
