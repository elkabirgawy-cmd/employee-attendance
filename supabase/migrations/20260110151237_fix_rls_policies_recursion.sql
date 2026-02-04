/*
  # Fix RLS Policies - Remove Infinite Recursion

  1. Problem
    - Current policies check admin_users table to verify access
    - This creates infinite recursion when trying to read admin_users
    - Error: "infinite recursion detected in policy for relation admin_users"

  2. Solution
    - Drop existing problematic policies
    - Create new simple policies using auth.uid() directly
    - Allow users to read their own record using ID match
    - Allow authenticated users to insert (for registration)

  3. Changes
    - Drop all existing policies on admin_users
    - Create simple non-recursive policies
    - Users can read their own data by ID
    - Users can insert their own record (for registration)
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can view admin users" ON admin_users;
DROP POLICY IF EXISTS "Super admins can manage admin users" ON admin_users;

-- Create new simple policies without recursion

-- Allow users to read their own admin record
CREATE POLICY "Users can read own admin data"
  ON admin_users
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Allow users to insert their own admin record (for registration)
CREATE POLICY "Users can create own admin record"
  ON admin_users
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- Allow users to update their own admin record
CREATE POLICY "Users can update own admin record"
  ON admin_users
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
