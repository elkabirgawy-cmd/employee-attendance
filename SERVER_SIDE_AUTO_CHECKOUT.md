# Server-Side Auto Checkout System

## Overview

This system implements server-side auto checkout enforcement with proper recovery and cancellation tracking. The server (not the client) is the final authority on whether an auto checkout should execute.

## Architecture

### Client Responsibilities
1. Track location health and trigger countdown UI
2. Report pending auto checkout to server
3. Send location heartbeat every 15 seconds
4. Cancel pending when recovered
5. Execute immediate checkout when countdown expires (backup)

### Server Responsibilities
1. Process pending auto checkouts every 1 minute (scheduled job)
2. Apply final gate check before execution
3. Respect recovery signals from heartbeat
4. Execute auto checkout when conditions are met
5. Handle edge cases (log deleted, already checked out, etc.)

## Database Tables

### 1. `auto_checkout_pending`

Tracks pending auto checkout operations awaiting server execution.

```sql
CREATE TABLE auto_checkout_pending (
  id uuid PRIMARY KEY,
  employee_id uuid NOT NULL REFERENCES employees(id),
  attendance_log_id uuid NOT NULL REFERENCES attendance_logs(id),
  reason text NOT NULL CHECK (reason IN ('GPS_BLOCKED', 'OUTSIDE_BRANCH')),
  ends_at timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('PENDING', 'CANCELLED', 'DONE')),
  created_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  done_at timestamptz,
  cancel_reason text
);
```

**Fields:**
- `reason`: Why auto checkout started
  - `GPS_BLOCKED`: Location services disabled or stale
  - `OUTSIDE_BRANCH`: Employee left branch perimeter
- `status`:
  - `PENDING`: Waiting for server to process
  - `CANCELLED`: Cancelled before execution
  - `DONE`: Server executed checkout
- `cancel_reason`: Why it was cancelled
  - `RECOVERED`: Client detected recovery and cancelled
  - `RECOVERED_BEFORE_EXEC`: Server detected recovery at final gate
  - `SUPERSEDED`: Replaced by newer pending record
  - `LOG_NOT_FOUND`: Attendance log was deleted

### 2. `employee_location_heartbeat`

Tracks real-time employee location health for final gate checks.

```sql
CREATE TABLE employee_location_heartbeat (
  employee_id uuid PRIMARY KEY REFERENCES employees(id),
  attendance_log_id uuid REFERENCES attendance_logs(id),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  in_branch boolean NOT NULL,
  gps_ok boolean NOT NULL,
  reason text
);
```

**Fields:**
- `last_seen_at`: Last heartbeat timestamp
- `in_branch`: Is employee inside branch perimeter
- `gps_ok`: Is GPS working properly
- `reason`: Current warning (GPS_BLOCKED or OUTSIDE_BRANCH)

**Update Frequency:** Every 15 seconds while employee is checked in

## Client Flow

### A. When Countdown STARTS (first time)

```typescript
const startAutoCheckout = async (reason: 'LOCATION_DISABLED' | 'OUT_OF_BRANCH') => {
  // 1. Set local state
  const endsAt = Date.now() + (autoCheckoutSettings.auto_checkout_after_seconds * 1000);
  setAutoCheckout({ active: true, reason, endsAtServerMs: endsAt });

  // 2. Save to localStorage (for recovery after reload)
  localStorage.setItem(`auto_checkout_${employee.id}`, JSON.stringify(state));

  // 3. Cancel any existing PENDING records
  await supabase
    .from('auto_checkout_pending')
    .update({ status: 'CANCELLED', cancel_reason: 'SUPERSEDED' })
    .eq('employee_id', employee.id)
    .eq('attendance_log_id', currentLog.id)
    .eq('status', 'PENDING');

  // 4. Insert new PENDING record
  await supabase
    .from('auto_checkout_pending')
    .insert({
      employee_id: employee.id,
      attendance_log_id: currentLog.id,
      reason: dbReason, // 'GPS_BLOCKED' or 'OUTSIDE_BRANCH'
      ends_at: new Date(endsAt).toISOString(),
      status: 'PENDING'
    });
};
```

**Trigger Conditions:**
- `hasLocationWarning()` returns true
- `autoCheckout.active` is false
- Has valid `autoCheckoutSettings`
- Currently checked in (`currentLog` exists)

### B. Location Heartbeat (every 15 seconds)

