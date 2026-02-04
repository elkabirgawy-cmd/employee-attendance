/*
  # Enforce Strict Tenant Isolation - Part 2: RLS Policies

  ## Overview
  Add comprehensive RLS policies for complete tenant isolation.
  All queries filtered by: WHERE company_id = current_company_id()

  ## Security Rules
  - SELECT: Only own company data
  - INSERT: Auto-set company_id via trigger
  - UPDATE/DELETE: Only own company data
*/

-- =====================================================
-- COMPANIES TABLE
-- =====================================================

DROP POLICY IF EXISTS "companies_select_own" ON companies;
CREATE POLICY "companies_select_own"
  ON companies
  FOR SELECT
  TO authenticated
  USING (id = current_company_id());

DROP POLICY IF EXISTS "companies_update_own" ON companies;
CREATE POLICY "companies_update_own"
  ON companies
  FOR UPDATE
  TO authenticated
  USING (id = current_company_id())
  WITH CHECK (id = current_company_id());

-- =====================================================
-- EMPLOYEES
-- =====================================================

DROP POLICY IF EXISTS "employees_select_own_company" ON employees;
CREATE POLICY "employees_select_own_company"
  ON employees
  FOR SELECT
  TO authenticated
  USING (company_id = current_company_id());

DROP POLICY IF EXISTS "employees_insert_own_company" ON employees;
CREATE POLICY "employees_insert_own_company"
  ON employees
  FOR INSERT
  TO authenticated
  WITH CHECK (company_id = current_company_id());

DROP POLICY IF EXISTS "employees_update_own_company" ON employees;
CREATE POLICY "employees_update_own_company"
  ON employees
  FOR UPDATE
  TO authenticated
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

DROP POLICY IF EXISTS "employees_delete_own_company" ON employees;
CREATE POLICY "employees_delete_own_company"
  ON employees
  FOR DELETE
  TO authenticated
  USING (company_id = current_company_id());

-- =====================================================
-- BRANCHES
-- =====================================================

DROP POLICY IF EXISTS "branches_select_own_company" ON branches;
CREATE POLICY "branches_select_own_company"
  ON branches
  FOR SELECT
  TO authenticated
  USING (company_id = current_company_id());

DROP POLICY IF EXISTS "branches_insert_own_company" ON branches;
CREATE POLICY "branches_insert_own_company"
  ON branches
  FOR INSERT
  TO authenticated
  WITH CHECK (company_id = current_company_id());

DROP POLICY IF EXISTS "branches_update_own_company" ON branches;
CREATE POLICY "branches_update_own_company"
  ON branches
  FOR UPDATE
  TO authenticated
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

DROP POLICY IF EXISTS "branches_delete_own_company" ON branches;
CREATE POLICY "branches_delete_own_company"
  ON branches
  FOR DELETE
  TO authenticated
  USING (company_id = current_company_id());

-- =====================================================
-- SHIFTS
-- =====================================================

DROP POLICY IF EXISTS "shifts_select_own_company" ON shifts;
CREATE POLICY "shifts_select_own_company"
  ON shifts
  FOR SELECT
  TO authenticated
  USING (company_id = current_company_id());

DROP POLICY IF EXISTS "shifts_insert_own_company" ON shifts;
CREATE POLICY "shifts_insert_own_company"
  ON shifts
  FOR INSERT
  TO authenticated
  WITH CHECK (company_id = current_company_id());

DROP POLICY IF EXISTS "shifts_update_own_company" ON shifts;
CREATE POLICY "shifts_update_own_company"
  ON shifts
  FOR UPDATE
  TO authenticated
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

DROP POLICY IF EXISTS "shifts_delete_own_company" ON shifts;
CREATE POLICY "shifts_delete_own_company"
  ON shifts
  FOR DELETE
  TO authenticated
  USING (company_id = current_company_id());

-- =====================================================
-- DEPARTMENTS
-- =====================================================

DROP POLICY IF EXISTS "departments_select_own_company" ON departments;
CREATE POLICY "departments_select_own_company"
  ON departments
  FOR SELECT
  TO authenticated
  USING (company_id = current_company_id());

DROP POLICY IF EXISTS "departments_insert_own_company" ON departments;
CREATE POLICY "departments_insert_own_company"
  ON departments
  FOR INSERT
  TO authenticated
  WITH CHECK (company_id = current_company_id());

