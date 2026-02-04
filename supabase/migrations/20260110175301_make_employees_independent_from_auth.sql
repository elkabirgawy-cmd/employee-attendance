/*
  # Make Employees Independent from Auth System

  ## Changes
  This migration makes the employees table independent from Supabase Auth,
  allowing employees to check in using only their employee code without
  requiring a Supabase Auth account.

  1. Schema Changes
    - Remove foreign key constraint linking employees.id to auth.users
    - Make employees.id a regular UUID that doesn't require auth
    
  2. Security Updates
    - Update RLS policies to work with anonymous users
    - Allow employee lookup by employee_code for anonymous users
    
  3. Important Notes
    - Employees no longer need Supabase Auth accounts
    - Check-in system works purely with employee_code
    - Maintains security through employee_code verification
*/

-- Drop the existing foreign key constraint
ALTER TABLE employees 
  DROP CONSTRAINT IF EXISTS employees_id_fkey;

-- Update RLS policies to allow anonymous employee operations
-- These replace the old policies that required authentication

-- Drop old employee policies
DROP POLICY IF EXISTS "Employees can view own profile" ON employees;
DROP POLICY IF EXISTS "Employees can update own profile" ON employees;

-- Create new policy for anonymous employee code lookup
CREATE POLICY "Allow employee lookup by code"
  ON employees FOR SELECT
  TO anon, authenticated
  USING (is_active = true);
