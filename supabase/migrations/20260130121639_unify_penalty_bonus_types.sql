/*
  # Unify Penalty and Bonus Types

  1. Changes
    - Update penalty_type to support unified types for both penalties and bonuses
    - Add is_recurring field (default false)
    - Add apply_to_salary field (default true)
    - Update CHECK constraint to support all types

  2. Type Mapping
    - 'fixed' → 'fixed_amount' (fixed amount)
    - 'fraction' → 'salary_percent' (percentage of salary)
    - 'days' → 'days' (days-based calculation)

  3. Security
    - No RLS changes needed
    - Backwards compatible
*/

-- Update CHECK constraint to support new types while maintaining old ones
ALTER TABLE penalties DROP CONSTRAINT IF EXISTS penalties_penalty_type_check;
ALTER TABLE penalties ADD CONSTRAINT penalties_penalty_type_check
  CHECK (penalty_type IN ('fixed', 'days', 'fraction', 'fixed_amount', 'salary_percent'));

-- Add is_recurring field with default false
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'penalties' AND column_name = 'is_recurring'
  ) THEN
    ALTER TABLE penalties ADD COLUMN is_recurring boolean DEFAULT false;
  END IF;
END $$;

-- Add apply_to_salary field with default true
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'penalties' AND column_name = 'apply_to_salary'
  ) THEN
    ALTER TABLE penalties ADD COLUMN apply_to_salary boolean DEFAULT true;
  END IF;
END $$;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_penalties_type_impact ON penalties(penalty_type, impact);