DROP POLICY IF EXISTS "departments_update_own_company" ON departments;
CREATE POLICY "departments_update_own_company"
  ON departments
  FOR UPDATE
  TO authenticated
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

DROP POLICY IF EXISTS "departments_delete_own_company" ON departments;
CREATE POLICY "departments_delete_own_company"
  ON departments
  FOR DELETE
  TO authenticated
  USING (company_id = current_company_id());

-- =====================================================
-- ATTENDANCE_LOGS
-- =====================================================

DROP POLICY IF EXISTS "attendance_logs_select_own_company" ON attendance_logs;
CREATE POLICY "attendance_logs_select_own_company"
  ON attendance_logs
  FOR SELECT
  TO authenticated
  USING (company_id = current_company_id());

DROP POLICY IF EXISTS "attendance_logs_insert_own_company" ON attendance_logs;
CREATE POLICY "attendance_logs_insert_own_company"
  ON attendance_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (company_id = current_company_id());

DROP POLICY IF EXISTS "attendance_logs_update_own_company" ON attendance_logs;
CREATE POLICY "attendance_logs_update_own_company"
  ON attendance_logs
  FOR UPDATE
  TO authenticated
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

DROP POLICY IF EXISTS "attendance_logs_delete_own_company" ON attendance_logs;
CREATE POLICY "attendance_logs_delete_own_company"
  ON attendance_logs
  FOR DELETE
  TO authenticated
  USING (company_id = current_company_id());

-- =====================================================
-- DEVICES
-- =====================================================

DROP POLICY IF EXISTS "devices_select_own_company" ON devices;
CREATE POLICY "devices_select_own_company"
  ON devices
  FOR SELECT
  TO authenticated
  USING (company_id = current_company_id());

DROP POLICY IF EXISTS "devices_insert_own_company" ON devices;
CREATE POLICY "devices_insert_own_company"
  ON devices
  FOR INSERT
  TO authenticated
  WITH CHECK (company_id = current_company_id());

DROP POLICY IF EXISTS "devices_update_own_company" ON devices;
CREATE POLICY "devices_update_own_company"
  ON devices
  FOR UPDATE
  TO authenticated
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

DROP POLICY IF EXISTS "devices_delete_own_company" ON devices;
CREATE POLICY "devices_delete_own_company"
  ON devices
  FOR DELETE
  TO authenticated
  USING (company_id = current_company_id());

-- =====================================================
-- PAYROLL_RECORDS
-- =====================================================

DROP POLICY IF EXISTS "payroll_records_select_own_company" ON payroll_records;
CREATE POLICY "payroll_records_select_own_company"
  ON payroll_records
  FOR SELECT
  TO authenticated
  USING (company_id = current_company_id());

DROP POLICY IF EXISTS "payroll_records_insert_own_company" ON payroll_records;
CREATE POLICY "payroll_records_insert_own_company"
  ON payroll_records
  FOR INSERT
  TO authenticated
  WITH CHECK (company_id = current_company_id());

DROP POLICY IF EXISTS "payroll_records_update_own_company" ON payroll_records;
CREATE POLICY "payroll_records_update_own_company"
  ON payroll_records
  FOR UPDATE
  TO authenticated
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

DROP POLICY IF EXISTS "payroll_records_delete_own_company" ON payroll_records;
CREATE POLICY "payroll_records_delete_own_company"
  ON payroll_records
  FOR DELETE
  TO authenticated
  USING (company_id = current_company_id());

-- =====================================================
-- LEAVE_TYPES
-- =====================================================

DROP POLICY IF EXISTS "leave_types_select_own_company" ON leave_types;
CREATE POLICY "leave_types_select_own_company"
  ON leave_types
  FOR SELECT
  TO authenticated
  USING (company_id = current_company_id());

DROP POLICY IF EXISTS "leave_types_insert_own_company" ON leave_types;
CREATE POLICY "leave_types_insert_own_company"
  ON leave_types
  FOR INSERT
  TO authenticated
  WITH CHECK (company_id = current_company_id());

DROP POLICY IF EXISTS "leave_types_update_own_company" ON leave_types;
CREATE POLICY "leave_types_update_own_company"
  ON leave_types
  FOR UPDATE
  TO authenticated
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

DROP POLICY IF EXISTS "leave_types_delete_own_company" ON leave_types;
CREATE POLICY "leave_types_delete_own_company"
  ON leave_types
  FOR DELETE
  TO authenticated
  USING (company_id = current_company_id());

-- =====================================================
-- LEAVE_BALANCES
-- =====================================================

