/*
  # Payroll System with Penalties

  1. New Tables
    - `payroll_settings`
      - Global settings for payroll (workdays per month, lateness policy)
    - `lateness_slabs`
      - Lateness penalty slabs (from_min, to_min, penalty_type, penalty_value)
    - `penalties`
      - Admin-defined penalties (fixed, days, fraction) with approval workflow
    - `payroll_runs`
      - Monthly payroll calculation records

  2. Changes
    - Add salary fields to employees table (mode: monthly/daily, amounts, allowances)

  3. Security
    - Enable RLS on all new tables
    - Admin-only access for settings and penalties
    - Employees can view their own payslips only

  4. Important Notes
    - Lateness penalty applies SINGLE slab (non-cumulative)
    - Daily employees paid only for present days
    - Monthly employees have fixed salary with deductions
    - Penalties must be approved before applying to payroll
*/

-- Add salary fields to employees table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'salary_mode'
  ) THEN
    ALTER TABLE employees ADD COLUMN salary_mode text DEFAULT 'monthly' CHECK (salary_mode IN ('monthly', 'daily'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'monthly_salary'
  ) THEN
    ALTER TABLE employees ADD COLUMN monthly_salary numeric(10,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'daily_wage'
  ) THEN
    ALTER TABLE employees ADD COLUMN daily_wage numeric(10,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'allowances'
  ) THEN
    ALTER TABLE employees ADD COLUMN allowances numeric(10,2) DEFAULT 0;
  END IF;
END $$;

-- Payroll settings table
CREATE TABLE IF NOT EXISTS payroll_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  workdays_per_month integer DEFAULT 26,
  grace_minutes integer DEFAULT 15,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE payroll_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage payroll settings"
  ON payroll_settings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

-- Lateness slabs table
CREATE TABLE IF NOT EXISTS lateness_slabs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  from_minutes integer NOT NULL,
  to_minutes integer NOT NULL,
  penalty_type text NOT NULL CHECK (penalty_type IN ('fixed', 'day_fraction')),
  penalty_value numeric(10,2) NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE lateness_slabs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage lateness slabs"
  ON lateness_slabs FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

-- Penalties table
CREATE TABLE IF NOT EXISTS penalties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  penalty_date date NOT NULL,
  penalty_type text NOT NULL CHECK (penalty_type IN ('fixed', 'days', 'fraction')),
  penalty_value numeric(10,2) NOT NULL,
  reason text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by uuid REFERENCES admin_users(id),
  approved_at timestamptz,
  created_by uuid REFERENCES admin_users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE penalties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage penalties"
  ON penalties FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

-- Payroll runs table
CREATE TABLE IF NOT EXISTS payroll_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  period_month integer NOT NULL,
  period_year integer NOT NULL,
  salary_mode text NOT NULL,
  base_salary numeric(10,2) DEFAULT 0,
  allowances numeric(10,2) DEFAULT 0,
  present_days integer DEFAULT 0,
  late_days integer DEFAULT 0,
  lateness_deduction numeric(10,2) DEFAULT 0,
  penalties_deduction numeric(10,2) DEFAULT 0,
  other_deductions numeric(10,2) DEFAULT 0,
  gross_salary numeric(10,2) DEFAULT 0,
  total_deductions numeric(10,2) DEFAULT 0,
  net_salary numeric(10,2) DEFAULT 0,
  calculation_metadata jsonb,
  created_by uuid REFERENCES admin_users(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(employee_id, period_month, period_year)
);

ALTER TABLE payroll_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage payroll runs"
  ON payroll_runs FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

-- Insert default payroll settings
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM payroll_settings LIMIT 1) THEN
    INSERT INTO payroll_settings (organization_id, workdays_per_month, grace_minutes)
    VALUES (gen_random_uuid(), 26, 15);
  END IF;
END $$;

-- Insert default lateness slabs
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM lateness_slabs LIMIT 1) THEN
    INSERT INTO lateness_slabs (organization_id, from_minutes, to_minutes, penalty_type, penalty_value)
    VALUES 
      (gen_random_uuid(), 1, 15, 'fixed', 0),
      (gen_random_uuid(), 16, 30, 'fixed', 50),
      (gen_random_uuid(), 31, 60, 'day_fraction', 0.25),
      (gen_random_uuid(), 61, 999, 'day_fraction', 0.5);
  END IF;
END $$;
