/*
  # Add Extended Payroll Fields
  
  1. New Fields in payroll_runs table:
    - `overtime_hours` (numeric) - Number of overtime hours worked
    - `overtime_amount` (numeric) - Calculated overtime payment
    - `social_insurance` (numeric) - Social insurance deduction
    - `income_tax` (numeric) - Income tax deduction
    - `absence_days` (integer) - Number of absence days
    - `absence_deduction` (numeric) - Deduction amount for absences
  
  2. Changes:
    - All new fields are nullable and default to 0
    - These fields will be populated during payroll generation
    - Will be displayed in employee payslips
  
  3. Notes:
    - Base salary source of truth is in employees table (monthly_salary)
    - Payroll runs are read-only calculation outputs
    - New fields follow existing deduction/earning patterns
*/

-- Add overtime fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payroll_runs' AND column_name = 'overtime_hours'
  ) THEN
    ALTER TABLE payroll_runs ADD COLUMN overtime_hours numeric DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payroll_runs' AND column_name = 'overtime_amount'
  ) THEN
    ALTER TABLE payroll_runs ADD COLUMN overtime_amount numeric DEFAULT 0;
  END IF;
END $$;

-- Add deduction fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payroll_runs' AND column_name = 'social_insurance'
  ) THEN
    ALTER TABLE payroll_runs ADD COLUMN social_insurance numeric DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payroll_runs' AND column_name = 'income_tax'
  ) THEN
    ALTER TABLE payroll_runs ADD COLUMN income_tax numeric DEFAULT 0;
  END IF;
END $$;

-- Add absence fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payroll_runs' AND column_name = 'absence_days'
  ) THEN
    ALTER TABLE payroll_runs ADD COLUMN absence_days integer DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payroll_runs' AND column_name = 'absence_deduction'
  ) THEN
    ALTER TABLE payroll_runs ADD COLUMN absence_deduction numeric DEFAULT 0;
  END IF;
END $$;
