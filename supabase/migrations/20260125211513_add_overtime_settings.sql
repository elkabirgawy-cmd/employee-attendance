/*
  # Add Overtime Settings to Payroll Settings
  
  1. Changes:
    - Add `overtime_multiplier` field - معامل ضرب الوقت الإضافي (افتراضي 1.5)
    - Add `shift_hours_per_day` field - عدد ساعات الوردية اليومية (افتراضي 8)
  
  2. Notes:
    - overtime_amount = overtime_hours * hourly_rate * overtime_multiplier
    - hourly_rate = basic_salary / (work_days * shift_hours) for monthly
    - hourly_rate = basic_salary / shift_hours for daily
*/

-- Add overtime_multiplier field
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payroll_settings' AND column_name = 'overtime_multiplier'
  ) THEN
    ALTER TABLE payroll_settings ADD COLUMN overtime_multiplier numeric DEFAULT 1.5;
  END IF;
END $$;

-- Add shift_hours_per_day field
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payroll_settings' AND column_name = 'shift_hours_per_day'
  ) THEN
    ALTER TABLE payroll_settings ADD COLUMN shift_hours_per_day numeric DEFAULT 8;
  END IF;
END $$;

-- Update existing row if exists
UPDATE payroll_settings 
SET 
  overtime_multiplier = 1.5,
  shift_hours_per_day = 8
WHERE overtime_multiplier IS NULL OR shift_hours_per_day IS NULL;
