/*
  # Add Unique Constraint to payroll_settings.company_id

  ## Changes
  1. Add unique constraint on company_id to ensure one settings row per company
  2. Remove duplicate rows if any exist (keep the most recent one)

  ## Purpose
  - Prevent multiple payroll_settings rows for the same company
  - Enable safe upsert operations
  - Auto-creation of default settings for new companies
*/

-- Remove duplicate rows, keeping only the most recent one per company
DO $$
DECLARE
  duplicate_company_id uuid;
BEGIN
  FOR duplicate_company_id IN
    SELECT company_id
    FROM payroll_settings
    WHERE company_id IS NOT NULL
    GROUP BY company_id
    HAVING COUNT(*) > 1
  LOOP
    -- Keep the most recent row, delete older ones
    DELETE FROM payroll_settings
    WHERE company_id = duplicate_company_id
    AND id NOT IN (
      SELECT id FROM payroll_settings
      WHERE company_id = duplicate_company_id
      ORDER BY created_at DESC
      LIMIT 1
    );
  END LOOP;
END $$;

-- Add unique constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payroll_settings_company_id_unique'
  ) THEN
    ALTER TABLE payroll_settings
    ADD CONSTRAINT payroll_settings_company_id_unique
    UNIQUE (company_id);
  END IF;
END $$;