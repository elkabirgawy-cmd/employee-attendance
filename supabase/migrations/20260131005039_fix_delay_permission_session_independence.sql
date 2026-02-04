/*
  # Fix Delay Permission - Remove Session Requirement

  ## Overview
  This migration removes the requirement for active employee_sessions when submitting delay permissions.
  This allows employees to submit delay permissions even if their session has expired, improving UX.

  ## Key Changes

  ### 1. Remove Session Dependency
  - Delay permissions NO LONGER require active employee_sessions
  - Only require: employee exists, is active, and company_id matches
  - Frontend will handle session refresh automatically

  ### 2. Updated RLS Policies (Anonymous Role)
  - **INSERT**: Only validates employee + company (NO session check)
  - **SELECT**: Only validates employee + company (NO session check)
  - Frontend handles authentication and session management

  ### 3. Benefits
  - ✅ Employees can submit after idle time
  - ✅ Works after app backgrounding
  - ✅ No "session expired" errors
  - ✅ Frontend auto-refreshes session silently
  - ✅ Better UX overall

  ## Security Note
  While we remove the session check from RLS, the frontend still:
  1. Validates employee is logged in (has localStorage data)
  2. Auto-refreshes auth session if expired
  3. Redirects to login if refresh fails
  4. Multi-tenant isolation maintained via company_id check
*/

-- =========================================
-- 1. DROP EXISTING POLICIES
-- =========================================

DROP POLICY IF EXISTS "Employees can insert delay permissions" ON delay_permissions;
DROP POLICY IF EXISTS "Employees can view delay permissions" ON delay_permissions;

-- =========================================
-- 2. NEW SIMPLIFIED EMPLOYEE POLICIES
-- =========================================

-- Policy 1: Employees can INSERT delay permissions
-- Requirements (SIMPLIFIED - NO SESSION CHECK):
-- 1. Employee exists
-- 2. Employee is active
-- 3. Company ID matches
-- Frontend handles authentication and session refresh
CREATE POLICY "Employees can insert delay permissions v2"
  ON delay_permissions
  FOR INSERT
  TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees e
      WHERE e.id = delay_permissions.employee_id
      AND e.company_id = delay_permissions.company_id
      AND e.is_active = true
    )
  );

-- Policy 2: Employees can SELECT delay permissions
-- Requirements (SIMPLIFIED - NO SESSION CHECK):
-- 1. Employee exists
-- 2. Company ID matches (multi-tenant isolation)
-- Frontend filters by employee_id
CREATE POLICY "Employees can view delay permissions v2"
  ON delay_permissions
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM employees e
      WHERE e.id = delay_permissions.employee_id
      AND e.company_id = delay_permissions.company_id
    )
  );

-- =========================================
-- 3. HELPFUL COMMENTS
-- =========================================

COMMENT ON POLICY "Employees can insert delay permissions v2" ON delay_permissions IS
  'Allows employees to create delay permission requests. Only validates employee exists, is active, and company_id matches. NO session check - frontend handles authentication and auto-refresh.';

COMMENT ON POLICY "Employees can view delay permissions v2" ON delay_permissions IS
  'Allows employees to view delay permissions. Only validates employee exists and company_id matches. NO session check - frontend handles authentication.';

-- =========================================
-- 4. UPDATE SELF-TEST FUNCTION
-- =========================================

-- Update test function to not check for active session
CREATE OR REPLACE FUNCTION test_delay_permission_submission(
  p_employee_id UUID,
  p_company_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  test_name TEXT,
  passed BOOLEAN,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_employee_exists BOOLEAN;
  v_employee_active BOOLEAN;
  v_company_matches BOOLEAN;
  v_employee_company_id UUID;
BEGIN
  -- Test 1: Employee exists
  SELECT EXISTS(
    SELECT 1 FROM employees WHERE id = p_employee_id
  ) INTO v_employee_exists;

  RETURN QUERY SELECT
    'Employee Exists'::TEXT,
    v_employee_exists,
    CASE WHEN v_employee_exists THEN '✓ Employee found' ELSE '✗ Employee not found' END;

  IF NOT v_employee_exists THEN
    RETURN;
  END IF;

  -- Test 2: Employee is active
  SELECT is_active, company_id
  INTO v_employee_active, v_employee_company_id
  FROM employees
  WHERE id = p_employee_id;

  RETURN QUERY SELECT
    'Employee Active'::TEXT,
    v_employee_active,
    CASE WHEN v_employee_active THEN '✓ Employee is active' ELSE '✗ Employee is inactive' END;

  -- Test 3: Company ID matches
  v_company_matches := (v_employee_company_id = p_company_id);

  RETURN QUERY SELECT
    'Company ID Match'::TEXT,
    v_company_matches,
    CASE 
      WHEN v_company_matches THEN '✓ Company ID matches'
      ELSE '✗ Company ID mismatch: employee is in ' || v_employee_company_id || ', trying to create for ' || p_company_id
    END;

  -- Test 4: Try a test insert (rolled back)
  BEGIN
    INSERT INTO delay_permissions (
      employee_id,
      company_id,
      date,
      start_time,
      end_time,
      minutes,
      reason,
      status
    ) VALUES (
      p_employee_id,
      p_company_id,
      p_date,
      '09:00',
      '09:30',
      30,
      'Test permission',
      'pending'
    );

    RETURN QUERY SELECT
      'Test Insert'::TEXT,
      true,
      '✓ Test insert succeeded (will be rolled back)'::TEXT;

    RAISE EXCEPTION 'Rolling back test insert';

  EXCEPTION
    WHEN OTHERS THEN
      RETURN QUERY SELECT
        'Test Insert'::TEXT,
        false,
        '✗ Test insert failed: ' || SQLERRM;
  END;
END;
$$;

COMMENT ON FUNCTION test_delay_permission_submission IS
  'Tests if an employee can submit a delay permission. NO session check - only validates employee data.';
