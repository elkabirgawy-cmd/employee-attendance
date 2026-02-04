/*
  # Enforce Strict Tenant Isolation - Part 1: Schema & Triggers

  ## Overview
  Complete multi-tenant isolation. Every admin sees ONLY their company's data.

  ## Changes
  1. Helper function current_company_id()
  2. Add missing company_id columns
  3. Backfill existing data
  4. Add foreign keys
  5. Create BEFORE INSERT triggers
*/

-- =====================================================
-- 1. CREATE HELPER FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION current_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT company_id 
  FROM admin_users 
  WHERE id = auth.uid() 
  LIMIT 1;
$$;

-- =====================================================
-- 2. ADD MISSING company_id COLUMNS
-- =====================================================

-- employee_branches
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employee_branches' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE employee_branches ADD COLUMN company_id uuid;
  END IF;
END $$;

-- otp_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'otp_logs' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE otp_logs ADD COLUMN company_id uuid;
  END IF;
END $$;

-- audit_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_logs' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE audit_logs ADD COLUMN company_id uuid;
  END IF;
END $$;

-- employee_sessions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employee_sessions' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE employee_sessions ADD COLUMN company_id uuid;
  END IF;
END $$;

-- employee_vacation_requests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employee_vacation_requests' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE employee_vacation_requests ADD COLUMN company_id uuid;
  END IF;
END $$;

-- time_sync_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'time_sync_logs' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE time_sync_logs ADD COLUMN company_id uuid;
  END IF;
END $$;

-- auto_checkout_pending
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auto_checkout_pending' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE auto_checkout_pending ADD COLUMN company_id uuid;
  END IF;
END $$;

-- employee_location_heartbeat
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employee_location_heartbeat' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE employee_location_heartbeat ADD COLUMN company_id uuid;
  END IF;
END $$;

-- =====================================================
-- 3. BACKFILL company_id FROM RELATED TABLES
-- =====================================================

-- employee_branches (from employee)
UPDATE employee_branches eb
SET company_id = e.company_id
FROM employees e
WHERE eb.employee_id = e.id AND eb.company_id IS NULL;

-- otp_logs (from employee)
UPDATE otp_logs ol
SET company_id = e.company_id
FROM employees e
WHERE ol.employee_id = e.id AND ol.company_id IS NULL;

-- employee_sessions (from employee)
UPDATE employee_sessions es
SET company_id = e.company_id
FROM employees e
WHERE es.employee_id = e.id AND es.company_id IS NULL;

-- employee_vacation_requests (from employee)
UPDATE employee_vacation_requests evr
SET company_id = e.company_id
FROM employees e
WHERE evr.employee_id = e.id AND evr.company_id IS NULL;

-- time_sync_logs (from employee)
UPDATE time_sync_logs tsl
SET company_id = e.company_id
FROM employees e
WHERE tsl.employee_id = e.id AND tsl.company_id IS NULL;

-- auto_checkout_pending (from employee)
UPDATE auto_checkout_pending acp
SET company_id = e.company_id
FROM employees e
WHERE acp.employee_id = e.id AND acp.company_id IS NULL;

-- employee_location_heartbeat (from employee)
UPDATE employee_location_heartbeat elh
SET company_id = e.company_id
FROM employees e
WHERE elh.employee_id = e.id AND elh.company_id IS NULL;

