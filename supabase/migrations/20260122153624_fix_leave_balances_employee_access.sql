/*
  # Fix Leave Balances Employee Access

  1. Problem
    - Employees need to view their leave balances to see available days
    - Current RLS policies only allow admin (authenticated) access
    - Frontend fetches leave_balances when opening leave request modal

  2. Solution
    - Add SELECT policy for 'anon' role (employees can view leave balances)
    - Keep existing admin policies unchanged

  3. Security
    - Read-only access for employees
    - Application-level security via session tokens
    - Admins retain full CRUD access
*/

-- Add SELECT policy for employees (anon role)
CREATE POLICY "Employees can view leave balances"
  ON leave_balances
  FOR SELECT
  TO anon
  USING (true);

-- Admin policy already exists: "Admin can manage leave balances" (ALL for authenticated)
-- No changes needed to admin access
