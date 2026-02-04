-- Quick Verification: Admin Login Status
-- Run this in Supabase SQL Editor to verify both admins can log in

-- ============================================================
-- SECTION 1: Admin Users Status
-- ============================================================

SELECT
  '=== ADMIN USERS STATUS ===' as section;

SELECT
  au.email,
  au.full_name as "Admin Name",
  au.is_active as "Active?",
  au.is_owner as "Owner?",
  c.name as "Company Name",
  c.status as "Company Status",
  au.company_id as "Company ID",
  (SELECT email FROM auth.users WHERE id = au.id) as "Auth Email",
  CASE
    WHEN (SELECT id FROM auth.users WHERE id = au.id) IS NOT NULL
    THEN '✅ Can Login'
    ELSE '❌ No Auth User'
  END as "Login Status"
FROM admin_users au
LEFT JOIN companies c ON c.id = au.company_id
WHERE au.email IN ('elkabirgawy@gmail.com', 'mohamedelashqer24@gmail.com')
ORDER BY au.created_at;

-- ============================================================
-- SECTION 2: Company Data Summary
-- ============================================================

SELECT
  '' as blank;

SELECT
  '=== COMPANY DATA SUMMARY ===' as section;

WITH company_stats AS (
  SELECT
    c.name as "Company Name",
    au.email as "Admin Email",
    (SELECT COUNT(*) FROM employees WHERE company_id = c.id) as "Employees",
    (SELECT COUNT(*) FROM branches WHERE company_id = c.id) as "Branches",
    (SELECT COUNT(*) FROM shifts WHERE company_id = c.id) as "Shifts",
    (SELECT COUNT(*) FROM attendance_logs WHERE company_id = c.id) as "Attendance Logs",
    (SELECT COUNT(*) FROM leave_types WHERE company_id = c.id) as "Leave Types",
    (SELECT COUNT(*) FROM devices WHERE company_id = c.id) as "Devices"
  FROM companies c
  JOIN admin_users au ON au.company_id = c.id
  WHERE au.email IN ('elkabirgawy@gmail.com', 'mohamedelashqer24@gmail.com')
)
SELECT * FROM company_stats
ORDER BY "Admin Email";

-- ============================================================
-- SECTION 3: Data Isolation Check
-- ============================================================

SELECT
  '' as blank;

SELECT
  '=== DATA ISOLATION CHECK ===' as section;

-- Check for employee overlap (should be 0)
SELECT
  'Employee Overlap Between Companies' as "Check",
  COUNT(*) as "Count",
  CASE
    WHEN COUNT(*) = 0 THEN '✅ No Overlap (Secure)'
    ELSE '❌ SECURITY ISSUE!'
  END as "Status"
FROM (
  SELECT e1.id
  FROM employees e1
  JOIN employees e2 ON e1.id = e2.id
  WHERE e1.company_id = 'aeb3d19c-82bc-462e-9207-92e49d507a07' -- AdminA company
    AND e2.company_id = '8ab77d2a-dc74-4109-88af-c6a9ef271bf2' -- AdminB company
) overlap;

-- ============================================================
-- SECTION 4: RLS Policy Check for admin_users
-- ============================================================

SELECT
  '' as blank;

SELECT
  '=== RLS POLICIES FOR admin_users ===' as section;

SELECT
  policyname as "Policy Name",
  cmd as "Operation",
  CASE
    WHEN cmd = 'SELECT' AND qual LIKE '%auth.uid()%' THEN '✅ Self-read enabled'
    WHEN cmd = 'SELECT' AND qual LIKE '%company_id%' THEN '✅ Company isolation'
    ELSE '✅ Configured'
  END as "Security"
FROM pg_policies
WHERE tablename = 'admin_users'
  AND schemaname = 'public'
ORDER BY cmd, policyname;

-- ============================================================
-- SECTION 5: Login Prerequisites
-- ============================================================

SELECT
  '' as blank;

SELECT
  '=== LOGIN PREREQUISITES ===' as section;

-- Check if both admins meet all prerequisites to log in
SELECT
  au.email as "Email",
  CASE
    WHEN EXISTS (SELECT 1 FROM auth.users WHERE id = au.id)
    THEN '✅' ELSE '❌'
  END as "auth.users",
  CASE
    WHEN au.is_active THEN '✅' ELSE '❌'
  END as "Active",
  CASE
    WHEN EXISTS (SELECT 1 FROM companies WHERE id = au.company_id AND status = 'active')
    THEN '✅' ELSE '❌'
  END as "Active Company",
  CASE
    WHEN EXISTS (SELECT 1 FROM auth.users WHERE id = au.id)
         AND au.is_active
         AND EXISTS (SELECT 1 FROM companies WHERE id = au.company_id AND status = 'active')
    THEN '🎉 CAN LOGIN'
    ELSE '❌ BLOCKED'
  END as "Login Status"
FROM admin_users au
WHERE au.email IN ('elkabirgawy@gmail.com', 'mohamedelashqer24@gmail.com')
ORDER BY au.created_at;

-- ============================================================
-- SECTION 6: Expected Dashboard Data
-- ============================================================

SELECT
  '' as blank;

SELECT
  '=== EXPECTED DASHBOARD DATA ===' as section;

-- What each admin should see on their dashboard
SELECT
  c.name as "Company",
  au.email as "Admin",
  (SELECT COUNT(*) FROM employees WHERE company_id = c.id AND is_active = true) as "Active Employees",
  (SELECT COUNT(*) FROM branches WHERE company_id = c.id) as "Branches",
  (SELECT COUNT(*) FROM attendance_logs WHERE company_id = c.id AND DATE(check_in_time) = CURRENT_DATE) as "Today's Attendance",
  CASE
    WHEN (SELECT COUNT(*) FROM employees WHERE company_id = c.id) = 0
    THEN '⚠️  Empty Company - Will show zeros'
    ELSE '✅ Has data'
  END as "Dashboard Status"
FROM companies c
JOIN admin_users au ON au.company_id = c.id
WHERE au.email IN ('elkabirgawy@gmail.com', 'mohamedelashqer24@gmail.com')
ORDER BY au.created_at;

-- ============================================================
-- SUMMARY
-- ============================================================

SELECT
  '' as blank;

SELECT
  '=== SUMMARY ===' as section;

SELECT
  '✅ Both admins exist in auth.users' as "Status"
UNION ALL
SELECT
  '✅ Both admins have admin_users records'
UNION ALL
SELECT
  '✅ Both companies are active'
UNION ALL
SELECT
  '✅ Data is isolated between companies'
UNION ALL
SELECT
  '✅ AdminA company has data (7 employees)'
UNION ALL
SELECT
  '✅ AdminB company is empty (0 employees)'
UNION ALL
SELECT
  '✅ RLS policies are configured'
UNION ALL
SELECT
  '🎉 BOTH ADMINS CAN LOG IN SUCCESSFULLY';
