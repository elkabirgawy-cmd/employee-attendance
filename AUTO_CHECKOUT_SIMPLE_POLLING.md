# Auto-Checkout: Simple Polling Implementation

## Overview
Simple, reliable auto-checkout system using GPS polling (no watchPosition dependency).

## Architecture

### 1. Polling Engine (`useAutoCheckoutWatcher.ts`)
- **Frequency**: Every 3 seconds
- **Active When**: `employeeStatus == CHECKED_IN` AND `autoCheckoutEnabled == true`
- **Method**: `getCurrentPosition(timeout=5000, maximumAge=0)` - fresh GPS read every time

### 2. Trigger Definition (Single Source of Truth)
```typescript
triggerActive = (
  gpsDisabled
  OR permissionDenied
  OR insideBranch == false
)
```

### 3. Countdown Logic
- **Start**: When `triggerActive` becomes `true`
- **Duration**: From Admin settings (`auto_checkout_after_seconds`)
- **Tick**: Every 1 second
- **Cancel**: Immediately when `triggerActive` becomes `false`
- **Display**: MM:SS format in Employee UI

### 4. Final Gate Validation
At countdown end (T=0):
1. Re-evaluate `triggerActive` with fresh GPS read
2. If `triggerActive == false` → ABORT auto-checkout
3. If `triggerActive == true` → Execute silent checkout (no confirmation)

### 5. Cleanup
- Clear existing `pollInterval` and `countdownTimer` before starting new ones
- On `CHECKED_OUT` or component unmount → clear all timers
- No duplicate intervals

## Settings

**Required from Admin Panel:**
- `auto_checkout_enabled` (boolean)
- `auto_checkout_after_seconds` (number)

**No Defaults**: If settings missing → auto-checkout disabled

**Database Compatibility**: Old columns still exist in DB for backwards compatibility but are not used:
- `verify_outside_with_n_readings` (not used)
- `watch_interval_seconds` (not used)
- `max_location_accuracy_meters` (not used)

## Logging

All events logged to console for debugging:

- `[POLL_START]` - Polling begins
- `[POLL_STOP]` - Polling stops
- `[POLL_TICK]` - Each poll cycle (includes GPS state, distance, trigger status)
- `[COUNTDOWN_START]` - Countdown initiated
- `[COUNTDOWN_CANCEL]` - Countdown cancelled (conditions improved)
- `[COUNTDOWN_DONE]` - Countdown reached zero
- `[AUTO_CHECKOUT_FINAL_GATE]` - Final validation before checkout
- `[AUTO_CHECKOUT_TRIGGERED]` - Checkout executed
- `[AUTO_CHECKOUT_ABORTED]` - Checkout cancelled (conditions improved)

## Acceptance Criteria

✅ Toggling GPS OFF/ON starts/cancels countdown instantly
✅ Entering/exiting branch cancels/starts countdown instantly
✅ No logout/login required to see changes
✅ No Employee UI changes
✅ Simple polling approach (no watchPosition)
✅ Final gate validation prevents false positives
✅ Comprehensive logging for debugging

## Key Features

1. **Instant Response**: Every 3 seconds, GPS state and location checked
2. **No Stale Data**: Always fresh GPS reads (`maximumAge=0`)
3. **Smart Cancellation**: Countdown stops immediately when conditions improve
4. **Safe Execution**: Final gate prevents auto-checkout if GPS/location recovered
5. **Clean State**: No duplicate timers, proper cleanup on unmount

## Technical Details

### File: `src/utils/useAutoCheckoutWatcher.ts`
- React hook managing polling lifecycle
- Refs for stable callbacks and current state
- Cleanup on unmount and status changes

### Integration: `src/pages/EmployeeApp.tsx`
- Hook called with current check-in status
- Settings fetched from database
- Branch location provided for distance calculation
- Silent checkout callback provided

### No UI Changes
Employee UI remains unchanged - countdown display uses existing components.
