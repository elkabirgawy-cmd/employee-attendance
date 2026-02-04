/*
  # Multi-Company SaaS Transformation

  ## Overview
  Transforms the GPS Attendance system into a true multi-tenant SaaS platform.

  ## Changes
  1. New `companies` table
  2. Add `company_id` to all business tables  
  3. Add employee salary fields
  4. Update RLS policies for multi-tenancy
  5. Create performance indexes
*/

-- =====================================================
-- 1. CREATE COMPANIES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'basic', 'premium', 'enterprise')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'cancelled')),
  trial_ends_at timestamptz,
  currency_label text DEFAULT 'ریال',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- Create default company
INSERT INTO companies (name, plan, status, currency_label)
VALUES ('شركة افتراضية', 'free', 'active', 'ریال')
ON CONFLICT DO NOTHING;

-- =====================================================
-- 2. ADD COMPANY_ID COLUMNS
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_users' AND column_name = 'company_id') THEN
    ALTER TABLE admin_users ADD COLUMN company_id uuid REFERENCES companies(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'company_id') THEN
    ALTER TABLE employees ADD COLUMN company_id uuid REFERENCES companies(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'branches' AND column_name = 'company_id') THEN
    ALTER TABLE branches ADD COLUMN company_id uuid REFERENCES companies(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'departments' AND column_name = 'company_id') THEN
    ALTER TABLE departments ADD COLUMN company_id uuid REFERENCES companies(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shifts' AND column_name = 'company_id') THEN
    ALTER TABLE shifts ADD COLUMN company_id uuid REFERENCES companies(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'attendance_logs' AND column_name = 'company_id') THEN
    ALTER TABLE attendance_logs ADD COLUMN company_id uuid REFERENCES companies(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payroll_runs' AND column_name = 'company_id') THEN
    ALTER TABLE payroll_runs ADD COLUMN company_id uuid REFERENCES companies(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payroll_records' AND column_name = 'company_id') THEN
    ALTER TABLE payroll_records ADD COLUMN company_id uuid REFERENCES companies(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leave_types' AND column_name = 'company_id') THEN
    ALTER TABLE leave_types ADD COLUMN company_id uuid REFERENCES companies(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leave_balances' AND column_name = 'company_id') THEN
    ALTER TABLE leave_balances ADD COLUMN company_id uuid REFERENCES companies(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leave_requests' AND column_name = 'company_id') THEN
    ALTER TABLE leave_requests ADD COLUMN company_id uuid REFERENCES companies(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'devices' AND column_name = 'company_id') THEN
    ALTER TABLE devices ADD COLUMN company_id uuid REFERENCES companies(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'penalties' AND column_name = 'company_id') THEN
    ALTER TABLE penalties ADD COLUMN company_id uuid REFERENCES companies(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fraud_alerts' AND column_name = 'company_id') THEN
    ALTER TABLE fraud_alerts ADD COLUMN company_id uuid REFERENCES companies(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'timezone_alerts' AND column_name = 'company_id') THEN
    ALTER TABLE timezone_alerts ADD COLUMN company_id uuid REFERENCES companies(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'generated_reports' AND column_name = 'company_id') THEN
    ALTER TABLE generated_reports ADD COLUMN company_id uuid REFERENCES companies(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activation_codes' AND column_name = 'company_id') THEN
    ALTER TABLE activation_codes ADD COLUMN company_id uuid REFERENCES companies(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'device_change_requests' AND column_name = 'company_id') THEN
    ALTER TABLE device_change_requests ADD COLUMN company_id uuid REFERENCES companies(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lateness_slabs' AND column_name = 'company_id') THEN
    ALTER TABLE lateness_slabs DROP COLUMN IF EXISTS organization_id;
    ALTER TABLE lateness_slabs ADD COLUMN company_id uuid REFERENCES companies(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payroll_settings' AND column_name = 'company_id') THEN
    ALTER TABLE payroll_settings DROP COLUMN IF EXISTS organization_id;
    ALTER TABLE payroll_settings ADD COLUMN company_id uuid REFERENCES companies(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'auto_checkout_settings' AND column_name = 'company_id') THEN
    ALTER TABLE auto_checkout_settings ADD COLUMN company_id uuid REFERENCES companies(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'attendance_calculation_settings' AND column_name = 'company_id') THEN
    ALTER TABLE attendance_calculation_settings ADD COLUMN company_id uuid REFERENCES companies(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'application_settings' AND column_name = 'company_id') THEN
    ALTER TABLE application_settings ADD COLUMN company_id uuid REFERENCES companies(id);
  END IF;
END $$;

-- =====================================================
-- 3. MIGRATE EXISTING DATA
-- =====================================================

DO $$
DECLARE
  default_company_id uuid;
BEGIN
  SELECT id INTO default_company_id FROM companies LIMIT 1;

  IF default_company_id IS NOT NULL THEN
    UPDATE admin_users SET company_id = default_company_id WHERE company_id IS NULL;
    UPDATE employees SET company_id = default_company_id WHERE company_id IS NULL;
    UPDATE branches SET company_id = default_company_id WHERE company_id IS NULL;
    UPDATE departments SET company_id = default_company_id WHERE company_id IS NULL;
    UPDATE shifts SET company_id = default_company_id WHERE company_id IS NULL;
    UPDATE attendance_logs SET company_id = default_company_id WHERE company_id IS NULL;
    UPDATE payroll_runs SET company_id = default_company_id WHERE company_id IS NULL;
    UPDATE payroll_records SET company_id = default_company_id WHERE company_id IS NULL;
    UPDATE leave_types SET company_id = default_company_id WHERE company_id IS NULL;
    UPDATE leave_balances SET company_id = default_company_id WHERE company_id IS NULL;
    UPDATE leave_requests SET company_id = default_company_id WHERE company_id IS NULL;
    UPDATE devices SET company_id = default_company_id WHERE company_id IS NULL;
    UPDATE penalties SET company_id = default_company_id WHERE company_id IS NULL;
    UPDATE fraud_alerts SET company_id = default_company_id WHERE company_id IS NULL;
    UPDATE timezone_alerts SET company_id = default_company_id WHERE company_id IS NULL;
    UPDATE generated_reports SET company_id = default_company_id WHERE company_id IS NULL;
    UPDATE activation_codes SET company_id = default_company_id WHERE company_id IS NULL;
    UPDATE device_change_requests SET company_id = default_company_id WHERE company_id IS NULL;
    UPDATE lateness_slabs SET company_id = default_company_id WHERE company_id IS NULL;
    UPDATE payroll_settings SET company_id = default_company_id WHERE company_id IS NULL;
    UPDATE auto_checkout_settings SET company_id = default_company_id WHERE company_id IS NULL;
    UPDATE attendance_calculation_settings SET company_id = default_company_id WHERE company_id IS NULL;
    UPDATE application_settings SET company_id = default_company_id WHERE company_id IS NULL;
  END IF;
END $$;

ALTER TABLE admin_users ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE employees ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE branches ALTER COLUMN company_id SET NOT NULL;

-- =====================================================
-- 4. ADD EMPLOYEE SALARY FIELDS
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'salary_base') THEN
    ALTER TABLE employees ADD COLUMN salary_base numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'salary_type') THEN
    ALTER TABLE employees ADD COLUMN salary_type text DEFAULT 'monthly' CHECK (salary_type IN ('monthly', 'daily'));
  END IF;
END $$;

UPDATE employees
SET
  salary_base = COALESCE(monthly_salary, daily_wage, 0),
  salary_type = COALESCE(salary_mode, 'monthly')
WHERE salary_base IS NULL OR salary_base = 0;

-- =====================================================
-- 5. HELPER FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN (
    SELECT company_id
    FROM admin_users
    WHERE id = auth.uid()
    LIMIT 1
  );
END;
$$;

-- =====================================================
-- 6. RLS POLICIES
-- =====================================================

-- Companies
CREATE POLICY "Users can view their own company"
  ON companies FOR SELECT
  TO authenticated
  USING (id = public.get_user_company_id());

-- Admin Users
DROP POLICY IF EXISTS "Admins can view all users" ON admin_users;
DROP POLICY IF EXISTS "Admins can insert users" ON admin_users;
DROP POLICY IF EXISTS "Admins can update users" ON admin_users;
DROP POLICY IF EXISTS "Allow registration" ON admin_users;

CREATE POLICY "Admins can view company users"
  ON admin_users FOR SELECT
  TO authenticated
  USING (company_id = public.get_user_company_id());

CREATE POLICY "Admins can insert company users"
  ON admin_users FOR INSERT
  TO authenticated
  WITH CHECK (company_id = public.get_user_company_id());

CREATE POLICY "Admins can update company users"
  ON admin_users FOR UPDATE
  TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

CREATE POLICY "Allow admin registration"
  ON admin_users FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Employees
DROP POLICY IF EXISTS "Admins can view employees" ON employees;
DROP POLICY IF EXISTS "Admins can insert employees" ON employees;
DROP POLICY IF EXISTS "Admins can update employees" ON employees;
DROP POLICY IF EXISTS "Admins can delete employees" ON employees;

CREATE POLICY "Admins can view company employees"
  ON employees FOR SELECT
  TO authenticated
  USING (company_id = public.get_user_company_id());

CREATE POLICY "Admins can insert company employees"
  ON employees FOR INSERT
  TO authenticated
  WITH CHECK (company_id = public.get_user_company_id());

CREATE POLICY "Admins can update company employees"
  ON employees FOR UPDATE
  TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

CREATE POLICY "Admins can delete company employees"
  ON employees FOR DELETE
  TO authenticated
  USING (company_id = public.get_user_company_id());

-- Branches
DROP POLICY IF EXISTS "Admins can view all branches" ON branches;
DROP POLICY IF EXISTS "Admins can insert branches" ON branches;
DROP POLICY IF EXISTS "Admins can update branches" ON branches;
DROP POLICY IF EXISTS "Admins can delete branches" ON branches;

CREATE POLICY "Admins can view company branches"
  ON branches FOR SELECT
  TO authenticated
  USING (company_id = public.get_user_company_id());

CREATE POLICY "Admins can insert company branches"
  ON branches FOR INSERT
  TO authenticated
  WITH CHECK (company_id = public.get_user_company_id());

CREATE POLICY "Admins can update company branches"
  ON branches FOR UPDATE
  TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

CREATE POLICY "Admins can delete company branches"
  ON branches FOR DELETE
  TO authenticated
  USING (company_id = public.get_user_company_id());

-- Departments
DROP POLICY IF EXISTS "Admins can view all departments" ON departments;
DROP POLICY IF EXISTS "Admins can insert departments" ON departments;
DROP POLICY IF EXISTS "Admins can update departments" ON departments;
DROP POLICY IF EXISTS "Admins can delete departments" ON departments;

CREATE POLICY "Admins can view company departments"
  ON departments FOR SELECT
  TO authenticated
  USING (company_id = public.get_user_company_id());

CREATE POLICY "Admins can insert company departments"
  ON departments FOR INSERT
  TO authenticated
  WITH CHECK (company_id = public.get_user_company_id());

CREATE POLICY "Admins can update company departments"
  ON departments FOR UPDATE
  TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

CREATE POLICY "Admins can delete company departments"
  ON departments FOR DELETE
  TO authenticated
  USING (company_id = public.get_user_company_id());

-- Shifts
DROP POLICY IF EXISTS "Admins can view all shifts" ON shifts;
DROP POLICY IF EXISTS "Admins can insert shifts" ON shifts;
DROP POLICY IF EXISTS "Admins can update shifts" ON shifts;
DROP POLICY IF EXISTS "Admins can delete shifts" ON shifts;

CREATE POLICY "Admins can view company shifts"
  ON shifts FOR SELECT
  TO authenticated
  USING (company_id = public.get_user_company_id());

CREATE POLICY "Admins can insert company shifts"
  ON shifts FOR INSERT
  TO authenticated
  WITH CHECK (company_id = public.get_user_company_id());

CREATE POLICY "Admins can update company shifts"
  ON shifts FOR UPDATE
  TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

CREATE POLICY "Admins can delete company shifts"
  ON shifts FOR DELETE
  TO authenticated
  USING (company_id = public.get_user_company_id());

-- Attendance Logs
DROP POLICY IF EXISTS "Admins can view all attendance logs" ON attendance_logs;
DROP POLICY IF EXISTS "Admins can insert attendance logs" ON attendance_logs;
DROP POLICY IF EXISTS "Admins can update attendance logs" ON attendance_logs;
DROP POLICY IF EXISTS "Allow anonymous attendance logging" ON attendance_logs;
DROP POLICY IF EXISTS "Allow anonymous attendance for company employees" ON attendance_logs;

CREATE POLICY "Admins can view company attendance"
  ON attendance_logs FOR SELECT
  TO authenticated
  USING (company_id = public.get_user_company_id());

CREATE POLICY "Admins can insert company attendance"
  ON attendance_logs FOR INSERT
  TO authenticated
  WITH CHECK (company_id = public.get_user_company_id());

CREATE POLICY "Admins can update company attendance"
  ON attendance_logs FOR UPDATE
  TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

CREATE POLICY "Allow anonymous attendance logging"
  ON attendance_logs FOR INSERT
  TO anon
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM employees WHERE id = employee_id
    )
  );

-- Payroll Records
DROP POLICY IF EXISTS "Admins can view payroll records" ON payroll_records;
DROP POLICY IF EXISTS "Admins can insert payroll records" ON payroll_records;
DROP POLICY IF EXISTS "Admins can update payroll records" ON payroll_records;
DROP POLICY IF EXISTS "Admins can delete payroll records" ON payroll_records;

CREATE POLICY "Admins can view company payroll"
  ON payroll_records FOR SELECT
  TO authenticated
  USING (company_id = public.get_user_company_id());

CREATE POLICY "Admins can insert company payroll"
  ON payroll_records FOR INSERT
  TO authenticated
  WITH CHECK (company_id = public.get_user_company_id());

CREATE POLICY "Admins can update company payroll"
  ON payroll_records FOR UPDATE
  TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

CREATE POLICY "Admins can delete company payroll"
  ON payroll_records FOR DELETE
  TO authenticated
  USING (company_id = public.get_user_company_id());

-- Leave Types
DROP POLICY IF EXISTS "Anyone can view leave types" ON leave_types;
DROP POLICY IF EXISTS "Admins can manage leave types" ON leave_types;
DROP POLICY IF EXISTS "Anon can view active leave types" ON leave_types;
DROP POLICY IF EXISTS "Authenticated users can view leave types" ON leave_types;

CREATE POLICY "Users can view company leave types"
  ON leave_types FOR SELECT
  TO authenticated
  USING (company_id = public.get_user_company_id());

CREATE POLICY "Admins can insert company leave types"
  ON leave_types FOR INSERT
  TO authenticated
  WITH CHECK (company_id = public.get_user_company_id());

CREATE POLICY "Admins can update company leave types"
  ON leave_types FOR UPDATE
  TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

CREATE POLICY "Admins can delete company leave types"
  ON leave_types FOR DELETE
  TO authenticated
  USING (company_id = public.get_user_company_id());

CREATE POLICY "Anon can view active leave types"
  ON leave_types FOR SELECT
  TO anon
  USING (is_active = true);

-- =====================================================
-- 7. INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_admin_users_company_id ON admin_users(company_id);
CREATE INDEX IF NOT EXISTS idx_employees_company_id ON employees(company_id);
CREATE INDEX IF NOT EXISTS idx_branches_company_id ON branches(company_id);
CREATE INDEX IF NOT EXISTS idx_departments_company_id ON departments(company_id);
CREATE INDEX IF NOT EXISTS idx_shifts_company_id ON shifts(company_id);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_company_id ON attendance_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_payroll_records_company_id ON payroll_records(company_id);
CREATE INDEX IF NOT EXISTS idx_leave_types_company_id ON leave_types(company_id);
CREATE INDEX IF NOT EXISTS idx_devices_company_id ON devices(company_id);

-- =====================================================
-- 8. ADD OWNER FIELD
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_users' AND column_name = 'is_owner') THEN
    ALTER TABLE admin_users ADD COLUMN is_owner boolean DEFAULT false;
  END IF;
END $$;

UPDATE admin_users SET is_owner = true WHERE is_owner IS NULL OR is_owner = false;
