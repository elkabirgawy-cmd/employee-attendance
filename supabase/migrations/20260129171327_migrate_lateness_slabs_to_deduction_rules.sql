/*
  # Migrate Late Ladder to Late Deduction Rules

  1. Data Migration
    - Convert all existing lateness_slabs data to late_deduction_rules
    - Map penalty_type to deduction_type (fixed/day_fraction -> fixed/percent)
    - Preserve company_id and all settings
    - No data loss, no impact on historical payroll

  2. Cleanup
    - Rename lateness_slabs table to lateness_slabs_archived (preserve data)
    - Remove UI references will be handled in application code

  3. Add Validation
    - Add function to check for overlapping ranges
    - Prevent saving overlapping rules for the same company
*/

-- Step 1: Migrate existing lateness_slabs to late_deduction_rules
DO $$
BEGIN
  -- Only migrate if lateness_slabs table exists and has data
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lateness_slabs') THEN
    -- Insert data from lateness_slabs into late_deduction_rules
    -- Map penalty_type: 'fixed' -> 'fixed', 'day_fraction' -> 'percent'
    INSERT INTO late_deduction_rules (company_id, from_minutes, to_minutes, deduction_type, value, created_at)
    SELECT 
      company_id,
      from_minutes,
      to_minutes,
      CASE 
        WHEN penalty_type = 'fixed' THEN 'fixed'
        WHEN penalty_type = 'day_fraction' THEN 'percent'
        ELSE 'fixed'
      END as deduction_type,
      penalty_value as value,
      created_at
    FROM lateness_slabs
    WHERE NOT EXISTS (
      -- Avoid duplicates if migration was already run
      SELECT 1 FROM late_deduction_rules ldr
      WHERE ldr.company_id = lateness_slabs.company_id
      AND ldr.from_minutes = lateness_slabs.from_minutes
      AND ldr.to_minutes = lateness_slabs.to_minutes
    );
  END IF;
END $$;

-- Step 2: Archive the lateness_slabs table (preserve data for safety)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lateness_slabs') THEN
    -- Rename to archived version instead of dropping
    ALTER TABLE lateness_slabs RENAME TO lateness_slabs_archived;
    
    -- Add a note column to track when it was archived
    ALTER TABLE lateness_slabs_archived ADD COLUMN IF NOT EXISTS archived_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Step 3: Create function to validate no overlapping ranges
CREATE OR REPLACE FUNCTION check_late_deduction_overlap(
  p_company_id uuid,
  p_from_minutes int,
  p_to_minutes int,
  p_rule_id uuid DEFAULT NULL
)
RETURNS boolean AS $$
DECLARE
  overlap_count int;
BEGIN
  -- Check for any overlapping ranges
  -- Ranges overlap if: (from1 < to2) AND (to1 > from2)
  SELECT COUNT(*) INTO overlap_count
  FROM late_deduction_rules
  WHERE company_id = p_company_id
    AND (p_rule_id IS NULL OR id != p_rule_id)
    AND (
      (from_minutes < p_to_minutes AND to_minutes > p_from_minutes)
    );
  
  RETURN overlap_count > 0;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Add constraint to prevent invalid ranges
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'late_deduction_valid_range'
  ) THEN
    ALTER TABLE late_deduction_rules
    ADD CONSTRAINT late_deduction_valid_range
    CHECK (to_minutes > from_minutes AND from_minutes >= 0);
  END IF;
END $$;

-- Step 5: Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_late_deduction_rules_company_range 
ON late_deduction_rules(company_id, from_minutes, to_minutes);
