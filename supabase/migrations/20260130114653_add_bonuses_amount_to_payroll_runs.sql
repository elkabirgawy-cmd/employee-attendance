/*
  # Add Bonuses Amount to Payroll Runs

  1. Changes
    - Add `bonuses_amount` column to payroll_runs table
    - Default value is 0 for existing records

  2. Notes
    - Bonuses are positive amounts added to earnings
    - Backwards compatible with existing payroll runs
*/

-- Add bonuses_amount field to payroll_runs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payroll_runs' AND column_name = 'bonuses_amount'
  ) THEN
    ALTER TABLE payroll_runs
    ADD COLUMN bonuses_amount numeric(10,2) DEFAULT 0;
  END IF;
END $$;
