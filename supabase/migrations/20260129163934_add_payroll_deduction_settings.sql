/*
  # Add Payroll Deduction Settings

  1. New Tables
    - `payroll_deduction_settings`
      - Company-level settings for late, early checkout, and absence deductions
      - Toggles for each deduction type
      - Absence deduction configuration
    
    - `late_deduction_rules`
      - Editable table for late deduction slabs
      - from_minutes, to_minutes, deduction_type (fixed/percent), value
    
    - `early_checkout_deduction_rules`
      - Same structure as late deduction rules

  2. Security
    - Enable RLS on all tables
    - Admin users can manage their company's settings
*/

-- Payroll deduction settings table (company-level)
CREATE TABLE IF NOT EXISTS payroll_deduction_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  
  -- General settings
  salary_type text DEFAULT 'monthly' CHECK (salary_type IN ('monthly', 'daily')),
  
  -- Late deduction
  late_deduction_enabled boolean DEFAULT false,
  
  -- Early checkout deduction
  early_checkout_deduction_enabled boolean DEFAULT false,
  
  -- Absence deduction
  absence_deduction_enabled boolean DEFAULT false,
  absence_deduction_type text DEFAULT 'full_day' CHECK (absence_deduction_type IN ('full_day', 'fixed_amount')),
  absence_fixed_amount numeric(10,2) DEFAULT 0,
  count_absence_without_checkin boolean DEFAULT true,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(company_id)
);

ALTER TABLE payroll_deduction_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin users can view own company deduction settings"
  ON payroll_deduction_settings FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM admin_users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admin users can insert own company deduction settings"
  ON payroll_deduction_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM admin_users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admin users can update own company deduction settings"
  ON payroll_deduction_settings FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM admin_users WHERE id = auth.uid()
    )
  );

-- Late deduction rules table
CREATE TABLE IF NOT EXISTS late_deduction_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  from_minutes int NOT NULL,
  to_minutes int NOT NULL,
  deduction_type text NOT NULL CHECK (deduction_type IN ('fixed', 'percent')),
  value numeric(10,2) NOT NULL,
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT valid_minute_range CHECK (to_minutes > from_minutes)
);

ALTER TABLE late_deduction_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin users can view own company late deduction rules"
  ON late_deduction_rules FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM admin_users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admin users can insert own company late deduction rules"
  ON late_deduction_rules FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM admin_users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admin users can update own company late deduction rules"
  ON late_deduction_rules FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM admin_users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admin users can delete own company late deduction rules"
  ON late_deduction_rules FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM admin_users WHERE id = auth.uid()
    )
  );

-- Early checkout deduction rules table
CREATE TABLE IF NOT EXISTS early_checkout_deduction_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  from_minutes int NOT NULL,
  to_minutes int NOT NULL,
  deduction_type text NOT NULL CHECK (deduction_type IN ('fixed', 'percent')),
  value numeric(10,2) NOT NULL,
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT valid_minute_range CHECK (to_minutes > from_minutes)
);

ALTER TABLE early_checkout_deduction_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin users can view own company early checkout deduction rules"
  ON early_checkout_deduction_rules FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM admin_users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admin users can insert own company early checkout deduction rules"
  ON early_checkout_deduction_rules FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM admin_users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admin users can update own company early checkout deduction rules"
  ON early_checkout_deduction_rules FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM admin_users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admin users can delete own company early checkout deduction rules"
  ON early_checkout_deduction_rules FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM admin_users WHERE id = auth.uid()
    )
  );

-- Add salary_type to existing payroll_settings if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payroll_settings' AND column_name = 'salary_type'
  ) THEN
    ALTER TABLE payroll_settings ADD COLUMN salary_type text DEFAULT 'monthly' CHECK (salary_type IN ('monthly', 'daily'));
  END IF;
END $$;