DROP POLICY IF EXISTS "leave_balances_select_own_company" ON leave_balances;
CREATE POLICY "leave_balances_select_own_company"
  ON leave_balances
  FOR SELECT
  TO authenticated
  USING (company_id = current_company_id());

DROP POLICY IF EXISTS "leave_balances_insert_own_company" ON leave_balances;
CREATE POLICY "leave_balances_insert_own_company"
  ON leave_balances
  FOR INSERT
  TO authenticated
  WITH CHECK (company_id = current_company_id());

DROP POLICY IF EXISTS "leave_balances_update_own_company" ON leave_balances;
CREATE POLICY "leave_balances_update_own_company"
  ON leave_balances
  FOR UPDATE
  TO authenticated
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

DROP POLICY IF EXISTS "leave_balances_delete_own_company" ON leave_balances;
CREATE POLICY "leave_balances_delete_own_company"
  ON leave_balances
  FOR DELETE
  TO authenticated
  USING (company_id = current_company_id());

-- =====================================================
-- LEAVE_REQUESTS
-- =====================================================

DROP POLICY IF EXISTS "leave_requests_select_own_company" ON leave_requests;
CREATE POLICY "leave_requests_select_own_company"
  ON leave_requests
  FOR SELECT
  TO authenticated
  USING (company_id = current_company_id());

DROP POLICY IF EXISTS "leave_requests_insert_own_company" ON leave_requests;
CREATE POLICY "leave_requests_insert_own_company"
  ON leave_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (company_id = current_company_id());

DROP POLICY IF EXISTS "leave_requests_update_own_company" ON leave_requests;
CREATE POLICY "leave_requests_update_own_company"
  ON leave_requests
  FOR UPDATE
  TO authenticated
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

DROP POLICY IF EXISTS "leave_requests_delete_own_company" ON leave_requests;
CREATE POLICY "leave_requests_delete_own_company"
  ON leave_requests
  FOR DELETE
  TO authenticated
  USING (company_id = current_company_id());

-- =====================================================
-- FRAUD_ALERTS
-- =====================================================

DROP POLICY IF EXISTS "fraud_alerts_select_own_company" ON fraud_alerts;
CREATE POLICY "fraud_alerts_select_own_company"
  ON fraud_alerts
  FOR SELECT
  TO authenticated
  USING (company_id = current_company_id());

DROP POLICY IF EXISTS "fraud_alerts_insert_own_company" ON fraud_alerts;
CREATE POLICY "fraud_alerts_insert_own_company"
  ON fraud_alerts
  FOR INSERT
  TO authenticated
  WITH CHECK (company_id = current_company_id());

DROP POLICY IF EXISTS "fraud_alerts_update_own_company" ON fraud_alerts;
CREATE POLICY "fraud_alerts_update_own_company"
  ON fraud_alerts
  FOR UPDATE
  TO authenticated
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

DROP POLICY IF EXISTS "fraud_alerts_delete_own_company" ON fraud_alerts;
CREATE POLICY "fraud_alerts_delete_own_company"
  ON fraud_alerts
  FOR DELETE
  TO authenticated
  USING (company_id = current_company_id());

-- =====================================================
-- TIMEZONE_ALERTS
-- =====================================================

DROP POLICY IF EXISTS "timezone_alerts_select_own_company" ON timezone_alerts;
CREATE POLICY "timezone_alerts_select_own_company"
  ON timezone_alerts
  FOR SELECT
  TO authenticated
  USING (company_id = current_company_id());

DROP POLICY IF EXISTS "timezone_alerts_insert_own_company" ON timezone_alerts;
CREATE POLICY "timezone_alerts_insert_own_company"
  ON timezone_alerts
  FOR INSERT
  TO authenticated
  WITH CHECK (company_id = current_company_id());

DROP POLICY IF EXISTS "timezone_alerts_update_own_company" ON timezone_alerts;
CREATE POLICY "timezone_alerts_update_own_company"
  ON timezone_alerts
  FOR UPDATE
  TO authenticated
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

DROP POLICY IF EXISTS "timezone_alerts_delete_own_company" ON timezone_alerts;
CREATE POLICY "timezone_alerts_delete_own_company"
  ON timezone_alerts
  FOR DELETE
  TO authenticated
  USING (company_id = current_company_id());

-- =====================================================
-- GENERATED_REPORTS
-- =====================================================

