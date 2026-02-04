/*
  # Fix Admin Users Circular RLS Dependency

  ## Problem
  Current SELECT policy has circular dependency:
  - To read admin_users, you need company_id
  - To get company_id, you need to read admin_users
  - Result: After signup, user can't read their own admin_users record

  ## Fix
  Add policy to allow users to directly read their own record by id
*/

-- Allow users to read their own admin_users record directly
DROP POLICY IF EXISTS "admin_users_select_self" ON admin_users;
CREATE POLICY "admin_users_select_self"
  ON admin_users
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Keep the company-wide policy for viewing team members
-- (admin_users_select_own_company stays as-is)
