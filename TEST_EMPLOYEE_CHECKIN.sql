-- ================================================================
-- TEST: Employee Attendance Check-In Fix
-- ================================================================
-- Run this to verify employee check-in is working
-- ================================================================

-- STEP 1: Verify RLS policies on attendance_logs
-- ================================================================
SELECT 
  '=== ATTENDANCE_LOGS RLS POLICIES ===' as test,
  policyname,
  cmd,
  roles,
  CASE 
    WHEN roles::text LIKE '%anon%' THEN '✅ Anonymous allowed'
    ELSE '❌ Anonymous blocked'
  END as anonymous_access
FROM pg_policies
WHERE tablename = 'attendance_logs'
ORDER BY cmd, policyname;

-- Expected:
-- employees_can_insert_attendance | INSERT | {anon,authenticated} | ✅ Anonymous allowed
-- employees_can_select_own_attendance | SELECT | {anon} | ✅ Anonymous allowed
-- employees_can_update_own_attendance | UPDATE | {anon} | ✅ Anonymous allowed

-- ================================================================
-- STEP 2: Verify employees have company_id
-- ================================================================
SELECT 
  '=== EMPLOYEES WITH COMPANY_ID ===' as test,
  employee_code,
  full_name,
  company_id,
  CASE company_id
    WHEN 'aeb3d19c-82bc-462e-9207-92e49d507a07' THEN 'Company A (AdminA)'
    WHEN '8ab77d2a-dc74-4109-88af-c6a9ef271bf2' THEN 'Company B (AdminB)'
    ELSE 'Other'
  END as company_name,
  is_active,
  branch_id IS NOT NULL as has_branch,
  shift_id IS NOT NULL as has_shift
FROM employees
WHERE employee_code IN ('EMP001', 'EMP002', 'EMP003', 'EMP006')
ORDER BY employee_code;

-- Expected:
-- All employees should have company_id, branch_id, and shift_id

-- ================================================================
-- STEP 3: Check recent attendance logs
-- ================================================================
SELECT 
  '=== RECENT ATTENDANCE LOGS ===' as test,
  al.id,
  e.employee_code,
  e.full_name,
  al.company_id,
  CASE al.company_id
    WHEN 'aeb3d19c-82bc-462e-9207-92e49d507a07' THEN 'Company A'
    WHEN '8ab77d2a-dc74-4109-88af-c6a9ef271bf2' THEN 'Company B'
    ELSE 'Other'
  END as company_name,
  al.check_in_time,
  al.check_out_time,
  al.check_in_distance_m,
  al.status
FROM attendance_logs al
JOIN employees e ON e.id = al.employee_id
WHERE al.check_in_time >= CURRENT_DATE
ORDER BY al.check_in_time DESC
LIMIT 10;

-- After testing employee check-in, this should show new records with company_id

-- ================================================================
-- STEP 4: Verify anonymous policies on supporting tables
-- ================================================================
SELECT 
  '=== ANONYMOUS ACCESS TO SUPPORTING TABLES ===' as test,
  tablename,
  COUNT(*) FILTER (WHERE roles::text LIKE '%anon%') as anon_policies,
  CASE 
    WHEN COUNT(*) FILTER (WHERE roles::text LIKE '%anon%') > 0 
    THEN '✅ Anonymous allowed'
    ELSE '❌ Anonymous blocked'
  END as status
FROM pg_policies
WHERE tablename IN ('employees', 'branches', 'shifts')
  AND cmd = 'SELECT'
GROUP BY tablename
ORDER BY tablename;

-- Expected:
-- employees | 1 | ✅ Anonymous allowed
-- branches  | 1 | ✅ Anonymous allowed
-- shifts    | 1 | ✅ Anonymous allowed

-- ================================================================
-- STEP 5: Test employee check-in simulation
-- ================================================================
-- This simulates what happens when employee checks in

-- Step 5.1: Employee lookup (anonymous)
SELECT 
  '=== STEP 5.1: Employee Lookup ===' as test,
  id,
  employee_code,
  full_name,
  company_id,
  branch_id,
  shift_id,
  is_active
FROM employees
WHERE employee_code = 'EMP001'
  AND is_active = true;

-- Expected: 1 row with company_id = aeb3d19c...

-- Step 5.2: Branch data (anonymous)
SELECT 
  '=== STEP 5.2: Branch Data ===' as test,
  b.id,
  b.name,
  b.latitude,
  b.longitude,
  b.geofence_radius
FROM branches b
WHERE b.id = (SELECT branch_id FROM employees WHERE employee_code = 'EMP001');

-- Expected: 1 row with GPS coordinates

-- Step 5.3: Shift data (anonymous)
SELECT 
  '=== STEP 5.3: Shift Data ===' as test,
  s.id,
  s.name,
  s.start_time,
  s.end_time,
  s.grace_period_minutes
FROM shifts s
WHERE s.id = (SELECT shift_id FROM employees WHERE employee_code = 'EMP001');

-- Expected: 1 row with shift schedule

-- ================================================================
-- EXPECTED OUTPUT SUMMARY
-- ================================================================
/*
STEP 1: ✅ All RLS policies allow anonymous access for INSERT/SELECT/UPDATE
STEP 2: ✅ All test employees have company_id, branch_id, shift_id
STEP 3: ✅ Recent attendance logs include company_id
STEP 4: ✅ employees, branches, shifts allow anonymous SELECT
STEP 5: ✅ Employee lookup returns data (simulates successful check-in)

MANUAL BROWSER TEST:
1. Open: http://localhost:5173/employee-check-in
2. Enter: EMP001
3. Click: دخول
4. Allow GPS access
5. Click: تسجيل الحضور
6. Expected: ✅ تم تسجيل الحضور بنجاح

VERIFY IN CONSOLE:
- Console should show: "SUCCESS: Attendance logged successfully"
- Console should show: Company ID: aeb3d19c-82bc-462e-9207-92e49d507a07

VERIFY IN DATABASE:
- Run STEP 3 query again
- Should see new attendance record with correct company_id
*/
