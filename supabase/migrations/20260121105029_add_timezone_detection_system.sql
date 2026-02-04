/*
  # Add GPS-Based Timezone Detection

  1. Schema Changes
    - Add timezone fields to attendance_logs
    - Add timezone_alerts table for mismatches
    - Add timezone settings to system_settings

  2. New Fields in attendance_logs
    - resolved_timezone (text) - IANA timezone from GPS (e.g., Africa/Cairo)
    - device_timezone (text) - Browser/device reported timezone
    - utc_check_in_time (timestamptz) - Check-in in UTC
    - utc_check_out_time (timestamptz) - Check-out in UTC
    - local_check_in_time (timestamptz) - Check-in in resolved timezone
    - local_check_out_time (timestamptz) - Check-out in resolved timezone
    - timezone_mismatch (boolean) - Flag if device timezone ≠ GPS timezone

  3. New Tables
    - timezone_alerts - Tracks timezone mismatch incidents
    - timezone_resolution_cache - Caches GPS→timezone lookups

  4. Settings
    - timezone_mode (auto_gps / fixed_per_branch)
    - timezone_mismatch_threshold (minutes)

  5. Security
    - Enable RLS on all new tables
    - Admin-only access for alerts and settings
*/

-- Add timezone fields to attendance_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendance_logs' AND column_name = 'resolved_timezone'
  ) THEN
    ALTER TABLE attendance_logs ADD COLUMN resolved_timezone text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendance_logs' AND column_name = 'device_timezone'
  ) THEN
    ALTER TABLE attendance_logs ADD COLUMN device_timezone text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendance_logs' AND column_name = 'utc_check_in_time'
  ) THEN
    ALTER TABLE attendance_logs ADD COLUMN utc_check_in_time timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendance_logs' AND column_name = 'utc_check_out_time'
  ) THEN
    ALTER TABLE attendance_logs ADD COLUMN utc_check_out_time timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendance_logs' AND column_name = 'local_check_in_time'
  ) THEN
    ALTER TABLE attendance_logs ADD COLUMN local_check_in_time timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendance_logs' AND column_name = 'local_check_out_time'
  ) THEN
    ALTER TABLE attendance_logs ADD COLUMN local_check_out_time timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendance_logs' AND column_name = 'timezone_mismatch'
  ) THEN
    ALTER TABLE attendance_logs ADD COLUMN timezone_mismatch boolean DEFAULT false;
  END IF;
END $$;

-- Timezone alerts table
CREATE TABLE IF NOT EXISTS timezone_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  attendance_log_id uuid REFERENCES attendance_logs(id) ON DELETE SET NULL,
  resolved_timezone text NOT NULL,
  device_timezone text NOT NULL,
  gps_latitude numeric(10, 7) NOT NULL,
  gps_longitude numeric(10, 7) NOT NULL,
  time_difference_minutes integer,
  severity text DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  is_resolved boolean DEFAULT false,
  resolved_by uuid REFERENCES admin_users(id),
  resolved_at timestamptz,
  resolution_notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE timezone_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view timezone alerts"
  ON timezone_alerts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

CREATE POLICY "Admin can update timezone alerts"
  ON timezone_alerts FOR UPDATE
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

-- Timezone resolution cache (to reduce API calls)
CREATE TABLE IF NOT EXISTS timezone_resolution_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  latitude numeric(10, 7) NOT NULL,
  longitude numeric(10, 7) NOT NULL,
  timezone text NOT NULL,
  utc_offset integer NOT NULL,
  dst_active boolean DEFAULT false,
  cached_at timestamptz DEFAULT now(),
  last_used_at timestamptz DEFAULT now(),
  use_count integer DEFAULT 1,
  UNIQUE(latitude, longitude)
);

ALTER TABLE timezone_resolution_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System can manage timezone cache"
  ON timezone_resolution_cache FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Add timezone settings to system_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'system_settings' AND column_name = 'timezone_mode'
  ) THEN
    ALTER TABLE system_settings ADD COLUMN timezone_mode text DEFAULT 'auto_gps' CHECK (timezone_mode IN ('auto_gps', 'fixed_per_branch'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'system_settings' AND column_name = 'timezone_mismatch_threshold_minutes'
  ) THEN
    ALTER TABLE system_settings ADD COLUMN timezone_mismatch_threshold_minutes integer DEFAULT 30;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'system_settings' AND column_name = 'create_alert_on_timezone_mismatch'
  ) THEN
    ALTER TABLE system_settings ADD COLUMN create_alert_on_timezone_mismatch boolean DEFAULT true;
  END IF;
END $$;

-- Add timezone field to branches (for fixed_per_branch mode)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'branches' AND column_name = 'fixed_timezone'
  ) THEN
    ALTER TABLE branches ADD COLUMN fixed_timezone text;
  END IF;
END $$;

-- Create index for faster timezone cache lookups
CREATE INDEX IF NOT EXISTS idx_timezone_cache_coords ON timezone_resolution_cache(latitude, longitude);

-- Create index for timezone alerts
CREATE INDEX IF NOT EXISTS idx_timezone_alerts_employee ON timezone_alerts(employee_id);
CREATE INDEX IF NOT EXISTS idx_timezone_alerts_created ON timezone_alerts(created_at);
CREATE INDEX IF NOT EXISTS idx_timezone_alerts_resolved ON timezone_alerts(is_resolved);

-- Function to clean old cache entries (keep only last 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_timezone_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM timezone_resolution_cache
  WHERE last_used_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Update system_settings with default timezone settings if not exists
DO $$
BEGIN
  UPDATE system_settings
  SET 
    timezone_mode = COALESCE(timezone_mode, 'auto_gps'),
    timezone_mismatch_threshold_minutes = COALESCE(timezone_mismatch_threshold_minutes, 30),
    create_alert_on_timezone_mismatch = COALESCE(create_alert_on_timezone_mismatch, true)
  WHERE id IS NOT NULL;
END $$;