-- Backfill other nullable company_id columns
UPDATE devices SET company_id = (SELECT company_id FROM employees WHERE employees.id = devices.employee_id) WHERE company_id IS NULL;
UPDATE fraud_alerts SET company_id = (SELECT company_id FROM employees WHERE employees.id = fraud_alerts.employee_id) WHERE company_id IS NULL;
UPDATE device_change_requests SET company_id = (SELECT company_id FROM employees WHERE employees.id = device_change_requests.employee_id) WHERE company_id IS NULL;
UPDATE activation_codes SET company_id = (SELECT company_id FROM employees WHERE employees.id = activation_codes.employee_id) WHERE company_id IS NULL;
UPDATE timezone_alerts SET company_id = (SELECT company_id FROM employees WHERE employees.id = timezone_alerts.employee_id) WHERE company_id IS NULL;
UPDATE generated_reports SET company_id = (SELECT company_id FROM admin_users WHERE admin_users.id = generated_reports.admin_user_id) WHERE company_id IS NULL;
UPDATE penalties SET company_id = (SELECT company_id FROM employees WHERE employees.id = penalties.employee_id) WHERE company_id IS NULL;
UPDATE payroll_runs SET company_id = (SELECT company_id FROM employees WHERE employees.id = payroll_runs.employee_id) WHERE company_id IS NULL;
UPDATE leave_balances SET company_id = (SELECT company_id FROM employees WHERE employees.id = leave_balances.employee_id) WHERE company_id IS NULL;
UPDATE leave_requests SET company_id = (SELECT company_id FROM employees WHERE employees.id = leave_requests.employee_id) WHERE company_id IS NULL;
UPDATE payroll_records SET company_id = (SELECT company_id FROM employees WHERE employees.id = payroll_records.employee_id) WHERE company_id IS NULL;

-- Settings tables - assign to first company
UPDATE lateness_slabs SET company_id = (SELECT id FROM companies ORDER BY created_at LIMIT 1) WHERE company_id IS NULL;
UPDATE payroll_settings SET company_id = (SELECT id FROM companies ORDER BY created_at LIMIT 1) WHERE company_id IS NULL;
UPDATE auto_checkout_settings SET company_id = (SELECT id FROM companies ORDER BY created_at LIMIT 1) WHERE company_id IS NULL;
UPDATE attendance_calculation_settings SET company_id = (SELECT id FROM companies ORDER BY created_at LIMIT 1) WHERE company_id IS NULL;
UPDATE application_settings SET company_id = (SELECT id FROM companies ORDER BY created_at LIMIT 1) WHERE company_id IS NULL;
UPDATE leave_types SET company_id = (SELECT id FROM companies ORDER BY created_at LIMIT 1) WHERE company_id IS NULL;

-- audit_logs - assign to first company if exists
UPDATE audit_logs SET company_id = (SELECT id FROM companies ORDER BY created_at LIMIT 1) WHERE company_id IS NULL;

-- =====================================================
-- 4. ADD FOREIGN KEY CONSTRAINTS
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'employee_branches_company_id_fkey'
  ) THEN
    ALTER TABLE employee_branches ADD CONSTRAINT employee_branches_company_id_fkey 
    FOREIGN KEY (company_id) REFERENCES companies(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'otp_logs_company_id_fkey'
  ) THEN
    ALTER TABLE otp_logs ADD CONSTRAINT otp_logs_company_id_fkey 
    FOREIGN KEY (company_id) REFERENCES companies(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'audit_logs_company_id_fkey'
  ) THEN
    ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_company_id_fkey 
    FOREIGN KEY (company_id) REFERENCES companies(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'employee_sessions_company_id_fkey'
  ) THEN
    ALTER TABLE employee_sessions ADD CONSTRAINT employee_sessions_company_id_fkey 
    FOREIGN KEY (company_id) REFERENCES companies(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'employee_vacation_requests_company_id_fkey'
  ) THEN
    ALTER TABLE employee_vacation_requests ADD CONSTRAINT employee_vacation_requests_company_id_fkey 
    FOREIGN KEY (company_id) REFERENCES companies(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'time_sync_logs_company_id_fkey'
  ) THEN
    ALTER TABLE time_sync_logs ADD CONSTRAINT time_sync_logs_company_id_fkey 
    FOREIGN KEY (company_id) REFERENCES companies(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'auto_checkout_pending_company_id_fkey'
  ) THEN
    ALTER TABLE auto_checkout_pending ADD CONSTRAINT auto_checkout_pending_company_id_fkey 
    FOREIGN KEY (company_id) REFERENCES companies(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'employee_location_heartbeat_company_id_fkey'
  ) THEN
    ALTER TABLE employee_location_heartbeat ADD CONSTRAINT employee_location_heartbeat_company_id_fkey 
    FOREIGN KEY (company_id) REFERENCES companies(id);
  END IF;