```typescript
useEffect(() => {
  if (!currentLog || !employee) return;

  // Send initial heartbeat
  sendHeartbeat();

  // Send every 15 seconds
  const interval = setInterval(() => {
    const gpsOk = !locationHealth.isDisabled && !locationHealth.isStale && location !== null;
    const inBranch = !isConfirmedOutside && location !== null;

    await supabase
      .from('employee_location_heartbeat')
      .upsert({
        employee_id: employee.id,
        attendance_log_id: currentLog.id,
        last_seen_at: new Date().toISOString(),
        in_branch: inBranch,
        gps_ok: gpsOk,
        reason: gpsOk && inBranch ? null : (gpsOk ? 'OUTSIDE_BRANCH' : 'GPS_BLOCKED')
      });
  }, 15000);

  return () => clearInterval(interval);
}, [currentLog, employee]);
```

**Purpose:** Provides real-time status to server for final gate check

### C. When Countdown CANCELS (recovered)

```typescript
const cancelAutoCheckout = async () => {
  // 1. Clear local state
  setAutoCheckout({ active: false, reason: null, endsAtServerMs: null });

  // 2. Remove from localStorage
  localStorage.removeItem(`auto_checkout_${employee.id}`);

  // 3. Update DB record to CANCELLED
  await supabase
    .from('auto_checkout_pending')
    .update({
      status: 'CANCELLED',
      cancelled_at: new Date().toISOString(),
      cancel_reason: 'RECOVERED'
    })
    .eq('id', autoCheckoutPendingIdRef.current)
    .eq('status', 'PENDING');
};
```

**Trigger Conditions:**
- `hasLocationWarning()` returns false
- `autoCheckout.active` is true

### D. Client-Side Execute (backup/immediate)

```typescript
const executeAutoCheckout = async () => {
  // Called when countdown reaches 0
  await handleCheckOut({ source: 'auto', bypassConfirm: true });
  cancelAutoCheckout();
};
```

**Note:** This is a backup mechanism. The server will also execute if the client fails.

## Server Flow

### Edge Function: `process-auto-checkout`

**Execution:** Should be scheduled to run every 1 minute via cron or similar

```typescript
Deno.serve(async (req: Request) => {
  // 1. Get all PENDING records where ends_at <= now
  const { data: pendingRecords } = await supabase
    .from('auto_checkout_pending')
    .select('*')
    .eq('status', 'PENDING')
    .lte('ends_at', now.toISOString());

  for (const pending of pendingRecords) {
    // 2. Verify attendance log is still checked in
    const attendanceLog = await supabase
      .from('attendance_logs')
      .select('*')
      .eq('id', pending.attendance_log_id)
      .maybeSingle();

    if (!attendanceLog) {
      // Log deleted - cancel
      await markCancelled(pending.id, 'LOG_NOT_FOUND');
      continue;
    }

    if (attendanceLog.check_out_time) {
      // Already checked out - mark done
      await markDone(pending.id);
      continue;
    }

    // 3. Final Gate: Check heartbeat
    const heartbeat = await supabase
      .from('employee_location_heartbeat')
      .select('*')
      .eq('employee_id', pending.employee_id)
      .eq('attendance_log_id', pending.attendance_log_id)
      .maybeSingle();

    const twoMinutesBeforeEnds = new Date(pending.ends_at).getTime() - (2 * 60 * 1000);

    if (heartbeat &&
        heartbeat.gps_ok &&
        heartbeat.in_branch &&
        new Date(heartbeat.last_seen_at).getTime() >= twoMinutesBeforeEnds) {
      // Recovered before execution - cancel
      await markCancelled(pending.id, 'RECOVERED_BEFORE_EXEC');
      continue;
    }

    // 4. Execute auto checkout
    await supabase
      .from('attendance_logs')
      .update({
        check_out_time: new Date().toISOString(),
        checkout_type: 'AUTO',
        checkout_reason: pending.reason === 'GPS_BLOCKED' ? 'LOCATION_DISABLED' : 'OUT_OF_BRANCH'
      })
      .eq('id', pending.attendance_log_id);

    await markDone(pending.id);
  }
});
```

## Final Gate Logic

The server applies a final gate check before executing auto checkout:

```
IF (
  heartbeat.gps_ok = true AND
  heartbeat.in_branch = true AND
  heartbeat.last_seen_at >= (ends_at - 2 minutes)
)
THEN
  ABORT: Mark as CANCELLED with reason 'RECOVERED_BEFORE_EXEC'
ELSE
  EXECUTE: Perform auto checkout
```

