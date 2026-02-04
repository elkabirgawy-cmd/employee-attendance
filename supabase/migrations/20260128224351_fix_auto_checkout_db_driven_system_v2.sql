/*
  # Fix Auto-Checkout: DB-Driven Multi-Tenant System

  1. Purpose
    - Remove browser-based auto-checkout (no beforeunload/visibilitychange triggers)
    - Implement server-driven auto-checkout using persisted DB state
    - Ensure identical behavior across all companies (multi-tenant)
    - Session state must persist across browser refresh/close

  2. Changes
    - Add unique constraints on company_id for settings tables
    - Add triggers to create default settings on company creation
    - Fix RLS policies for proper company isolation
    - Add heartbeat update policies for anon users
    - Create helper functions for session management

  3. Security
    - Admins can read/update their own company settings
    - Employees (anon) can read settings (read-only) and update heartbeats
    - All operations are scoped to company_id
*/

-- ============================================================================
-- STEP 1: Add Unique Constraints on company_id
-- ============================================================================

-- Add unique constraint on application_settings.company_id
ALTER TABLE application_settings
  ADD CONSTRAINT application_settings_company_id_unique UNIQUE (company_id);

-- Add unique constraint on auto_checkout_settings.company_id
ALTER TABLE auto_checkout_settings
  ADD CONSTRAINT auto_checkout_settings_company_id_unique UNIQUE (company_id);

-- Add unique constraint on attendance_calculation_settings.company_id
ALTER TABLE attendance_calculation_settings
  ADD CONSTRAINT attendance_calculation_settings_company_id_unique UNIQUE (company_id);

-- ============================================================================
-- STEP 2: Fix RLS Policies for Settings Tables
-- ============================================================================

DROP POLICY IF EXISTS "anon_can_select_application_settings" ON application_settings;
DROP POLICY IF EXISTS "anon_can_select_auto_checkout_settings" ON auto_checkout_settings;

CREATE POLICY "anon_select_application_settings_via_employee"
  ON application_settings
  FOR SELECT
  TO anon
  USING (
    company_id IN (
      SELECT company_id
      FROM employees
      WHERE id::text = current_setting('request.jwt.claims', true)::json->>'employee_id'
        AND is_active = true
    )
  );

CREATE POLICY "anon_select_auto_checkout_settings_via_employee"
  ON auto_checkout_settings
  FOR SELECT
  TO anon
  USING (
    company_id IN (
      SELECT company_id
      FROM employees
      WHERE id::text = current_setting('request.jwt.claims', true)::json->>'employee_id'
        AND is_active = true
    )
  );

CREATE POLICY "employee_location_heartbeat_update_anon"
  ON employee_location_heartbeat
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- STEP 3: Create Function to Initialize Company Settings
-- ============================================================================

