# الغياب اليوم Card Fix - Complete

## Problem Fixed
The "الغياب اليوم" (Absent Today) card showed the correct count, but clicking it displayed an empty modal. This was caused by the count query and details query using potentially different logic or timing.

## Root Cause
- Dashboard used: `supabase.rpc('get_absent_today_count')` for count
- Modal used: `supabase.rpc('get_absent_employees_list')` for list
- Both called separate RPC functions that could diverge
- No guarantee they used identical filters, date ranges, or timing

## Solution Implemented

### 1. Created Shared Service (Single Source of Truth)
**File**: `src/utils/absentEmployeesService.ts`

This service provides a single function `getAbsentEmployeesToday()` that:
- Fetches the full list of absent employees using `get_absent_employees_list` RPC
- Derives the count from `list.length`
- Uses identical parameters (companyId, date)
- Returns both count and list together

```typescript
export async function getAbsentEmployeesToday(
  companyId: string,
  date?: string
): Promise<AbsentEmployeesResult>
```

### 2. Updated Dashboard to Use Shared Service
**File**: `src/pages/Dashboard.tsx`

Changed from:
```typescript
supabase.rpc('get_absent_today_count', { p_day: todayDate, p_company_id: companyId })
```

To:
```typescript
getAbsentEmployeesToday(companyId, todayDate)
```

The card count now uses `result.count` which is derived from the same list.

### 3. Updated Modal to Use Shared Service
**File**: `src/components/AbsentEmployeesModal.tsx`

Changed from:
```typescript
supabase.rpc('get_absent_employees_list', { p_day: today, p_company_id: companyId })
```

To:
```typescript
getAbsentEmployeesToday(companyId, today)
```

Both Dashboard and Modal now call the same function with the same parameters.

### 4. Added Admin Debug Logging
Console logs (development mode only) when clicking the card:
- Company ID
- Date (today)
- Start/End of day ISO timestamps
- Returned count
- First 3 employee IDs
- Full list of employee IDs
- Any Supabase errors

Example console output:
```
[AbsentEmployeesModal] Fetching absent employees on click: {
  companyId: "xxx-xxx-xxx",
  date: "2026-02-03",
  startOfDayISO: "2026-02-03T00:00:00Z",
  endOfDayISO: "2026-02-03T23:59:59Z"
}

[AbsentEmployeesModal] Fetched result: {
  count: 5,
  employeeCount: 5,
  firstThreeIds: ["id1", "id2", "id3"],
  error: null
}
```

### 5. Empty State Handling
The modal already had proper empty state UI:
- Shows green checkmark icon
- Displays "لا يوجد موظفون غائبون" (No Absent Employees)
- Shows subtitle "جميع الموظفين المتوقعون قد سجلوا الحضور اليوم"

This now renders correctly when the list is empty instead of showing blank UI.

## Files Changed

1. **NEW**: `src/utils/absentEmployeesService.ts` - Shared service (single source of truth)
2. **MODIFIED**: `src/pages/Dashboard.tsx` - Uses shared service for count
3. **MODIFIED**: `src/components/AbsentEmployeesModal.tsx` - Uses shared service for list

## Benefits

✅ **Guaranteed Consistency**: Count and list always match (derived from same query)
✅ **Single Source of Truth**: One function, one query, one result
✅ **Better Debugging**: Console logs show exactly what's fetched and returned
✅ **Proper Empty State**: Modal shows "لا يوجد موظفون غائبون" instead of blank
✅ **Maintainability**: Future changes only need to update one service
✅ **Type Safety**: Shared TypeScript interface for AbsentEmployee

## Testing

To verify the fix:

1. Open Dashboard
2. Check "الغياب اليوم" card count
3. Click the card
4. Modal should show:
   - Same count as card
   - List of absent employees, OR
   - "لا يوجد موظفون غائبون" if count is 0
5. Open browser console (F12) to see debug logs

## Logic Used (from SQL function)

Employee is counted as absent if:
- Active employee with shift assigned
- Current time > (shift_start + grace_period + max_late_window)
- No check-in today
- NOT on approved leave today
- NOT on active free task today
- Day is WORKDAY (not OFFDAY)

This logic is in the `get_absent_employees_list()` SQL function, which is now the single source for both count and list.