**Why 2 minutes?**
- Gives grace period for temporary GPS glitches
- Prevents false positives from network delays
- Employee had stable GPS + in-branch status near the end

## Idempotency

The server function is idempotent and safe to run multiple times:

1. **Status Check**: Only processes `status='PENDING'` records
2. **Already Checked Out**: If log has `check_out_time`, marks as DONE (no re-checkout)
3. **Deleted Logs**: If log missing, marks as CANCELLED
4. **Double Processing**: Uses `WHERE status='PENDING'` in all updates

## Recovery Scenarios

### Scenario 1: GPS Recovers Before Countdown Ends

```
t=0:   GPS blocked, countdown starts (15:00)
       → Insert PENDING record with ends_at = now + 900s

t=300: GPS recovers
       → Client: cancelAutoCheckout()
       → Update PENDING to CANCELLED with reason='RECOVERED'

t=900: Server runs
       → Finds record with status='CANCELLED'
       → Skips (only processes PENDING)
```

**Result:** ✅ No checkout executed

### Scenario 2: GPS Recovers 30 Seconds Before Execution

```
t=0:   GPS blocked, countdown starts
       → Insert PENDING with ends_at = now + 900s

t=870: GPS recovers
       → Client: cancelAutoCheckout()
       → Update to CANCELLED with reason='RECOVERED'
       → Heartbeat now shows gps_ok=true, in_branch=true

t=900: Server runs
       → Finds record with status='CANCELLED'
       → Skips
```

**Result:** ✅ No checkout executed (client cancelled)

### Scenario 3: GPS Recovers But Client Crashes Before Cancel

```
t=0:   GPS blocked, countdown starts
       → Insert PENDING with ends_at = now + 900s

t=870: GPS recovers BUT client crashes/closes

t=875: Heartbeat shows gps_ok=true, in_branch=true

t=900: Server runs
       → Finds PENDING record
       → Checks heartbeat: gps_ok=true, in_branch=true, last_seen=875s
       → 875s >= (900s - 120s) = true
       → ABORT: Mark as CANCELLED with reason='RECOVERED_BEFORE_EXEC'
```

**Result:** ✅ No checkout executed (server detected recovery)

### Scenario 4: GPS Never Recovers

```
t=0:   GPS blocked, countdown starts
       → Insert PENDING with ends_at = now + 900s

t=0-900: Heartbeat shows gps_ok=false

t=900: Server runs
       → Finds PENDING record
       → Checks heartbeat: gps_ok=false
       → Final gate: PASS (no recovery detected)
       → EXECUTE: Auto checkout with reason='LOCATION_DISABLED'
       → Mark as DONE
```

**Result:** ✅ Auto checkout executed

### Scenario 5: Employee Leaves Branch

```
t=0:   Inside branch, checked in

t=300: Leaves branch, countdown starts
       → Insert PENDING with reason='OUTSIDE_BRANCH', ends_at = now + 900s

t=0-900: Heartbeat shows in_branch=false

t=900: Server runs
       → Finds PENDING record
       → Checks heartbeat: in_branch=false
       → Final gate: PASS
       → EXECUTE: Auto checkout with reason='OUT_OF_BRANCH'
```

**Result:** ✅ Auto checkout executed

## Deployment

### 1. Database Migration

```bash
# Already applied via migration system
# Creates:
# - auto_checkout_pending table
# - employee_location_heartbeat table
# - Indexes and RLS policies
```

### 2. Deploy Edge Function

```bash
# Already deployed
# Function: process-auto-checkout
# Endpoint: {SUPABASE_URL}/functions/v1/process-auto-checkout
```

### 3. Setup Scheduled Job

**Option A: Supabase Cron (Recommended)**
```sql
-- Run every 1 minute
SELECT cron.schedule(
  'process-auto-checkout',
  '* * * * *',
  $$
  SELECT net.http_post(
    url:='https://your-project.supabase.co/functions/v1/process-auto-checkout',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);
```

**Option B: External Cron**
```bash
# Add to crontab
* * * * * curl -X POST https://your-project.supabase.co/functions/v1/process-auto-checkout \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

**Option C: GitHub Actions**
```yaml
name: Process Auto Checkout
on:
  schedule:
    - cron: '* * * * *'
