# Auto Checkout State Machine Implementation

## Problem Fixed
Employee screen button was flipping every ~6 seconds between "Auto checkout countdown" and "Manual checkout" because the UI was derived from the latest GPS reading, causing effects to restart on each watcher tick.

## Solution
Implemented an explicit state machine with latched states to prevent UI flipping.

## State Machine Design

### States
1. **IDLE**: No auto-checkout activity
2. **ARMING**: Detected issue, counting consecutive failures
3. **COUNTING**: Countdown active (UI LATCHED - no flipping)
4. **DONE**: Auto-checkout executed successfully

### Variables
- `state`: Current state (IDLE | ARMING | COUNTING | DONE)
- `reason`: Trigger reason (LOCATION_DISABLED | OUTSIDE_BRANCH | null)
- `failCount`: Number of consecutive failed readings
- `countdownRemaining`: Seconds remaining in countdown
- `watchTimerRef`: Watcher interval reference
- `countdownTimerRef`: Countdown interval reference

## State Transitions

### 1. IDLE → ARMING
**Trigger:** First detection of issue (location disabled OR outside branch)
**Action:**
- Set `state = ARMING`
- Set `reason = currentReason` (first detected reason)
- Set `failCount = 1`

### 2. ARMING → COUNTING
**Trigger:** `failCount >= verifyOutsideWithNReadings` (default: 3)
**Action:**
- Set `state = COUNTING`
- Start countdown timer
- UI now shows countdown panel (LATCHED)

### 3. ARMING → IDLE
**Trigger:** Issue resolved (`currentReason = null`)
**Action:**
- Reset all state
- Clear timers

### 4. COUNTING → IDLE
**Trigger:** Issue resolved BEFORE countdown reaches zero
**Action:**
- Cancel countdown
- Reset all state
- Clear timers

### 5. COUNTING → DONE
**Trigger:** Countdown reaches zero
**Action:**
- Execute auto-checkout (NO confirm modal)
- Set `state = DONE`
- After checkout completes → reset to IDLE

## Current Reason Logic

On each watcher tick, compute `currentReason`:

```typescript
// 1. Check location permission and GPS
if (!gpsEnabled || permission === 'denied') {
  currentReason = 'LOCATION_DISABLED';
}
// 2. Check geofence
else {
  const location = await getCurrentLocation();
  if (!location) {
    currentReason = 'LOCATION_DISABLED';
  } else {
    const distance = distanceMeters(lat, lng, branchLat, branchLng);
    if (distance > branchRadius) {
      currentReason = 'OUTSIDE_BRANCH';
    }
  }
}
```

**IMPORTANT:**
- Does NOT trigger on accuracy issues
- Does NOT trigger on weak signal alone
- Only triggers on: permission denied, GPS disabled, OR outside geofence

## ARMING Logic

```typescript
if (state === 'IDLE' && currentReason !== null) {
  state = 'ARMING';
  reason = currentReason; // Keep first reason
  failCount = 1;
}

if (state === 'ARMING') {
  if (currentReason !== null) {
    failCount++; // Increment on each tick with issue
    if (failCount >= verifyOutsideWithNReadings) {
      state = 'COUNTING'; // Enter countdown
    }
  } else {
    state = 'IDLE'; // Issue resolved, reset
  }
}
```

## COUNTING Logic (LATCHED)

```typescript
if (state === 'COUNTING') {
  // UI ALWAYS shows countdown panel (no flipping)

  if (currentReason === null) {
    // Cancel immediately if issue resolved
    state = 'IDLE';
    clearInterval(countdownTimer);
  }

  // Countdown timer runs independently
  if (countdownRemaining <= 0) {
    state = 'DONE';
    executeAutoCheckout(); // NO confirm modal
  }
}
```

**Key Features:**
- Countdown interval stored in `useRef` (NOT recreated on render)
- While COUNTING, UI is latched to countdown display
- Cancel immediately if location recovers
- No confirm modal on auto-checkout

