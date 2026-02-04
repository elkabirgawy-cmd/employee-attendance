-- ============================================================================
-- TEST SCRIPT: Load Failed Fix Verification
-- ============================================================================
-- This script verifies that the load failed fix is working correctly
-- Run this script to check the state of your database

-- ============================================================================
-- TEST 1: Verify All Companies Have Settings
-- ============================================================================

DO $$
DECLARE
  v_company RECORD;
  v_total INTEGER := 0;
  v_missing_app INTEGER := 0;
  v_missing_auto INTEGER := 0;
BEGIN
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'TEST 1: Company Settings Verification';
  RAISE NOTICE '===========================================';

  FOR v_company IN
    SELECT
      c.id,
      c.name,
      c.status,
      EXISTS(SELECT 1 FROM application_settings WHERE company_id = c.id) as has_app,
      EXISTS(SELECT 1 FROM auto_checkout_settings WHERE company_id = c.id) as has_auto
    FROM companies c
    WHERE c.status = 'active'
    ORDER BY c.created_at
  LOOP
    v_total := v_total + 1;

    IF NOT v_company.has_app THEN
      v_missing_app := v_missing_app + 1;
      RAISE WARNING '✗ Company "%" (%) missing application_settings', v_company.name, v_company.id;
    END IF;

    IF NOT v_company.has_auto THEN
      v_missing_auto := v_missing_auto + 1;
      RAISE WARNING '✗ Company "%" (%) missing auto_checkout_settings', v_company.name, v_company.id;
    END IF;

    IF v_company.has_app AND v_company.has_auto THEN
      RAISE NOTICE '✓ Company "%" has all required settings', v_company.name;
    END IF;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE 'Summary:';
  RAISE NOTICE '  Total active companies: %', v_total;
  RAISE NOTICE '  Companies missing application_settings: %', v_missing_app;
  RAISE NOTICE '  Companies missing auto_checkout_settings: %', v_missing_auto;

  IF v_missing_app = 0 AND v_missing_auto = 0 THEN
    RAISE NOTICE '';
    RAISE NOTICE '✓✓✓ TEST 1 PASSED: All companies have required settings';
  ELSE
    RAISE WARNING '';
    RAISE WARNING '✗✗✗ TEST 1 FAILED: Some companies missing settings';
  END IF;
  RAISE NOTICE '===========================================';
END $$;

-- ============================================================================
-- TEST 2: Verify Triggers Exist
-- ============================================================================

DO $$
DECLARE
  v_trigger_app INTEGER;
  v_trigger_auto INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'TEST 2: Triggers Verification';
  RAISE NOTICE '===========================================';

  SELECT COUNT(*) INTO v_trigger_app
  FROM information_schema.triggers
  WHERE trigger_name = 'trigger_create_application_settings'
    AND event_object_table = 'companies';

  SELECT COUNT(*) INTO v_trigger_auto
  FROM information_schema.triggers
  WHERE trigger_name = 'trigger_create_auto_checkout_settings'
    AND event_object_table = 'companies';

  IF v_trigger_app > 0 THEN
    RAISE NOTICE '✓ Trigger "trigger_create_application_settings" exists';
  ELSE
    RAISE WARNING '✗ Trigger "trigger_create_application_settings" NOT FOUND';
  END IF;

  IF v_trigger_auto > 0 THEN
    RAISE NOTICE '✓ Trigger "trigger_create_auto_checkout_settings" exists';
  ELSE
    RAISE WARNING '✗ Trigger "trigger_create_auto_checkout_settings" NOT FOUND';
  END IF;

  IF v_trigger_app > 0 AND v_trigger_auto > 0 THEN
    RAISE NOTICE '';
    RAISE NOTICE '✓✓✓ TEST 2 PASSED: All triggers exist';
  ELSE
    RAISE WARNING '';
    RAISE WARNING '✗✗✗ TEST 2 FAILED: Some triggers missing';
  END IF;
  RAISE NOTICE '===========================================';
END $$;

-- ============================================================================
-- TEST 3: Verify RPC Function Exists
-- ============================================================================

DO $$
DECLARE
  v_function_exists INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'TEST 3: RPC Function Verification';
  RAISE NOTICE '===========================================';

  SELECT COUNT(*) INTO v_function_exists
  FROM information_schema.routines
  WHERE routine_name = 'upsert_company_settings'
    AND routine_type = 'FUNCTION';

  IF v_function_exists > 0 THEN
    RAISE NOTICE '✓ RPC Function "upsert_company_settings" exists';
    RAISE NOTICE '';
    RAISE NOTICE '✓✓✓ TEST 3 PASSED: RPC function exists';
  ELSE
    RAISE WARNING '✗ RPC Function "upsert_company_settings" NOT FOUND';
    RAISE WARNING '';
    RAISE WARNING '✗✗✗ TEST 3 FAILED: RPC function missing';
  END IF;
  RAISE NOTICE '===========================================';
