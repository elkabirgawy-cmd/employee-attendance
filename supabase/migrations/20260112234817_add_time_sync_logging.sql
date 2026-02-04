/*
  # Add Time Sync Logging System

  1. New Tables
    - `time_sync_logs`
      - `id` (uuid, primary key)
      - `employee_id` (uuid, nullable) - Employee who triggered the sync (null for admin)
      - `time_source` (text) - SERVER_GPS, SERVER_CACHED_TZ, or DEVICE_FALLBACK
      - `timezone_source` (text) - GPS, MANUAL, CACHED, or DEFAULT
      - `timezone` (text) - Detected timezone (e.g., Asia/Riyadh)
      - `gps_latitude` (numeric, nullable) - GPS coordinates used for detection
      - `gps_longitude` (numeric, nullable)
      - `server_time` (timestamptz) - The server time at sync
      - `device_time` (timestamptz) - The device time at sync
      - `time_drift_seconds` (numeric) - Difference between server and device
      - `synced_at` (timestamptz) - When the sync occurred
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `time_sync_logs` table
    - Add policy for authenticated users to insert their own logs
    - Add policy for admin users to read all logs
*/

-- Create time_sync_logs table
CREATE TABLE IF NOT EXISTS time_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE,
  time_source text NOT NULL CHECK (time_source IN ('SERVER_GPS', 'SERVER_CACHED_TZ', 'DEVICE_FALLBACK')),
  timezone_source text NOT NULL CHECK (timezone_source IN ('GPS', 'MANUAL', 'CACHED', 'DEFAULT')),
  timezone text NOT NULL,
  gps_latitude numeric,
  gps_longitude numeric,
  server_time timestamptz NOT NULL,
  device_time timestamptz NOT NULL,
  time_drift_seconds numeric DEFAULT 0,
  synced_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE time_sync_logs ENABLE ROW LEVEL SECURITY;

-- Public can insert time sync logs (for employee check-in)
CREATE POLICY "Anyone can insert time sync logs"
  ON time_sync_logs
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Admin users can read all time sync logs
CREATE POLICY "Admin users can read all time sync logs"
  ON time_sync_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_time_sync_logs_employee_id ON time_sync_logs(employee_id);
CREATE INDEX IF NOT EXISTS idx_time_sync_logs_synced_at ON time_sync_logs(synced_at DESC);
CREATE INDEX IF NOT EXISTS idx_time_sync_logs_time_source ON time_sync_logs(time_source);
