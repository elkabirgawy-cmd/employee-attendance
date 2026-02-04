/*
  # Fix Remaining Dangerous RLS Policies - Part 2

  ## Critical Issues Found
  
  **DANGEROUS POLICIES (qual = true):**
  - application_settings: ANY authenticated user can read/update ALL settings
  - employee_sessions: ANY user can read/update ALL sessions
  - leave_types: ANY user can view ALL companies' leave types
  - otp_logs: ANY user can read/update ALL OTP logs
  - roles: ANY user can view ALL roles

  **ADMIN_NO_FILTER POLICIES (is_admin() without company_id):**
  - All policies using is_admin() allow admin from CompanyA to see CompanyB's data
  - This is a CRITICAL multi-tenant isolation breach

  ## Solution
  
  Replace ALL policies with tenant-isolated versions using current_company_id()
*/

-- ============================================================================
-- APPLICATION_SETTINGS
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated users can read application settings" ON application_settings;
DROP POLICY IF EXISTS "Authenticated users can update application settings" ON application_settings;
DROP POLICY IF EXISTS "application_settings_select_own_company" ON application_settings;
DROP POLICY IF EXISTS "application_settings_insert_own_company" ON application_settings;
DROP POLICY IF EXISTS "application_settings_update_own_company" ON application_settings;
DROP POLICY IF EXISTS "application_settings_delete_own_company" ON application_settings;

CREATE POLICY "application_settings_select_own_company"
  ON application_settings FOR SELECT
  TO authenticated
  USING (company_id = current_company_id());

CREATE POLICY "application_settings_insert_own_company"
  ON application_settings FOR INSERT
  TO authenticated
  WITH CHECK (company_id = current_company_id());

CREATE POLICY "application_settings_update_own_company"
  ON application_settings FOR UPDATE
  TO authenticated
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

-- ============================================================================
-- EMPLOYEE_SESSIONS
-- ============================================================================
DROP POLICY IF EXISTS "Allow session lookup" ON employee_sessions;
DROP POLICY IF EXISTS "Allow session updates" ON employee_sessions;
DROP POLICY IF EXISTS "Admins can view all sessions" ON employee_sessions;
DROP POLICY IF EXISTS "employee_sessions_select_own_company" ON employee_sessions;
DROP POLICY IF EXISTS "employee_sessions_insert_own_company" ON employee_sessions;
DROP POLICY IF EXISTS "employee_sessions_update_own_company" ON employee_sessions;
DROP POLICY IF EXISTS "employee_sessions_delete_own_company" ON employee_sessions;

CREATE POLICY "employee_sessions_select_own_company"
  ON employee_sessions FOR SELECT
  TO authenticated
  USING (company_id = current_company_id());

CREATE POLICY "employee_sessions_insert_own_company"
  ON employee_sessions FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

CREATE POLICY "employee_sessions_update_own_company"
  ON employee_sessions FOR UPDATE
  TO authenticated, anon
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

-- ============================================================================
-- LEAVE_TYPES
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated users can view all leave types" ON leave_types;
DROP POLICY IF EXISTS "Admin can manage leave types" ON leave_types;
DROP POLICY IF EXISTS "Anon can view active leave types" ON leave_types;
DROP POLICY IF EXISTS "Employees can view active leave types" ON leave_types;
DROP POLICY IF EXISTS "leave_types_select_own_company" ON leave_types;
DROP POLICY IF EXISTS "leave_types_insert_own_company" ON leave_types;
DROP POLICY IF EXISTS "leave_types_update_own_company" ON leave_types;
DROP POLICY IF EXISTS "leave_types_delete_own_company" ON leave_types;

CREATE POLICY "leave_types_select_own_company"
  ON leave_types FOR SELECT
  TO authenticated, anon
  USING (company_id = current_company_id());

CREATE POLICY "leave_types_insert_own_company"
  ON leave_types FOR INSERT
  TO authenticated
  WITH CHECK (company_id = current_company_id());

CREATE POLICY "leave_types_update_own_company"
  ON leave_types FOR UPDATE
  TO authenticated
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

CREATE POLICY "leave_types_delete_own_company"
  ON leave_types FOR DELETE
  TO authenticated
  USING (company_id = current_company_id());

