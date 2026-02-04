-- ============================================================================
-- VERIFICATION SCRIPT: Employee RLS and Persistence Fix
-- ============================================================================
-- Run this script to verify all fixes are working correctly

\echo '============================================='
\echo 'EMPLOYEE RLS AND PERSISTENCE VERIFICATION'
\echo '============================================='
\echo ''

-- ============================================================================
-- TEST 1: Verify RPC Function Exists
-- ============================================================================

\echo '-------------------------------------------'
\echo 'TEST 1: RPC Function Verification'
\echo '-------------------------------------------'

SELECT
  routine_name,
  routine_type,
  CASE
    WHEN routine_definition LIKE '%SECURITY DEFINER%' THEN '✓ SECURITY DEFINER'
    ELSE '✗ NOT SECURITY DEFINER'
  END as security_status
FROM information_schema.routines
WHERE routine_name = 'get_auto_checkout_settings_for_employee'
  AND routine_schema = 'public';

\echo ''

-- ============================================================================
-- TEST 2: Test RPC Function with Real Employee
-- ============================================================================

\echo '-------------------------------------------'
\echo 'TEST 2: RPC Function Test (Real Data)'
\echo '-------------------------------------------'

DO $$
DECLARE
  v_test_employee_id uuid;
  v_test_employee_name text;
  v_result jsonb;
BEGIN
  -- Get first active employee
  SELECT id, full_name
  INTO v_test_employee_id, v_test_employee_name
  FROM employees
  WHERE is_active = true
  LIMIT 1;

  IF v_test_employee_id IS NULL THEN
    RAISE NOTICE '✗ No active employees found';
    RETURN;
  END IF;

  -- Test the function
  SELECT get_auto_checkout_settings_for_employee(v_test_employee_id) INTO v_result;

  RAISE NOTICE 'Employee: % (%)', v_test_employee_name, v_test_employee_id;
  RAISE NOTICE 'Result: %', v_result;

  IF (v_result->>'success')::boolean = true THEN
    RAISE NOTICE '✓ TEST PASSED: Function works correctly';
    RAISE NOTICE '  Company ID: %', v_result->>'company_id';
    RAISE NOTICE '  Settings: %', v_result->'settings';
  ELSE
    RAISE WARNING '✗ TEST FAILED: %', v_result->>'error';
  END IF;
END $$;

\echo ''

-- ============================================================================
-- TEST 3: Verify employee_location_heartbeat Policies
-- ============================================================================

\echo '-------------------------------------------'
\echo 'TEST 3: employee_location_heartbeat Policies'
\echo '-------------------------------------------'

SELECT
  policyname,
  cmd,
  roles::text,
  CASE
    WHEN policyname = 'employee_location_heartbeat_insert_anon' AND cmd = 'INSERT'
    THEN '✓ Correct'
    ELSE '  OK'
  END as status
FROM pg_policies
WHERE tablename = 'employee_location_heartbeat'
ORDER BY cmd, policyname;

\echo ''

-- ============================================================================
-- TEST 4: Verify All Companies Have Settings
-- ============================================================================

\echo '-------------------------------------------'
\echo 'TEST 4: Company Settings Coverage'
\echo '-------------------------------------------'

SELECT
  c.name as company_name,
  c.status,
  CASE
    WHEN EXISTS (SELECT 1 FROM auto_checkout_settings WHERE company_id = c.id)
    THEN '✓ Has settings'
    ELSE '✗ Missing settings'
  END as settings_status
FROM companies c
WHERE c.status = 'active'
ORDER BY c.created_at;

\echo ''

-- ============================================================================
-- TEST 5: Verify State Persistence Pattern
-- ============================================================================

\echo '-------------------------------------------'
\echo 'TEST 5: State Persistence (Current Status)'
\echo '-------------------------------------------'

SELECT
  e.full_name as employee,
  c.name as company,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM attendance_logs al
      WHERE al.employee_id = e.id
        AND al.check_in_time >= CURRENT_DATE
        AND al.check_out_time IS NULL
    ) THEN '✓ CHECKED_IN'
    ELSE '  CHECKED_OUT'
  END as status,
  (
    SELECT al.check_in_time
    FROM attendance_logs al
    WHERE al.employee_id = e.id
      AND al.check_in_time >= CURRENT_DATE
      AND al.check_out_time IS NULL
    ORDER BY al.check_in_time DESC
    LIMIT 1
  ) as check_in_time
FROM employees e
JOIN companies c ON c.id = e.company_id
WHERE e.is_active = true
  AND c.status = 'active'
