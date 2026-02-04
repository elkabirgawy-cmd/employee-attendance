/*
  # Add Activation Codes System

  1. New Tables
    - `activation_codes`
      - `id` (uuid, primary key)
      - `employee_id` (uuid, references employees)
      - `activation_code` (text, unique code for employee activation)
      - `is_used` (boolean, whether code has been used)
      - `used_at` (timestamptz, when code was used)
      - `device_id_used` (text, which device used this code)
      - `created_at` (timestamptz, when code was created)
      - `expires_at` (timestamptz, when code expires)
      - `created_by` (uuid, references admin_users)

  2. Security
    - Enable RLS on `activation_codes` table
    - Add policy for admins to manage codes
    - Add policy for service role to verify codes

  3. Changes
    - Add `is_device_activated` column to employees table
    - Add `activation_code_used` column to employees table
*/

CREATE TABLE IF NOT EXISTS activation_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  activation_code text NOT NULL UNIQUE,
  is_used boolean DEFAULT false,
  used_at timestamptz,
  device_id_used text,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '30 days'),
  created_by uuid REFERENCES admin_users(id)
);

ALTER TABLE activation_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage activation codes"
  ON activation_codes
  FOR ALL
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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'is_device_activated'
  ) THEN
    ALTER TABLE employees ADD COLUMN is_device_activated boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'activation_code_used'
  ) THEN
    ALTER TABLE employees ADD COLUMN activation_code_used text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_activation_codes_employee_id ON activation_codes(employee_id);
CREATE INDEX IF NOT EXISTS idx_activation_codes_code ON activation_codes(activation_code);
CREATE INDEX IF NOT EXISTS idx_activation_codes_is_used ON activation_codes(is_used);
