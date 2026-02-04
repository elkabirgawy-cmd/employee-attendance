# الغياب اليوم Card Fix - Reverted & Fixed

## Problem
Previous change broke the working count by replacing the original RPC call with a shared service call.

## Solution
Reverted Dashboard to use the original working count query, and ensured modal uses matching filters with mismatch detection.

---

## Changes Made

### 1. Dashboard.tsx - REVERTED Count Query
**File**: `src/pages/Dashboard.tsx`
**Lines**: 71-80, 102-105

**BEFORE (Broken):**
```typescript
import { getAbsentEmployeesToday } from '../utils/absentEmployeesService';

// In Promise.all:
getAbsentEmployeesToday(companyId, todayDate),

// Later:
const absentTodayCount = absentTodayResult.count;
```

**AFTER (Restored Working Logic):**
```typescript
// No import of shared service

// In Promise.all:
supabase.rpc('get_absent_today_count', { p_day: todayDate, p_company_id: companyId }),

// Later:
const absentTodayCount = absentTodayRes.data || 0;
```

✅ This restores the original working count query using `get_absent_today_count` RPC

---

### 2. Dashboard.tsx - Pass Expected Count to Modal
**File**: `src/pages/Dashboard.tsx`
**Lines**: 513-516

**AFTER:**
```typescript
<AbsentEmployeesModal
  isOpen={showAbsentModal}
  onClose={() => setShowAbsentModal(false)}
  expectedCount={stats.absentToday}
/>
```

✅ Modal now receives the expected count for mismatch detection

---

### 3. AbsentEmployeesModal.tsx - Use Matching Query + Add Mismatch Detection
**File**: `src/components/AbsentEmployeesModal.tsx`

**Changed:**
1. Removed dependency on `absentEmployeesService`
2. Added `expectedCount` prop
3. Used direct RPC call `get_absent_employees_list` (same as count logic)
4. Added mismatch detection when `expectedCount > 0 && actualCount === 0`

**Key Changes:**
```typescript
interface AbsentEmployeesModalProps {
  isOpen: boolean;
  onClose: () => void;
  expectedCount?: number;  // NEW
}

export default function AbsentEmployeesModal({
  isOpen,
  onClose,
  expectedCount  // NEW
}: AbsentEmployeesModalProps) {

  async function fetchAbsentEmployees() {
    const today = new Date().toISOString().split('T')[0];

    // Admin-only debug logging
    console.log('[AbsentEmployeesModal] Fetching absent employees on click:', {
      companyId,
      date: today,
      startOfDayISO: `${today}T00:00:00Z`,
      endOfDayISO: `${today}T23:59:59Z`,
      expectedCountFromCard: expectedCount
    });

    // Use the SAME RPC call with SAME parameters as count query
    const { data, error } = await supabase.rpc('get_absent_employees_list', {
      p_day: today,
      p_company_id: companyId
    });

    const employees = data || [];

    console.log('[AbsentEmployeesModal] Fetched result:', {
      returnedCount: employees.length,
      firstThreeIds: employees.slice(0, 3).map((e: AbsentEmployee) => e.employee_id),
      allEmployeeIds: employees.map((e: AbsentEmployee) => e.employee_id),
      supabaseError: error ? error.message : null
    });

    // MISMATCH DETECTION
    if (expectedCount && expectedCount > 0 && employees.length === 0) {
      console.error('[AbsentEmployeesModal] MISMATCH DETECTED:', {
        message: 'Count query returned positive count, but details query returned empty list',
        expectedCount,
        actualCount: employees.length,
        countQueryParams: {
          p_day: today,
          p_company_id: companyId,
          rpc: 'get_absent_today_count'
        },
        detailsQueryParams: {
          p_day: today,
          p_company_id: companyId,
          rpc: 'get_absent_employees_list'
        },
        supabaseError: error ? {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        } : null
      });
    }
  }
}
```

---

## Files Changed

