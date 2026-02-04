/*
  # Fix Final Dangerous Policies

  ## Critical Security Issues
  
  **DANGEROUS POLICIES FOUND:**
  1. auto_checkout_pending: qual = 'true' → ANY user can access ALL data
  2. employee_location_heartbeat: qual = 'true' → ANY user can access ALL data

  **NEEDS IMPROVEMENT:**
  - generated_reports: Uses auth.uid() but should also filter by company_id

  ## Solution
  
  Replace with proper tenant-isolated policies
*/

-- ============================================================================
-- AUTO_CHECKOUT_PENDING
-- ============================================================================
DROP POLICY IF EXISTS "Allow anon access for auto checkout pending" ON auto_checkout_pending;
DROP POLICY IF EXISTS "auto_checkout_pending_select_own_company" ON auto_checkout_pending;
DROP POLICY IF EXISTS "auto_checkout_pending_insert_own_company" ON auto_checkout_pending;
DROP POLICY IF EXISTS "auto_checkout_pending_update_own_company" ON auto_checkout_pending;
DROP POLICY IF EXISTS "auto_checkout_pending_delete_own_company" ON auto_checkout_pending;

CREATE POLICY "auto_checkout_pending_select_own_company"
  ON auto_checkout_pending FOR SELECT
  TO authenticated
  USING (company_id = current_company_id());

CREATE POLICY "auto_checkout_pending_insert_system"
  ON auto_checkout_pending FOR INSERT
  TO authenticated, anon, service_role
  WITH CHECK (true);

CREATE POLICY "auto_checkout_pending_update_own_company"
  ON auto_checkout_pending FOR UPDATE
  TO authenticated
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

CREATE POLICY "auto_checkout_pending_delete_own_company"
  ON auto_checkout_pending FOR DELETE
  TO authenticated
  USING (company_id = current_company_id());

-- ============================================================================
-- EMPLOYEE_LOCATION_HEARTBEAT
-- ============================================================================
DROP POLICY IF EXISTS "Allow anon access for employee heartbeat" ON employee_location_heartbeat;
DROP POLICY IF EXISTS "employee_location_heartbeat_select_own_company" ON employee_location_heartbeat;
DROP POLICY IF EXISTS "employee_location_heartbeat_insert_own_company" ON employee_location_heartbeat;
DROP POLICY IF EXISTS "employee_location_heartbeat_update_own_company" ON employee_location_heartbeat;
DROP POLICY IF EXISTS "employee_location_heartbeat_delete_own_company" ON employee_location_heartbeat;

CREATE POLICY "employee_location_heartbeat_select_own_company"
  ON employee_location_heartbeat FOR SELECT
  TO authenticated
  USING (company_id = current_company_id());

CREATE POLICY "employee_location_heartbeat_insert_system"
  ON employee_location_heartbeat FOR INSERT
  TO authenticated, anon, service_role
  WITH CHECK (true);

CREATE POLICY "employee_location_heartbeat_update_own_company"
  ON employee_location_heartbeat FOR UPDATE
  TO authenticated
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

CREATE POLICY "employee_location_heartbeat_delete_own_company"
  ON employee_location_heartbeat FOR DELETE
  TO authenticated
  USING (company_id = current_company_id());

-- ============================================================================
-- GENERATED_REPORTS - Add company_id filtering
-- ============================================================================
DROP POLICY IF EXISTS "Admins can view own reports" ON generated_reports;
DROP POLICY IF EXISTS "Admins can delete own reports" ON generated_reports;
DROP POLICY IF EXISTS "Admins can insert reports" ON generated_reports;
DROP POLICY IF EXISTS "generated_reports_select_own_company" ON generated_reports;
DROP POLICY IF EXISTS "generated_reports_insert_own_company" ON generated_reports;
DROP POLICY IF EXISTS "generated_reports_delete_own_company" ON generated_reports;

CREATE POLICY "generated_reports_select_own_company"
  ON generated_reports FOR SELECT
  TO authenticated
  USING (company_id = current_company_id() AND admin_user_id = auth.uid());

CREATE POLICY "generated_reports_insert_own_company"
  ON generated_reports FOR INSERT
  TO authenticated
  WITH CHECK (company_id = current_company_id() AND admin_user_id = auth.uid());

CREATE POLICY "generated_reports_delete_own_company"
  ON generated_reports FOR DELETE
  TO authenticated
  USING (company_id = current_company_id() AND admin_user_id = auth.uid());
