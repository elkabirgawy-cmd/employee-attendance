# Employee Check-In Debug Guide

## Enhanced Error Logging Added

The employee check-in page now has comprehensive error logging to identify the exact issue.

## Testing Steps

### 1. Open Browser Developer Tools

1. Open browser (Chrome/Firefox)
2. Press `F12` or `Ctrl+Shift+I` to open DevTools
3. Go to **Console** tab
4. Clear console: Click 🚫 or press `Ctrl+L`

### 2. Navigate to Employee Check-In

```
http://localhost:5173/employee-check-in
```

### 3. Test Employee Login

Enter employee code: `EMP001`
Click: "دخول"

### 4. Attempt Check-In

1. Allow GPS access when prompted
2. Wait for GPS to stabilize (accuracy < 60m)
3. Click "تسجيل الحضور"

### 5. Check Console Output

You should see detailed logs like this:

```javascript
=== ATTENDANCE CHECK-IN DEBUG ===
Timestamp: 2026-01-28T12:34:56.789Z
Auth Session: NULL (Anonymous)
Auth User ID: NULL
Auth Role: anon
Employee ID: e0a52a49-13fc-4db2-be8c-a38fdab3fd4a
Employee Code: EMP001
Employee Name: أحمد محمد العلي
Company ID: aeb3d19c-82bc-462e-9207-92e49d507a07
Branch ID: d21a26cd-612b-44ed-b414-56a92fc03f23
Shift ID: EXISTS
GPS Coordinates: { lat: 24.7136, lng: 46.6753 }
GPS Accuracy: 15.2 meters
Distance from Branch: 45 meters
Is Inside Geofence: true
Check-in Time: 2026-01-28T12:34:56.789Z
Attendance Data to Insert: {
  "employee_id": "e0a52a49-13fc-4db2-be8c-a38fdab3fd4a",
  "company_id": "aeb3d19c-82bc-462e-9207-92e49d507a07",
  "branch_id": "d21a26cd-612b-44ed-b414-56a92fc03f23",
  "check_in_time": "2026-01-28T12:34:56.789Z",
  "check_in_device_time": "2026-01-28T12:34:56.789Z",
  "check_in_latitude": 24.7136,
  "check_in_longitude": 46.6753,
  "check_in_accuracy": 15.2,
  "check_in_distance_m": 45.0,
  "status": "on_time"
}
Attempting INSERT...
```

### Expected Outcomes

#### Success Case:
```javascript
✅ SUCCESS: Attendance logged successfully
Inserted Row ID: abc-123-def-456
Inserted Data: { ... }
================================
```

#### Error Case:
```javascript
❌ INSERT FAILED
Error Code: 42501
Error Message: new row violates row-level security policy for table "attendance_logs"
Error Details: ...
Error Hint: ...
Full Error Object: { ... }
```

### 6. Check Error Alert

If insert fails, you'll see an alert with:
```
حدث خطأ أثناء تسجيل الحضور

تفاصيل الخطأ:
Code: 42501
Message: new row violates row-level security policy...
Details: ...
Hint: ...
```

## Common Error Codes

| Code | Meaning | Solution |
|------|---------|----------|
| `42501` | RLS policy violation | Check RLS policies on attendance_logs |
| `23502` | NOT NULL violation | Missing required field in insert data |
| `23503` | Foreign key violation | Invalid employee_id, branch_id, or company_id |
| `PGRST116` | No rows returned | Query found no data |

## SQL Verification

Run this in Supabase SQL Editor to verify setup:

```sql
-- 1. Check if employee exists and has company_id
SELECT 
  employee_code,
  full_name,
  company_id,
  branch_id,
  is_active
FROM employees
WHERE employee_code = 'EMP001';

-- Expected: 1 row with company_id = aeb3d19c-82bc-462e-9207-92e49d507a07

-- 2. Check RLS policies on attendance_logs
SELECT 
  policyname,
  roles,
  cmd,
  with_check
FROM pg_policies
WHERE tablename = 'attendance_logs'
  AND cmd = 'INSERT';

-- Expected: employees_can_insert_attendance with roles {anon,authenticated}

-- 3. Check table grants
SELECT 
  grantee,
  privilege_type
FROM information_schema.table_privileges
WHERE table_name = 'attendance_logs'
  AND grantee = 'anon'
  AND privilege_type = 'INSERT';

-- Expected: anon has INSERT privilege

-- 4. Simulate RLS check
WITH test_data AS (
  SELECT 
    'e0a52a49-13fc-4db2-be8c-a38fdab3fd4a'::uuid as employee_id,
    'aeb3d19c-82bc-462e-9207-92e49d507a07'::uuid as company_id
)
SELECT 
  EXISTS (
    SELECT 1
    FROM employees e
    WHERE e.id = td.employee_id
      AND e.company_id = td.company_id
      AND e.is_active = true
  ) as rls_would_allow
FROM test_data td;

-- Expected: true
```

