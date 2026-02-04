import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RequestBody {
  adminEmail: string;
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

    const { adminEmail }: RequestBody = await req.json();

    if (!adminEmail || !adminEmail.trim()) {
      // Return generic success message for security
      return new Response(
        JSON.stringify({
          success: true,
          message: "إذا كان هذا البريد مسجلاً، ستتلقى رابط إعادة تعيين كلمة المرور."
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const emailLower = adminEmail.toLowerCase().trim();

    // Check if email exists in admin_users table
    const { data: adminUser, error: adminError } = await supabase
      .from("admin_users")
      .select("id, email")
      .eq("email", emailLower)
      .maybeSingle();

    if (adminError) {
      console.error("Error checking admin user:", adminError);
      // Return generic success message for security
      return new Response(
        JSON.stringify({
          success: true,
          message: "إذا كان هذا البريد مسجلاً، ستتلقى رابط إعادة تعيين كلمة المرور."
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // If email doesn't exist in admin_users, still return success for security
    if (!adminUser) {
      console.log(`Password reset attempted for non-existent admin: ${emailLower}`);
      return new Response(
        JSON.stringify({
          success: true,
          message: "إذا كان هذا البريد مسجلاً، ستتلقى رابط إعادة تعيين كلمة المرور."
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Admin user exists, send password reset email using Supabase Auth
    try {
      // Get the app URL from request origin or default
      const origin = req.headers.get('origin') || supabaseUrl.replace(/https?:\/\/[^/]+/, '');
      const resetUrl = origin.includes('localhost') || origin.includes('127.0.0.1')
        ? `${origin}/reset-password`
        : `${origin}/reset-password`;

      const { data, error: resetError } = await supabase.auth.admin.generateLink({
        type: 'recovery',
        email: emailLower,
        options: {
          redirectTo: resetUrl
        }
      });

      if (resetError) {
        console.error("Error generating reset link:", resetError);
        // Still return success message for security
        return new Response(
          JSON.stringify({
            success: true,
            message: "إذا كان هذا البريد مسجلاً، ستتلقى رابط إعادة تعيين كلمة المرور."
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      console.log(`Password reset link generated for admin: ${emailLower}`);

      // Log the recovery request
      await supabase
        .from("password_recovery_requests")
        .insert({
          admin_email: emailLower,
          admin_name: adminUser.email,
          requested_at: new Date().toISOString(),
          status: "pending"
        });

      // Return generic success message
      return new Response(
        JSON.stringify({
          success: true,
          message: "إذا كان هذا البريد مسجلاً، ستتلقى رابط إعادة تعيين كلمة المرور."
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } catch (resetErr) {
      console.error("Error in password reset:", resetErr);
      // Return generic success message for security
      return new Response(
        JSON.stringify({
          success: true,
          message: "إذا كان هذا البريد مسجلاً، ستتلقى رابط إعادة تعيين كلمة المرور."
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  } catch (error) {
    console.error("Error in admin-forgot-password:", error);
    // Return generic success message for security
    return new Response(
      JSON.stringify({
        success: true,
        message: "إذا كان هذا البريد مسجلاً، ستتلقى رابط إعادة تعيين كلمة المرور."
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
