import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface LeaveRequestPayload {
  leave_type_id: string;
  start_date: string;
  end_date: string;
  reason?: string;
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

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload: LeaveRequestPayload = await req.json();
    const { leave_type_id, start_date, end_date, reason } = payload;

    if (!leave_type_id || !start_date || !end_date) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: leave_type_id, start_date, end_date' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: employee, error: employeeError } = await supabase
      .from('employees')
      .select('id, company_id, first_name, last_name')
      .eq('user_id', user.id)
      .single();

    if (employeeError || !employee) {
      return new Response(
        JSON.stringify({ error: 'Employee record not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: leaveType, error: leaveTypeError } = await supabase
      .from('leave_types')
      .select('id, name, company_id')
      .eq('id', leave_type_id)
      .eq('company_id', employee.company_id)
      .single();

    if (leaveTypeError || !leaveType) {
      return new Response(
        JSON.stringify({ error: 'Leave type not found or does not belong to your company' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const start = new Date(start_date);
    const end = new Date(end_date);
    if (start > end) {
      return new Response(
        JSON.stringify({ error: 'Start date must be before or equal to end date' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const { data: leaveBalance, error: balanceError } = await supabase
      .from('leave_balances')
      .select('available_days')
      .eq('employee_id', employee.id)
      .eq('leave_type_id', leave_type_id)
      .eq('company_id', employee.company_id)
      .single();

    if (balanceError || !leaveBalance) {
      return new Response(
        JSON.stringify({ error: 'Leave balance not found for this leave type' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (leaveBalance.available_days < days) {
      return new Response(
        JSON.stringify({
          error: `Insufficient leave balance. You have ${leaveBalance.available_days} days available, but requested ${days} days.`
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: newRequest, error: insertError } = await supabase
      .from('leave_requests')
      .insert({
        employee_id: employee.id,
        company_id: employee.company_id,
        leave_type_id: leave_type_id,
        start_date: start_date,
        end_date: end_date,
        reason: reason || null,
        status: 'pending',
        days: days,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to create leave request', details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { error: notificationError } = await supabase
      .from('notifications')
      .insert({
        company_id: employee.company_id,
        title: 'New Leave Request',
        message: `${employee.first_name} ${employee.last_name} has submitted a leave request for ${days} day(s)`,
        type: 'leave_request',
        priority: 'normal',
        target_user_type: 'admin',
      });

    if (notificationError) {
      console.warn('Failed to create notification:', notificationError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        leave_request: newRequest,
        message: 'Leave request submitted successfully'
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
