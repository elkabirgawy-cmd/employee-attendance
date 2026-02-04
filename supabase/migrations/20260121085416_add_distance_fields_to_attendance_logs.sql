/*
  # Add Distance Fields to Attendance Logs

  1. Changes
    - Add `check_in_distance_m` column to store calculated distance from branch at check-in (in meters)
    - Add `check_out_distance_m` column to store calculated distance from branch at check-out (in meters)
  
  2. Purpose
    - Enable auditing and verification of geofence compliance
    - Store exact distance at time of check-in/out for fraud detection
    - Support historical reporting and analysis
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendance_logs' AND column_name = 'check_in_distance_m'
  ) THEN
    ALTER TABLE attendance_logs ADD COLUMN check_in_distance_m numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendance_logs' AND column_name = 'check_out_distance_m'
  ) THEN
    ALTER TABLE attendance_logs ADD COLUMN check_out_distance_m numeric;
  END IF;
END $$;
