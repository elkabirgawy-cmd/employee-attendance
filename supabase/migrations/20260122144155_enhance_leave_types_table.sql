/*
  # Enhance Leave Types Table

  1. Changes
    - Add `is_active` column to enable/disable leave types
    - Add `sort_order` column for custom ordering
    - Add `name_en` column for English names (migrate from existing `name` column)
    - Add more leave type options (Casual, Mission, etc.)
    - Update existing data to include new fields
  
  2. Data Migration
    - Migrate existing `name` to `name_en`
    - Set default values for is_active and sort_order
    - Add new leave types with proper Arabic and English names
*/

-- Add new columns if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leave_types' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE leave_types ADD COLUMN is_active boolean NOT NULL DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leave_types' AND column_name = 'sort_order'
  ) THEN
    ALTER TABLE leave_types ADD COLUMN sort_order integer NOT NULL DEFAULT 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leave_types' AND column_name = 'name_en'
  ) THEN
    ALTER TABLE leave_types ADD COLUMN name_en text;
    -- Migrate existing name to name_en
    UPDATE leave_types SET name_en = name WHERE name_en IS NULL;
  END IF;
END $$;

-- Update sort order for existing records
UPDATE leave_types SET sort_order = 1 WHERE name_ar = 'إجازة سنوية';
UPDATE leave_types SET sort_order = 2 WHERE name_ar = 'إجازة مرضية';
UPDATE leave_types SET sort_order = 3 WHERE name_ar = 'إجازة بدون أجر';

-- Add new leave types if they don't exist
INSERT INTO leave_types (name_ar, name_en, name, is_paid, default_days_per_year, color, is_active, sort_order)
SELECT * FROM (VALUES
  ('إجازة عارضة', 'Casual Leave', 'Casual Leave', true, 7, '#3b82f6', true, 4),
  ('مأمورية', 'Mission', 'Mission', true, 0, '#8b5cf6', true, 5),
  ('إجازة أمومة', 'Maternity Leave', 'Maternity Leave', true, 60, '#ec4899', true, 6),
  ('إجازة أبوة', 'Paternity Leave', 'Paternity Leave', true, 3, '#06b6d4', true, 7),
  ('إجازة دراسية', 'Study Leave', 'Study Leave', false, 0, '#f97316', true, 8)
) AS v(name_ar, name_en, name, is_paid, default_days_per_year, color, is_active, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM leave_types WHERE leave_types.name_ar = v.name_ar
);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_leave_types_active_sort ON leave_types(is_active, sort_order);

-- Add comment
COMMENT ON COLUMN leave_types.is_active IS 'Whether this leave type is active and available for selection';
COMMENT ON COLUMN leave_types.sort_order IS 'Display order (lower numbers first)';
COMMENT ON COLUMN leave_types.name_en IS 'English name for the leave type';
