/*
  # Add Comprehensive Overtime Settings System
  
  1. New Table: `overtime_settings`
    - `id` (uuid, primary key)
    - `company_id` (uuid, FK to companies)
    - `overtime_enabled` (boolean) - تفعيل الوقت الإضافي
    - `calculation_basis` (text) - shift_based | employee_based
    - `rate_type` (text) - same_rate | multiplier | fixed_amount
    - `rate_value` (numeric) - قيمة المعامل أو المبلغ الثابت
    - `max_overtime_hours_per_day` (numeric, nullable) - الحد الأقصى للساعات الإضافية يوميًا
    - `ignore_overtime_less_than_minutes` (integer, nullable) - تجاهل الوقت الإضافي أقل من X دقيقة
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)
  
  2. Security:
    - Enable RLS
    - Only authenticated company admins can access their own settings
  
  3. Notes:
    - One settings record per company
    - Default: overtime disabled
    - If shift_based: overtime = hours after shift end time
    - If employee_based: overtime = hours after employee.daily_working_hours
*/

-- Create overtime_settings table
CREATE TABLE IF NOT EXISTS overtime_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  overtime_enabled boolean DEFAULT false,
  calculation_basis text DEFAULT 'shift_based' CHECK (calculation_basis IN ('shift_based', 'employee_based')),
  rate_type text DEFAULT 'multiplier' CHECK (rate_type IN ('same_rate', 'multiplier', 'fixed_amount')),
  rate_value numeric DEFAULT 1.5,
  max_overtime_hours_per_day numeric,
  ignore_overtime_less_than_minutes integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id)
);

-- Enable RLS
ALTER TABLE overtime_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Company admins can view their overtime settings"
  ON overtime_settings FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM admin_users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Company admins can insert their overtime settings"
  ON overtime_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM admin_users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Company admins can update their overtime settings"
  ON overtime_settings FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM admin_users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM admin_users WHERE id = auth.uid()
    )
  );

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_overtime_settings_company_id ON overtime_settings(company_id);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_overtime_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_overtime_settings_timestamp
  BEFORE UPDATE ON overtime_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_overtime_settings_updated_at();