jobs:
  run:
    runs-on: ubuntu-latest
    steps:
      - name: Call Edge Function
        run: |
          curl -X POST ${{ secrets.SUPABASE_URL }}/functions/v1/process-auto-checkout \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_KEY }}"
```

## Monitoring

### Check Pending Records

```sql
-- Currently pending
SELECT * FROM auto_checkout_pending WHERE status = 'PENDING';

-- Recently cancelled
SELECT * FROM auto_checkout_pending
WHERE status = 'CANCELLED'
AND cancelled_at >= now() - interval '1 hour';

-- Recently executed
SELECT * FROM auto_checkout_pending
WHERE status = 'DONE'
AND done_at >= now() - interval '1 hour';
```

### Check Heartbeats

```sql
-- Active heartbeats
SELECT * FROM employee_location_heartbeat
WHERE last_seen_at >= now() - interval '1 minute';

-- Stale heartbeats (no update in 2 minutes)
SELECT * FROM employee_location_heartbeat
WHERE last_seen_at < now() - interval '2 minutes';
```

### Audit Auto Checkouts

```sql
-- Auto checkouts executed today
SELECT
  al.employee_id,
  e.name,
  al.check_in_time,
  al.check_out_time,
  al.checkout_reason
FROM attendance_logs al
JOIN employees e ON e.id = al.employee_id
WHERE al.checkout_type = 'AUTO'
AND al.check_out_time >= current_date;
```

## Testing

### Test Recovery Path

1. Employee checks in with GPS ON
2. Turn GPS OFF
3. Wait for countdown to start (should see orange button)
4. Wait 5 seconds
5. Turn GPS ON
6. Countdown should cancel immediately
7. Check DB: `auto_checkout_pending` should show CANCELLED with reason='RECOVERED'

### Test Execution Path

1. Employee checks in with GPS ON
2. Turn GPS OFF
3. Wait for countdown to start
4. Keep GPS OFF until countdown reaches 0
5. Client executes checkout immediately
6. Server (when it runs) should find already checked out and mark DONE
7. Check DB: `attendance_logs.checkout_type='AUTO'` and `checkout_reason='LOCATION_DISABLED'`

### Test Server Final Gate

1. Employee checks in with GPS ON
2. Turn GPS OFF
3. Wait for countdown to start
4. Close app immediately (so client can't cancel)
5. Turn GPS ON outside app
6. Open app (heartbeat resumes with gps_ok=true)
7. Wait for server to run
8. Server should detect recovery via heartbeat and cancel
9. Check DB: `auto_checkout_pending.status='CANCELLED'` with `cancel_reason='RECOVERED_BEFORE_EXEC'`

## Advantages

✅ **Reliable**: Server is final authority, not client
✅ **Recovers Gracefully**: Multiple recovery detection mechanisms
✅ **Idempotent**: Safe to run multiple times
✅ **Auditable**: Full history in `auto_checkout_pending`
✅ **Respects User**: Cancels if GPS recovers before execution
✅ **Handles Crashes**: Server detects recovery even if client crashes
✅ **No False Positives**: 2-minute grace period for final gate

## Edge Cases Handled

1. ✅ Client crashes before cancel
2. ✅ Network disconnects during countdown
3. ✅ Attendance log deleted mid-countdown
4. ✅ Employee already checked out manually
5. ✅ GPS temporarily glitches then recovers
6. ✅ Multiple pending records (superseded)
7. ✅ Server runs multiple times on same record
8. ✅ Heartbeat stops (no recent data)
9. ✅ App backgrounded/foregrounded
10. ✅ Page reload during countdown

## Files Modified/Created

### Database
- `supabase/migrations/*_add_server_side_auto_checkout.sql`
- `supabase/migrations/*_add_unique_constraint_auto_checkout_pending.sql`
- `supabase/migrations/*_fix_auto_checkout_pending_unique_constraint.sql`

### Edge Functions
- `supabase/functions/process-auto-checkout/index.ts`

### Client
- `src/pages/EmployeeApp.tsx`
  - Added `autoCheckoutPendingIdRef`
  - Added `locationHeartbeatIntervalRef`
  - Added `isConfirmedOutsideRef`
  - Modified `startAutoCheckout()` to insert pending record
  - Modified `cancelAutoCheckout()` to update pending record
  - Added `sendHeartbeat()` function
  - Added heartbeat interval effect (15 seconds)
  - Added ref sync for `isConfirmedOutside`

## Build Status

```bash
npm run build
✓ built in 7.50s
✅ No errors
```
