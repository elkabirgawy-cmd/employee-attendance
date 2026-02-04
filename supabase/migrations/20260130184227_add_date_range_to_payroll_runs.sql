/*
  # Add Date Range Fields to Payroll Runs

  1. Changes
    - Add `period_from_day` integer field (default 1)
    - Add `period_to_day` integer field (default last day of month)
    - These fields define the exact range of days used for payroll calculation

  2. Purpose
    - Support partial month payroll calculation (e.g., from day 1 to day 15)
    - Prevent counting days outside the specified range as absences
    - Accurate payroll calculations based on actual working period

  3. Important Notes
    - Existing records will default to full month (1 to last day)
    - Future payroll runs can specify custom ranges
    - All calculations (attendance, penalties, bonuses) respect this range
*/

-- Add period_from_day field to payroll_runs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payroll_runs' AND column_name = 'period_from_day'
  ) THEN
    ALTER TABLE payroll_runs ADD COLUMN period_from_day integer DEFAULT 1;
  END IF;
END $$;

-- Add period_to_day field to payroll_runs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payroll_runs' AND column_name = 'period_to_day'
  ) THEN
    ALTER TABLE payroll_runs ADD COLUMN period_to_day integer DEFAULT 31;
  END IF;
END $$;

-- Update existing records to use full month
UPDATE payroll_runs
SET
  period_from_day = 1,
  period_to_day = CASE
    WHEN period_month IN (1, 3, 5, 7, 8, 10, 12) THEN 31
    WHEN period_month IN (4, 6, 9, 11) THEN 30
    WHEN period_month = 2 AND period_year % 4 = 0 AND (period_year % 100 != 0 OR period_year % 400 = 0) THEN 29
    ELSE 28
  END
WHERE period_from_day IS NULL OR period_to_day IS NULL;
