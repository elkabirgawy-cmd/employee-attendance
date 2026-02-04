/*
  # Remove Permissive RLS Policies

  ## Problem
  Old policies allow viewing ALL data without company_id filtering:
  - "Admins can view all employees" - no company filter
  - "Admins can view all attendance" - no company filter
  - "Authenticated users can * shifts" with qual=true

  ## Fix
  Drop all permissive policies that bypass company isolation.
*/

-- Drop permissive employee policies
DROP POLICY IF EXISTS "Admins can view all employees" ON employees;
DROP POLICY IF EXISTS "Admins can approve device changes" ON employees;

-- Drop permissive attendance policies
DROP POLICY IF EXISTS "Admins can view all attendance" ON attendance_logs;
DROP POLICY IF EXISTS "Anonymous can create attendance logs" ON attendance_logs;
DROP POLICY IF EXISTS "Anonymous can update attendance logs" ON attendance_logs;
DROP POLICY IF EXISTS "Anonymous can view attendance logs" ON attendance_logs;

-- Drop permissive shift policies
DROP POLICY IF EXISTS "Admins can manage shifts" ON shifts;
DROP POLICY IF EXISTS "Authenticated users can delete shifts" ON shifts;
DROP POLICY IF EXISTS "Authenticated users can insert shifts" ON shifts;
DROP POLICY IF EXISTS "Authenticated users can read shifts" ON shifts;
DROP POLICY IF EXISTS "Authenticated users can update shifts" ON shifts;
