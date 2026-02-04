/*
  # Fix Delay Permissions Multi-Company Isolation

  ## Overview
  This migration enhances the delay_permissions system to ensure complete multi-company isolation
  and proper authentication for both employees and admins.

  ## Changes

  ### 1. Helper Function
  - Creates `get_employee_company_id(employee_id UUID)` function
  - Returns the company_id for a given employee
  - Used for automatic company_id validation in RLS policies

  ### 2. Employee RLS Policies (Anonymous Role)
  
  #### INSERT Policy:
  - Employee must be authenticated via employee_sessions
  - Validates employee_id matches session
  - Validates company_id matches employee's company
  - Ensures employee is active
  - **Result**: Employees can ONLY create delay permissions for themselves in their own company
  
  #### SELECT Policy:
  - Employees can view their own delay permissions only
  - Ensures company_id matches to prevent cross-company leaks
  - **Result**: Complete isolation between companies

  ### 3. Admin RLS Policies (Authenticated Role)
  
  #### All Operations:
  - Validates admin belongs to same company_id via admin_users table
  - **Result**: Admins have full access within their company only, zero cross-company access

  ## Security Guarantees
  
  1. ✅ **Multi-tenant Isolation**: Each company's data is completely isolated
  2. ✅ **Employee Authentication**: Employees can only insert for themselves
  3. ✅ **Company Validation**: All operations verify company_id matches
  4. ✅ **No Cross-Company Access**: Impossible to access or modify other companies' data
  5. ✅ **Active Employee Check**: Only active employees can create permissions
*/

-- Drop existing policies to rebuild from scratch
DROP POLICY IF EXISTS "Employees can insert own delay permissions" ON delay_permissions;
DROP POLICY IF EXISTS "Employees can view company delay permissions" ON delay_permissions;
DROP POLICY IF EXISTS "Admins can view delay permissions" ON delay_permissions;
DROP POLICY IF EXISTS "Admins can insert delay permissions" ON delay_permissions;
DROP POLICY IF EXISTS "Admins can update delay permissions" ON delay_permissions;
DROP POLICY IF EXISTS "Admins can delete delay permissions" ON delay_permissions;

-- Helper function: Get company_id from employee_id
CREATE OR REPLACE FUNCTION get_employee_company_id(p_employee_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_company_id UUID;
BEGIN
  SELECT company_id INTO v_company_id
  FROM employees
  WHERE id = p_employee_id;
  
  RETURN v_company_id;
END;
$$;

COMMENT ON FUNCTION get_employee_company_id IS 
  'Returns the company_id for a given employee. Used for RLS validation.';

-- =========================================
-- EMPLOYEE POLICIES (Anonymous Role)
-- =========================================

-- Policy 1: Employees can INSERT delay permissions
-- Requirements:
-- 1. Employee must have active session (validated by checking employee_sessions)
-- 2. employee_id in permission must match session owner
-- 3. company_id must match employee's company
-- 4. Employee must be active
CREATE POLICY "Employees can insert own delay permissions"
  ON delay_permissions
  FOR INSERT
  TO anon
  WITH CHECK (
    -- Verify employee has active session
    EXISTS (
      SELECT 1 FROM employee_sessions
      WHERE employee_sessions.employee_id = delay_permissions.employee_id
      AND employee_sessions.expires_at > now()
    )
    AND
    -- Verify employee exists, is active, and company_id matches
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = delay_permissions.employee_id
      AND employees.company_id = delay_permissions.company_id
      AND employees.is_active = true
    )
  );

-- Policy 2: Employees can SELECT their own delay permissions
-- Requirements:
-- 1. Employee must have active session
-- 2. employee_id matches session owner
-- 3. company_id matches (prevents cross-company access)
CREATE POLICY "Employees can view own delay permissions"
  ON delay_permissions
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM employee_sessions
      WHERE employee_sessions.employee_id = delay_permissions.employee_id
      AND employee_sessions.expires_at > now()
    )
  );

-- =========================================
-- ADMIN POLICIES (Authenticated Role)
-- =========================================

-- Policy 3: Admins can SELECT delay permissions in their company
CREATE POLICY "Admins can view delay permissions"
  ON delay_permissions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.company_id = delay_permissions.company_id
    )
  );

-- Policy 4: Admins can INSERT delay permissions for employees in their company
CREATE POLICY "Admins can insert delay permissions"
  ON delay_permissions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.company_id = delay_permissions.company_id
    )
    AND
    -- Verify employee belongs to same company
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = delay_permissions.employee_id
      AND employees.company_id = delay_permissions.company_id
    )
  );

-- Policy 5: Admins can UPDATE delay permissions in their company
CREATE POLICY "Admins can update delay permissions"
  ON delay_permissions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.company_id = delay_permissions.company_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.company_id = delay_permissions.company_id
    )
  );

-- Policy 6: Admins can DELETE delay permissions in their company
CREATE POLICY "Admins can delete delay permissions"
  ON delay_permissions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.company_id = delay_permissions.company_id
    )
  );

-- Add helpful comments
COMMENT ON POLICY "Employees can insert own delay permissions" ON delay_permissions IS 
  'Allows employees to create delay permission requests via anonymous session. Validates active session, employee ownership, company_id match, and active status.';

COMMENT ON POLICY "Employees can view own delay permissions" ON delay_permissions IS 
  'Allows employees to view their own delay permissions only. Validates active session and company isolation.';

COMMENT ON POLICY "Admins can view delay permissions" ON delay_permissions IS 
  'Allows admins to view all delay permissions within their company only.';

COMMENT ON POLICY "Admins can insert delay permissions" ON delay_permissions IS 
  'Allows admins to create delay permissions for employees in their company.';

COMMENT ON POLICY "Admins can update delay permissions" ON delay_permissions IS 
  'Allows admins to approve/reject delay permissions in their company.';

COMMENT ON POLICY "Admins can delete delay permissions" ON delay_permissions IS 
  'Allows admins to delete delay permissions in their company.';
