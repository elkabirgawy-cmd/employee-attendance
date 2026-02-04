/*
  # Fix Auto Checkout Settings for Multi-Tenant - V2

  ## Problem Diagnosed
  Auto checkout works for old company but NOT for new companies.
  **Root Cause:** 
  1. New companies do NOT have a row in auto_checkout_settings table
  2. Old constraint `auto_checkout_settings_single_row` enforces id = 1 (SINGLE ROW ONLY!)
  3. This prevents creating settings for multiple companies

  ## Solution
  1. Remove single-row constraint (id = 1)
  2. Change id to auto-increment (serial)
  3. Make company_id the unique key (already has index)
  4. Create settings for all existing companies
  5. Add trigger for new companies
  6. Remove old buggy policy

  ## Changes
  - Drop single-row constraint
  - Make id auto-increment
  - Backfill missing settings
  - Add trigger for automatic settings creation
*/

-- ============================================================================
-- 1. REMOVE SINGLE-ROW CONSTRAINT (BLOCKING MULTI-TENANT)
-- ============================================================================

-- This constraint forces id = 1, preventing multiple companies from having settings
ALTER TABLE auto_checkout_settings 
  DROP CONSTRAINT IF EXISTS auto_checkout_settings_single_row;

-- ============================================================================
-- 2. FIX ID COLUMN TO AUTO-INCREMENT
-- ============================================================================

-- Create sequence for id
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'auto_checkout_settings_id_seq') THEN
    CREATE SEQUENCE auto_checkout_settings_id_seq;
    
    -- Set sequence to start after current max id
    PERFORM setval('auto_checkout_settings_id_seq', COALESCE((SELECT MAX(id) FROM auto_checkout_settings), 0) + 1, false);
    
    -- Alter column to use sequence
    ALTER TABLE auto_checkout_settings 
      ALTER COLUMN id SET DEFAULT nextval('auto_checkout_settings_id_seq');
  END IF;
END $$;

-- ============================================================================
-- 3. BACKFILL MISSING SETTINGS FOR EXISTING COMPANIES
-- ============================================================================

-- Create default settings for any company that doesn't have them
INSERT INTO auto_checkout_settings (
  company_id,
  auto_checkout_enabled,
  auto_checkout_after_seconds,
  verify_outside_with_n_readings,
  watch_interval_seconds,
  max_location_accuracy_meters,
  created_at,
  updated_at
)
SELECT 
  c.id as company_id,
  true as auto_checkout_enabled,
  900 as auto_checkout_after_seconds,
  3 as verify_outside_with_n_readings,
  15 as watch_interval_seconds,
  80 as max_location_accuracy_meters,
  now() as created_at,
  now() as updated_at
FROM companies c
WHERE NOT EXISTS (
  SELECT 1 
  FROM auto_checkout_settings acs 
  WHERE acs.company_id = c.id
)
ON CONFLICT (company_id) DO NOTHING;

-- ============================================================================
-- 4. CLEAN UP OLD BUGGY POLICY
-- ============================================================================

-- Remove old policy that uses id = 1 (global, not multi-tenant)
DROP POLICY IF EXISTS "allow insert auto checkout settings" ON auto_checkout_settings;

-- ============================================================================
-- 5. CREATE TRIGGER FOR NEW COMPANIES
-- ============================================================================

-- Function to create default auto checkout settings for new company
CREATE OR REPLACE FUNCTION create_default_auto_checkout_settings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert default auto checkout settings for the new company
  INSERT INTO auto_checkout_settings (
    company_id,
    auto_checkout_enabled,
    auto_checkout_after_seconds,
    verify_outside_with_n_readings,
    watch_interval_seconds,
    max_location_accuracy_meters,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    true,
    900,
    3,
    15,
    80,
    now(),
    now()
  )
  ON CONFLICT (company_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trigger_create_auto_checkout_settings ON companies;

CREATE TRIGGER trigger_create_auto_checkout_settings
  AFTER INSERT ON companies
  FOR EACH ROW
  EXECUTE FUNCTION create_default_auto_checkout_settings();

-- ============================================================================
-- 6. HELPER FUNCTION FOR SETTINGS INITIALIZATION (CALLED FROM FRONTEND)
-- ============================================================================

-- Function to ensure settings exist for a company (called when admin opens settings page)
CREATE OR REPLACE FUNCTION ensure_auto_checkout_settings(p_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_settings record;
BEGIN
  -- Check if settings exist
  SELECT * INTO v_settings
  FROM auto_checkout_settings
  WHERE company_id = p_company_id;

  -- If not found, create default settings
  IF v_settings IS NULL THEN
    INSERT INTO auto_checkout_settings (
      company_id,
      auto_checkout_enabled,
      auto_checkout_after_seconds,
      verify_outside_with_n_readings,
      watch_interval_seconds,
      max_location_accuracy_meters,
      created_at,
      updated_at
    ) VALUES (
      p_company_id,
      true,
      900,
      3,
      15,
      80,
      now(),
      now()
    )
    ON CONFLICT (company_id) DO NOTHING
    RETURNING * INTO v_settings;

    -- If still NULL (race condition), fetch again
    IF v_settings IS NULL THEN
      SELECT * INTO v_settings
      FROM auto_checkout_settings
      WHERE company_id = p_company_id;
    END IF;

    RETURN jsonb_build_object(
      'created', true,
      'settings', row_to_json(v_settings)
    );
  END IF;

  -- Settings already exist
  RETURN jsonb_build_object(
    'created', false,
    'settings', row_to_json(v_settings)
  );
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION ensure_auto_checkout_settings(uuid) TO authenticated;

-- ============================================================================
-- 7. VERIFICATION
-- ============================================================================

DO $$
DECLARE
  v_companies_count integer;
  v_settings_count integer;
  v_companies_without_settings integer;
BEGIN
  SELECT COUNT(*) INTO v_companies_count FROM companies;
  SELECT COUNT(*) INTO v_settings_count FROM auto_checkout_settings;
  
  SELECT COUNT(*) INTO v_companies_without_settings
  FROM companies c
  WHERE NOT EXISTS (
    SELECT 1 FROM auto_checkout_settings acs WHERE acs.company_id = c.id
  );

  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Auto Checkout Settings Verification';
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Total Companies: %', v_companies_count;
  RAISE NOTICE 'Total Settings Rows: %', v_settings_count;
  RAISE NOTICE 'Companies WITHOUT Settings: %', v_companies_without_settings;

  IF v_companies_without_settings > 0 THEN
    RAISE EXCEPTION 'ERROR: % companies still missing settings!', v_companies_without_settings;
  END IF;

  IF v_companies_count != v_settings_count THEN
    RAISE WARNING 'MISMATCH: % companies but % settings rows', v_companies_count, v_settings_count;
  ELSE
    RAISE NOTICE '✓ SUCCESS: All companies have auto_checkout_settings';
  END IF;
  
  RAISE NOTICE '===========================================';
END $$;