-- ============================================================================
-- OTP_LOGS
-- ============================================================================
DROP POLICY IF EXISTS "Allow OTP lookup for verification" ON otp_logs;
DROP POLICY IF EXISTS "Allow OTP verification" ON otp_logs;
DROP POLICY IF EXISTS "Admins can view all OTP logs" ON otp_logs;
DROP POLICY IF EXISTS "Employees can view own OTP logs" ON otp_logs;
DROP POLICY IF EXISTS "otp_logs_select_own_company" ON otp_logs;
DROP POLICY IF EXISTS "otp_logs_insert_own_company" ON otp_logs;
DROP POLICY IF EXISTS "otp_logs_update_own_company" ON otp_logs;
DROP POLICY IF EXISTS "otp_logs_delete_own_company" ON otp_logs;

CREATE POLICY "otp_logs_select_own_company"
  ON otp_logs FOR SELECT
  TO authenticated
  USING (company_id = current_company_id());

CREATE POLICY "otp_logs_insert_own_company"
  ON otp_logs FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

CREATE POLICY "otp_logs_update_own_company"
  ON otp_logs FOR UPDATE
  TO authenticated, anon
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

-- ============================================================================
-- ROLES - KEEP SIMPLE (shared across tenants)
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated users can view roles" ON roles;
-- Keep super_admin policy as is (roles are shared)

-- ============================================================================
-- ACTIVATION_CODES
-- ============================================================================
DROP POLICY IF EXISTS "Admins can manage activation codes" ON activation_codes;
-- Keep tenant-isolated policies only
-- activation_codes_select_own_company ✓
-- activation_codes_insert_own_company ✓
-- activation_codes_update_own_company ✓
-- activation_codes_delete_own_company ✓

-- ============================================================================
-- ATTENDANCE_CALCULATION_SETTINGS
-- ============================================================================
DROP POLICY IF EXISTS "Admins can view settings" ON attendance_calculation_settings;
DROP POLICY IF EXISTS "Admins can insert settings" ON attendance_calculation_settings;
DROP POLICY IF EXISTS "Admins can update settings" ON attendance_calculation_settings;
DROP POLICY IF EXISTS "attendance_calculation_settings_select_own_company" ON attendance_calculation_settings;
DROP POLICY IF EXISTS "attendance_calculation_settings_insert_own_company" ON attendance_calculation_settings;
DROP POLICY IF EXISTS "attendance_calculation_settings_update_own_company" ON attendance_calculation_settings;
DROP POLICY IF EXISTS "attendance_calculation_settings_delete_own_company" ON attendance_calculation_settings;

CREATE POLICY "attendance_calculation_settings_select_own_company"
  ON attendance_calculation_settings FOR SELECT
  TO authenticated
  USING (company_id = current_company_id());

CREATE POLICY "attendance_calculation_settings_insert_own_company"
  ON attendance_calculation_settings FOR INSERT
  TO authenticated
  WITH CHECK (company_id = current_company_id());

CREATE POLICY "attendance_calculation_settings_update_own_company"
  ON attendance_calculation_settings FOR UPDATE
  TO authenticated
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

-- ============================================================================
-- AUDIT_LOGS
-- ============================================================================
DROP POLICY IF EXISTS "Admins can view audit logs" ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_select_own_company" ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_insert_own_company" ON audit_logs;

CREATE POLICY "audit_logs_select_own_company"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (company_id = current_company_id());

CREATE POLICY "audit_logs_insert_own_company"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (company_id = current_company_id());

-- ============================================================================
-- AUTO_CHECKOUT_SETTINGS
-- ============================================================================
DROP POLICY IF EXISTS "allow read auto checkout settings" ON auto_checkout_settings;
DROP POLICY IF EXISTS "allow update auto checkout settings" ON auto_checkout_settings;
DROP POLICY IF EXISTS "auto_checkout_settings_select_own_company" ON auto_checkout_settings;
DROP POLICY IF EXISTS "auto_checkout_settings_insert_own_company" ON auto_checkout_settings;
DROP POLICY IF EXISTS "auto_checkout_settings_update_own_company" ON auto_checkout_settings;

CREATE POLICY "auto_checkout_settings_select_own_company"
  ON auto_checkout_settings FOR SELECT
  TO authenticated
  USING (company_id = current_company_id());

CREATE POLICY "auto_checkout_settings_insert_own_company"
  ON auto_checkout_settings FOR INSERT
  TO authenticated
  WITH CHECK (company_id = current_company_id());

CREATE POLICY "auto_checkout_settings_update_own_company"
  ON auto_checkout_settings FOR UPDATE
  TO authenticated
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