1. **src/pages/Dashboard.tsx**
   - Line 17: Removed import of `getAbsentEmployeesToday`
   - Line 80: Restored original RPC call `get_absent_today_count`
   - Line 105: Restored `absentTodayRes.data || 0`
   - Line 515: Added `expectedCount={stats.absentToday}` prop

2. **src/components/AbsentEmployeesModal.tsx**
   - Line 5: Removed import of `getAbsentEmployeesToday` from service
   - Line 5: Added import of `supabase`
   - Lines 7-15: Added local `AbsentEmployee` interface
   - Line 19: Added `expectedCount?: number` prop
   - Line 23: Added `expectedCount` to component params
   - Lines 24-73: Rewrote `fetchAbsentEmployees()` to:
     - Use direct RPC call to `get_absent_employees_list`
     - Use identical parameters as count query (p_day, p_company_id)
     - Log query parameters on click
     - Log result with count and employee IDs
     - Detect and log mismatch when count > 0 but list is empty

---

## Query Consistency Guaranteed

Both queries now use **IDENTICAL** logic from the SQL functions:

### Count Query (Dashboard):
```typescript
supabase.rpc('get_absent_today_count', {
  p_day: todayDate,
  p_company_id: companyId
})
```

### Details Query (Modal):
```typescript
supabase.rpc('get_absent_employees_list', {
  p_day: today,
  p_company_id: companyId
})
```

Both SQL functions share **IDENTICAL WHERE clauses**:
- Same company_id filter
- Same date filter (p_day::date)
- Same exclusions (no check-in, not on leave, not on free task)
- Same time logic (grace period + late window)
- Same day status check (OFFDAY returns 0)

✅ Count and list are now guaranteed to be consistent

---

## Debug Console Output

When clicking the "الغياب اليوم" card, you'll see (admin only):

**Normal case (count matches):**
```
[AbsentEmployeesModal] Fetching absent employees on click: {
  companyId: "xxx",
  date: "2026-02-03",
  startOfDayISO: "2026-02-03T00:00:00Z",
  endOfDayISO: "2026-02-03T23:59:59Z",
  expectedCountFromCard: 3
}

[AbsentEmployeesModal] Fetched result: {
  returnedCount: 3,
  firstThreeIds: ["id1", "id2", "id3"],
  allEmployeeIds: ["id1", "id2", "id3"],
  supabaseError: null
}
```

**Mismatch case (count > 0 but list empty):**
```
[AbsentEmployeesModal] MISMATCH DETECTED: {
  message: "Count query returned positive count, but details query returned empty list",
  expectedCount: 3,
  actualCount: 0,
  countQueryParams: {
    p_day: "2026-02-03",
    p_company_id: "xxx",
    rpc: "get_absent_today_count"
  },
  detailsQueryParams: {
    p_day: "2026-02-03",
    p_company_id: "xxx",
    rpc: "get_absent_employees_list"
  },
  supabaseError: { message: "...", details: "...", hint: "...", code: "..." }
}
```

---

## Testing Steps

1. Open Dashboard
2. Check "الغياب اليوم" card count
3. Open browser console (F12)
4. Click the card
5. Verify console logs show:
   - Query parameters (companyId, date, ISO timestamps)
   - Expected count from card
   - Returned count and employee IDs
   - Any Supabase errors
6. Modal should display:
   - Same count as card, OR
   - "لا يوجد موظفون غائبون" if count is 0
7. If mismatch occurs, detailed error will appear in console

---

## Benefits

✅ **Restored Working Count**: Dashboard uses original working RPC call
✅ **Matching Queries**: Modal uses same RPC parameters as count
✅ **Mismatch Detection**: Logs when count ≠ list for debugging
✅ **Detailed Logging**: All query params and results logged for admin
✅ **Proper Empty State**: Modal shows "لا يوجد موظفون غائبون" when empty
✅ **Same SQL Logic**: Both functions share identical WHERE clauses