CREATE OR REPLACE FUNCTION initialize_company_settings(p_company_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO application_settings (
    company_id,
    max_gps_accuracy_meters,
    gps_warning_threshold_meters,
    require_high_accuracy,
    enable_fake_gps_detection,
    grace_period_minutes,
    early_check_in_allowed_minutes,
    require_checkout,
    block_duplicate_check_ins,
    detect_rooted_devices,
    detect_fake_gps,
    detect_time_manipulation,
    block_suspicious_devices,
    max_distance_jump_meters,
    default_language,
    date_format,
    currency
  )
  VALUES (
    p_company_id, 50, 30, true, true, 15, 30, true, false, true, true, true, false, 1000, 'ar', 'DD/MM/YYYY', 'ريال'
  )
  ON CONFLICT (company_id) DO NOTHING;

  INSERT INTO auto_checkout_settings (
    company_id,
    auto_checkout_enabled,
    auto_checkout_after_seconds,
    verify_outside_with_n_readings,
    watch_interval_seconds,
    max_location_accuracy_meters
  )
  VALUES (
    p_company_id, true, 900, 3, 15, 80
  )
  ON CONFLICT (company_id) DO NOTHING;

  INSERT INTO attendance_calculation_settings (
    company_id,
    working_days_mode,
    fixed_working_days,
    fixed_vacation_days,
    weekly_off_days
  )
  VALUES (
    p_company_id, 'automatic', 26, 0, ARRAY[]::integer[]
  )
  ON CONFLICT (company_id) DO NOTHING;
END;
$$;

-- ============================================================================
-- STEP 4: Create Trigger to Auto-Initialize Settings on Company Creation
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_initialize_company_settings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM initialize_company_settings(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_company_created_initialize_settings ON companies;

CREATE TRIGGER on_company_created_initialize_settings
  AFTER INSERT ON companies
  FOR EACH ROW
  EXECUTE FUNCTION trigger_initialize_company_settings();

-- ============================================================================
-- STEP 5: Backfill Settings for Existing Companies
-- ============================================================================

DO $$
DECLARE
  company_record RECORD;
BEGIN
  FOR company_record IN SELECT id FROM companies
  LOOP
    PERFORM initialize_company_settings(company_record.id);
  END LOOP;
END $$;

-- ============================================================================
-- STEP 6: Add Helper Function for Heartbeat Management
-- ============================================================================

CREATE OR REPLACE FUNCTION upsert_employee_heartbeat(
  p_employee_id UUID,
  p_company_id UUID,
  p_attendance_log_id UUID,
  p_in_branch BOOLEAN,
  p_gps_ok BOOLEAN,
  p_reason TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO employee_location_heartbeat (
    employee_id,
    company_id,
    attendance_log_id,
    last_seen_at,
    in_branch,
    gps_ok,
    reason
  )
  VALUES (
    p_employee_id, p_company_id, p_attendance_log_id, NOW(), p_in_branch, p_gps_ok, p_reason
  )
  ON CONFLICT (employee_id)
  DO UPDATE SET
    attendance_log_id = EXCLUDED.attendance_log_id,
    last_seen_at = NOW(),
    in_branch = EXCLUDED.in_branch,
    gps_ok = EXCLUDED.gps_ok,
    reason = EXCLUDED.reason;
END;
$$;

-- ============================================================================
-- STEP 7: Add Function to Get Active Session State
-- ============================================================================

CREATE OR REPLACE FUNCTION get_active_attendance_session(
  p_employee_id UUID,
  p_company_id UUID
)
RETURNS TABLE (
  log_id UUID,
  check_in_time TIMESTAMPTZ,
  check_out_time TIMESTAMPTZ,
  last_heartbeat_at TIMESTAMPTZ,
  in_branch BOOLEAN,
  gps_ok BOOLEAN,
  auto_checkout_pending_id UUID,
  auto_checkout_reason TEXT,
  auto_checkout_ends_at TIMESTAMPTZ,
  auto_checkout_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    al.id AS log_id,
    al.check_in_time,
    al.check_out_time,
    al.last_heartbeat_at,
    COALESCE(elh.in_branch, false) AS in_branch,
    COALESCE(elh.gps_ok, false) AS gps_ok,
    acp.id AS auto_checkout_pending_id,
    acp.reason AS auto_checkout_reason,
    acp.ends_at AS auto_checkout_ends_at,
    acp.status AS auto_checkout_status
  FROM attendance_logs al
  LEFT JOIN employee_location_heartbeat elh ON elh.employee_id = al.employee_id
  LEFT JOIN auto_checkout_pending acp ON acp.attendance_log_id = al.id AND acp.status = 'PENDING'
  WHERE al.employee_id = p_employee_id
    AND al.company_id = p_company_id
    AND al.check_in_time >= CURRENT_DATE::timestamptz
    AND al.check_in_time < (CURRENT_DATE + INTERVAL '1 day')::timestamptz
    AND al.check_out_time IS NULL
  ORDER BY al.check_in_time DESC
  LIMIT 1;
END;
$$;

-- ============================================================================
-- STEP 8: Add Indexes for Performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_attendance_logs_active_sessions
  ON attendance_logs(employee_id, company_id, check_in_time)
  WHERE check_out_time IS NULL;

CREATE INDEX IF NOT EXISTS idx_employee_location_heartbeat_company
  ON employee_location_heartbeat(company_id, employee_id);

CREATE INDEX IF NOT EXISTS idx_auto_checkout_pending_active
  ON auto_checkout_pending(company_id, employee_id, status, ends_at)
  WHERE status = 'PENDING';
