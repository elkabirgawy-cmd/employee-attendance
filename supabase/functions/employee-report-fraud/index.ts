import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface FraudReportPayload {
  alert_type: string;
  description: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, any>;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }

    // This function is called from employee check-in screen
    // It may be called with or without auth (e.g., mock location detection before login)
    const authHeader = req.headers.get('Authorization');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: FraudReportPayload = await req.json();
    const { alert_type, description, severity = 'high', metadata = {} } = payload;

    if (!alert_type || !description) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: alert_type, description' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let employeeId: string | null = null;
    let companyId: string | null = null;
    let deviceId: string | null = null;

    // Try to resolve employee and company from auth (if available)
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');

      // Check if it's a valid employee session
      const { data: sessionData } = await supabase
        .from('employee_sessions')
        .select('employee_id, device_id')
        .eq('session_token', token)
        .eq('is_active', true)
        .maybeSingle();

      if (sessionData) {
        employeeId = sessionData.employee_id;
        deviceId = sessionData.device_id;

        // Get company_id from employee record
        const { data: employee } = await supabase
          .from('employees')
          .select('company_id')
          .eq('id', employeeId)
          .single();

        if (employee) {
          companyId = employee.company_id;
        }
      }
    }

    // If we couldn't resolve from session, try from metadata
    if (!employeeId && metadata.employee_id) {
      employeeId = metadata.employee_id;

      // Resolve company_id from employee
      const { data: employee } = await supabase
        .from('employees')
        .select('company_id')
        .eq('id', employeeId)
        .maybeSingle();

      if (employee) {
        companyId = employee.company_id;
      }
    }

    // Insert fraud alert with resolved company_id
    const { data: fraudAlert, error: insertError } = await supabase
      .from('fraud_alerts')
      .insert({
        employee_id: employeeId,
        device_id: deviceId,
        company_id: companyId,
        alert_type: alert_type,
        severity: severity,
        description: description,
        metadata: metadata,
        is_resolved: false,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to create fraud alert', details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[FRAUD-ALERT] Created:', {
      id: fraudAlert.id,
      type: alert_type,
      employee_id: employeeId,
      company_id: companyId
    });

    return new Response(
      JSON.stringify({
        success: true,
        fraud_alert: fraudAlert,
        message: 'Fraud alert logged successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
