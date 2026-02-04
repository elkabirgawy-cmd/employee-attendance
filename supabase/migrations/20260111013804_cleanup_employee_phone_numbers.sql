/*
  # Clean up employee phone numbers

  1. Data Cleanup
    - Remove all non-digit characters from employee phone numbers
    - Apply consistent normalization to all phone numbers
    - Convert all valid Egyptian phone numbers to +201XXXXXXXXX format
  
  2. Changes
    - Update all rows in `employees` table
    - Sanitize phone field by removing non-digits
    - Normalize to standard +201XXXXXXXXX format
  
  3. Security
    - No RLS changes needed
    - Data integrity maintained through validation
  
  4. Notes
    - This is a one-time cleanup migration
    - All phone numbers will be converted to digits-only format before normalization
    - Pattern: 01XXXXXXXXX → +201XXXXXXXXX
    - Pattern: 201XXXXXXXXX → +201XXXXXXXXX
    - Pattern: 20XXXXXXXXX → +201XXXXXXXXX (if length matches)
*/

-- Function to sanitize and normalize Egyptian phone numbers
CREATE OR REPLACE FUNCTION sanitize_and_normalize_phone(phone_input text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  digits_only text;
  result text;
BEGIN
  IF phone_input IS NULL OR phone_input = '' THEN
    RETURN phone_input;
  END IF;
  
  -- Remove all non-digit characters
  digits_only := regexp_replace(phone_input, '\D', '', 'g');
  
  -- Normalize based on length and prefix
  -- Egyptian mobile: 01XXXXXXXXX (11 digits)
  IF digits_only ~ '^01[0-9]{9}$' THEN
    result := '+20' || substring(digits_only from 2);
  -- Already has country code: 201XXXXXXXXX (12 digits)
  ELSIF digits_only ~ '^201[0-9]{9}$' THEN
    result := '+' || digits_only;
  -- Missing + sign: 20XXXXXXXXX (12 digits starting with 20)
  ELSIF digits_only ~ '^20[0-9]{10}$' AND length(digits_only) = 12 THEN
    result := '+' || digits_only;
  ELSE
    -- Return original if pattern doesn't match
    result := phone_input;
  END IF;
  
  RETURN result;
END;
$$;

-- Update all employee phone numbers
UPDATE employees
SET phone = sanitize_and_normalize_phone(phone)
WHERE phone IS NOT NULL AND phone != '';

-- Drop the temporary function
DROP FUNCTION IF EXISTS sanitize_and_normalize_phone(text);