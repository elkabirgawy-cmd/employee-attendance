-- Verification: Check RLS Policies on attendance_logs
-- Run this to verify the fix was applied correctly

-- 1. Check all policies on attendance_logs
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'attendance_logs'
ORDER BY policyname;

-- 2. Check if validate_employee_belongs_to_company function exists
SELECT
  p.proname as function_name,
  pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'validate_employee_belongs_to_company'
  AND n.nspname = 'public';

-- 3. Check grants on the function
SELECT
  routine_name,
  grantee,
  privilege_type
FROM information_schema.routine_privileges
WHERE routine_name = 'validate_employee_belongs_to_company'
  AND routine_schema = 'public'
ORDER BY grantee, privilege_type;

-- 4. Test the function with a fake employee ID
SELECT validate_employee_belongs_to_company(
  '00000000-0000-0000-0000-000000000000'::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid
) as test_result;
-- Should return: false

-- 5. Check table-level grants
SELECT
  grantee,
  privilege_type
FROM information_schema.table_privileges
WHERE table_name = 'attendance_logs'
  AND table_schema = 'public'
ORDER BY grantee, privilege_type;
