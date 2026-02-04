/*
  # Add Employee Access to Delay Permissions

  ## Overview
  This migration adds RLS policies to allow employees (anonymous users) to create and view delay permission requests.
  The employee authentication is handled at the application level via session tokens.

  ## Changes
    1. Add policy for anonymous users to insert delay permissions
    2. Add policy for anonymous users to view delay permissions
    3. Keep existing admin policies for full management

  ## Security
    - Anonymous users (employees) can create delay permission requests
    - Anonymous users can view delay permissions (filtered by company_id at app level)
    - Only admins can update or delete delay permissions
    - Multi-tenant isolation is maintained via company_id
*/

-- Policy: Allow anonymous users (employees) to create delay permissions
-- Validation will be done at application level
CREATE POLICY "Employees can create delay permissions"
  ON delay_permissions
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Policy: Allow anonymous users (employees) to view delay permissions
-- Filtering by employee_id will be done at application level
CREATE POLICY "Employees can view delay permissions"
  ON delay_permissions
  FOR SELECT
  TO anon
  USING (true);

-- Note: Employees (anon users) cannot update or delete delay permissions
-- Only admins have those permissions via existing policies
