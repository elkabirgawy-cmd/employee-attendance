/*
  # Add Currency Setting
  
  1. Changes:
    - Add `currency` field to application_settings table
    - Default value is 'ريال' (Saudi Riyal in Arabic)
  
  2. Notes:
    - This field will be used across payroll slip displays
    - Admin can customize the currency text
    - Can support any currency symbol or text
*/

-- Add currency field
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'application_settings' AND column_name = 'currency'
  ) THEN
    ALTER TABLE application_settings ADD COLUMN currency text DEFAULT 'ريال';
  END IF;
END $$;

-- Update existing row if exists
UPDATE application_settings SET currency = 'ريال' WHERE currency IS NULL;
