/*
  # Fix Branches RLS Policies

  1. Changes
    - Drop existing "Admins can manage branches" policy that uses FOR ALL
    - Create separate policies for INSERT, UPDATE, and DELETE operations
    - Keep existing SELECT policy for employees to view active branches
    
  2. Security
    - Admins can SELECT all branches (active and inactive)
    - Admins can INSERT new branches
    - Admins can UPDATE existing branches
    - Admins can DELETE branches
    - All policies check that user exists in admin_users table and is active
*/

-- Drop the problematic ALL policy
DROP POLICY IF EXISTS "Admins can manage branches" ON branches;

-- Admin can select all branches (including inactive)
CREATE POLICY "Admins can view all branches"
  ON branches
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.is_active = true
    )
  );

-- Admin can insert branches
CREATE POLICY "Admins can insert branches"
  ON branches
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.is_active = true
    )
  );

-- Admin can update branches
CREATE POLICY "Admins can update branches"
  ON branches
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.is_active = true
    )
  );

-- Admin can delete branches
CREATE POLICY "Admins can delete branches"
  ON branches
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.is_active = true
    )
  );