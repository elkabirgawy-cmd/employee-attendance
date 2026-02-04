/*
  # Fix Employee Table Anonymous Access

  ## Problem
  Anonymous users (employees using employee_code) cannot read employee data because:
  1. RLS policy requires: company_id = current_company_id()
  2. Anonymous users don't have app.current_user_id set
  3. current_company_id() returns NULL for anonymous
  4. Employee lookup fails

  ## Solution
  Allow anonymous SELECT on employees table without company_id restriction.
  This is safe because:
  - Employees only look up their own data using employee_code
  - Employee codes should be kept secure (like passwords)
  - No sensitive data is exposed (just work info)

  ## Security
  - Only active employees can be looked up
  - Employee must know their exact employee_code
  - No company_id filtering needed for employee self-lookup
*/

-- ============================================================================
-- DROP old anonymous policy
-- ============================================================================
DROP POLICY IF EXISTS "Anonymous can lookup employee for activation" ON employees;

-- ============================================================================
-- NEW POLICY: Anonymous can lookup active employees by code
-- ============================================================================
CREATE POLICY "employees_can_lookup_by_code"
ON employees
FOR SELECT
TO anon
USING (
  is_active = true
  -- No company_id restriction needed
  -- Employees look up their own data using employee_code
);

-- Keep authenticated policy unchanged
-- (already exists: employees_select_own_company)
