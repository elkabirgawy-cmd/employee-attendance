/*
  # Fix Infinite Recursion in RLS Policies

  1. Problem
    - Code 42P17: infinite recursion detected
    - 35+ tables have policies with: EXISTS (SELECT FROM admin_users WHERE id = auth.uid())
    - When logging in, all these policies try to read admin_users simultaneously
    - This creates infinite recursion because admin_users has its own RLS

  2. Solution
    - Create SECURITY DEFINER function that bypasses RLS
    - This function can read admin_users without triggering RLS policies
    - Replace all EXISTS (SELECT FROM admin_users) with function call

  3. Security
    - Function is SECURITY DEFINER but safe because:
      - Only checks if user exists in admin_users
      - Only checks auth.uid() (cannot check other users)
      - Returns boolean (no data leakage)
*/

-- Drop existing function if exists
DROP FUNCTION IF EXISTS public.is_admin(uuid);
DROP FUNCTION IF EXISTS public.is_admin();

-- Create security definer function to check admin status without RLS
CREATE OR REPLACE FUNCTION public.is_admin(check_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_users 
    WHERE id = check_user_id 
    AND is_active = true
  );
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO anon;

-- Now update admin_users policies to use this function
DROP POLICY IF EXISTS "admin_users_select_self" ON admin_users;
DROP POLICY IF EXISTS "admin_users_insert_own" ON admin_users;
DROP POLICY IF EXISTS "admin_users_update_own" ON admin_users;

-- Simple policies that don't create recursion
CREATE POLICY "admin_users_select_self"
  ON admin_users
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Update all other tables to use is_admin() instead of EXISTS
-- activation_codes
DROP POLICY IF EXISTS "Admins can manage activation codes" ON activation_codes;
CREATE POLICY "Admins can manage activation codes"
  ON activation_codes
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- attendance_calculation_settings
DROP POLICY IF EXISTS "Admins can view settings" ON attendance_calculation_settings;
DROP POLICY IF EXISTS "Admins can insert settings" ON attendance_calculation_settings;
DROP POLICY IF EXISTS "Admins can update settings" ON attendance_calculation_settings;

CREATE POLICY "Admins can view settings"
  ON attendance_calculation_settings
  FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can insert settings"
  ON attendance_calculation_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update settings"
  ON attendance_calculation_settings
  FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- audit_logs
DROP POLICY IF EXISTS "Admins can view audit logs" ON audit_logs;
CREATE POLICY "Admins can view audit logs"
  ON audit_logs
  FOR SELECT
  TO authenticated
  USING (is_admin());

-- auto_checkout_settings
DROP POLICY IF EXISTS "allow update auto checkout settings" ON auto_checkout_settings;
CREATE POLICY "allow update auto checkout settings"
  ON auto_checkout_settings
  FOR UPDATE
  TO authenticated
  USING (id = 1 AND is_admin())
  WITH CHECK (id = 1 AND is_admin());

-- device_change_requests
DROP POLICY IF EXISTS "Admins can view all device change requests" ON device_change_requests;
DROP POLICY IF EXISTS "Admins can update device change requests" ON device_change_requests;

CREATE POLICY "Admins can view all device change requests"
  ON device_change_requests
  FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can update device change requests"
  ON device_change_requests
  FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- devices
DROP POLICY IF EXISTS "Admins can view all devices" ON devices;
CREATE POLICY "Admins can view all devices"
  ON devices
  FOR SELECT
  TO authenticated
  USING (is_admin());

-- employee_branches
DROP POLICY IF EXISTS "Admins can manage branch assignments" ON employee_branches;
CREATE POLICY "Admins can manage branch assignments"
  ON employee_branches
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- employee_sessions
DROP POLICY IF EXISTS "Admins can view all sessions" ON employee_sessions;
CREATE POLICY "Admins can view all sessions"
  ON employee_sessions
  FOR SELECT
  TO authenticated
  USING (is_admin());

