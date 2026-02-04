/*
  # Fix upsert_company_settings - Use Correct Schema (v2)

  ## Problem
  The upsert_company_settings function was using wrong column names for application_settings.
  The table has GPS and security settings, not app_name/support_email.

  ## Solution
  1. Drop triggers first
  2. Drop old functions
  3. Create new functions with correct schema
  4. Recreate triggers

  ## Changes
  - Fix application_settings columns in upsert function
  - Fix application_settings columns in trigger function
*/

-- ============================================================================
-- STEP 1: DROP TRIGGERS FIRST
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_create_application_settings ON companies;
DROP TRIGGER IF EXISTS trigger_create_auto_checkout_settings ON companies;

-- ============================================================================
-- STEP 2: DROP OLD FUNCTIONS
-- ============================================================================

DROP FUNCTION IF EXISTS create_default_application_settings();
DROP FUNCTION IF EXISTS create_default_auto_checkout_settings();
DROP FUNCTION IF EXISTS upsert_company_settings(uuid);

-- ============================================================================
-- STEP 3: CREATE CORRECT FUNCTIONS
-- ============================================================================

-- Function to create application_settings for new company with CORRECT schema
CREATE OR REPLACE FUNCTION create_default_application_settings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO application_settings (
    company_id,
    max_gps_accuracy_meters,
    gps_warning_threshold_meters,
    require_high_accuracy,
    enable_fake_gps_detection,
    grace_period_minutes,
    early_check_in_allowed_minutes,
    require_checkout,
    block_duplicate_check_ins,
    detect_rooted_devices,
    detect_fake_gps,
    detect_time_manipulation,
    block_suspicious_devices,
    max_distance_jump_meters,
    default_language,
    date_format,
    currency,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    50,              -- max_gps_accuracy_meters
    30,              -- gps_warning_threshold_meters
    true,            -- require_high_accuracy
    true,            -- enable_fake_gps_detection
    15,              -- grace_period_minutes
    30,              -- early_check_in_allowed_minutes
    true,            -- require_checkout
    true,            -- block_duplicate_check_ins
    false,           -- detect_rooted_devices
    true,            -- detect_fake_gps
    true,            -- detect_time_manipulation
    false,           -- block_suspicious_devices
    1000,            -- max_distance_jump_meters
    'ar',            -- default_language
    'DD/MM/YYYY',    -- date_format
    'SAR',           -- currency
    now(),
    now()
  )
  ON CONFLICT (company_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Function to create auto_checkout_settings for new company (unchanged)
CREATE OR REPLACE FUNCTION create_default_auto_checkout_settings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO auto_checkout_settings (
    company_id,
    enabled,
    on_location_disabled,
    on_leave_branch,
    countdown_minutes,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    true,
    true,
    true,
    5,
    now(),
    now()
  )
  ON CONFLICT (company_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- RPC Function for idempotent settings upsert with CORRECT schema
CREATE OR REPLACE FUNCTION upsert_company_settings(p_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_company_name text;
  v_result jsonb := '{}';
  v_app_created boolean := false;
  v_auto_created boolean := false;
BEGIN
  -- Get company name
  SELECT name INTO v_company_name FROM companies WHERE id = p_company_id;
  
  IF v_company_name IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Company not found'
    );
  END IF;

  -- Upsert application_settings with CORRECT schema
  INSERT INTO application_settings (
    company_id,
    max_gps_accuracy_meters,
    gps_warning_threshold_meters,
    require_high_accuracy,
    enable_fake_gps_detection,
    grace_period_minutes,
    early_check_in_allowed_minutes,
    require_checkout,
    block_duplicate_check_ins,
    detect_rooted_devices,
    detect_fake_gps,
    detect_time_manipulation,
    block_suspicious_devices,
    max_distance_jump_meters,
    default_language,
    date_format,
    currency,
    created_at,
    updated_at
  ) VALUES (
    p_company_id,
    50,              -- max_gps_accuracy_meters
    30,              -- gps_warning_threshold_meters
    true,            -- require_high_accuracy
    true,            -- enable_fake_gps_detection
    15,              -- grace_period_minutes
    30,              -- early_check_in_allowed_minutes
    true,            -- require_checkout
    true,            -- block_duplicate_check_ins
    false,           -- detect_rooted_devices
    true,            -- detect_fake_gps
    true,            -- detect_time_manipulation
    false,           -- block_suspicious_devices
    1000,            -- max_distance_jump_meters
    'ar',            -- default_language
    'DD/MM/YYYY',    -- date_format
    'SAR',           -- currency
    now(),
    now()
  )
  ON CONFLICT (company_id) DO UPDATE SET
    updated_at = now()
  RETURNING (xmax = 0) INTO v_app_created;

  -- Upsert auto_checkout_settings (unchanged)
  INSERT INTO auto_checkout_settings (
    company_id,
    enabled,
    on_location_disabled,
    on_leave_branch,
    countdown_minutes,
    created_at,
    updated_at
  ) VALUES (
    p_company_id,
    true,
    true,
    true,
    5,
    now(),
    now()
  )
  ON CONFLICT (company_id) DO UPDATE SET
    updated_at = now()
  RETURNING (xmax = 0) INTO v_auto_created;

  RETURN jsonb_build_object(
    'success', true,
    'company_id', p_company_id,
    'company_name', v_company_name,
    'application_settings', jsonb_build_object('created', v_app_created),
    'auto_checkout_settings', jsonb_build_object('created', v_auto_created)
  );
END;
$$;

-- ============================================================================
-- STEP 4: RECREATE TRIGGERS
-- ============================================================================

CREATE TRIGGER trigger_create_application_settings
  AFTER INSERT ON companies
  FOR EACH ROW
  EXECUTE FUNCTION create_default_application_settings();

CREATE TRIGGER trigger_create_auto_checkout_settings
  AFTER INSERT ON companies
  FOR EACH ROW
  EXECUTE FUNCTION create_default_auto_checkout_settings();

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'FIXED FUNCTIONS AND TRIGGERS';
  RAISE NOTICE '===========================================';
  RAISE NOTICE '✓ Function: create_default_application_settings() - FIXED';
  RAISE NOTICE '✓ Function: create_default_auto_checkout_settings() - RECREATED';
  RAISE NOTICE '✓ Function: upsert_company_settings(uuid) - FIXED';
  RAISE NOTICE '✓ Trigger: trigger_create_application_settings - RECREATED';
  RAISE NOTICE '✓ Trigger: trigger_create_auto_checkout_settings - RECREATED';
  RAISE NOTICE '===========================================';
END $$;
