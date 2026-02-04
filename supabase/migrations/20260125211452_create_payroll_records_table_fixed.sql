/*
  # Create Payroll Records Table
  
  1. New Tables
    - `payroll_records`
      - `id` (uuid, primary key)
      - `employee_id` (uuid, foreign key to employees)
      - `month` (integer, 1-12)
      - `year` (integer)
      - `basic_salary` (numeric) - الراتب الأساسي
      - `salary_type` (text) - monthly/daily
      - `allowances` (numeric) - البدلات
      - `overtime_hours` (numeric) - ساعات الوقت الإضافي
      - `overtime_amount` (numeric) - قيمة الوقت الإضافي
      - `absence_days` (numeric) - أيام الغياب
      - `absence_deduction` (numeric) - خصم الغياب
      - `lateness_deduction` (numeric) - خصم التأخير
      - `penalties_deduction` (numeric) - الجزاءات
      - `insurance_amount` (numeric) - التأمينات الاجتماعية
      - `tax_amount` (numeric) - ضريبة الدخل
      - `other_deductions` (numeric) - خصومات أخرى
      - `net_salary` (numeric) - صافي الراتب
      - `work_days` (integer) - أيام العمل
      - `shift_hours` (numeric) - ساعات الوردية
      - `created_at` (timestamp)
      - `created_by` (uuid, reference to admin user)
  
  2. Security
    - Enable RLS on `payroll_records` table
    - Add policies for authenticated admin users to read/write
  
  3. Indexes
    - Index on employee_id, month, year for fast lookups
*/

-- Create payroll_records table
CREATE TABLE IF NOT EXISTS payroll_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  month integer NOT NULL CHECK (month >= 1 AND month <= 12),
  year integer NOT NULL CHECK (year >= 2000 AND year <= 2100),
  basic_salary numeric DEFAULT 0,
  salary_type text DEFAULT 'monthly' CHECK (salary_type IN ('monthly', 'daily')),
  allowances numeric DEFAULT 0,
  overtime_hours numeric DEFAULT 0,
  overtime_amount numeric DEFAULT 0,
  absence_days numeric DEFAULT 0,
  absence_deduction numeric DEFAULT 0,
  lateness_deduction numeric DEFAULT 0,
  penalties_deduction numeric DEFAULT 0,
  insurance_amount numeric DEFAULT 0,
  tax_amount numeric DEFAULT 0,
  other_deductions numeric DEFAULT 0,
  net_salary numeric DEFAULT 0,
  work_days integer DEFAULT 0,
  shift_hours numeric DEFAULT 8,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES admin_users(id),
  UNIQUE(employee_id, month, year)
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_payroll_records_employee_period 
  ON payroll_records(employee_id, year DESC, month DESC);

-- Enable RLS
ALTER TABLE payroll_records ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can read all payroll records
CREATE POLICY "Admins can read all payroll records"
  ON payroll_records
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

-- Policy: Admins can insert payroll records
CREATE POLICY "Admins can insert payroll records"
  ON payroll_records
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

-- Policy: Admins can update payroll records
CREATE POLICY "Admins can update payroll records"
  ON payroll_records
  FOR UPDATE
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

-- Policy: Admins can delete payroll records
CREATE POLICY "Admins can delete payroll records"
  ON payroll_records
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );
