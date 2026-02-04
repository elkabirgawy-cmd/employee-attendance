-- ================================================================
-- COMPREHENSIVE EMPLOYEE CHECK-IN SETUP VERIFICATION
-- ================================================================
-- Run this script in Supabase SQL Editor to verify all prerequisites
-- ================================================================

-- TEST 1: Verify employees have company_id
-- ================================================================
\echo '========================================';
\echo 'TEST 1: Employees with company_id';
\echo '========================================';

SELECT 
  '1. Employees Setup' as test_name,
  employee_code,
  full_name,
  company_id,
  CASE company_id
    WHEN 'aeb3d19c-82bc-462e-9207-92e49d507a07' THEN 'Company A (Admin A)'
    WHEN '8ab77d2a-dc74-4109-88af-c6a9ef271bf2' THEN 'Company B (Admin B)'
    ELSE 'Unknown Company'
  END as company_name,
  branch_id IS NOT NULL as has_branch,
  shift_id IS NOT NULL as has_shift,
  is_active,
  CASE 
    WHEN company_id IS NOT NULL 
      AND branch_id IS NOT NULL 
      AND shift_id IS NOT NULL 
      AND is_active = true 
    THEN '✅ READY'
    ELSE '❌ MISSING DATA'
  END as status
FROM employees
WHERE employee_code IN ('EMP001', 'EMP002', 'EMP003', 'EMP006')
ORDER BY employee_code;

-- Expected: All employees should have company_id, branch_id, shift_id, is_active=true

-- TEST 2: RLS Policies on attendance_logs
-- ================================================================
\echo '';
\echo '========================================';
\echo 'TEST 2: RLS Policies';
\echo '========================================';

SELECT 
  '2. Attendance RLS Policies' as test_name,
  policyname,
  cmd,
  roles::text,
  CASE 
    WHEN roles::text LIKE '%anon%' THEN '✅ Anonymous Allowed'
    ELSE '❌ Anonymous Blocked'
  END as anonymous_access
FROM pg_policies
WHERE tablename = 'attendance_logs'
  AND cmd IN ('INSERT', 'SELECT', 'UPDATE')
ORDER BY cmd, policyname;

-- Expected:
-- INSERT: employees_can_insert_attendance | {anon,authenticated} | ✅
-- SELECT: employees_can_select_own_attendance | {anon} | ✅
-- UPDATE: employees_can_update_own_attendance | {anon} | ✅

-- TEST 3: Table Grants
-- ================================================================
\echo '';
\echo '========================================';
\echo 'TEST 3: Table Grants';
\echo '========================================';

SELECT 
  '3. Attendance Grants' as test_name,
  grantee,
  string_agg(privilege_type, ', ' ORDER BY privilege_type) as privileges,
  CASE 
    WHEN grantee = 'anon' AND string_agg(privilege_type, ', ') LIKE '%INSERT%' 
    THEN '✅ Can INSERT'
    WHEN grantee = 'anon' 
    THEN '❌ Cannot INSERT'
    ELSE '✅ OK'
  END as status
FROM information_schema.table_privileges
WHERE table_name = 'attendance_logs'
  AND grantee IN ('anon', 'authenticated')
GROUP BY grantee
ORDER BY grantee;

-- Expected: anon should have INSERT, SELECT, UPDATE

-- TEST 4: Supporting Tables Anonymous Access
-- ================================================================
\echo '';
\echo '========================================';
\echo 'TEST 4: Supporting Tables Access';
\echo '========================================';

SELECT 
  '4. Supporting Tables RLS' as test_name,
  tablename,
  COUNT(*) FILTER (WHERE cmd = 'SELECT' AND roles::text LIKE '%anon%') as anon_select_policies,
  CASE 
    WHEN COUNT(*) FILTER (WHERE cmd = 'SELECT' AND roles::text LIKE '%anon%') > 0 
    THEN '✅ Anonymous can SELECT'
    ELSE '❌ Anonymous blocked'
  END as status
FROM pg_policies
WHERE tablename IN ('employees', 'branches', 'shifts')
GROUP BY tablename
ORDER BY tablename;

-- Expected: All 3 tables should allow anonymous SELECT

-- TEST 5: RLS Policy Logic Test
-- ================================================================
\echo '';
\echo '========================================';
\echo 'TEST 5: RLS Policy Logic';
\echo '========================================';

WITH test_data AS (
  SELECT 
    e.id as employee_id,
    e.employee_code,
    e.company_id,
    e.branch_id,
    e.is_active
  FROM employees e
  WHERE e.employee_code IN ('EMP001', 'EMP002')
)
SELECT 
  '5. RLS Would Allow Insert' as test_name,
  td.employee_code,
  td.company_id,
  EXISTS (
    SELECT 1
    FROM employees e
    WHERE e.id = td.employee_id
      AND e.company_id = td.company_id
      AND e.is_active = true
  ) as rls_would_allow,
  CASE 
    WHEN EXISTS (
      SELECT 1
      FROM employees e
      WHERE e.id = td.employee_id
        AND e.company_id = td.company_id
        AND e.is_active = true
    ) THEN '✅ INSERT would succeed'
    ELSE '❌ INSERT would be blocked'
  END as status
