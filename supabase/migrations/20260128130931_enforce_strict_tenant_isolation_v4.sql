/*
  # Enforce Strict Multi-Tenant Isolation - Complete Fix

  ## Critical Security Issue Identified
  
  **Problem:** Multiple conflicting policies allow cross-tenant data leakage:
  1. Old policies use `is_admin()` without `company_id` filter
  2. Dangerous policies allow `true` or `is_active = true` without company filter
  3. Anonymous/Employee policies expose ALL companies' data

  **Impact:** 
  - AdminA (elkabirgawy@gmail.com, company: aeb3d19c) can see AdminB's data
  - AdminB (mohamedelashqer24@gmail.com, company: 8ab77d2a) can see AdminA's data
  - This is a CRITICAL security breach in a Multi-Tenant SaaS

  ## Solution
  
  1. DROP all dangerous policies
  2. Keep ONLY policies with `current_company_id()` filtering
  3. Add safe anonymous/employee policies with proper filtering
  4. Use RESTRICTIVE policies where needed

  ## Tables Fixed
  - employees
  - branches  
  - attendance_logs
  - shifts
  - departments
  - devices
  - device_change_requests
  - fraud_alerts
  - leave_requests
  - leave_balances
  - payroll_records
  - penalties
*/

-- ============================================================================
-- EMPLOYEES TABLE
-- ============================================================================

-- Drop old dangerous policies
DROP POLICY IF EXISTS "Admins can view company employees" ON employees;
DROP POLICY IF EXISTS "Admins can insert company employees" ON employees;
DROP POLICY IF EXISTS "Admins can update company employees" ON employees;
DROP POLICY IF EXISTS "Admins can delete company employees" ON employees;
DROP POLICY IF EXISTS "Allow employee lookup by code" ON employees;
DROP POLICY IF EXISTS "Anonymous can view employee by code" ON employees;
DROP POLICY IF EXISTS "Allow device binding during auth" ON employees;

-- Keep only tenant-isolated policies (these are correct)
-- employees_select_own_company ✓
-- employees_insert_own_company ✓  
-- employees_update_own_company ✓
-- employees_delete_own_company ✓

-- Add safe anonymous policy for employee activation only
CREATE POLICY "Anonymous can lookup employee for activation"
  ON employees
  FOR SELECT
  TO anon
  USING (is_active = true AND company_id = current_company_id());

-- ============================================================================
-- BRANCHES TABLE
-- ============================================================================

-- Drop old dangerous policies
DROP POLICY IF EXISTS "Admins can view company branches" ON branches;
DROP POLICY IF EXISTS "Admins can insert company branches" ON branches;
DROP POLICY IF EXISTS "Admins can update company branches" ON branches;
DROP POLICY IF EXISTS "Admins can delete company branches" ON branches;
DROP POLICY IF EXISTS "Anonymous can view active branches" ON branches;
DROP POLICY IF EXISTS "Employees can view active branches" ON branches;

-- Keep only tenant-isolated policies
-- branches_select_own_company ✓
-- branches_insert_own_company ✓
-- branches_update_own_company ✓
-- branches_delete_own_company ✓

-- ============================================================================
-- ATTENDANCE_LOGS TABLE
-- ============================================================================

-- Drop old dangerous policies
DROP POLICY IF EXISTS "Admins can view company attendance" ON attendance_logs;
DROP POLICY IF EXISTS "Admins can insert company attendance" ON attendance_logs;
DROP POLICY IF EXISTS "Admins can update company attendance" ON attendance_logs;
DROP POLICY IF EXISTS "Employees can view own attendance" ON attendance_logs;
DROP POLICY IF EXISTS "Employees can insert own attendance" ON attendance_logs;
DROP POLICY IF EXISTS "Employees can update own attendance" ON attendance_logs;
DROP POLICY IF EXISTS "Allow anonymous attendance logging" ON attendance_logs;

-- Keep only tenant-isolated policies
-- attendance_logs_select_own_company ✓
-- attendance_logs_insert_own_company ✓
-- attendance_logs_update_own_company ✓
-- attendance_logs_delete_own_company ✓

-- ============================================================================
-- SHIFTS TABLE
-- ============================================================================

-- Drop old dangerous policies
DROP POLICY IF EXISTS "Admins can view company shifts" ON shifts;
DROP POLICY IF EXISTS "Admins can insert company shifts" ON shifts;
DROP POLICY IF EXISTS "Admins can update company shifts" ON shifts;
DROP POLICY IF EXISTS "Admins can delete company shifts" ON shifts;
DROP POLICY IF EXISTS "Anonymous can view active shifts" ON shifts;
DROP POLICY IF EXISTS "Employees can view active shifts" ON shifts;

-- Keep only tenant-isolated policies
-- shifts_select_own_company ✓
-- shifts_insert_own_company ✓
-- shifts_update_own_company ✓
-- shifts_delete_own_company ✓

-- ============================================================================
-- DEPARTMENTS TABLE - CRITICAL FIX
-- ============================================================================

-- Drop ALL dangerous policies (these allow ANY authenticated user!)
DROP POLICY IF EXISTS "Authenticated users can view departments" ON departments;
DROP POLICY IF EXISTS "Authenticated users can insert departments" ON departments;
DROP POLICY IF EXISTS "Authenticated users can update departments" ON departments;
DROP POLICY IF EXISTS "Authenticated users can delete departments" ON departments;
DROP POLICY IF EXISTS "Admins can view company departments" ON departments;
DROP POLICY IF EXISTS "Admins can insert company departments" ON departments;
DROP POLICY IF EXISTS "Admins can update company departments" ON departments;
DROP POLICY IF EXISTS "Admins can delete company departments" ON departments;

