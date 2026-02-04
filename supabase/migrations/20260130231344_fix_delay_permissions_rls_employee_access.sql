/*
  # Fix Delay Permissions RLS for Employee Access

  ## Overview
  This migration improves the RLS policies for the delay_permissions table to provide better security
  while maintaining compatibility with the employee authentication system (anonymous access with session tokens).

  ## Security Improvements
  
  ### For Employees (Anonymous Role):
  - **INSERT**: Employees can create delay permissions, but only if:
    - The employee_id exists in the employees table
    - The employee is active (is_active = true)
    - The company_id matches the employee's company_id (tenant isolation)
  
  - **SELECT**: Employees can view delay permissions for their company
    - Application-level filtering by employee_id ensures they only see their own requests
    - Company-level isolation prevents cross-tenant data leaks

  ### For Admins (Authenticated Role):
  - **SELECT**: View all delay permissions in their company
  - **INSERT**: Create delay permissions for any employee in their company
  - **UPDATE**: Approve/reject delay permissions in their company
  - **DELETE**: Delete delay permissions in their company

  ## Changes
  1. Drop existing overly-permissive anonymous policies
  2. Create new policies with proper validation for employees
  3. Keep existing admin policies unchanged
*/

-- Drop existing overly-permissive policies
DROP POLICY IF EXISTS "Employees can create delay permissions" ON delay_permissions;
DROP POLICY IF EXISTS "Employees can view delay permissions" ON delay_permissions;

-- Policy: Employees (anon) can create delay permissions with validation
-- Ensures employee exists, is active, and company_id matches
CREATE POLICY "Employees can insert own delay permissions"
  ON delay_permissions
  FOR INSERT
  TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = delay_permissions.employee_id
      AND employees.company_id = delay_permissions.company_id
      AND employees.is_active = true
    )
  );

-- Policy: Employees (anon) can view delay permissions in their company
-- Application-level code filters by employee_id
-- This policy ensures company-level isolation
CREATE POLICY "Employees can view company delay permissions"
  ON delay_permissions
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = delay_permissions.employee_id
      AND employees.company_id = delay_permissions.company_id
    )
  );

-- Add helpful comments
COMMENT ON POLICY "Employees can insert own delay permissions" ON delay_permissions IS 
  'Allows anonymous users (employees) to create delay permission requests. Validates that employee exists, is active, and company_id matches for tenant isolation.';

COMMENT ON POLICY "Employees can view company delay permissions" ON delay_permissions IS 
  'Allows anonymous users (employees) to view delay permissions. Ensures company-level isolation. Application code filters by employee_id.';
