/*
  # Fix Infinite Recursion in admin_users RLS Policies

  1. Problem
    - Error Code 42P17: infinite recursion detected in policy for table "admin_users"
    - Caused by policies that query admin_users inside themselves
    - Policy "admin_users_select_own_company" has: company_id IN (SELECT company_id FROM admin_users WHERE id = auth.uid())
    - This creates infinite recursion when checking permissions

  2. Solution
    - DROP all existing RLS policies on admin_users
    - Create ONE simple policy: id = auth.uid()
    - NO subqueries, NO EXISTS, NO joins
    - User can only select their own row

  3. Note
    - admin_users.id = auth.users.id (same UUID)
    - No user_id column exists, using id column
*/

-- Drop all existing policies on admin_users
DROP POLICY IF EXISTS "admin_users_select_self" ON admin_users;
DROP POLICY IF EXISTS "admin_users_select_own_company" ON admin_users;
DROP POLICY IF EXISTS "admin_users_insert_own_company" ON admin_users;
DROP POLICY IF EXISTS "admin_users_update_own_company" ON admin_users;
DROP POLICY IF EXISTS "admin_users_delete_own_company" ON admin_users;

-- Ensure RLS is enabled
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Create simple SELECT policy (no recursion)
CREATE POLICY "admin_users_select_self"
  ON admin_users
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());