END $$;

-- =====================================================
-- 5. CREATE BEFORE INSERT TRIGGERS
-- =====================================================

-- Generic trigger function for auto-setting company_id
CREATE OR REPLACE FUNCTION set_company_id_from_current()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := current_company_id();
  END IF;
  RETURN NEW;
END;
$$;

-- Apply trigger to all tenant tables
DROP TRIGGER IF EXISTS set_company_id_trigger ON employees;
CREATE TRIGGER set_company_id_trigger BEFORE INSERT ON employees
  FOR EACH ROW EXECUTE FUNCTION set_company_id_from_current();

DROP TRIGGER IF EXISTS set_company_id_trigger ON branches;
CREATE TRIGGER set_company_id_trigger BEFORE INSERT ON branches
  FOR EACH ROW EXECUTE FUNCTION set_company_id_from_current();

DROP TRIGGER IF EXISTS set_company_id_trigger ON shifts;
CREATE TRIGGER set_company_id_trigger BEFORE INSERT ON shifts
  FOR EACH ROW EXECUTE FUNCTION set_company_id_from_current();

DROP TRIGGER IF EXISTS set_company_id_trigger ON departments;
CREATE TRIGGER set_company_id_trigger BEFORE INSERT ON departments
  FOR EACH ROW EXECUTE FUNCTION set_company_id_from_current();

DROP TRIGGER IF EXISTS set_company_id_trigger ON attendance_logs;
CREATE TRIGGER set_company_id_trigger BEFORE INSERT ON attendance_logs
  FOR EACH ROW EXECUTE FUNCTION set_company_id_from_current();

DROP TRIGGER IF EXISTS set_company_id_trigger ON devices;
CREATE TRIGGER set_company_id_trigger BEFORE INSERT ON devices
  FOR EACH ROW EXECUTE FUNCTION set_company_id_from_current();

DROP TRIGGER IF EXISTS set_company_id_trigger ON employee_branches;
CREATE TRIGGER set_company_id_trigger BEFORE INSERT ON employee_branches
  FOR EACH ROW EXECUTE FUNCTION set_company_id_from_current();

DROP TRIGGER IF EXISTS set_company_id_trigger ON otp_logs;
CREATE TRIGGER set_company_id_trigger BEFORE INSERT ON otp_logs
  FOR EACH ROW EXECUTE FUNCTION set_company_id_from_current();

DROP TRIGGER IF EXISTS set_company_id_trigger ON fraud_alerts;
CREATE TRIGGER set_company_id_trigger BEFORE INSERT ON fraud_alerts
  FOR EACH ROW EXECUTE FUNCTION set_company_id_from_current();

DROP TRIGGER IF EXISTS set_company_id_trigger ON audit_logs;
CREATE TRIGGER set_company_id_trigger BEFORE INSERT ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION set_company_id_from_current();

DROP TRIGGER IF EXISTS set_company_id_trigger ON employee_sessions;
CREATE TRIGGER set_company_id_trigger BEFORE INSERT ON employee_sessions
  FOR EACH ROW EXECUTE FUNCTION set_company_id_from_current();

DROP TRIGGER IF EXISTS set_company_id_trigger ON device_change_requests;
CREATE TRIGGER set_company_id_trigger BEFORE INSERT ON device_change_requests
  FOR EACH ROW EXECUTE FUNCTION set_company_id_from_current();

DROP TRIGGER IF EXISTS set_company_id_trigger ON activation_codes;
CREATE TRIGGER set_company_id_trigger BEFORE INSERT ON activation_codes
  FOR EACH ROW EXECUTE FUNCTION set_company_id_from_current();

DROP TRIGGER IF EXISTS set_company_id_trigger ON attendance_calculation_settings;
CREATE TRIGGER set_company_id_trigger BEFORE INSERT ON attendance_calculation_settings
  FOR EACH ROW EXECUTE FUNCTION set_company_id_from_current();

DROP TRIGGER IF EXISTS set_company_id_trigger ON employee_vacation_requests;
CREATE TRIGGER set_company_id_trigger BEFORE INSERT ON employee_vacation_requests
  FOR EACH ROW EXECUTE FUNCTION set_company_id_from_current();

