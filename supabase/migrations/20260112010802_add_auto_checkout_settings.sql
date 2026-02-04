/*
  # Auto-Checkout Settings and Tracking

  1. New Tables
    - `auto_checkout_settings`
      - `id` (uuid, primary key)
      - `auto_checkout_on_location_disabled_enabled` (boolean) - Enable auto-checkout when location is disabled
      - `location_disabled_grace_minutes` (integer) - Grace period in minutes after location is disabled
      - `auto_checkout_on_no_signal_enabled` (boolean) - Enable auto-checkout when app signal stops
      - `no_signal_grace_minutes` (integer) - Grace period in minutes when signal stops
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Changes to `attendance_logs`
    - Add `last_heartbeat_at` (timestamp) - Last heartbeat received from employee app
    - Add `last_location_at` (timestamp) - Last location update received
    - Add `location_permission_state` (text) - Current location permission state (granted/prompt/denied)
    - Add `first_location_disabled_detected_at` (timestamp) - When location disabled was first detected
    - Add `checkout_reason` (text) - Reason for checkout (MANUAL/AUTO_LEFT_GEOFENCE/AUTO_LOCATION_DISABLED/AUTO_NO_APP_SIGNAL)

  3. Security
    - Enable RLS on `auto_checkout_settings`
    - Only authenticated admin users can read/write settings
    - Add policies for attendance_logs updates

  4. Important Notes
    - Settings are global (company-wide)
    - Only one settings row should exist
    - Default values are set for initial configuration
    - Server jobs will use these settings for enforcement
*/

-- Create auto_checkout_settings table
CREATE TABLE IF NOT EXISTS auto_checkout_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auto_checkout_on_location_disabled_enabled boolean DEFAULT false,
  location_disabled_grace_minutes integer DEFAULT 15 CHECK (location_disabled_grace_minutes >= 1 AND location_disabled_grace_minutes <= 180),
  auto_checkout_on_no_signal_enabled boolean DEFAULT false,
  no_signal_grace_minutes integer DEFAULT 20 CHECK (no_signal_grace_minutes >= 5 AND no_signal_grace_minutes <= 240),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add new columns to attendance_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendance_logs' AND column_name = 'last_heartbeat_at'
  ) THEN
    ALTER TABLE attendance_logs ADD COLUMN last_heartbeat_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendance_logs' AND column_name = 'last_location_at'
  ) THEN
    ALTER TABLE attendance_logs ADD COLUMN last_location_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendance_logs' AND column_name = 'location_permission_state'
  ) THEN
    ALTER TABLE attendance_logs ADD COLUMN location_permission_state text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendance_logs' AND column_name = 'first_location_disabled_detected_at'
  ) THEN
    ALTER TABLE attendance_logs ADD COLUMN first_location_disabled_detected_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendance_logs' AND column_name = 'checkout_reason'
  ) THEN
    ALTER TABLE attendance_logs ADD COLUMN checkout_reason text DEFAULT 'MANUAL';
  END IF;
END $$;

-- Enable RLS on auto_checkout_settings
ALTER TABLE auto_checkout_settings ENABLE ROW LEVEL SECURITY;

-- Admin users can read settings
CREATE POLICY "Admin users can read auto-checkout settings"
  ON auto_checkout_settings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

-- Admin users can update settings
CREATE POLICY "Admin users can update auto-checkout settings"
  ON auto_checkout_settings
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

-- Admin users can insert settings
CREATE POLICY "Admin users can insert auto-checkout settings"
  ON auto_checkout_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

-- Insert default settings if none exist
INSERT INTO auto_checkout_settings (
  auto_checkout_on_location_disabled_enabled,
  location_disabled_grace_minutes,
  auto_checkout_on_no_signal_enabled,
  no_signal_grace_minutes
)
SELECT false, 15, false, 20
WHERE NOT EXISTS (SELECT 1 FROM auto_checkout_settings);