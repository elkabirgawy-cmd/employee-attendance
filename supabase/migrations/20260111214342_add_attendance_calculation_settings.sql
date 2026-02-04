/*
  # Add Attendance Calculation Settings

  1. New Tables
    - `attendance_calculation_settings`
      - `id` (uuid, primary key)
      - `working_days_mode` (text) - 'fixed' or 'automatic'
      - `fixed_working_days` (integer) - when mode is 'fixed'
      - `fixed_vacation_days` (integer) - monthly vacation days to deduct
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `employee_vacation_requests`
      - `id` (uuid, primary key)
      - `employee_id` (uuid, foreign key)
      - `start_date` (date)
      - `end_date` (date)
      - `days_count` (integer)
      - `status` (text) - 'pending', 'approved', 'rejected'
      - `reason` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Modifications
    - Add to `employees` table:
      - `custom_working_days` (integer, nullable) - per-employee override
      - `custom_vacation_days` (integer, nullable) - per-employee override

  3. Security
    - Enable RLS on all new tables
    - Add policies for authenticated admin users
*/

-- Create attendance calculation settings table
CREATE TABLE IF NOT EXISTS attendance_calculation_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  working_days_mode text NOT NULL DEFAULT 'automatic' CHECK (working_days_mode IN ('fixed', 'automatic')),
  fixed_working_days integer DEFAULT 26 CHECK (fixed_working_days > 0 AND fixed_working_days <= 31),
  fixed_vacation_days integer DEFAULT 0 CHECK (fixed_vacation_days >= 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create employee vacation requests table
CREATE TABLE IF NOT EXISTS employee_vacation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  days_count integer NOT NULL CHECK (days_count > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add custom fields to employees table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'custom_working_days'
  ) THEN
    ALTER TABLE employees ADD COLUMN custom_working_days integer CHECK (custom_working_days > 0 AND custom_working_days <= 31);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'custom_vacation_days'
  ) THEN
    ALTER TABLE employees ADD COLUMN custom_vacation_days integer CHECK (custom_vacation_days >= 0);
  END IF;
END $$;

-- Insert default settings if not exists
INSERT INTO attendance_calculation_settings (working_days_mode, fixed_working_days, fixed_vacation_days)
SELECT 'automatic', 26, 4
WHERE NOT EXISTS (SELECT 1 FROM attendance_calculation_settings);

-- Enable RLS
ALTER TABLE attendance_calculation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_vacation_requests ENABLE ROW LEVEL SECURITY;

-- Policies for attendance_calculation_settings
CREATE POLICY "Admins can view settings"
  ON attendance_calculation_settings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

CREATE POLICY "Admins can update settings"
  ON attendance_calculation_settings FOR UPDATE
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

CREATE POLICY "Admins can insert settings"
  ON attendance_calculation_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

-- Policies for employee_vacation_requests
CREATE POLICY "Admins can view vacation requests"
  ON employee_vacation_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert vacation requests"
  ON employee_vacation_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

CREATE POLICY "Admins can update vacation requests"
  ON employee_vacation_requests FOR UPDATE
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

CREATE POLICY "Admins can delete vacation requests"
  ON employee_vacation_requests FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_vacation_requests_employee ON employee_vacation_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_vacation_requests_status ON employee_vacation_requests(status);
CREATE INDEX IF NOT EXISTS idx_vacation_requests_dates ON employee_vacation_requests(start_date, end_date);
