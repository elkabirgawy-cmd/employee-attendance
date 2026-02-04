/*
  # Add checkout_type field to attendance_logs

  1. Changes
    - Add `checkout_type` (text) - Type of checkout: MANUAL or AUTO
    - Set default to 'MANUAL'
    - Update existing auto-checkout records to have checkout_type = 'AUTO'

  2. Notes
    - This separates checkout type (MANUAL/AUTO) from checkout reason (LOCATION_DISABLED/OUTSIDE_BRANCH/etc)
    - Makes it easier to query and filter auto-checkout records
*/

-- Add checkout_type column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendance_logs' AND column_name = 'checkout_type'
  ) THEN
    ALTER TABLE attendance_logs ADD COLUMN checkout_type text DEFAULT 'MANUAL';
  END IF;
END $$;

-- Update existing auto-checkout records
UPDATE attendance_logs 
SET checkout_type = 'AUTO'
WHERE checkout_reason LIKE 'AUTO_%';