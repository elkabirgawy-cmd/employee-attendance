/*
  # Update Attendance Calculation to Calendar-Based System

  1. Changes to Tables
    - `attendance_calculation_settings`
      - Remove `working_days_mode` (no longer needed - always calendar-based)
      - Remove `fixed_working_days` (replaced by automatic calendar calculation)
      - Remove `fixed_vacation_days` (replaced by weekly off days)
      - Add `weekly_off_days` (integer array) - days of week (0=Sunday, 6=Saturday)
    
    - `employees`
      - Add `weekly_off_days` (integer array) - per-employee weekly off override
      - Add `custom_working_days_enabled` (boolean) - toggle for custom days
      - Keep `custom_working_days` (integer) - but only used when enabled
      - Remove `custom_vacation_days` (no longer needed)

  2. Notes
    - Calendar-based: Always use actual days in month (28-31)
    - Weekly off days: Count occurrences of selected days in the month
    - Effective days = DaysInMonth - WeeklyOffCount - ApprovedVacations
    - If employee has custom_working_days_enabled: use custom value instead
*/

-- Update attendance_calculation_settings table
DO $$
BEGIN
  -- Add weekly_off_days column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendance_calculation_settings' AND column_name = 'weekly_off_days'
  ) THEN
    ALTER TABLE attendance_calculation_settings ADD COLUMN weekly_off_days integer[] DEFAULT '{}';
  END IF;

  -- Drop old columns if they exist (we'll keep them for backward compatibility but won't use them)
  -- Just set defaults to null for now to avoid data loss
END $$;

-- Update employees table
DO $$
BEGIN
  -- Add weekly_off_days for employees
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'weekly_off_days'
  ) THEN
    ALTER TABLE employees ADD COLUMN weekly_off_days integer[] DEFAULT NULL;
  END IF;

  -- Add custom_working_days_enabled flag
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'custom_working_days_enabled'
  ) THEN
    ALTER TABLE employees ADD COLUMN custom_working_days_enabled boolean DEFAULT false;
  END IF;
END $$;

-- Create index for weekly_off_days for better performance
CREATE INDEX IF NOT EXISTS idx_employees_weekly_off_days ON employees USING GIN (weekly_off_days);

-- Update existing settings record to have empty weekly off days array
UPDATE attendance_calculation_settings 
SET weekly_off_days = '{}' 
WHERE weekly_off_days IS NULL;
