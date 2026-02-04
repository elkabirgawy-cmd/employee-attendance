/*
  # Add Employee Working Hours and Late/Early Leave Tracking

  ## Overview
  This migration adds working hours configuration per employee and tracking for late arrivals and early departures.

  ## New Columns in `employees` table
  - `work_start_time` (time) - Scheduled work start time (e.g., "09:00:00")
  - `work_end_time` (time) - Scheduled work end time (e.g., "17:00:00")
  - `late_grace_min` (integer) - Grace period for late arrivals in minutes (default: 0)
  - `early_grace_min` (integer) - Grace period for early departures in minutes (default: 0)

  ## New Columns in `attendance_logs` table
  - `late_minutes` (integer) - Minutes late after grace period (default: 0)
  - `early_leave_minutes` (integer) - Minutes of early departure after grace period (default: 0)

  ## Important Notes
  1. All time fields are nullable - if not set, no late/early calculations are performed
  2. Grace periods allow for small delays without penalty
  3. If work_end_time < work_start_time, it's treated as an overnight shift
  4. Negative values are never stored - minimum is 0
*/

-- Add working hours fields to employees table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'work_start_time'
  ) THEN
    ALTER TABLE employees ADD COLUMN work_start_time time;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'work_end_time'
  ) THEN
    ALTER TABLE employees ADD COLUMN work_end_time time;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'late_grace_min'
  ) THEN
    ALTER TABLE employees ADD COLUMN late_grace_min integer DEFAULT 0 NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'early_grace_min'
  ) THEN
    ALTER TABLE employees ADD COLUMN early_grace_min integer DEFAULT 0 NOT NULL;
  END IF;
END $$;

-- Add late/early tracking fields to attendance_logs table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendance_logs' AND column_name = 'late_minutes'
  ) THEN
    ALTER TABLE attendance_logs ADD COLUMN late_minutes integer DEFAULT 0 NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendance_logs' AND column_name = 'early_leave_minutes'
  ) THEN
    ALTER TABLE attendance_logs ADD COLUMN early_leave_minutes integer DEFAULT 0 NOT NULL;
  END IF;
END $$;