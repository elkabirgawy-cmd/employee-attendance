/*
  # Allow Anonymous Attendance Operations

  ## Changes
  This migration adds policies to allow anonymous users to manage their attendance records.

  1. Security Changes
    - Allow anonymous users to read attendance logs
    - Allow anonymous users to create attendance records
    - Allow anonymous users to update attendance records (for check-out)
    
  2. Important Notes
    - Anonymous users can only access attendance data
    - No authentication checks since this is for the employee kiosk app
*/

-- Allow anonymous users to read attendance logs
CREATE POLICY "Anonymous can view attendance logs"
  ON attendance_logs FOR SELECT
  TO anon
  USING (true);

-- Allow anonymous users to create attendance records
CREATE POLICY "Anonymous can create attendance logs"
  ON attendance_logs FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow anonymous users to update attendance records (for check-out)
CREATE POLICY "Anonymous can update attendance logs"
  ON attendance_logs FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);