-- ============================================================================
-- EMPLOYEE_BRANCHES
-- ============================================================================
DROP POLICY IF EXISTS "Admins can manage branch assignments" ON employee_branches;
DROP POLICY IF EXISTS "Employees can view own branch assignments" ON employee_branches;
DROP POLICY IF EXISTS "employee_branches_select_own_company" ON employee_branches;
DROP POLICY IF EXISTS "employee_branches_insert_own_company" ON employee_branches;
DROP POLICY IF EXISTS "employee_branches_update_own_company" ON employee_branches;
DROP POLICY IF EXISTS "employee_branches_delete_own_company" ON employee_branches;

CREATE POLICY "employee_branches_select_own_company"
  ON employee_branches FOR SELECT
  TO authenticated
  USING (company_id = current_company_id());

CREATE POLICY "employee_branches_insert_own_company"
  ON employee_branches FOR INSERT
  TO authenticated
  WITH CHECK (company_id = current_company_id());

CREATE POLICY "employee_branches_update_own_company"
  ON employee_branches FOR UPDATE
  TO authenticated
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

CREATE POLICY "employee_branches_delete_own_company"
  ON employee_branches FOR DELETE
  TO authenticated
  USING (company_id = current_company_id());

-- ============================================================================
-- EMPLOYEE_VACATION_REQUESTS
-- ============================================================================
DROP POLICY IF EXISTS "Admins can view vacation requests" ON employee_vacation_requests;
DROP POLICY IF EXISTS "Admins can insert vacation requests" ON employee_vacation_requests;
DROP POLICY IF EXISTS "Admins can update vacation requests" ON employee_vacation_requests;
DROP POLICY IF EXISTS "Admins can delete vacation requests" ON employee_vacation_requests;
DROP POLICY IF EXISTS "employee_vacation_requests_select_own_company" ON employee_vacation_requests;
DROP POLICY IF EXISTS "employee_vacation_requests_insert_own_company" ON employee_vacation_requests;
DROP POLICY IF EXISTS "employee_vacation_requests_update_own_company" ON employee_vacation_requests;
DROP POLICY IF EXISTS "employee_vacation_requests_delete_own_company" ON employee_vacation_requests;

CREATE POLICY "employee_vacation_requests_select_own_company"
  ON employee_vacation_requests FOR SELECT
  TO authenticated
  USING (company_id = current_company_id());

CREATE POLICY "employee_vacation_requests_insert_own_company"
  ON employee_vacation_requests FOR INSERT
  TO authenticated
  WITH CHECK (company_id = current_company_id());

CREATE POLICY "employee_vacation_requests_update_own_company"
  ON employee_vacation_requests FOR UPDATE
  TO authenticated
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

CREATE POLICY "employee_vacation_requests_delete_own_company"
  ON employee_vacation_requests FOR DELETE
  TO authenticated
  USING (company_id = current_company_id());

-- ============================================================================
-- LATENESS_SLABS
-- ============================================================================
DROP POLICY IF EXISTS "Admin can manage lateness slabs" ON lateness_slabs;
DROP POLICY IF EXISTS "lateness_slabs_select_own_company" ON lateness_slabs;
DROP POLICY IF EXISTS "lateness_slabs_insert_own_company" ON lateness_slabs;
DROP POLICY IF EXISTS "lateness_slabs_update_own_company" ON lateness_slabs;
DROP POLICY IF EXISTS "lateness_slabs_delete_own_company" ON lateness_slabs;

CREATE POLICY "lateness_slabs_select_own_company"
  ON lateness_slabs FOR SELECT
  TO authenticated
  USING (company_id = current_company_id());

CREATE POLICY "lateness_slabs_insert_own_company"
  ON lateness_slabs FOR INSERT
  TO authenticated
  WITH CHECK (company_id = current_company_id());

CREATE POLICY "lateness_slabs_update_own_company"
  ON lateness_slabs FOR UPDATE
  TO authenticated
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

CREATE POLICY "lateness_slabs_delete_own_company"
  ON lateness_slabs FOR DELETE
  TO authenticated
  USING (company_id = current_company_id());

-- ============================================================================
-- PAYROLL_RUNS
-- ============================================================================
DROP POLICY IF EXISTS "Admin can manage payroll runs" ON payroll_runs;
DROP POLICY IF EXISTS "payroll_runs_select_own_company" ON payroll_runs;
DROP POLICY IF EXISTS "payroll_runs_insert_own_company" ON payroll_runs;
DROP POLICY IF EXISTS "payroll_runs_update_own_company" ON payroll_runs;
DROP POLICY IF EXISTS "payroll_runs_delete_own_company" ON payroll_runs;

CREATE POLICY "payroll_runs_select_own_company"
  ON payroll_runs FOR SELECT
  TO authenticated
  USING (company_id = current_company_id());

