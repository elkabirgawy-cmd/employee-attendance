/*
  # Fix Leave Types Access for Employees

  1. Problem
    - Employees authenticate via session tokens stored in localStorage
    - They access Supabase with 'anon' role, not 'authenticated'
    - Current RLS policies only allow 'authenticated' role to view leave_types
    - Result: Employee dropdown is empty

  2. Solution
    - Add SELECT policy for 'anon' role to view active leave types
    - Keep existing 'authenticated' policy for backward compatibility
    - Admin write policies remain unchanged

  3. Security
    - Anon users can only SELECT (read-only)
    - Only active leave types are visible (is_active = true)
    - No sensitive data exposed in leave_types table
*/

-- Drop existing SELECT policy and recreate with proper access
DROP POLICY IF EXISTS "Everyone can view leave types" ON leave_types;

-- Allow authenticated users (admins) to view all leave types
CREATE POLICY "Authenticated users can view all leave types"
  ON leave_types
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow anonymous users (employees) to view only active leave types
CREATE POLICY "Employees can view active leave types"
  ON leave_types
  FOR SELECT
  TO anon
  USING (is_active = true);

-- Verify admin policy still exists (no changes needed)
-- Policy: "Admin can manage leave types" already exists for ALL operations