-- Keep only tenant-isolated policies
-- departments_select_own_company ✓
-- departments_insert_own_company ✓
-- departments_update_own_company ✓
-- departments_delete_own_company ✓

-- ============================================================================
-- DEVICES TABLE
-- ============================================================================

-- Drop old dangerous policies
DROP POLICY IF EXISTS "Admins can view all devices" ON devices;
DROP POLICY IF EXISTS "Employees can view own devices" ON devices;
DROP POLICY IF EXISTS "Employees can register own devices" ON devices;
DROP POLICY IF EXISTS "Employees can update own devices" ON devices;

-- Keep only tenant-isolated policies
-- devices_select_own_company ✓
-- devices_insert_own_company ✓
-- devices_update_own_company ✓
-- devices_delete_own_company ✓

-- ============================================================================
-- DEVICE_CHANGE_REQUESTS TABLE
-- ============================================================================

-- Drop old dangerous policies
DROP POLICY IF EXISTS "Admins can view all device change requests" ON device_change_requests;
DROP POLICY IF EXISTS "Admins can update device change requests" ON device_change_requests;
DROP POLICY IF EXISTS "Employees can view own device change requests" ON device_change_requests;
DROP POLICY IF EXISTS "System can insert device change requests" ON device_change_requests;

-- Keep only tenant-isolated policies
-- device_change_requests_select_own_company ✓
-- device_change_requests_insert_own_company ✓
-- device_change_requests_update_own_company ✓
-- device_change_requests_delete_own_company ✓

-- ============================================================================
-- FRAUD_ALERTS TABLE
-- ============================================================================

-- Drop old dangerous policies
DROP POLICY IF EXISTS "Admins can view fraud alerts" ON fraud_alerts;
DROP POLICY IF EXISTS "Admins can update fraud alerts" ON fraud_alerts;
DROP POLICY IF EXISTS "System can insert fraud alerts" ON fraud_alerts;

-- Keep only tenant-isolated policies
-- fraud_alerts_select_own_company ✓
-- fraud_alerts_insert_own_company ✓
-- fraud_alerts_update_own_company ✓
-- fraud_alerts_delete_own_company ✓

-- ============================================================================
-- LEAVE_REQUESTS TABLE - CRITICAL FIX
-- ============================================================================

-- Drop ALL dangerous policies
DROP POLICY IF EXISTS "Admin can manage leave requests" ON leave_requests;
DROP POLICY IF EXISTS "Employees can view leave requests" ON leave_requests;
DROP POLICY IF EXISTS "Employees can create leave requests" ON leave_requests;
DROP POLICY IF EXISTS "Employees can update leave requests" ON leave_requests;

-- Keep only tenant-isolated policies
-- leave_requests_select_own_company ✓
-- leave_requests_insert_own_company ✓
-- leave_requests_update_own_company ✓
-- leave_requests_delete_own_company ✓

-- ============================================================================
-- LEAVE_BALANCES TABLE - CRITICAL FIX
-- ============================================================================

-- Drop ALL dangerous policies
DROP POLICY IF EXISTS "Admin can manage leave balances" ON leave_balances;
DROP POLICY IF EXISTS "Employees can view leave balances" ON leave_balances;

-- Keep only tenant-isolated policies
-- leave_balances_select_own_company ✓
-- leave_balances_insert_own_company ✓
-- leave_balances_update_own_company ✓
-- leave_balances_delete_own_company ✓

-- ============================================================================
-- PAYROLL_RECORDS TABLE
-- ============================================================================

-- Drop old dangerous policies
DROP POLICY IF EXISTS "Admins can read all payroll records" ON payroll_records;
DROP POLICY IF EXISTS "Admins can view company payroll" ON payroll_records;
DROP POLICY IF EXISTS "Admins can insert company payroll" ON payroll_records;
DROP POLICY IF EXISTS "Admins can update company payroll" ON payroll_records;
DROP POLICY IF EXISTS "Admins can delete company payroll" ON payroll_records;

-- Keep only tenant-isolated policies
-- payroll_records_select_own_company ✓
-- payroll_records_insert_own_company ✓
-- payroll_records_update_own_company ✓
-- payroll_records_delete_own_company ✓

-- ============================================================================
-- PENALTIES TABLE
-- ============================================================================

-- Drop old dangerous policies
DROP POLICY IF EXISTS "Admin can manage penalties" ON penalties;

-- Keep only tenant-isolated policies
-- penalties_select_own_company ✓
-- penalties_insert_own_company ✓
-- penalties_update_own_company ✓
-- penalties_delete_own_company ✓

-- ============================================================================
-- VERIFICATION QUERY
-- ============================================================================

-- This query should return 0 rows (no policies without company filtering)
-- Run this after migration to verify:
-- 
-- SELECT tablename, policyname, qual
-- FROM pg_policies 
-- WHERE tablename IN ('employees', 'branches', 'attendance_logs', 'shifts', 
--                     'departments', 'devices', 'device_change_requests',
--                     'fraud_alerts', 'leave_requests', 'leave_balances',
--                     'payroll_records', 'penalties')
-- AND qual NOT LIKE '%company_id%'
-- AND qual NOT LIKE '%current_company_id()%'
-- AND policyname NOT LIKE '%_own_company%';