DROP TRIGGER IF EXISTS set_company_id_trigger ON auto_checkout_settings;
CREATE TRIGGER set_company_id_trigger BEFORE INSERT ON auto_checkout_settings
  FOR EACH ROW EXECUTE FUNCTION set_company_id_from_current();

DROP TRIGGER IF EXISTS set_company_id_trigger ON generated_reports;
CREATE TRIGGER set_company_id_trigger BEFORE INSERT ON generated_reports
  FOR EACH ROW EXECUTE FUNCTION set_company_id_from_current();

DROP TRIGGER IF EXISTS set_company_id_trigger ON time_sync_logs;
CREATE TRIGGER set_company_id_trigger BEFORE INSERT ON time_sync_logs
  FOR EACH ROW EXECUTE FUNCTION set_company_id_from_current();

DROP TRIGGER IF EXISTS set_company_id_trigger ON payroll_settings;
CREATE TRIGGER set_company_id_trigger BEFORE INSERT ON payroll_settings
  FOR EACH ROW EXECUTE FUNCTION set_company_id_from_current();

DROP TRIGGER IF EXISTS set_company_id_trigger ON lateness_slabs;
CREATE TRIGGER set_company_id_trigger BEFORE INSERT ON lateness_slabs
  FOR EACH ROW EXECUTE FUNCTION set_company_id_from_current();

DROP TRIGGER IF EXISTS set_company_id_trigger ON penalties;
CREATE TRIGGER set_company_id_trigger BEFORE INSERT ON penalties
  FOR EACH ROW EXECUTE FUNCTION set_company_id_from_current();

DROP TRIGGER IF EXISTS set_company_id_trigger ON payroll_runs;
CREATE TRIGGER set_company_id_trigger BEFORE INSERT ON payroll_runs
  FOR EACH ROW EXECUTE FUNCTION set_company_id_from_current();

DROP TRIGGER IF EXISTS set_company_id_trigger ON leave_types;
CREATE TRIGGER set_company_id_trigger BEFORE INSERT ON leave_types
  FOR EACH ROW EXECUTE FUNCTION set_company_id_from_current();

DROP TRIGGER IF EXISTS set_company_id_trigger ON leave_balances;
CREATE TRIGGER set_company_id_trigger BEFORE INSERT ON leave_balances
  FOR EACH ROW EXECUTE FUNCTION set_company_id_from_current();

DROP TRIGGER IF EXISTS set_company_id_trigger ON leave_requests;
CREATE TRIGGER set_company_id_trigger BEFORE INSERT ON leave_requests
  FOR EACH ROW EXECUTE FUNCTION set_company_id_from_current();

DROP TRIGGER IF EXISTS set_company_id_trigger ON timezone_alerts;
CREATE TRIGGER set_company_id_trigger BEFORE INSERT ON timezone_alerts
  FOR EACH ROW EXECUTE FUNCTION set_company_id_from_current();

DROP TRIGGER IF EXISTS set_company_id_trigger ON auto_checkout_pending;
CREATE TRIGGER set_company_id_trigger BEFORE INSERT ON auto_checkout_pending
  FOR EACH ROW EXECUTE FUNCTION set_company_id_from_current();

DROP TRIGGER IF EXISTS set_company_id_trigger ON employee_location_heartbeat;
CREATE TRIGGER set_company_id_trigger BEFORE INSERT ON employee_location_heartbeat
  FOR EACH ROW EXECUTE FUNCTION set_company_id_from_current();

DROP TRIGGER IF EXISTS set_company_id_trigger ON payroll_records;
CREATE TRIGGER set_company_id_trigger BEFORE INSERT ON payroll_records
  FOR EACH ROW EXECUTE FUNCTION set_company_id_from_current();

DROP TRIGGER IF EXISTS set_company_id_trigger ON application_settings;
CREATE TRIGGER set_company_id_trigger BEFORE INSERT ON application_settings
  FOR EACH ROW EXECUTE FUNCTION set_company_id_from_current();
