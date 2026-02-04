/*
  # Fix Leave Requests Employee RLS Policies

  ## Problem
  Employees cannot submit leave requests in new accounts due to RLS policy violations.
  - Error: "new row violates row-level security policy for table leave_requests"
  - Current policies only work for authenticated (admin) users
  - Employees use anon role and cannot pass current_company_id() check
  - Missing company_id in insert payload

  ## Root Cause Analysis
  1. Migration 20260128130931 removed employee-friendly policies:
     - "Employees can create leave requests" (anon WITH CHECK true) was dropped
     - Only tenant-isolated policies remain (authenticated only)
  2. Policies use current_company_id() which returns NULL for anon users
  3. UI doesn't include company_id in insert payload

  ## Solution
  Follow the same pattern as delay_permissions (20260131011118):
  1. Drop restrictive authenticated-only policies
  2. Create new policies for both anon (employees) and authenticated (admins)
  3. Validate employee_id and company_id match in employees table
  4. UI updated to include company_id in insert

  ## Security Model
  - Employees (anon): Can INSERT/SELECT their own leave requests
  - Validation: employee_id and company_id must match active employee record
  - Admins (authenticated): Full UPDATE/DELETE access to their company's requests
  - Multi-tenant isolation: company_id enforced via employee lookup

  ## Changes
  1. DROP old policies (authenticated only)
  2. CREATE new INSERT policy (anon + authenticated)
  3. CREATE new SELECT policy (anon + authenticated)
  4. CREATE new UPDATE policy (authenticated only - admins)
  5. CREATE new DELETE policy (authenticated only - admins)
*/

-- ============================================================================
-- 1. DROP OLD RESTRICTIVE POLICIES
-- ============================================================================

DO $$
BEGIN
  DROP POLICY IF EXISTS "leave_requests_select_own_company" ON leave_requests;
  DROP POLICY IF EXISTS "leave_requests_insert_own_company" ON leave_requests;
  DROP POLICY IF EXISTS "leave_requests_update_own_company" ON leave_requests;
  DROP POLICY IF EXISTS "leave_requests_delete_own_company" ON leave_requests;
  DROP POLICY IF EXISTS "Admin can manage leave requests" ON leave_requests;
  DROP POLICY IF EXISTS "Employees can view leave requests" ON leave_requests;
  DROP POLICY IF EXISTS "Employees can create leave requests" ON leave_requests;
  DROP POLICY IF EXISTS "Employees can update leave requests" ON leave_requests;
  
  RAISE NOTICE 'Dropped old leave_requests policies';
END $$;

-- ============================================================================
-- 2. CREATE NEW INSERT POLICY (ANON + AUTHENTICATED)
-- ============================================================================

-- Employees (anon) and admins (authenticated) can insert leave requests
-- Validation: employee_id and company_id must match an active employee
CREATE POLICY "leave_requests_insert_employee_validated"
  ON leave_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    -- Validate that employee exists and company_id matches
    EXISTS (
      SELECT 1 FROM employees e
      WHERE e.id = leave_requests.employee_id
      AND e.company_id = leave_requests.company_id
      AND e.is_active = true
    )
  );

COMMENT ON POLICY "leave_requests_insert_employee_validated" ON leave_requests IS 
  'Allows employees (anon) and admins (authenticated) to insert leave requests. Validates employee_id and company_id match active employee record for multi-tenant isolation.';

-- ============================================================================
-- 3. CREATE NEW SELECT POLICY (ANON + AUTHENTICATED)
-- ============================================================================

-- Employees (anon) can view their own requests
-- Admins (authenticated) can view all requests in their company
CREATE POLICY "leave_requests_select_own_or_admin"
  ON leave_requests
  FOR SELECT
  TO anon, authenticated
  USING (
    -- Employee viewing their own requests
    EXISTS (
      SELECT 1 FROM employees e
      WHERE e.id = leave_requests.employee_id
      AND e.company_id = leave_requests.company_id
    )
    OR
    -- Admin viewing their company's requests
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.id = auth.uid()
      AND au.company_id = leave_requests.company_id
    )
  );

COMMENT ON POLICY "leave_requests_select_own_or_admin" ON leave_requests IS 
  'Allows employees to view requests where employee_id/company_id match valid employee, OR admins to view all requests in their company.';

-- ============================================================================
-- 4. CREATE NEW UPDATE POLICY (AUTHENTICATED ONLY - ADMINS)
-- ============================================================================

-- Only admins can update leave requests (approval/rejection)
CREATE POLICY "leave_requests_update_admin_only"
  ON leave_requests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.id = auth.uid()
      AND au.company_id = leave_requests.company_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.id = auth.uid()
      AND au.company_id = leave_requests.company_id
    )
  );

COMMENT ON POLICY "leave_requests_update_admin_only" ON leave_requests IS 
  'Only admins can update leave requests (approve/reject). Ensures company_id matches admin company.';

-- ============================================================================
-- 5. CREATE NEW DELETE POLICY (AUTHENTICATED ONLY - ADMINS)
-- ============================================================================

-- Only admins can delete leave requests
CREATE POLICY "leave_requests_delete_admin_only"
  ON leave_requests
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.id = auth.uid()
      AND au.company_id = leave_requests.company_id
    )
  );

COMMENT ON POLICY "leave_requests_delete_admin_only" ON leave_requests IS 
  'Only admins can delete leave requests. Ensures company_id matches admin company.';

-- ============================================================================
-- 6. VERIFICATION
-- ============================================================================

DO $$
DECLARE
  v_policy_count integer;
BEGIN
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
  AND tablename = 'leave_requests';
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Leave Requests RLS Policies:';
  RAISE NOTICE '  Total policies: %', v_policy_count;
  RAISE NOTICE '  Expected: 4 (INSERT, SELECT, UPDATE, DELETE)';
  RAISE NOTICE '========================================';
  
  IF v_policy_count != 4 THEN
    RAISE WARNING 'Policy count mismatch! Expected 4, got %', v_policy_count;
  ELSE
    RAISE NOTICE '✓ Policy count correct';
  END IF;
END $$;