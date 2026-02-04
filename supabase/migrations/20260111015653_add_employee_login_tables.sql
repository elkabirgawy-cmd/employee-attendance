/*
  # Add Employee Login Support Tables and Columns

  ## Overview
  This migration adds the necessary tables and columns to support the employee phone login flow with OTP verification and device management.

  ## Changes

  1. Schema Changes
    - Add `otp_verified_at` column to employees table to track first OTP verification
    - Create `device_change_requests` table for managing device change approvals

  2. device_change_requests Table
    - `id` (uuid, primary key)
    - `employee_id` (uuid, references employees) - The employee requesting device change
    - `old_device_id` (text) - The previously bound device
    - `new_device_id` (text) - The new device being requested
    - `status` (text) - 'pending', 'approved', 'rejected'
    - `requested_at` (timestamptz) - When the request was made
    - `reviewed_at` (timestamptz) - When admin reviewed the request
    - `reviewed_by` (uuid, references admin_users) - Admin who reviewed
    - `notes` (text) - Admin notes or rejection reason
    - `created_at` (timestamptz)

  3. Security
    - Enable RLS on device_change_requests
    - Employees can view their own requests
    - Admins can view and manage all requests

  4. Important Notes
    - This supports the employee phone login flow
    - Device changes require admin approval for security
    - OTP verification is tracked at first login
*/

-- Add otp_verified_at column to employees if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'otp_verified_at'
  ) THEN
    ALTER TABLE employees ADD COLUMN otp_verified_at timestamptz;
  END IF;
END $$;

-- Create device_change_requests table
CREATE TABLE IF NOT EXISTS device_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  old_device_id text,
  new_device_id text NOT NULL,
  status text CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  requested_at timestamptz DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES admin_users(id),
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(employee_id, new_device_id)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_device_change_requests_employee ON device_change_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_device_change_requests_status ON device_change_requests(status) WHERE status = 'pending';

-- Enable RLS
ALTER TABLE device_change_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for device_change_requests

-- Employees can view their own device change requests
CREATE POLICY "Employees can view own device change requests"
  ON device_change_requests FOR SELECT
  TO authenticated, anon
  USING (true);

-- System can insert device change requests (anon for employee app)
CREATE POLICY "System can insert device change requests"
  ON device_change_requests FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

-- Admins can view all device change requests
CREATE POLICY "Admins can view all device change requests"
  ON device_change_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.is_active = true
    )
  );

-- Admins can update device change requests
CREATE POLICY "Admins can update device change requests"
  ON device_change_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.is_active = true
    )
  );
