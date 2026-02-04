-- =================================================================
-- Employee Check-In INSERT Test
-- This simulates what happens when employee clicks check-in button
-- =================================================================

-- TEST 1: Check if anonymous can read employees
-- =================================================================
SET ROLE anon;

SELECT 
  'TEST 1: Can anonymous read employees?' as test,
  count(*) as count,
  CASE 
    WHEN count(*) > 0 THEN '✅ Can read employees'
    ELSE '❌ Cannot read employees'
  END as result
FROM employees
WHERE employee_code = 'EMP001' AND is_active = true;

-- TEST 2: Check employee data
-- =================================================================
SELECT 
  'TEST 2: Employee data' as test,
  employee_code,
  id as employee_id,
  company_id,
  branch_id,
  shift_id,
  is_active
FROM employees
WHERE employee_code = 'EMP001';

-- TEST 3: Try INSERT as anonymous
-- =================================================================
-- This will show the actual error if any
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

-- If we reach here, insert succeeded
SELECT 
  'TEST 3: INSERT Result' as test,
  '✅ INSERT SUCCEEDED as anonymous' as result,
  id,
  employee_id,
  company_id
FROM attendance_logs
WHERE employee_id = (SELECT id FROM employees WHERE employee_code = 'EMP001')
ORDER BY created_at DESC
LIMIT 1;

ROLLBACK; -- Don't actually save

-- Reset role
RESET ROLE;

-- =================================================================
-- FINAL SUMMARY
-- =================================================================
SELECT 
  'SUMMARY' as test,
  'If all tests passed, the issue is in frontend code or browser'::text as result;