FROM test_data td;

-- Expected: Both should show "✅ INSERT would succeed"

-- TEST 6: NOT NULL Constraints
-- ================================================================
\echo '';
\echo '========================================';
\echo 'TEST 6: Required Fields';
\echo '========================================';

SELECT 
  '6. Attendance Required Fields' as test_name,
  column_name,
  data_type,
  column_default,
  CASE 
    WHEN column_default IS NOT NULL THEN '✅ Has default'
    ELSE '⚠️ Must provide value'
  END as requirement
FROM information_schema.columns
WHERE table_name = 'attendance_logs'
  AND is_nullable = 'NO'
  AND column_name != 'id'
ORDER BY column_name;

-- Expected:
-- company_id: ⚠️ Must provide value
-- late_minutes: ✅ Has default (0)
-- early_leave_minutes: ✅ Has default (0)

-- TEST 7: Simulate Insert (DRY RUN)
-- ================================================================
\echo '';
\echo '========================================';
\echo 'TEST 7: Simulate Insert';
\echo '========================================';

EXPLAIN (FORMAT TEXT)
INSERT INTO attendance_logs (
  employee_id,
  company_id,
  branch_id,
  check_in_time,
  check_in_device_time,
  check_in_latitude,
  check_in_longitude,
  check_in_accuracy,
  check_in_distance_m,
  status
)
SELECT 
  e.id,
  e.company_id,
  e.branch_id,
  NOW(),
  NOW(),
  24.7136,
  46.6753,
  15.0,
  45.0,
  'on_time'
FROM employees e
WHERE e.employee_code = 'EMP001'
LIMIT 0; -- Don't actually insert

-- This shows the query plan without inserting

-- SUMMARY
-- ================================================================
\echo '';
\echo '========================================';
\echo 'SUMMARY';
\echo '========================================';

WITH checks AS (
  SELECT 
    COUNT(*) FILTER (WHERE company_id IS NOT NULL) >= 3 as employees_ok
  FROM employees 
  WHERE employee_code IN ('EMP001', 'EMP002', 'EMP003')
),
rls_checks AS (
  SELECT 
    COUNT(*) FILTER (WHERE cmd = 'INSERT' AND roles::text LIKE '%anon%') > 0 as rls_insert_ok,
    COUNT(*) FILTER (WHERE cmd = 'SELECT' AND roles::text LIKE '%anon%') > 0 as rls_select_ok
  FROM pg_policies 
  WHERE tablename = 'attendance_logs'
),
grant_checks AS (
  SELECT 
    COUNT(*) FILTER (WHERE privilege_type = 'INSERT' AND grantee = 'anon') > 0 as grant_ok
  FROM information_schema.table_privileges 
  WHERE table_name = 'attendance_logs'
)
SELECT 
  'FINAL SUMMARY' as test,
  CASE WHEN c.employees_ok THEN '✅' ELSE '❌' END || ' Employees have company_id' as check_1,
  CASE WHEN r.rls_insert_ok THEN '✅' ELSE '❌' END || ' RLS allows anonymous INSERT' as check_2,
  CASE WHEN r.rls_select_ok THEN '✅' ELSE '❌' END || ' RLS allows anonymous SELECT' as check_3,
  CASE WHEN g.grant_ok THEN '✅' ELSE '❌' END || ' Anonymous has INSERT grant' as check_4,
  CASE 
    WHEN c.employees_ok AND r.rls_insert_ok AND r.rls_select_ok AND g.grant_ok 
    THEN '✅✅✅ ALL CHECKS PASSED - EMPLOYEE CHECK-IN SHOULD WORK'
    ELSE '❌❌❌ SOME CHECKS FAILED - REVIEW OUTPUT ABOVE'
  END as overall_status
FROM checks c, rls_checks r, grant_checks g;

-- ================================================================
-- INTERPRETATION GUIDE
-- ================================================================
/*

TEST 1: Employees Setup
- ✅ READY: Employee has all required data
- ❌ MISSING DATA: Employee missing company_id, branch_id, or shift_id

TEST 2: RLS Policies
- ✅ Anonymous Allowed: Policy allows anonymous users
- ❌ Anonymous Blocked: Policy blocks anonymous users

TEST 3: Table Grants
- ✅ Can INSERT: Anonymous role has INSERT permission
- ❌ Cannot INSERT: Anonymous role lacks INSERT permission

TEST 4: Supporting Tables
- ✅ Anonymous can SELECT: Can read employees, branches, shifts
- ❌ Anonymous blocked: Cannot read required data

TEST 5: RLS Logic
- ✅ INSERT would succeed: Policy conditions are met
- ❌ INSERT would be blocked: Policy conditions not met

TEST 6: Required Fields
- ✅ Has default: Field auto-populated
- ⚠️ Must provide value: Must include in INSERT

OVERALL STATUS:
- ✅✅✅ ALL CHECKS PASSED: Everything is configured correctly
- ❌❌❌ SOME CHECKS FAILED: Review failed tests above

*/
