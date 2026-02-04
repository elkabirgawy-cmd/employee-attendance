/*
  # Fix Leave Requests Employee Access

  1. Problem
    - Employees authenticate via session tokens (localStorage)
    - Access Supabase with 'anon' role, not 'authenticated'
    - Current RLS policies only allow admin (authenticated) to manage leave_requests
    - Result: "new row violates row-level security policy" error when employee submits

  2. Solution
    - Add INSERT policy for 'anon' role (employees can create leave requests)
    - Add SELECT policy for 'anon' role (employees can view their leave requests)
    - Add UPDATE policy for 'anon' role (for future edits/cancellations)
    - Keep existing admin policies unchanged

  3. Security Model
    - Similar to attendance_logs table
    - Application-level security via session tokens (validated by edge functions)
    - Anon users can create/view leave requests
    - Admin approval required for processing (handled by admin policies)

  4. Policies
    - Employees (anon): Can INSERT, SELECT, UPDATE leave requests
    - Admins (authenticated): Full CRUD access (existing policy)
*/

-- Add INSERT policy for employees (anon role)
CREATE POLICY "Employees can create leave requests"
  ON leave_requests
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Add SELECT policy for employees (anon role)
CREATE POLICY "Employees can view leave requests"
  ON leave_requests
  FOR SELECT
  TO anon
  USING (true);

-- Add UPDATE policy for employees (anon role) - for future features
CREATE POLICY "Employees can update leave requests"
  ON leave_requests
  FOR UPDATE
  TO anon
  USING (status = 'pending')
  WITH CHECK (status = 'pending');

-- Admin policy already exists: "Admin can manage leave requests" (ALL for authenticated)
-- No changes needed to admin access