## Console Logs

The implementation includes these logs:

```
[AC_TICK] {state, currentReason, failCount}
  - Logged on every watcher tick

[AC_STATE] IDLE | ARMING | COUNTING | DONE
  - Logged on state transitions

[AC_COUNTDOWN] {remaining}
  - Logged every second during countdown

[AC_CANCEL] reason
  - Logged when countdown cancelled (location recovered)

[AC_DONE]
  - Logged when auto-checkout executed
```

## Configuration

Settings read from `auto_checkout_settings` table:
- `auto_checkout_enabled`: Enable/disable feature
- `auto_checkout_after_seconds`: Countdown duration (default: 900s = 15min)
- `verify_outside_with_n_readings`: Number of consecutive failures needed (default: 3)
- `watch_interval_seconds`: Time between watcher ticks (default: 6s)

Settings are polled and applied without requiring logout/login.

## Files Changed

### 1. `src/utils/autoCheckoutStateMachine.ts` (NEW)
Custom hook implementing the state machine:
- `useAutoCheckoutStateMachine()`
- States: IDLE, ARMING, COUNTING, DONE
- Watcher tick logic
- Countdown logic
- State transitions

### 2. `src/pages/EmployeeApp.tsx` (MODIFIED)
- Replaced `useAutoCheckoutWatcher` with `useAutoCheckoutStateMachine`
- Updated all references to `autoCheckoutState.isActive` → `autoCheckoutIsActive`
- Updated button UI to show:
  - ARMING state: "تحذير - خارج نطاق الفرع" + progress (1/3, 2/3, 3/3)
  - COUNTING state: Countdown timer (MM:SS)
  - Reason display: "خدمة الموقع معطلة" or "خارج نطاق الفرع"

## UI Behavior

### Before Fix
- Button flips every 6 seconds
- Countdown resets on each GPS update
- User sees: Checkout → Countdown → Checkout → Countdown (loop)

### After Fix
- IDLE: Show normal checkout button
- ARMING: Show warning with progress (1/3, 2/3, 3/3)
- COUNTING: Show countdown timer (LATCHED - no flipping)
- Button stays in countdown view until:
  - Countdown completes → auto-checkout
  - OR location recovers → back to IDLE

## Testing Scenarios

### 1. Location Disabled
1. Check in
2. Disable GPS
3. Expected: State goes to ARMING after first tick
4. Expected: After 3 ticks (default), enters COUNTING
5. Re-enable GPS before countdown ends
6. Expected: Cancels countdown, returns to IDLE

### 2. Outside Geofence
1. Check in
2. Move outside branch radius
3. Expected: State goes to ARMING after first tick
4. Expected: After 3 consecutive "outside" readings, enters COUNTING
5. Move back inside before countdown ends
6. Expected: Cancels countdown, returns to IDLE

### 3. Countdown Completion
1. Check in
2. Move outside branch radius
3. Wait for 3 consecutive readings → COUNTING starts
4. Wait for countdown to reach zero
5. Expected: Auto-checkout executes WITHOUT confirm modal
6. Expected: Returns to IDLE state

### 4. Intermittent GPS Issues
1. Check in
2. Move outside (1 reading)
3. Move inside (reset to IDLE)
4. Move outside (1 reading)
5. Expected: failCount resets each time, never reaches COUNTING

## Benefits

1. **No UI Flipping**: Once COUNTING starts, button stays in countdown view
2. **Explicit States**: Clear state machine with defined transitions
3. **Debouncing**: Requires N consecutive failures before countdown
4. **Immediate Cancel**: Returns to normal if issue resolves
5. **Ref-based Timers**: Intervals not recreated on render
6. **Clear Logs**: Easy to debug and monitor state

## Build Status

```bash
npm run build
✓ built in 6.20s
✅ No errors
```
