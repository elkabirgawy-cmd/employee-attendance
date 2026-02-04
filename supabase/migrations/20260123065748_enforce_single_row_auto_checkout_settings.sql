/*
  # Enforce Single-Row Table for Auto-Checkout Settings
  
  1. Problem
    - Multiple rows can be inserted causing confusion
    - UUID primary key doesn't enforce single-row pattern
    - Insert operations create duplicate rows instead of updating existing
    
  2. Changes
    - Drop existing uuid id column
    - Add integer id column with default value 1
    - Add unique constraint to enforce single row
    - Convert existing data to use id=1
    - Update policies to work with new structure
    
  3. Benefits
    - Only one settings row can exist (id=1)
    - UPSERT operations work reliably
    - No duplicate settings rows
    - Simpler query logic (.eq('id', 1).single())
*/

-- Store existing settings data temporarily
DO $$
DECLARE
  existing_enabled boolean;
  existing_after_seconds integer;
  existing_n_readings integer;
  existing_watch_interval integer;
  existing_max_accuracy integer;
BEGIN
  -- Get current settings if they exist
  SELECT 
    auto_checkout_enabled,
    auto_checkout_after_seconds,
    verify_outside_with_n_readings,
    watch_interval_seconds,
    max_location_accuracy_meters
  INTO 
    existing_enabled,
    existing_after_seconds,
    existing_n_readings,
    existing_watch_interval,
    existing_max_accuracy
  FROM auto_checkout_settings
  LIMIT 1;
  
  -- Clear the table
  DELETE FROM auto_checkout_settings;
  
  -- Drop the uuid id column
  ALTER TABLE auto_checkout_settings DROP COLUMN IF EXISTS id CASCADE;
  
  -- Add integer id column with default 1
  ALTER TABLE auto_checkout_settings ADD COLUMN id integer NOT NULL DEFAULT 1;
  
  -- Make id the primary key
  ALTER TABLE auto_checkout_settings ADD PRIMARY KEY (id);
  
  -- Add constraint to ensure only id=1 can exist
  ALTER TABLE auto_checkout_settings ADD CONSTRAINT auto_checkout_settings_single_row 
    CHECK (id = 1);
  
  -- Re-insert the settings with id=1
  IF existing_enabled IS NOT NULL THEN
    INSERT INTO auto_checkout_settings (
      id,
      auto_checkout_enabled,
      auto_checkout_after_seconds,
      verify_outside_with_n_readings,
      watch_interval_seconds,
      max_location_accuracy_meters
    ) VALUES (
      1,
      existing_enabled,
      existing_after_seconds,
      existing_n_readings,
      existing_watch_interval,
      existing_max_accuracy
    );
  ELSE
    -- Insert default settings if none existed
    INSERT INTO auto_checkout_settings (
      id,
      auto_checkout_enabled,
      auto_checkout_after_seconds,
      verify_outside_with_n_readings,
      watch_interval_seconds,
      max_location_accuracy_meters
    ) VALUES (
      1,
      true,
      900,
      3,
      15,
      80
    );
  END IF;
END $$;

-- Ensure RLS is still enabled
ALTER TABLE auto_checkout_settings ENABLE ROW LEVEL SECURITY;

-- Recreate policies to work with new structure
DROP POLICY IF EXISTS "allow read auto checkout settings" ON auto_checkout_settings;
DROP POLICY IF EXISTS "allow insert auto checkout settings" ON auto_checkout_settings;
DROP POLICY IF EXISTS "allow update auto checkout settings" ON auto_checkout_settings;

-- Allow anyone to read the single settings row
CREATE POLICY "allow read auto checkout settings"
  ON auto_checkout_settings
  FOR SELECT
  USING (id = 1);

-- Allow anyone to insert the initial settings row (will only work once due to constraint)
CREATE POLICY "allow insert auto checkout settings"
  ON auto_checkout_settings
  FOR INSERT
  WITH CHECK (id = 1);

-- Allow authenticated admin users to update settings
CREATE POLICY "allow update auto checkout settings"
  ON auto_checkout_settings
  FOR UPDATE
  TO authenticated
  USING (
    id = 1 AND EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  )
  WITH CHECK (
    id = 1 AND EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

-- Create an index on id for faster lookups (though there's only one row)
CREATE INDEX IF NOT EXISTS idx_auto_checkout_settings_id ON auto_checkout_settings(id);