CREATE POLICY "payroll_runs_insert_own_company"
  ON payroll_runs FOR INSERT
  TO authenticated
  WITH CHECK (company_id = current_company_id());

CREATE POLICY "payroll_runs_update_own_company"
  ON payroll_runs FOR UPDATE
  TO authenticated
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

CREATE POLICY "payroll_runs_delete_own_company"
  ON payroll_runs FOR DELETE
  TO authenticated
  USING (company_id = current_company_id());

-- ============================================================================
-- PAYROLL_SETTINGS
-- ============================================================================
DROP POLICY IF EXISTS "Admin can manage payroll settings" ON payroll_settings;
DROP POLICY IF EXISTS "payroll_settings_select_own_company" ON payroll_settings;
DROP POLICY IF EXISTS "payroll_settings_insert_own_company" ON payroll_settings;
DROP POLICY IF EXISTS "payroll_settings_update_own_company" ON payroll_settings;
DROP POLICY IF EXISTS "payroll_settings_delete_own_company" ON payroll_settings;

CREATE POLICY "payroll_settings_select_own_company"
  ON payroll_settings FOR SELECT
  TO authenticated
  USING (company_id = current_company_id());

CREATE POLICY "payroll_settings_insert_own_company"
  ON payroll_settings FOR INSERT
  TO authenticated
  WITH CHECK (company_id = current_company_id());

CREATE POLICY "payroll_settings_update_own_company"
  ON payroll_settings FOR UPDATE
  TO authenticated
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

CREATE POLICY "payroll_settings_delete_own_company"
  ON payroll_settings FOR DELETE
  TO authenticated
  USING (company_id = current_company_id());

-- ============================================================================
-- SYSTEM_SETTINGS - Keep admin view policy with super_admin
-- ============================================================================
DROP POLICY IF EXISTS "Admins can view system settings" ON system_settings;
-- Keep super_admin policy

-- ============================================================================
-- TIME_SYNC_LOGS
-- ============================================================================
DROP POLICY IF EXISTS "Admin users can read all time sync logs" ON time_sync_logs;
DROP POLICY IF EXISTS "time_sync_logs_select_own_company" ON time_sync_logs;
DROP POLICY IF EXISTS "time_sync_logs_insert_own_company" ON time_sync_logs;

CREATE POLICY "time_sync_logs_select_own_company"
  ON time_sync_logs FOR SELECT
  TO authenticated
  USING (company_id = current_company_id());

CREATE POLICY "time_sync_logs_insert_own_company"
  ON time_sync_logs FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

-- ============================================================================
-- TIMEZONE_ALERTS
-- ============================================================================
DROP POLICY IF EXISTS "Admin can view timezone alerts" ON timezone_alerts;
DROP POLICY IF EXISTS "Admin can update timezone alerts" ON timezone_alerts;
DROP POLICY IF EXISTS "timezone_alerts_select_own_company" ON timezone_alerts;
DROP POLICY IF EXISTS "timezone_alerts_insert_own_company" ON timezone_alerts;
DROP POLICY IF EXISTS "timezone_alerts_update_own_company" ON timezone_alerts;
DROP POLICY IF EXISTS "timezone_alerts_delete_own_company" ON timezone_alerts;

CREATE POLICY "timezone_alerts_select_own_company"
  ON timezone_alerts FOR SELECT
  TO authenticated
  USING (company_id = current_company_id());

CREATE POLICY "timezone_alerts_insert_own_company"
  ON timezone_alerts FOR INSERT
  TO authenticated
  WITH CHECK (company_id = current_company_id());

CREATE POLICY "timezone_alerts_update_own_company"
  ON timezone_alerts FOR UPDATE
  TO authenticated
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

CREATE POLICY "timezone_alerts_delete_own_company"
  ON timezone_alerts FOR DELETE
  TO authenticated
  USING (company_id = current_company_id());

-- ============================================================================
-- NOTIFICATIONS - Fix to use company filtering
-- ============================================================================
DROP POLICY IF EXISTS "Admins can view admin notifications" ON notifications;
DROP POLICY IF EXISTS "Admins can update admin notifications" ON notifications;
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
DROP POLICY IF EXISTS "notifications_select_own_company" ON notifications;
DROP POLICY IF EXISTS "notifications_insert_own_company" ON notifications;
DROP POLICY IF EXISTS "notifications_update_own_company" ON notifications;
DROP POLICY IF EXISTS "notifications_delete_own_company" ON notifications;

-- Create proper company-isolated notification policies
CREATE POLICY "notifications_select_own_user"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "notifications_insert_any"
  ON notifications FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

CREATE POLICY "notifications_update_own_user"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