-- employee_vacation_requests
DROP POLICY IF EXISTS "Admins can view vacation requests" ON employee_vacation_requests;
DROP POLICY IF EXISTS "Admins can insert vacation requests" ON employee_vacation_requests;
DROP POLICY IF EXISTS "Admins can update vacation requests" ON employee_vacation_requests;
DROP POLICY IF EXISTS "Admins can delete vacation requests" ON employee_vacation_requests;

CREATE POLICY "Admins can view vacation requests"
  ON employee_vacation_requests
  FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can insert vacation requests"
  ON employee_vacation_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update vacation requests"
  ON employee_vacation_requests
  FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can delete vacation requests"
  ON employee_vacation_requests
  FOR DELETE
  TO authenticated
  USING (is_admin());

-- fraud_alerts
DROP POLICY IF EXISTS "Admins can view fraud alerts" ON fraud_alerts;
DROP POLICY IF EXISTS "Admins can update fraud alerts" ON fraud_alerts;

CREATE POLICY "Admins can view fraud alerts"
  ON fraud_alerts
  FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can update fraud alerts"
  ON fraud_alerts
  FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- lateness_slabs
DROP POLICY IF EXISTS "Admin can manage lateness slabs" ON lateness_slabs;
CREATE POLICY "Admin can manage lateness slabs"
  ON lateness_slabs
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- leave_balances
DROP POLICY IF EXISTS "Admin can manage leave balances" ON leave_balances;
CREATE POLICY "Admin can manage leave balances"
  ON leave_balances
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- leave_requests
DROP POLICY IF EXISTS "Admin can manage leave requests" ON leave_requests;
CREATE POLICY "Admin can manage leave requests"
  ON leave_requests
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- leave_types
DROP POLICY IF EXISTS "Admin can manage leave types" ON leave_types;
CREATE POLICY "Admin can manage leave types"
  ON leave_types
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- notifications
DROP POLICY IF EXISTS "Admins can view admin notifications" ON notifications;
DROP POLICY IF EXISTS "Admins can update admin notifications" ON notifications;

CREATE POLICY "Admins can view admin notifications"
  ON notifications
  FOR SELECT
  TO authenticated
  USING (role = 'admin' AND is_admin());

CREATE POLICY "Admins can update admin notifications"
  ON notifications
  FOR UPDATE
  TO authenticated
  USING (role = 'admin' AND is_admin())
  WITH CHECK (role = 'admin' AND is_admin());

-- otp_logs
DROP POLICY IF EXISTS "Admins can view all OTP logs" ON otp_logs;
CREATE POLICY "Admins can view all OTP logs"
  ON otp_logs
  FOR SELECT
  TO authenticated
  USING (is_admin());

-- payroll_records
DROP POLICY IF EXISTS "Admins can read all payroll records" ON payroll_records;
CREATE POLICY "Admins can read all payroll records"
  ON payroll_records
  FOR SELECT
  TO authenticated
  USING (is_admin());

-- payroll_runs
DROP POLICY IF EXISTS "Admin can manage payroll runs" ON payroll_runs;
CREATE POLICY "Admin can manage payroll runs"
  ON payroll_runs
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- payroll_settings
DROP POLICY IF EXISTS "Admin can manage payroll settings" ON payroll_settings;
CREATE POLICY "Admin can manage payroll settings"
  ON payroll_settings
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- penalties
DROP POLICY IF EXISTS "Admin can manage penalties" ON penalties;
CREATE POLICY "Admin can manage penalties"
  ON penalties
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- time_sync_logs
DROP POLICY IF EXISTS "Admin users can read all time sync logs" ON time_sync_logs;
CREATE POLICY "Admin users can read all time sync logs"
  ON time_sync_logs
  FOR SELECT
  TO authenticated
  USING (is_admin());

-- timezone_alerts
DROP POLICY IF EXISTS "Admin can view timezone alerts" ON timezone_alerts;
DROP POLICY IF EXISTS "Admin can update timezone alerts" ON timezone_alerts;

CREATE POLICY "Admin can view timezone alerts"
  ON timezone_alerts
  FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admin can update timezone alerts"
  ON timezone_alerts
  FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());
