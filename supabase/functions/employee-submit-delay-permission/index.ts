import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface DelayPermissionPayload {
  date: string;
  start_time: string;
  end_time: string;
  minutes: number;
  reason: string;
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

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Validate session
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload: DelayPermissionPayload = await req.json();
    const { date, start_time, end_time, minutes, reason } = payload;

    if (!date || !start_time || !end_time || !minutes || !reason) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: date, start_time, end_time, minutes, reason' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 1: Resolve employee and company_id from auth session
    const { data: employee, error: employeeError } = await supabase
      .from('employees')
      .select('id, company_id, full_name, is_active')
      .eq('user_id', user.id)
      .single();

    if (employeeError || !employee) {
      return new Response(
        JSON.stringify({ error: 'Employee record not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!employee.is_active) {
      return new Response(
        JSON.stringify({ error: 'Employee account is not active' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Check for overlapping permissions
    const { data: overlappingPermissions } = await supabase
      .from('delay_permissions')
      .select('id')
      .eq('employee_id', employee.id)
      .eq('date', date)
      .in('status', ['pending', 'approved'])
      .or(`and(start_time.lte.${start_time},end_time.gt.${start_time}),and(start_time.lt.${end_time},end_time.gte.${end_time}),and(start_time.gte.${start_time},end_time.lte.${end_time})`);

    if (overlappingPermissions && overlappingPermissions.length > 0) {
      return new Response(
        JSON.stringify({ error: 'You have an overlapping delay permission for this time period' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 3: Insert with company isolation enforced
    const { data: newPermission, error: insertError } = await supabase
      .from('delay_permissions')
      .insert({
        employee_id: employee.id,
        company_id: employee.company_id, // Company ID from employee record
        date: date,
        start_time: start_time,
        end_time: end_time,
        minutes: minutes,
        reason: reason,
        status: 'pending',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to create delay permission', details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 4: Create notification for admin
    const { error: notificationError } = await supabase
      .from('notifications')
      .insert({
        company_id: employee.company_id,
        title: 'طلب إذن تأخير جديد',
        message: `${employee.full_name} قدم طلب إذن تأخير لمدة ${minutes} دقيقة`,
        type: 'delay_permission',
        priority: 'normal',
        target_user_type: 'admin',
      });

    if (notificationError) {
      console.warn('Failed to create notification:', notificationError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        delay_permission: newPermission,
        message: 'Delay permission submitted successfully'
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
