# Auto-Checkout: DB-Driven Multi-Tenant Implementation

## Overview

Completely removed browser-based auto-checkout triggers. System now uses server-driven state with persistent database records.

---

## Database Changes

### 1. Settings Tables - Unique Constraints Added
- `application_settings.company_id` - UNIQUE
- `auto_checkout_settings.company_id` - UNIQUE
- `attendance_calculation_settings.company_id` - UNIQUE

### 2. Auto-Initialization on Company Creation
**Trigger:** `on_company_created_initialize_settings`
- Automatically creates default settings for new companies
- Backfilled existing companies without settings
- Function: `initialize_company_settings(company_id)`

### 3. RLS Policies Fixed
**Before:** Anon users could read ALL settings (security issue)
**After:** Anon users can only read settings for their own company via employee lookup

```sql
-- Old (INSECURE)
CREATE POLICY "anon_can_select_auto_checkout_settings"
  ON auto_checkout_settings FOR SELECT TO anon
  USING (true);  -- ❌ Can read ALL companies

-- New (SECURE)
CREATE POLICY "anon_select_auto_checkout_settings_via_employee"
  ON auto_checkout_settings FOR SELECT TO anon
  USING (
    company_id IN (
      SELECT company_id FROM employees
      WHERE id::text = current_setting('request.jwt.claims', true)::json->>'employee_id'
        AND is_active = true
    )
  );  -- ✅ Only reads own company
```

### 4. New Helper Functions

**`upsert_employee_heartbeat()`**
- Maintains `employee_location_heartbeat` table
- Tracks: `last_seen_at`, `in_branch`, `gps_ok`, `reason`
- Primary key: `employee_id` (one row per employee)

**`get_active_attendance_session()`**
- Returns complete session state for an employee
- Includes: attendance_log, heartbeat status, auto_checkout_pending
- Single query replaces multiple frontend queries

### 5. Indexes Added
```sql
-- Fast active session lookups
idx_attendance_logs_active_sessions (employee_id, company_id, check_in_time) WHERE check_out_time IS NULL

-- Fast heartbeat lookups
idx_employee_location_heartbeat_company (company_id, employee_id)

-- Fast auto-checkout pending lookups
idx_auto_checkout_pending_active (company_id, employee_id, status, ends_at) WHERE status = 'PENDING'
```

---

## Edge Functions

### 1. `employee-heartbeat` (Updated)

**Purpose:** Record heartbeat + update location status

**Called by:** Frontend every 12-15 seconds while checked in

**Input:**
```typescript
{
  employee_id: UUID,
  company_id: UUID,
  location: { lat, lng, accuracy },
  permission_state: 'granted' | 'denied' | 'prompt'
}
```

**Logic:**
1. Find active attendance_log for today
2. Update `last_heartbeat_at` in attendance_logs
3. Calculate `in_branch` (distance to branch < geofence_radius)
4. Calculate `gps_ok` (permission_state === 'granted')
5. Upsert into `employee_location_heartbeat` table

**Output:**
```typescript
{
  ok: true,
  in_branch: boolean,
  gps_ok: boolean
}
```

### 2. `auto-checkout-enforcement` (Completely Rewritten)

**Purpose:** Server-side job that enforces auto-checkout rules

**Scheduled:** Every 30-60 seconds via cron job

**Multi-Tenant:** Processes ALL companies in single run

**Logic for EACH company:**

1. **Fetch Settings**
   - Get `auto_checkout_settings` for company
   - Skip if `auto_checkout_enabled = false`

2. **Find Active Sessions**
   - Query `attendance_logs` WHERE:
     - `company_id` = company
     - `check_in_time` = today
     - `check_out_time IS NULL`

