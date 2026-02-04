import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { sanitizePhone } from "../_shared/phoneNormalization.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ActivateRequest {
  phone_number: string;
  activation_code: string;
  device_id: string;
}

const DEV_MODE = Deno.env.get("DEV_MODE") === "true";
const DEV_ACTIVATION_CODES = ['123456', '000000'];
const DEBUG_LOGGING = true;

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

    const { phone_number, activation_code, device_id }: ActivateRequest = await req.json();

    if (!phone_number || !activation_code || !device_id) {
      return new Response(
        JSON.stringify({ error: "رقم الهاتف وكود التفعيل ومعرف الجهاز مطلوبة" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const inputDigits = sanitizePhone(phone_number);
    const normalizedCode = activation_code.trim().replace(/\s+/g, '');

    if (DEBUG_LOGGING) {
      console.log(`[DEBUG] Activation request`);
      console.log(`[DEBUG] Input phone: ${phone_number}, digits: ${inputDigits}`);
      console.log(`[DEBUG] Activation code input: ${activation_code}, normalized: ${normalizedCode}`);
      console.log(`[DEBUG] Device ID: ${device_id}`);
      console.log(`[DEBUG] DEV_MODE: ${DEV_MODE}`);
    }

    const { data: allEmployees, error: employeeError } = await supabase
      .from("employees")
      .select("id, full_name, phone, employee_code, branch_id, avatar_url")
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
      if (DEBUG_LOGGING) {
        console.log(`[DEBUG] No employee found matching phone: ${inputDigits}`);
      }
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

    if (DEBUG_LOGGING) {
      console.log(`[DEBUG] Employee found: ${employee.id} - ${employee.full_name}`);
    }

    let codeIsValid = false;
    let activationCodeRecord = null;

    if (DEV_MODE && DEV_ACTIVATION_CODES.includes(normalizedCode)) {
      if (DEBUG_LOGGING) {
        console.log(`[DEBUG] DEV_MODE: Accepting test code ${normalizedCode}`);
      }
      codeIsValid = true;
    } else {
      const { data: codeData, error: codeError } = await supabase
        .from("activation_codes")
        .select("*")
        .eq("employee_id", employee.id)
        .eq("activation_code", normalizedCode)
        .is("used_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (DEBUG_LOGGING) {
        console.log(`[DEBUG] Database query for activation code:`);
        console.log(`[DEBUG] employee_id: ${employee.id}`);
        console.log(`[DEBUG] activation_code: ${normalizedCode}`);
        console.log(`[DEBUG] Query result:`, codeData);
        console.log(`[DEBUG] Query error:`, codeError);
      }

      if (codeError) {
        console.error("Error querying activation code:", codeError);
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

      if (!codeData) {
        const { data: expiredOrUsedCode } = await supabase
          .from("activation_codes")
          .select("id, expires_at, used_at")
          .eq("employee_id", employee.id)
          .eq("activation_code", normalizedCode)
          .maybeSingle();

        if (DEBUG_LOGGING) {
          console.log(`[DEBUG] Checking for expired/used code:`, expiredOrUsedCode);
        }

        if (expiredOrUsedCode) {
          if (expiredOrUsedCode.used_at) {
            return new Response(
              JSON.stringify({
                error: "هذا الكود تم استخدامه من قبل",
                error_en: "This code has already been used"
              }),
              {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            );
          } else if (new Date(expiredOrUsedCode.expires_at) < new Date()) {
            return new Response(
              JSON.stringify({
                error: "انتهت صلاحية الكود",
                error_en: "Activation code has expired"
              }),
              {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            );
          }
        }

        return new Response(
          JSON.stringify({
            error: "الكود غير صحيح",
            error_en: "Invalid activation code"
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      codeIsValid = true;
      activationCodeRecord = codeData;

      const { error: markUsedError } = await supabase
        .from("activation_codes")
        .update({
          is_used: true,
          used_at: new Date().toISOString(),
          device_id_used: device_id,
        })
        .eq("id", activationCodeRecord.id);

      if (markUsedError) {
        console.error("Error marking activation code as used:", markUsedError);
      } else if (DEBUG_LOGGING) {
        console.log(`[DEBUG] Activation code marked as used: ${activationCodeRecord.id}`);
      }
    }

    if (!codeIsValid) {
      return new Response(
        JSON.stringify({
          error: "الكود غير صحيح",
          error_en: "Invalid activation code"
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }


    const { error: upsertError } = await supabase
      .from("devices")
      .upsert({
        employee_id: employee.id,
        device_id: device_id,
        device_name: "Web Browser",
        os_type: "web",
        is_active: true,
        last_used_at: new Date().toISOString(),
      }, {
        onConflict: "device_id",
        ignoreDuplicates: false,
      });

    if (upsertError) {
      console.error("Device upsert error:", upsertError);
      return new Response(
        JSON.stringify({
          error: "حدث خطأ أثناء تفعيل الجهاز",
          error_en: "Error activating device"
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    try {
      await supabase
        .from("employees")
        .update({
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
        message: "Device activated successfully",
        message_ar: "تم تفعيل جهازك بنجاح",
        session_token: sessionToken,
        employee: {
          id: employee.id,
          full_name: employee.full_name,
          employee_code: employee.employee_code,
          phone: employee.phone,
          branch_id: employee.branch_id,
          avatar_url: employee.avatar_url,
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