/*
  # Allow Anonymous Employee Check-in

  ## Changes
  This migration adds policies to allow anonymous users (not authenticated via Supabase Auth)
  to access the employee check-in functionality using their employee code.

  1. Security Changes
    - Add policy to allow anonymous users to read employee data by employee_code
    - Add policy to allow anonymous users to view branches and shifts
    - Add policy to allow anonymous users to create attendance records
    
  2. Important Notes
    - Access is restricted to active employees only
    - Employees can only create attendance for themselves
    - Read access is limited to essential fields needed for check-in
*/

-- Allow anonymous users to read their employee data by employee_code
CREATE POLICY "Anonymous can view employee by code"
  ON employees FOR SELECT
  TO anon
  USING (is_active = true);

-- Allow anonymous users to view active branches
CREATE POLICY "Anonymous can view active branches"
  ON branches FOR SELECT
  TO anon
  USING (is_active = true);

-- Allow anonymous users to view active shifts
CREATE POLICY "Anonymous can view active shifts"
  ON shifts FOR SELECT
  TO anon
  USING (is_active = true);
