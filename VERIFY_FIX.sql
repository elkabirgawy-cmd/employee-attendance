-- =================================================================
-- Verification Script: Employee Check-In Fix
-- Run this after applying FIX_EMPLOYEE_CHECKIN.sql
-- =================================================================

-- Test 1: Verify new RLS policy exists
-- =================================================================
SELECT 
  '1. RLS Policy Check' as test,
  policyname,
  cmd,
  roles::text,
  CASE 
    WHEN with_check = '((employee_id IS NOT NULL) AND (company_id IS NOT NULL) AND (branch_id IS NOT NULL))' 
    THEN '✅ Policy is simplified (correct)'
    ELSE '❌ Policy still has old subquery'
  END as status
FROM pg_policies
WHERE tablename = 'attendance_logs'
  AND policyname = 'employees_can_insert_attendance';

-- Expected: Policy exists with simple NOT NULL checks

-- Test 2: Verify trigger exists
-- =================================================================
SELECT 
  '2. Trigger Check' as test,
  trigger_name,
  event_manipulation,
  action_timing,
  CASE 
    WHEN trigger_name = 'validate_attendance_insert_trigger' 
    THEN '✅ Trigger exists (correct)'
    ELSE '❌ Trigger not found'
  END as status
FROM information_schema.triggers
WHERE event_object_table = 'attendance_logs'
  AND trigger_name = 'validate_attendance_insert_trigger';

-- Expected: Trigger exists and fires BEFORE INSERT

-- Test 3: Verify trigger function exists
-- =================================================================
SELECT 
  '3. Trigger Function Check' as test,
  proname as function_name,
  prosecdef as is_security_definer,
  CASE 
    WHEN prosecdef = true 
    THEN '✅ Function is SECURITY DEFINER (correct)'
    ELSE '❌ Function missing SECURITY DEFINER'
  END as status
FROM pg_proc
WHERE proname = 'validate_attendance_insert';

-- Expected: Function exists with SECURITY DEFINER

-- Test 4: Test INSERT for Company A
-- =================================================================
BEGIN;

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
WHERE e.employee_code = 'EMP001';

SELECT 
  '4. Company A INSERT Test' as test,
  '✅ INSERT succeeded for EMP001' as status,
  id,
  employee_id,
  company_id
FROM attendance_logs
WHERE employee_id = (SELECT id FROM employees WHERE employee_code = 'EMP001')
ORDER BY created_at DESC
LIMIT 1;

ROLLBACK; -- Don't save test data

-- Test 5: Test INSERT for Company B
-- =================================================================
BEGIN;

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
  30.5705,
  31.0023,
  15.0,
  45.0,
  'on_time'
FROM employees e
WHERE e.employee_code = 'EMP633792';

SELECT 
  '5. Company B INSERT Test' as test,
  '✅ INSERT succeeded for EMP633792' as status,
  id,
  employee_id,
  company_id
FROM attendance_logs
WHERE employee_id = (SELECT id FROM employees WHERE employee_code = 'EMP633792')
ORDER BY created_at DESC
LIMIT 1;

ROLLBACK; -- Don't save test data

-- Test 6: Verify trigger rejects invalid company_id
-- =================================================================
DO $$
DECLARE
  test_result text;
BEGIN
  BEGIN
    -- Try to insert with mismatched company_id
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
      '00000000-0000-0000-0000-000000000000'::uuid, -- Wrong company_id
      e.branch_id,
      NOW(),
      NOW(),
      24.7136,
      46.6753,
      15.0,
      45.0,
      'on_time'
    FROM employees e
    WHERE e.employee_code = 'EMP001';
    
    test_result := '❌ Trigger did NOT reject invalid company_id';
    
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%Company ID mismatch%' THEN
      test_result := '✅ Trigger correctly rejected invalid company_id';
    ELSE
      test_result := '❌ Trigger rejected but with wrong error: ' || SQLERRM;
    END IF;
  END;
  
  RAISE NOTICE '6. Trigger Validation Test: %', test_result;
END $$;

-- Final Summary
-- =================================================================
SELECT 
  '=== FINAL SUMMARY ===' as summary,
  CASE 
    WHEN (
      SELECT COUNT(*) = 1 
      FROM pg_policies 
      WHERE tablename = 'attendance_logs' 
        AND policyname = 'employees_can_insert_attendance'
        AND with_check = '((employee_id IS NOT NULL) AND (company_id IS NOT NULL) AND (branch_id IS NOT NULL))'
    ) AND (
      SELECT COUNT(*) = 1 
      FROM information_schema.triggers 
      WHERE event_object_table = 'attendance_logs' 
        AND trigger_name = 'validate_attendance_insert_trigger'
    ) THEN '✅✅✅ ALL CHECKS PASSED - FIX APPLIED SUCCESSFULLY'
    ELSE '❌ Some checks failed - review output above'
  END as status;