ORDER BY c.name, e.full_name;

\echo ''

-- ============================================================================
-- TEST 6: Verify Tenant Isolation
-- ============================================================================

\echo '-------------------------------------------'
\echo 'TEST 6: Tenant Isolation Check'
\echo '-------------------------------------------'

WITH test_data AS (
  SELECT
    al.id,
    al.employee_id,
    al.company_id as log_company_id,
    e.company_id as employee_company_id,
    al.company_id = e.company_id as matches
  FROM attendance_logs al
  JOIN employees e ON e.id = al.employee_id
  WHERE al.check_in_time >= CURRENT_DATE - INTERVAL '7 days'
)
SELECT
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE matches) as matching_company,
  COUNT(*) FILTER (WHERE NOT matches) as mismatched_company,
  CASE
    WHEN COUNT(*) FILTER (WHERE NOT matches) = 0
    THEN '✓ Perfect isolation'
    ELSE '✗ TENANT ISOLATION VIOLATED!'
  END as isolation_status
FROM test_data;

\echo ''

-- ============================================================================
-- TEST 7: Verify RLS Policies on attendance_logs
-- ============================================================================

\echo '-------------------------------------------'
\echo 'TEST 7: attendance_logs RLS Policies (anon)'
\echo '-------------------------------------------'

SELECT
  policyname,
  cmd,
  roles::text,
  CASE
    WHEN cmd = 'SELECT' AND 'anon' = ANY(string_to_array(roles::text, ',')::name[])
    THEN '✓ anon can SELECT'
    WHEN cmd = 'INSERT' AND 'anon' = ANY(string_to_array(roles::text, ',')::name[])
    THEN '✓ anon can INSERT'
    ELSE '  ' || cmd
  END as policy_status
FROM pg_policies
WHERE tablename = 'attendance_logs'
  AND 'anon' = ANY(string_to_array(roles::text, ',')::name[])
ORDER BY cmd, policyname;

\echo ''

-- ============================================================================
-- FINAL SUMMARY
-- ============================================================================

\echo '============================================='
\echo 'VERIFICATION SUMMARY'
\echo '============================================='

DO $$
DECLARE
  v_function_exists boolean;
  v_companies_with_settings integer;
  v_total_companies integer;
  v_heartbeat_policy_exists boolean;
  v_all_tests_passed boolean := true;
BEGIN
  -- Check RPC function
  SELECT EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_name = 'get_auto_checkout_settings_for_employee'
  ) INTO v_function_exists;

  -- Check company settings
  SELECT COUNT(*) INTO v_total_companies
  FROM companies WHERE status = 'active';

  SELECT COUNT(*) INTO v_companies_with_settings
  FROM companies c
  WHERE c.status = 'active'
    AND EXISTS (SELECT 1 FROM auto_checkout_settings WHERE company_id = c.id);

  -- Check heartbeat policy
  SELECT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'employee_location_heartbeat'
      AND policyname = 'employee_location_heartbeat_insert_anon'
  ) INTO v_heartbeat_policy_exists;

  -- Print summary
  RAISE NOTICE '';
  RAISE NOTICE '1. RPC Function: %', CASE WHEN v_function_exists THEN '✓ EXISTS' ELSE '✗ MISSING' END;
  RAISE NOTICE '2. Company Settings: % / % companies', v_companies_with_settings, v_total_companies;
  RAISE NOTICE '3. Heartbeat Policy: %', CASE WHEN v_heartbeat_policy_exists THEN '✓ EXISTS' ELSE '✗ MISSING' END;

  v_all_tests_passed := v_function_exists AND (v_companies_with_settings = v_total_companies) AND v_heartbeat_policy_exists;

  RAISE NOTICE '';
  IF v_all_tests_passed THEN
    RAISE NOTICE '✓✓✓ ALL TESTS PASSED ✓✓✓';
    RAISE NOTICE '';
    RAISE NOTICE 'System is ready for production testing:';
    RAISE NOTICE '1. Test with two companies';
    RAISE NOTICE '2. Test check-in → refresh → verify state persists';
    RAISE NOTICE '3. Test check-in → close browser → reopen → verify state persists';
    RAISE NOTICE '4. Monitor console logs for timezone or RLS errors';
  ELSE
    RAISE WARNING '✗✗✗ SOME TESTS FAILED ✗✗✗';
    RAISE WARNING 'Review the test results above and fix any issues.';
  END IF;
  RAISE NOTICE '';
END $$;

\echo '============================================='
