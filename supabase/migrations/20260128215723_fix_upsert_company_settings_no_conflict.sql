/*
  # Fix upsert_company_settings - Remove ON CONFLICT

  ## Problem
  application_settings table doesn't have a unique constraint on company_id,
  so ON CONFLICT (company_id) fails.

  ## Solution
  Use IF EXISTS logic instead of ON CONFLICT.

  ## Changes
  - Rewrite upsert_company_settings to check for existence first
  - If exists, UPDATE; if not, INSERT
*/

-- ============================================================================
-- DROP OLD FUNCTION
-- ============================================================================

DROP FUNCTION IF EXISTS upsert_company_settings(uuid);

-- ============================================================================
-- CREATE FIXED FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION upsert_company_settings(p_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_company_name text;
  v_app_exists boolean := false;
  v_auto_exists boolean := false;
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

  -- Check if application_settings exists
  SELECT EXISTS (
    SELECT 1 FROM application_settings WHERE company_id = p_company_id
  ) INTO v_app_exists;

  IF v_app_exists THEN
    -- Update existing
    UPDATE application_settings
    SET updated_at = now()
    WHERE company_id = p_company_id;
    v_app_created := false;
  ELSE
    -- Insert new
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
    );
    v_app_created := true;
  END IF;

  -- Check if auto_checkout_settings exists
  SELECT EXISTS (
    SELECT 1 FROM auto_checkout_settings WHERE company_id = p_company_id
  ) INTO v_auto_exists;

  IF v_auto_exists THEN
    -- Update existing
    UPDATE auto_checkout_settings
    SET updated_at = now()
    WHERE company_id = p_company_id;
    v_auto_created := false;
  ELSE
    -- Insert new
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
    );
    v_auto_created := true;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'company_id', p_company_id,
    'company_name', v_company_name,
    'application_settings', jsonb_build_object(
      'created', v_app_created,
      'existed', v_app_exists
    ),
    'auto_checkout_settings', jsonb_build_object(
      'created', v_auto_created,
      'existed', v_auto_exists
    )
  );
END;
$$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'FIXED: upsert_company_settings function';
  RAISE NOTICE 'Now uses IF EXISTS logic instead of ON CONFLICT';
  RAISE NOTICE '===========================================';
END $$;