END $$;

-- ============================================================================
-- TEST 4: Test RPC Function Works
-- ============================================================================

DO $$
DECLARE
  v_company_id UUID;
  v_result JSONB;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'TEST 4: RPC Function Functionality Test';
  RAISE NOTICE '===========================================';

  -- Get first active company
  SELECT id INTO v_company_id
  FROM companies
  WHERE status = 'active'
  LIMIT 1;

  IF v_company_id IS NULL THEN
    RAISE WARNING '✗ No active companies found to test';
    RAISE WARNING '';
    RAISE WARNING '✗✗✗ TEST 4 FAILED: No test data available';
  ELSE
    -- Test the function
    SELECT upsert_company_settings(v_company_id) INTO v_result;

    RAISE NOTICE 'Testing with company_id: %', v_company_id;
    RAISE NOTICE 'Function result: %', v_result;

    IF (v_result->>'success')::boolean = true THEN
      RAISE NOTICE '✓ RPC function executed successfully';
      RAISE NOTICE '';
      RAISE NOTICE '✓✓✓ TEST 4 PASSED: RPC function works correctly';
    ELSE
      RAISE WARNING '✗ RPC function returned error: %', v_result->>'error';
      RAISE WARNING '';
      RAISE WARNING '✗✗✗ TEST 4 FAILED: RPC function returned error';
    END IF;
  END IF;
  RAISE NOTICE '===========================================';
END $$;

-- ============================================================================
-- TEST 5: Verify Attendance Query Works for All Employees
-- ============================================================================

DO $$
DECLARE
  v_employee RECORD;
  v_total INTEGER := 0;
  v_checked_in INTEGER := 0;
  v_checked_out INTEGER := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'TEST 5: Attendance Query Test';
  RAISE NOTICE '===========================================';

  FOR v_employee IN
    SELECT
      e.id as employee_id,
      e.full_name,
      e.company_id,
      c.name as company_name,
      EXISTS (
        SELECT 1 FROM attendance_logs al
        WHERE al.employee_id = e.id
          AND al.company_id = e.company_id
          AND al.check_in_time >= CURRENT_DATE
          AND al.check_out_time IS NULL
      ) as is_checked_in
    FROM employees e
    JOIN companies c ON c.id = e.company_id
    WHERE e.is_active = true
      AND c.status = 'active'
    ORDER BY c.name, e.full_name
  LOOP
    v_total := v_total + 1;

    IF v_employee.is_checked_in THEN
      v_checked_in := v_checked_in + 1;
      RAISE NOTICE '✓ Employee "%" (Company: %) - CHECKED_IN',
        v_employee.full_name, v_employee.company_name;
    ELSE
      v_checked_out := v_checked_out + 1;
      RAISE NOTICE '  Employee "%" (Company: %) - CHECKED_OUT',
        v_employee.full_name, v_employee.company_name;
    END IF;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE 'Summary:';
  RAISE NOTICE '  Total active employees: %', v_total;
  RAISE NOTICE '  Currently checked in: %', v_checked_in;
  RAISE NOTICE '  Currently checked out: %', v_checked_out;

  IF v_total > 0 THEN
    RAISE NOTICE '';
    RAISE NOTICE '✓✓✓ TEST 5 PASSED: Attendance queries work for all employees';
  ELSE
    RAISE WARNING '';
    RAISE WARNING '✗✗✗ TEST 5 FAILED: No employees found';
  END IF;
  RAISE NOTICE '===========================================';
END $$;

-- ============================================================================
-- FINAL SUMMARY
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'LOAD FAILED FIX VERIFICATION COMPLETE';
  RAISE NOTICE '===========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Review the test results above.';
  RAISE NOTICE 'All tests should show "PASSED" status.';
  RAISE NOTICE '';
  RAISE NOTICE 'If any test failed:';
  RAISE NOTICE '1. Re-run the migration: critical_fix_load_failed_issue.sql';
  RAISE NOTICE '2. Check for errors in migration logs';
  RAISE NOTICE '3. Manually verify the issue reported';
  RAISE NOTICE '===========================================';
END $$;
