/*
  # Add Bonuses Support to Penalties System

  1. Changes
    - Add `impact` field to penalties table ('positive' for bonuses, 'negative' for penalties)
    - Add index for better query performance
    - Update constraint to support both types

  2. Notes
    - Existing records default to 'negative' (penalties)
    - New bonuses will use 'positive'
    - No data loss
    - Backwards compatible
*/

-- Add impact field with default 'negative' for existing penalties
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'penalties' AND column_name = 'impact'
  ) THEN
    ALTER TABLE penalties
    ADD COLUMN impact text DEFAULT 'negative' CHECK (impact IN ('positive', 'negative'));
  END IF;
END $$;

-- Create index for better performance when filtering by impact
CREATE INDEX IF NOT EXISTS idx_penalties_impact ON penalties(impact);

-- Create index for faster queries by employee and impact
CREATE INDEX IF NOT EXISTS idx_penalties_employee_impact ON penalties(employee_id, impact);
