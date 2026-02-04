-- ============================================================================
-- MULTI-TENANT ISOLATION AUDIT SCRIPT
-- ============================================================================

-- STEP 1: Verify admin_users structure
SELECT
  '=== ADMIN USERS ===' as section,
  email,
  company_id,
  is_active
FROM admin_users
ORDER BY company_id;

-- STEP 2: Data distribution by company
SELECT 'employees' as table_name, company_id, COUNT(*) as count FROM employees GROUP BY company_id
UNION ALL
SELECT 'branches', company_id, COUNT(*) FROM branches GROUP BY company_id
UNION ALL
SELECT 'attendance_logs', company_id, COUNT(*) FROM attendance_logs GROUP BY company_id
UNION ALL
SELECT 'shifts', company_id, COUNT(*) FROM shifts GROUP BY company_id
ORDER BY table_name, company_id;

-- STEP 3: Find dangerous policies (no company filtering)
SELECT
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (SELECT table_name FROM information_schema.columns WHERE column_name = 'company_id')
  AND (qual NOT LIKE '%company_id%' OR qual = 'true' OR qual IS NULL)
  AND cmd != 'INSERT'
ORDER BY tablename;