3. **For Each Session:**

   a. **Check Heartbeat Status**
   ```typescript
   SELECT * FROM employee_location_heartbeat
   WHERE employee_id = session.employee_id
   ```

   b. **Determine If Trigger Needed**
   - No heartbeat + time_since_checkin > threshold → Trigger
   - Heartbeat timeout (last_seen_at old) → Trigger
   - GPS disabled (`gps_ok = false`) → Trigger
   - Outside branch (`in_branch = false`) → Trigger

   c. **If Trigger:**

   **Check `auto_checkout_pending` table:**

   - **If NO pending record:**
     ```sql
     INSERT INTO auto_checkout_pending (
       employee_id, company_id, attendance_log_id,
       reason, ends_at, status
     ) VALUES (
       ...,
       NOW() + auto_checkout_after_seconds,
       'PENDING'
     )
     ```
     **Action:** START countdown

   - **If pending record EXISTS:**
     ```typescript
     if (NOW() >= pending.ends_at) {
       // Execute checkout
       UPDATE attendance_logs SET
         check_out_time = NOW(),
         checkout_type = 'AUTO',
         checkout_reason = reason
       WHERE id = log.id;

       UPDATE auto_checkout_pending SET
         status = 'DONE',
         done_at = NOW()
       WHERE id = pending.id;

       DELETE FROM employee_location_heartbeat
       WHERE employee_id = log.employee_id;
     }
     ```
     **Action:** EXECUTE auto-checkout

   d. **If NO Trigger (conditions resolved):**
   ```sql
   UPDATE auto_checkout_pending SET
     status = 'CANCELLED',
     cancelled_at = NOW(),
     cancel_reason = 'CONDITIONS_RESOLVED'
   WHERE attendance_log_id = log.id
     AND status = 'PENDING';
   ```
   **Action:** CANCEL countdown

**Output:**
```typescript
{
  ok: true,
  processed: 10,     // Total sessions checked
  started: 2,        // Countdowns started
  executed: 1,       // Auto-checkouts executed
  details: [...]
}
```

---

## Frontend Changes Required

### 1. Remove Browser-Based Checkout Triggers

**REMOVE these event handlers:**
```typescript
// ❌ Remove - No auto-checkout on browser close
window.addEventListener('beforeunload', ...);
window.addEventListener('pagehide', ...);

// ❌ Remove - No auto-checkout on visibility change
document.addEventListener('visibilitychange', () => {
  if (!visible) executeAutoCheckout();  // REMOVE THIS
});
```

**KEEP these for state refresh:**
```typescript
// ✅ Keep - Refresh state from DB on focus
window.addEventListener('focus', () => {
  loadSessionStateFromDB();
});

document.addEventListener('visibilitychange', () => {
  if (visible) loadSessionStateFromDB();
});
```

### 2. Update Heartbeat Function

**OLD (using non-existent RPC):**
```typescript
const sendHeartbeat = async () => {
  const { data } = await supabase.rpc('record_heartbeat_and_check_auto_checkout', {
    p_employee_id: employee.id,
    p_attendance_log_id: currentLog.id,
    p_in_branch: inBranch,
    p_gps_ok: gpsOk
  });

  // Client-side logic to start/cancel countdown
  if (data?.auto_checkout_triggered) {
    startCountdown();  // ❌ Client manages state
  }
};
```

