import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface PendingRecord {
  id: string;
  employee_id: string;
  attendance_log_id: string;
  reason: 'GPS_BLOCKED' | 'OUTSIDE_BRANCH';
  ends_at: string;
}

interface HeartbeatRecord {
  employee_id: string;
  attendance_log_id: string;
  last_seen_at: string;
  in_branch: boolean;
  gps_ok: boolean;
  reason: string | null;
}

interface AttendanceLog {
  id: string;
  employee_id: string;
  check_in_time: string;
  check_out_time: string | null;
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
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[PROCESS_AUTO_CHECKOUT] Starting scheduled job');

    // Get all pending records where ends_at <= now()
    const now = new Date();
    const { data: pendingRecords, error: pendingError } = await supabase
      .from('auto_checkout_pending')
      .select('*')
      .eq('status', 'PENDING')
      .lte('ends_at', now.toISOString())
      .returns<PendingRecord[]>();

    if (pendingError) {
      console.error('[PENDING_QUERY_ERROR]', pendingError);
      throw pendingError;
    }

    if (!pendingRecords || pendingRecords.length === 0) {
      console.log('[NO_PENDING_RECORDS]');
      return new Response(
        JSON.stringify({
          ok: true,
          message: 'No pending auto checkouts to process',
          processed: 0
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[FOUND_PENDING] ${pendingRecords.length} records to process`);

    const results = {
      processed: 0,
      executed: 0,
      cancelled: 0,
      errors: 0
    };

    for (const pending of pendingRecords) {
      try {
        console.log(`[PROCESSING] ${pending.id} - employee ${pending.employee_id}`);

        // Step 1: Verify attendance log is still checked in
        const { data: attendanceLog, error: logError } = await supabase
          .from('attendance_logs')
          .select('id, employee_id, check_in_time, check_out_time')
          .eq('id', pending.attendance_log_id)
          .maybeSingle();

        if (logError) {
          console.error(`[LOG_QUERY_ERROR] ${pending.id}`, logError);
          results.errors++;
          continue;
        }

        if (!attendanceLog) {
          console.log(`[LOG_NOT_FOUND] ${pending.id} - attendance log deleted`);
          // Mark as cancelled since log doesn't exist
          await supabase
            .from('auto_checkout_pending')
            .update({
              status: 'CANCELLED',
              cancelled_at: new Date().toISOString(),
              cancel_reason: 'LOG_NOT_FOUND'
            })
            .eq('id', pending.id);
          results.cancelled++;
          continue;
        }

        if (attendanceLog.check_out_time) {
          console.log(`[ALREADY_CHECKED_OUT] ${pending.id} - already checked out at ${attendanceLog.check_out_time}`);
          // Mark as done since already checked out
          await supabase
            .from('auto_checkout_pending')
            .update({
              status: 'DONE',
              done_at: new Date().toISOString()
            })
            .eq('id', pending.id);
          results.executed++;
          continue;
        }

        // Step 2: Final Gate - check heartbeat
        const { data: heartbeat, error: heartbeatError } = await supabase
          .from('employee_location_heartbeat')
          .select('*')
          .eq('employee_id', pending.employee_id)
          .eq('attendance_log_id', pending.attendance_log_id)
          .maybeSingle();

        if (heartbeatError) {
          console.error(`[HEARTBEAT_QUERY_ERROR] ${pending.id}`, heartbeatError);
          results.errors++;
          continue;
        }

        // Calculate time threshold: ends_at - 2 minutes
        const endsAtTime = new Date(pending.ends_at).getTime();
        const twoMinutesBeforeEnds = endsAtTime - (2 * 60 * 1000);

        if (heartbeat) {
          const lastSeenTime = new Date(heartbeat.last_seen_at).getTime();

          // Check if recovered: gps_ok AND in_branch AND recent heartbeat
          if (heartbeat.gps_ok && heartbeat.in_branch && lastSeenTime >= twoMinutesBeforeEnds) {
            console.log(`[RECOVERED_BEFORE_EXEC] ${pending.id} - GPS OK and in branch, cancelling`);

            await supabase
              .from('auto_checkout_pending')
              .update({
                status: 'CANCELLED',
                cancelled_at: new Date().toISOString(),
                cancel_reason: 'RECOVERED_BEFORE_EXEC'
              })
              .eq('id', pending.id)
              .eq('status', 'PENDING');

            results.cancelled++;
            continue;
          }
        }

        // Step 3: Execute auto checkout
        console.log(`[EXECUTING_CHECKOUT] ${pending.id}`);

        const checkoutReason = pending.reason === 'GPS_BLOCKED' ? 'LOCATION_DISABLED' : 'OUT_OF_BRANCH';

        // Update attendance log
        const { error: updateError } = await supabase
          .from('attendance_logs')
          .update({
            check_out_time: new Date().toISOString(),
            checkout_type: 'AUTO',
            checkout_reason: checkoutReason
          })
          .eq('id', pending.attendance_log_id)
          .is('check_out_time', null);

        if (updateError) {
          console.error(`[CHECKOUT_UPDATE_ERROR] ${pending.id}`, updateError);
          results.errors++;
          continue;
        }

        // Mark pending as done
        await supabase
          .from('auto_checkout_pending')
          .update({
            status: 'DONE',
            done_at: new Date().toISOString()
          })
          .eq('id', pending.id)
          .eq('status', 'PENDING');

        console.log(`[CHECKOUT_EXECUTED] ${pending.id} - reason: ${checkoutReason}`);
        results.executed++;
        results.processed++;

      } catch (err) {
        console.error(`[PROCESS_ERROR] ${pending.id}`, err);
        results.errors++;
      }
    }

    console.log('[JOB_COMPLETE]', results);

    return new Response(
      JSON.stringify({
        ok: true,
        message: 'Auto checkout processing complete',
        results
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (err: any) {
    console.error('[PROCESS_AUTO_CHECKOUT_ERROR]', err);
    return new Response(
      JSON.stringify({
        ok: false,
        message: err?.message || 'Server error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