DROP POLICY IF EXISTS "generated_reports_select_own_company" ON generated_reports;
CREATE POLICY "generated_reports_select_own_company"
  ON generated_reports
  FOR SELECT
  TO authenticated
  USING (company_id = current_company_id());

DROP POLICY IF EXISTS "generated_reports_insert_own_company" ON generated_reports;
CREATE POLICY "generated_reports_insert_own_company"
  ON generated_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (company_id = current_company_id());

DROP POLICY IF EXISTS "generated_reports_update_own_company" ON generated_reports;
CREATE POLICY "generated_reports_update_own_company"
  ON generated_reports
  FOR UPDATE
  TO authenticated
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

DROP POLICY IF EXISTS "generated_reports_delete_own_company" ON generated_reports;
CREATE POLICY "generated_reports_delete_own_company"
  ON generated_reports
  FOR DELETE
  TO authenticated
  USING (company_id = current_company_id());

-- =====================================================
-- ACTIVATION_CODES
-- =====================================================

DROP POLICY IF EXISTS "activation_codes_select_own_company" ON activation_codes;
CREATE POLICY "activation_codes_select_own_company"
  ON activation_codes
  FOR SELECT
  TO authenticated
  USING (company_id = current_company_id());

DROP POLICY IF EXISTS "activation_codes_insert_own_company" ON activation_codes;
CREATE POLICY "activation_codes_insert_own_company"
  ON activation_codes
  FOR INSERT
  TO authenticated
  WITH CHECK (company_id = current_company_id());

DROP POLICY IF EXISTS "activation_codes_update_own_company" ON activation_codes;
CREATE POLICY "activation_codes_update_own_company"
  ON activation_codes
  FOR UPDATE
  TO authenticated
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

DROP POLICY IF EXISTS "activation_codes_delete_own_company" ON activation_codes;
CREATE POLICY "activation_codes_delete_own_company"
  ON activation_codes
  FOR DELETE
  TO authenticated
  USING (company_id = current_company_id());

-- =====================================================
-- DEVICE_CHANGE_REQUESTS
-- =====================================================

DROP POLICY IF EXISTS "device_change_requests_select_own_company" ON device_change_requests;
CREATE POLICY "device_change_requests_select_own_company"
  ON device_change_requests
  FOR SELECT
  TO authenticated
  USING (company_id = current_company_id());

DROP POLICY IF EXISTS "device_change_requests_insert_own_company" ON device_change_requests;
CREATE POLICY "device_change_requests_insert_own_company"
  ON device_change_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (company_id = current_company_id());

DROP POLICY IF EXISTS "device_change_requests_update_own_company" ON device_change_requests;
CREATE POLICY "device_change_requests_update_own_company"
  ON device_change_requests
  FOR UPDATE
  TO authenticated
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

DROP POLICY IF EXISTS "device_change_requests_delete_own_company" ON device_change_requests;
CREATE POLICY "device_change_requests_delete_own_company"
  ON device_change_requests
  FOR DELETE
  TO authenticated
  USING (company_id = current_company_id());

-- =====================================================
-- PENALTIES
-- =====================================================

DROP POLICY IF EXISTS "penalties_select_own_company" ON penalties;
CREATE POLICY "penalties_select_own_company"
  ON penalties
  FOR SELECT
  TO authenticated
  USING (company_id = current_company_id());

DROP POLICY IF EXISTS "penalties_insert_own_company" ON penalties;
CREATE POLICY "penalties_insert_own_company"
  ON penalties
  FOR INSERT
  TO authenticated
  WITH CHECK (company_id = current_company_id());

DROP POLICY IF EXISTS "penalties_update_own_company" ON penalties;
CREATE POLICY "penalties_update_own_company"
  ON penalties
  FOR UPDATE
  TO authenticated
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

DROP POLICY IF EXISTS "penalties_delete_own_company" ON penalties;
CREATE POLICY "penalties_delete_own_company"
  ON penalties
  FOR DELETE
  TO authenticated
  USING (company_id = current_company_id());

-- =====================================================
-- PAYROLL_RUNS
-- =====================================================

DROP POLICY IF EXISTS "payroll_runs_select_own_company" ON payroll_runs;
CREATE POLICY "payroll_runs_select_own_company"
  ON payroll_runs
  FOR SELECT
  TO authenticated
  USING (company_id = current_company_id());