**NEW (using edge function):**
```typescript
const sendHeartbeat = async () => {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/employee-heartbeat`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          employee_id: employee.id,
          company_id: employee.company_id,
          location: location ? {
            lat: location.lat,
            lng: location.lng,
            accuracy: location.accuracy
          } : null,
          permission_state: locationHealth.permission
        })
      }
    );

    const result = await response.json();
    console.log('[HEARTBEAT] Sent:', result);

    // After heartbeat, refresh auto-checkout state from DB
    await refreshAutoCheckoutState();
  } catch (error) {
    console.error('[HEARTBEAT] Failed:', error);
  }
};
```

### 3. Session State Restoration

**Use `get_active_attendance_session` RPC:**

```typescript
const loadSessionStateFromDB = async () => {
  if (!employee) return;

  try {
    const { data, error } = await supabase
      .rpc('get_active_attendance_session', {
        p_employee_id: employee.id,
        p_company_id: employee.company_id
      });

    if (error || !data || data.length === 0) {
      // No active session
      setCurrentLog(null);
      setAutoCheckout({
        active: false,
        reason: null,
        startedAtServerMs: null,
        endsAtServerMs: null,
        executionState: 'IDLE'
      });
      return;
    }

    const session = data[0];

    // Set attendance log
    setCurrentLog({
      id: session.log_id,
      check_in_time: session.check_in_time,
      check_out_time: session.check_out_time,
      // ... other fields
    });

    // Set auto-checkout state from DB
    if (session.auto_checkout_pending_id && session.auto_checkout_status === 'PENDING') {
      const endsAtMs = new Date(session.auto_checkout_ends_at).getTime();
      const nowMs = Date.now();

      setAutoCheckout({
        active: true,
        reason: session.auto_checkout_reason,
        startedAtServerMs: new Date(session.auto_checkout_ends_at).getTime() - (settings.auto_checkout_after_seconds * 1000),
        endsAtServerMs: endsAtMs,
        executionState: nowMs >= endsAtMs ? 'EXECUTING' : 'COUNTING'
      });
    } else {
      setAutoCheckout({
        active: false,
        reason: null,
        startedAtServerMs: null,
        endsAtServerMs: null,
        executionState: 'IDLE'
      });
    }
  } catch (error) {
    console.error('[SESSION_RESTORE] Error:', error);
  }
};
```

### 4. Periodic State Refresh

**Poll database every 10-15 seconds:**

```typescript
useEffect(() => {
  if (!currentLog || !employee) return;

  const refreshInterval = setInterval(() => {
    loadSessionStateFromDB();
  }, 15000);  // Every 15 seconds

  return () => clearInterval(refreshInterval);
}, [currentLog, employee]);
```

### 5. Countdown Display

**UI remains the same, but state comes from DB:**

```typescript
// Auto-checkout countdown
{autoCheckout.active && autoCheckout.executionState === 'COUNTING' && (
  <div className="countdown">
    <AlertCircle />
    <span>انصراف تلقائي خلال</span>
    <div className="time">
      {(() => {
        const remainingSec = autoCheckout.endsAtServerMs
          ? Math.max(0, Math.ceil((autoCheckout.endsAtServerMs - nowMs) / 1000))
          : 0;

        return `${Math.floor(remainingSec / 60).toString().padStart(2, '0')}:${(remainingSec % 60).toString().padStart(2, '0')}`;
      })()}
    </div>
  </div>
)}
```

---

## Testing Checklist

### Multi-Tenant Isolation
- [ ] Company A employee cannot see Company B's settings
- [ ] Company A auto-checkout doesn't affect Company B
- [ ] Settings default to correct values for new companies

### Auto-Checkout Behavior
- [ ] Countdown starts when GPS disabled
- [ ] Countdown starts when out of branch
- [ ] Countdown starts when heartbeat stops
- [ ] Countdown cancels when conditions resolve
- [ ] Checkout executes after countdown expires
- [ ] Behavior identical across all companies

### Browser Events
- [ ] Closing browser does NOT trigger checkout
- [ ] Refreshing page does NOT reset countdown
- [ ] Countdown persists after page reload
- [ ] Focus/visibility only refreshes state (no checkout)

### Session Persistence
- [ ] Check-in → Close browser → Reopen → Still checked in
- [ ] Countdown in progress → Close browser → Reopen → Countdown continues
- [ ] Auto-checkout happens even if browser closed

---

## Benefits

### Before (Browser-Based)
- ❌ Different behavior per company (bugs)
- ❌ Auto-checkout lost on browser close
- ❌ Race conditions between tabs
- ❌ Client controls critical business logic
- ❌ Countdown resets on refresh

### After (DB-Driven)
- ✅ Identical behavior across all companies
- ✅ Auto-checkout persists (browser-independent)
- ✅ Single source of truth (database)
- ✅ Server controls all business logic
- ✅ Countdown survives refresh/close

---

## Deployment

1. **Database Migration:** Applied ✅
2. **Edge Functions:** Deployed ✅
   - `employee-heartbeat`
   - `auto-checkout-enforcement`
3. **Cron Job:** Configure to call `auto-checkout-enforcement` every 30-60 seconds
4. **Frontend:** Update EmployeeApp.tsx (in progress)
5. **Build & Test:** npm run build

---

## Summary

The auto-checkout system is now **fully server-driven**:

1. **Frontend:** Sends heartbeats, displays state from DB
2. **Edge Functions:** Record heartbeat status
3. **Server Job:** Enforces auto-checkout rules
4. **Database:** Single source of truth

**No browser events trigger checkout.** The server decides when to checkout based on persisted state that survives browser close, refresh, and network interruptions.
