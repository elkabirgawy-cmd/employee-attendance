-- ================================================================
-- TEST: Dashboard Cards Tenant Isolation
-- ================================================================
-- Run this to verify Dashboard cards are now isolated by company
-- ================================================================

-- STEP 1: Verify functions have company_id filtering
-- ================================================================
SELECT 
  '=== FUNCTION SECURITY CHECK ===' as test,
  p.proname as function_name,
  CASE 
    WHEN pg_get_functiondef(p.oid) LIKE '%current_company_id()%' 
    THEN '✅ SECURE (has company_id filter)'
    ELSE '❌ INSECURE (missing company_id filter)'
  END as security_status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN ('get_present_today', 'get_present_now')
ORDER BY p.proname;

-- STEP 2: Check actual counts per company
-- ================================================================
SELECT 
  '=== ATTENDANCE DATA BY COMPANY ===' as test,
  company_id,
  CASE company_id
    WHEN 'aeb3d19c-82bc-462e-9207-92e49d507a07' THEN 'AdminA (elkabirgawy)'
    WHEN '8ab77d2a-dc74-4109-88af-c6a9ef271bf2' THEN 'AdminB (mohamedelashqer24)'
    ELSE 'Other'
  END as admin_name,
  COUNT(*) as attendance_count,
  COUNT(DISTINCT employee_id) as unique_employees
FROM attendance_logs
WHERE check_in_time >= CURRENT_DATE
GROUP BY company_id
ORDER BY company_id;

-- STEP 3: Expected Results
-- ================================================================
/*
EXPECTED OUTPUT:

=== FUNCTION SECURITY CHECK ===
function_name        | security_status
---------------------|----------------------------------------
get_present_now      | ✅ SECURE (has company_id filter)
get_present_today    | ✅ SECURE (has company_id filter)

=== ATTENDANCE DATA BY COMPANY ===
company_id                              | admin_name                  | attendance_count | unique_employees
----------------------------------------|-----------------------------|------------------|------------------
aeb3d19c-82bc-462e-9207-92e49d507a07   | AdminA (elkabirgawy)       | X                | 7
8ab77d2a-dc74-4109-88af-c6a9ef271bf2   | AdminB (mohamedelashqer24) | 0                | 0

INTERPRETATION:
- If both functions show ✅ SECURE = Functions are fixed
- If AdminA has data and AdminB has 0 = Isolation working correctly
- Dashboard cards will show these company-specific counts

MANUAL TEST IN BROWSER:
1. Login as elkabirgawy@gmail.com → Dashboard shows X employees
2. Login as mohamedelashqer24@gmail.com → Dashboard shows 0 employees
3. Numbers should be DIFFERENT = Isolation successful ✅
*/
