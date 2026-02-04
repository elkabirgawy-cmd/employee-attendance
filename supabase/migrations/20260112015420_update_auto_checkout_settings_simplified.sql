/*
  # Simplified Auto-Checkout Settings

  1. Changes to `auto_checkout_settings`
    - Replace complex settings with simplified ones
    - Add `auto_checkout_enabled` (boolean) - Master switch for auto-checkout
    - Add `auto_checkout_after_seconds` (integer) - Grace period before auto-checkout (default 900 = 15 min)
    - Add `verify_outside_with_n_readings` (integer) - Number of consecutive outside readings needed (default 3)
    - Add `watch_interval_seconds` (integer) - How often to check location (default 15 seconds)
    - Remove old heartbeat-based fields (we're simplifying to client-side monitoring)

  2. Important Notes
    - This is a simplified, client-driven approach
    - Two triggers only: LocationDisabled and LocationOutOfBranch
    - Countdown visible to employee with live timer
    - Persistence across app reloads using localStorage
*/

-- Drop old auto_checkout_settings approach
DROP TABLE IF EXISTS auto_checkout_settings CASCADE;

-- Create new simplified auto_checkout_settings table
CREATE TABLE IF NOT EXISTS auto_checkout_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auto_checkout_enabled boolean DEFAULT true,
  auto_checkout_after_seconds integer DEFAULT 900 CHECK (auto_checkout_after_seconds >= 60 AND auto_checkout_after_seconds <= 3600),
  verify_outside_with_n_readings integer DEFAULT 3 CHECK (verify_outside_with_n_readings >= 1 AND verify_outside_with_n_readings <= 10),
  watch_interval_seconds integer DEFAULT 15 CHECK (watch_interval_seconds >= 5 AND watch_interval_seconds <= 60),
  max_location_accuracy_meters integer DEFAULT 80,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE auto_checkout_settings ENABLE ROW LEVEL SECURITY;

-- Admin policies
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

-- Insert default settings
INSERT INTO auto_checkout_settings (
  auto_checkout_enabled,
  auto_checkout_after_seconds,
  verify_outside_with_n_readings,
  watch_interval_seconds
)
SELECT true, 900, 3, 15
WHERE NOT EXISTS (SELECT 1 FROM auto_checkout_settings);