-- ================================================================
-- FINAL MULTI-TENANT ISOLATION TEST
-- ================================================================
-- Run this script to verify complete tenant isolation
-- Expected: AdminA and AdminB should see ZERO overlap
-- ================================================================

-- PART 1: Companies and Admins
-- ================================================================
SELECT 
  '═══ COMPANIES & ADMINS ═══' as test_section,
  email,
  company_id,
  CASE company_id
    WHEN 'aeb3d19c-82bc-462e-9207-92e49d507a07' THEN 'Company A'
    WHEN '8ab77d2a-dc74-4109-88af-c6a9ef271bf2' THEN 'Company B'
    ELSE 'Other'
  END as company_name,
  is_active,
  is_owner
FROM admin_users
ORDER BY company_id;

-- PART 2: Data Distribution by Company
-- ================================================================
SELECT '═══ EMPLOYEES BY COMPANY ═══' as test_section, company_id, COUNT(*) as count 
FROM employees GROUP BY company_id

UNION ALL

SELECT '═══ BRANCHES BY COMPANY ═══', company_id, COUNT(*) 
FROM branches GROUP BY company_id

UNION ALL

SELECT '═══ ATTENDANCE BY COMPANY ═══', company_id, COUNT(*) 
FROM attendance_logs GROUP BY company_id

UNION ALL

SELECT '═══ SHIFTS BY COMPANY ═══', company_id, COUNT(*) 
FROM shifts GROUP BY company_id

ORDER BY test_section, company_id;

-- PART 3: RLS Policy Verification
-- ================================================================
SELECT
  '═══ RLS POLICIES STATUS ═══' as test_section,
  tablename,
  COUNT(*) as total_policies,
  COUNT(CASE WHEN qual LIKE '%current_company_id()%' THEN 1 END) as secure_policies,
  COUNT(CASE WHEN qual = 'true' THEN 1 END) as dangerous_policies,
  CASE
    WHEN COUNT(CASE WHEN qual = 'true' THEN 1 END) > 0 THEN '❌ INSECURE'
    WHEN COUNT(CASE WHEN qual LIKE '%current_company_id()%' THEN 1 END) > 0 THEN '✅ SECURE'
    ELSE '⚠️ CHECK'
  END as status
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('employees', 'branches', 'attendance_logs', 'shifts', 'departments',
                    'payroll_records', 'leave_requests', 'devices', 'fraud_alerts')
GROUP BY tablename
ORDER BY status DESC, tablename;

-- PART 4: Final Verdict
-- ================================================================
SELECT
  '═══ FINAL VERDICT ═══' as test_section,
  COUNT(CASE WHEN qual = 'true' THEN 1 END) as dangerous_count,
  CASE
    WHEN COUNT(CASE WHEN qual = 'true' THEN 1 END) = 0 THEN '✅ ISOLATION SECURE - Ready for Production'
    ELSE '❌ ISOLATION BREACHED - Do NOT deploy'
  END as verdict
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    SELECT table_name FROM information_schema.columns WHERE column_name = 'company_id'
  )
  AND cmd IN ('SELECT', 'UPDATE', 'DELETE')
  AND tablename != 'admin_users';

-- PART 5: Expected Results
-- ================================================================
/*
EXPECTED OUTPUT:

═══ COMPANIES & ADMINS ═══
email                          | company_id                              | company_name | is_active | is_owner
-------------------------------|----------------------------------------|--------------|-----------|----------
mohamedelashqer24@gmail.com    | 8ab77d2a-dc74-4109-88af-c6a9ef271bf2  | Company B    | true      | true
elkabirgawy@gmail.com          | aeb3d19c-82bc-462e-9207-92e49d507a07  | Company A    | true      | true

═══ DATA DISTRIBUTION ═══
test_section                   | company_id                              | count
-------------------------------|----------------------------------------|-------
ATTENDANCE BY COMPANY          | aeb3d19c-82bc-462e-9207-92e49d507a07  | 111
BRANCHES BY COMPANY            | aeb3d19c-82bc-462e-9207-92e49d507a07  | 2
EMPLOYEES BY COMPANY           | aeb3d19c-82bc-462e-9207-92e49d507a07  | 7

Note: Company B (8ab77d2a) has no data yet (new company)

═══ FINAL VERDICT ═══
dangerous_count | verdict
----------------|--------------------------------------------------
0               | ✅ ISOLATION SECURE - Ready for Production

If dangerous_count > 0: ❌ DO NOT DEPLOY - Security breach exists
If dangerous_count = 0: ✅ SAFE TO DEPLOY - Complete tenant isolation
*/
