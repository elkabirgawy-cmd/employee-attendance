/*
  # Recreate Push Notification System

  1. Drop existing notifications table and recreate with proper structure
  2. Create device_push_tokens table
  3. Set up RLS policies
  4. Create indexes

  ## Changes
  - Drop old notifications table
  - Create new notifications table with correct schema
  - Create device_push_tokens table
  - Add RLS policies
  - Add indexes for performance
*/

-- Drop existing notifications table
DROP TABLE IF EXISTS notifications CASCADE;

-- Create device_push_tokens table
CREATE TABLE IF NOT EXISTS device_push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'employee')),
  platform text NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  token text UNIQUE NOT NULL,
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create notifications table
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'employee')),
  type text NOT NULL CHECK (type IN ('leave_request', 'leave_approved', 'leave_rejected', 'late_arrival', 'absence', 'fraud_alert', 'payroll_deduction', 'device_change', 'fake_gps')),
  title text NOT NULL,
  body text NOT NULL,
  data jsonb DEFAULT '{}'::jsonb,
  read boolean DEFAULT false,
  priority text DEFAULT 'normal' CHECK (priority IN ('normal', 'high')),
  created_at timestamptz DEFAULT now(),
  read_at timestamptz
);

-- Enable RLS
ALTER TABLE device_push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Policies for device_push_tokens
CREATE POLICY "Users can view own device tokens"
  ON device_push_tokens FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own device tokens"
  ON device_push_tokens FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own device tokens"
  ON device_push_tokens FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own device tokens"
  ON device_push_tokens FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Policies for notifications
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Create indexes for performance
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_device_tokens_user_id ON device_push_tokens(user_id);
CREATE INDEX idx_device_tokens_token ON device_push_tokens(token);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_device_push_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS device_push_tokens_updated_at ON device_push_tokens;
CREATE TRIGGER device_push_tokens_updated_at
  BEFORE UPDATE ON device_push_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_device_push_tokens_updated_at();