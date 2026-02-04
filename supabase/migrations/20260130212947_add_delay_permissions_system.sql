/*
  # Add Delay Permissions System

  ## Overview
  This migration adds a comprehensive delay permission system that allows employees to request
  permission for being late, which reduces late deductions in payroll calculations.

  ## 1. New Tables
    - `delay_permissions`
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key to companies) - for multi-tenant isolation
      - `employee_id` (uuid, foreign key to employees)
      - `date` (date) - the date of the delay permission
      - `start_time` (time) - when the delay permission starts
      - `end_time` (time) - when the delay permission ends
      - `minutes` (integer) - total minutes calculated from time difference
      - `reason` (text, nullable) - optional reason for the delay
      - `status` (text) - pending|approved|rejected
      - `decided_by` (uuid, nullable) - admin who approved/rejected
      - `decided_at` (timestamptz, nullable) - when the decision was made
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  ## 2. Payroll Settings Updates
    - Add `delay_permission_enabled` (boolean) - enable/disable the feature
    - Add `max_delay_hours_per_day` (numeric) - maximum hours allowed per day (default 2)
    - Add `allow_delay_minutes` (boolean) - allow minute-level precision

  ## 3. Security
    - Enable RLS on `delay_permissions` table
    - Add policies for admins to manage all requests

  ## 4. Constraints
    - Check constraint to ensure end_time > start_time
    - Check constraint to ensure status is valid
*/

-- Create delay_permissions table
CREATE TABLE IF NOT EXISTS delay_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  minutes integer NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  decided_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  decided_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Constraints
  CONSTRAINT valid_time_range CHECK (end_time > start_time),
  CONSTRAINT positive_minutes CHECK (minutes > 0)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_delay_permissions_company_id ON delay_permissions(company_id);
CREATE INDEX IF NOT EXISTS idx_delay_permissions_employee_id ON delay_permissions(employee_id);
CREATE INDEX IF NOT EXISTS idx_delay_permissions_date ON delay_permissions(date);
CREATE INDEX IF NOT EXISTS idx_delay_permissions_status ON delay_permissions(status);

-- Add delay permission settings to payroll_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payroll_settings' AND column_name = 'delay_permission_enabled'
  ) THEN
    ALTER TABLE payroll_settings ADD COLUMN delay_permission_enabled boolean DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payroll_settings' AND column_name = 'max_delay_hours_per_day'
  ) THEN
    ALTER TABLE payroll_settings ADD COLUMN max_delay_hours_per_day numeric(5,2) DEFAULT 2.0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payroll_settings' AND column_name = 'allow_delay_minutes'
  ) THEN
    ALTER TABLE payroll_settings ADD COLUMN allow_delay_minutes boolean DEFAULT true;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE delay_permissions ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can view all delay permissions in their company
CREATE POLICY "Admins can view company delay permissions"
  ON delay_permissions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.company_id = delay_permissions.company_id
    )
  );

-- Policy: Admins can insert delay permissions
CREATE POLICY "Admins can create delay permissions"
  ON delay_permissions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.company_id = delay_permissions.company_id
    )
  );

-- Policy: Admins can update delay permissions (approve/reject)
CREATE POLICY "Admins can update delay permissions"
  ON delay_permissions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.company_id = delay_permissions.company_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.company_id = delay_permissions.company_id
    )
  );

-- Policy: Admins can delete delay permissions
CREATE POLICY "Admins can delete delay permissions"
  ON delay_permissions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.company_id = delay_permissions.company_id
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_delay_permissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS delay_permissions_updated_at ON delay_permissions;
CREATE TRIGGER delay_permissions_updated_at
  BEFORE UPDATE ON delay_permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_delay_permissions_updated_at();

-- Create function to calculate minutes from time range
CREATE OR REPLACE FUNCTION calculate_delay_minutes(
  p_start_time time,
  p_end_time time
)
RETURNS integer AS $$
BEGIN
  RETURN EXTRACT(EPOCH FROM (p_end_time - p_start_time)) / 60;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Comment on table
COMMENT ON TABLE delay_permissions IS 'Stores delay permission requests to reduce late deductions in payroll';
COMMENT ON COLUMN delay_permissions.minutes IS 'Total minutes of delay permission, calculated from time difference';
COMMENT ON COLUMN delay_permissions.status IS 'Permission status: pending (awaiting approval), approved (reduces late deduction), rejected (no effect)';