DROP POLICY IF EXISTS "payroll_runs_insert_own_company" ON payroll_runs;
CREATE POLICY "payroll_runs_insert_own_company"
  ON payroll_runs
  FOR INSERT
  TO authenticated
  WITH CHECK (company_id = current_company_id());

DROP POLICY IF EXISTS "payroll_runs_update_own_company" ON payroll_runs;
CREATE POLICY "payroll_runs_update_own_company"
  ON payroll_runs
  FOR UPDATE
  TO authenticated
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

DROP POLICY IF EXISTS "payroll_runs_delete_own_company" ON payroll_runs;
CREATE POLICY "payroll_runs_delete_own_company"
  ON payroll_runs
  FOR DELETE
  TO authenticated
  USING (company_id = current_company_id());

-- =====================================================
-- PAYROLL_SETTINGS
-- =====================================================

DROP POLICY IF EXISTS "payroll_settings_select_own_company" ON payroll_settings;
CREATE POLICY "payroll_settings_select_own_company"
  ON payroll_settings
  FOR SELECT
  TO authenticated
  USING (company_id = current_company_id());

DROP POLICY IF EXISTS "payroll_settings_insert_own_company" ON payroll_settings;
CREATE POLICY "payroll_settings_insert_own_company"
  ON payroll_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (company_id = current_company_id());

DROP POLICY IF EXISTS "payroll_settings_update_own_company" ON payroll_settings;
CREATE POLICY "payroll_settings_update_own_company"
  ON payroll_settings
  FOR UPDATE
  TO authenticated
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

DROP POLICY IF EXISTS "payroll_settings_delete_own_company" ON payroll_settings;
CREATE POLICY "payroll_settings_delete_own_company"
  ON payroll_settings
  FOR DELETE
  TO authenticated
  USING (company_id = current_company_id());

-- =====================================================
-- LATENESS_SLABS
-- =====================================================

DROP POLICY IF EXISTS "lateness_slabs_select_own_company" ON lateness_slabs;
CREATE POLICY "lateness_slabs_select_own_company"
  ON lateness_slabs
  FOR SELECT
  TO authenticated
  USING (company_id = current_company_id());

DROP POLICY IF EXISTS "lateness_slabs_insert_own_company" ON lateness_slabs;
CREATE POLICY "lateness_slabs_insert_own_company"
  ON lateness_slabs
  FOR INSERT
  TO authenticated
  WITH CHECK (company_id = current_company_id());

DROP POLICY IF EXISTS "lateness_slabs_update_own_company" ON lateness_slabs;
CREATE POLICY "lateness_slabs_update_own_company"
  ON lateness_slabs
  FOR UPDATE
  TO authenticated
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

DROP POLICY IF EXISTS "lateness_slabs_delete_own_company" ON lateness_slabs;
CREATE POLICY "lateness_slabs_delete_own_company"
  ON lateness_slabs
  FOR DELETE
  TO authenticated
  USING (company_id = current_company_id());

-- =====================================================
-- AUTO_CHECKOUT_SETTINGS
-- =====================================================

DROP POLICY IF EXISTS "auto_checkout_settings_select_own_company" ON auto_checkout_settings;
CREATE POLICY "auto_checkout_settings_select_own_company"
  ON auto_checkout_settings
  FOR SELECT
  TO authenticated
  USING (company_id = current_company_id());

DROP POLICY IF EXISTS "auto_checkout_settings_insert_own_company" ON auto_checkout_settings;
CREATE POLICY "auto_checkout_settings_insert_own_company"
  ON auto_checkout_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (company_id = current_company_id());

DROP POLICY IF EXISTS "auto_checkout_settings_update_own_company" ON auto_checkout_settings;
CREATE POLICY "auto_checkout_settings_update_own_company"
  ON auto_checkout_settings
  FOR UPDATE
  TO authenticated
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

DROP POLICY IF EXISTS "auto_checkout_settings_delete_own_company" ON auto_checkout_settings;
CREATE POLICY "auto_checkout_settings_delete_own_company"
  ON auto_checkout_settings
  FOR DELETE
  TO authenticated
  USING (company_id = current_company_id());

-- =====================================================
-- ATTENDANCE_CALCULATION_SETTINGS
-- =====================================================

DROP POLICY IF EXISTS "attendance_calculation_settings_select_own_company" ON attendance_calculation_settings;
CREATE POLICY "attendance_calculation_settings_select_own_company"
  ON attendance_calculation_settings
  FOR SELECT
  TO authenticated
  USING (company_id = current_company_id());

DROP POLICY IF EXISTS "attendance_calculation_settings_insert_own_company" ON attendance_calculation_settings;
CREATE POLICY "attendance_calculation_settings_insert_own_company"
  ON attendance_calculation_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (company_id = current_company_id());

DROP POLICY IF EXISTS "attendance_calculation_settings_update_own_company" ON attendance_calculation_settings;
CREATE POLICY "attendance_calculation_settings_update_own_company"
  ON attendance_calculation_settings
  FOR UPDATE
  TO authenticated
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

DROP POLICY IF EXISTS "attendance_calculation_settings_delete_own_company" ON attendance_calculation_settings;
CREATE POLICY "attendance_calculation_settings_delete_own_company"
  ON attendance_calculation_settings
  FOR DELETE
  TO authenticated
  USING (company_id = current_company_id());

-- =====================================================
-- APPLICATION_SETTINGS
-- =====================================================

DROP POLICY IF EXISTS "application_settings_select_own_company" ON application_settings;
CREATE POLICY "application_settings_select_own_company"
  ON application_settings
  FOR SELECT
  TO authenticated
  USING (company_id = current_company_id());

DROP POLICY IF EXISTS "application_settings_insert_own_company" ON application_settings;
CREATE POLICY "application_settings_insert_own_company"
  ON application_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (company_id = current_company_id());

DROP POLICY IF EXISTS "application_settings_update_own_company" ON application_settings;
CREATE POLICY "application_settings_update_own_company"
  ON application_settings
  FOR UPDATE
  TO authenticated
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

DROP POLICY IF EXISTS "application_settings_delete_own_company" ON application_settings;
CREATE POLICY "application_settings_delete_own_company"
  ON application_settings
  FOR DELETE
  TO authenticated
  USING (company_id = current_company_id());

-- =====================================================
-- EMPLOYEE_BRANCHES, OTP_LOGS, etc.
-- =====================================================

DROP POLICY IF EXISTS "employee_branches_select_own_company" ON employee_branches;
CREATE POLICY "employee_branches_select_own_company"
  ON employee_branches
  FOR SELECT
  TO authenticated
  USING (company_id = current_company_id());

DROP POLICY IF EXISTS "otp_logs_select_own_company" ON otp_logs;
CREATE POLICY "otp_logs_select_own_company"
  ON otp_logs
  FOR SELECT
  TO authenticated
  USING (company_id = current_company_id());

DROP POLICY IF EXISTS "otp_logs_insert_own_company" ON otp_logs;
CREATE POLICY "otp_logs_insert_own_company"
  ON otp_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (company_id = current_company_id());

DROP POLICY IF EXISTS "audit_logs_select_own_company" ON audit_logs;
CREATE POLICY "audit_logs_select_own_company"
  ON audit_logs
  FOR SELECT
  TO authenticated
  USING (company_id = current_company_id());

DROP POLICY IF EXISTS "audit_logs_insert_own_company" ON audit_logs;
CREATE POLICY "audit_logs_insert_own_company"
  ON audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (company_id = current_company_id());

DROP POLICY IF EXISTS "employee_sessions_select_own_company" ON employee_sessions;
CREATE POLICY "employee_sessions_select_own_company"
  ON employee_sessions
  FOR SELECT
  TO authenticated
  USING (company_id = current_company_id());

DROP POLICY IF EXISTS "employee_vacation_requests_select_own_company" ON employee_vacation_requests;
CREATE POLICY "employee_vacation_requests_select_own_company"
  ON employee_vacation_requests
  FOR SELECT
  TO authenticated
  USING (company_id = current_company_id());

DROP POLICY IF EXISTS "time_sync_logs_select_own_company" ON time_sync_logs;
CREATE POLICY "time_sync_logs_select_own_company"
  ON time_sync_logs
  FOR SELECT
  TO authenticated
  USING (company_id = current_company_id());

DROP POLICY IF EXISTS "auto_checkout_pending_select_own_company" ON auto_checkout_pending;
CREATE POLICY "auto_checkout_pending_select_own_company"
  ON auto_checkout_pending
  FOR SELECT
  TO authenticated
  USING (company_id = current_company_id());

DROP POLICY IF EXISTS "employee_location_heartbeat_select_own_company" ON employee_location_heartbeat;
CREATE POLICY "employee_location_heartbeat_select_own_company"
  ON employee_location_heartbeat
  FOR SELECT
  TO authenticated
  USING (company_id = current_company_id());