## Troubleshooting

### Issue: "Auth Session: NULL (Anonymous)"

This is **EXPECTED** for employee check-in. Employees use employee_code, not auth.

### Issue: "Company ID: NULL"

**Problem:** Employee doesn't have company_id
**Solution:**
```sql
-- Check if employee has company_id
SELECT employee_code, company_id FROM employees WHERE employee_code = 'EMP001';

-- If NULL, update it:
UPDATE employees
SET company_id = 'aeb3d19c-82bc-462e-9207-92e49d507a07'
WHERE employee_code = 'EMP001';
```

### Issue: RLS policy violation (42501)

**Problem:** RLS policy is blocking the insert
**Solution:**
```sql
-- Check current RLS policy
SELECT with_check FROM pg_policies
WHERE tablename = 'attendance_logs' AND cmd = 'INSERT';

-- Should be:
-- EXISTS (
--   SELECT 1 FROM employees e
--   WHERE e.id = attendance_logs.employee_id
--     AND e.company_id = attendance_logs.company_id
--     AND e.is_active = true
-- )
```

### Issue: NOT NULL violation (23502)

**Problem:** Missing required field
**Check console log for:** Which field is NULL in "Attendance Data to Insert"
**Solution:** Ensure all NOT NULL fields are included:
- company_id (required, no default)
- late_minutes (has default: 0)
- early_leave_minutes (has default: 0)

### Issue: GPS not working

**Problem:** Browser blocking location access
**Solution:**
1. Click lock icon in address bar
2. Allow location access
3. Refresh page

## Test Cases

### Test Case 1: Company A Employee

**Employee Code:** EMP001
**Expected Company ID:** aeb3d19c-82bc-462e-9207-92e49d507a07
**Expected Result:** ✅ Check-in successful

**Console Check:**
```javascript
Company ID: aeb3d19c-82bc-462e-9207-92e49d507a07
✅ SUCCESS: Attendance logged successfully
```

### Test Case 2: Company B Employee

**Employee Code:** EMP006 (or create new employee under Company B)
**Expected Company ID:** 8ab77d2a-dc74-4109-88af-c6a9ef271bf2
**Expected Result:** ✅ Check-in successful

**Console Check:**
```javascript
Company ID: 8ab77d2a-dc74-4109-88af-c6a9ef271bf2
✅ SUCCESS: Attendance logged successfully
```

### Test Case 3: Verify Isolation

**After both check-ins:**

```sql
-- Login as Admin A
SELECT COUNT(*) FROM attendance_logs
WHERE company_id = 'aeb3d19c-82bc-462e-9207-92e49d507a07';
-- Expected: Only EMP001 attendance

-- Login as Admin B
SELECT COUNT(*) FROM attendance_logs
WHERE company_id = '8ab77d2a-dc74-4109-88af-c6a9ef271bf2';
-- Expected: Only EMP006 attendance
```

## Next Steps After Testing

### If Successful:

1. ✅ Remove or reduce console logs
2. ✅ Clean up error alerts (remove technical details)
3. ✅ Test with multiple employees
4. ✅ Verify admin dashboard shows attendance correctly

### If Failed:

1. Copy **entire console output** from "=== ATTENDANCE CHECK-IN DEBUG ===" to end
2. Copy **error alert text**
3. Share both for analysis

## Error to Report Format

When reporting errors, include:

```
BROWSER: Chrome/Firefox/Safari
OS: Windows/Mac/Linux/Mobile

CONSOLE OUTPUT:
[paste entire console output here]

ERROR ALERT:
[paste error alert text here]

SQL VERIFICATION:
[paste results of SQL verification queries]
```

This will help identify the exact root cause.
