/*
  # Add Employee Insurance and Tax Fields

  1. New Fields in employees table:
    - `social_insurance_value` (numeric) - Monthly social insurance deduction amount
    - `income_tax_value` (numeric) - Monthly income tax deduction amount

  2. Changes:
    - Both fields are nullable and default to 0
    - These values will be used as the source of truth for payroll generation
    - Values are stored per employee and isolated per company
    - When payroll is generated, these values will be snapshot into payroll_runs

  3. Notes:
    - These are fixed monthly deductions per employee
    - Values can be left empty (treated as 0)
    - Will be displayed in employee card under salary information
    - Will appear as separate columns in payroll reports
*/

-- Add social insurance field to employees table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'social_insurance_value'
  ) THEN
    ALTER TABLE employees ADD COLUMN social_insurance_value numeric(10,2) DEFAULT 0;
  END IF;
END $$;

-- Add income tax field to employees table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'income_tax_value'
  ) THEN
    ALTER TABLE employees ADD COLUMN income_tax_value numeric(10,2) DEFAULT 0;
  END IF;
END $$;
