/*
  # Ensure Company Settings Initialization

  ## Problem
  New companies may not have required settings records:
  - attendance_calculation_settings
  - application_settings
  - auto_checkout_settings (already has trigger, but we backfill missing)

  This causes "Load failed" errors when employee app tries to load settings.

  ## Solution
  1. Backfill missing settings for all existing companies
  2. Create triggers to auto-create settings for new companies
  3. Add RPC functions for idempotent initialization (can be called from frontend)

  ## Changes
  - Backfill attendance_calculation_settings per company
  - Backfill application_settings per company
  - Add trigger for attendance_calculation_settings
  - Add trigger for application_settings
  - Add RPC functions for ensure_*_settings
*/

-- ============================================================================
-- 1. BACKFILL attendance_calculation_settings FOR EXISTING COMPANIES
-- ============================================================================

INSERT INTO attendance_calculation_settings (
  company_id,
  working_days_mode,
  fixed_working_days,
  fixed_vacation_days,
  created_at,
  updated_at
)
SELECT
  c.id as company_id,
  'automatic' as working_days_mode,
  26 as fixed_working_days,
  4 as fixed_vacation_days,
  now() as created_at,
  now() as updated_at
FROM companies c
WHERE c.status = 'active'
  AND NOT EXISTS (
    SELECT 1
    FROM attendance_calculation_settings acs
    WHERE acs.company_id = c.id
  )
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 2. BACKFILL application_settings FOR EXISTING COMPANIES
-- ============================================================================

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
)
SELECT
  c.id as company_id,
  80 as max_gps_accuracy_meters,
  50 as gps_warning_threshold_meters,
  true as require_high_accuracy,
  true as enable_fake_gps_detection,
  5 as grace_period_minutes,
  15 as early_check_in_allowed_minutes,
  true as require_checkout,
  true as block_duplicate_check_ins,
  false as detect_rooted_devices,
  true as detect_fake_gps,
  true as detect_time_manipulation,
  false as block_suspicious_devices,
  500 as max_distance_jump_meters,
  'ar' as default_language,
  'DD/MM/YYYY' as date_format,
  'SAR' as currency,
  now() as created_at,
  now() as updated_at
FROM companies c
WHERE c.status = 'active'
  AND NOT EXISTS (
    SELECT 1
    FROM application_settings apps
    WHERE apps.company_id = c.id
  )
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 3. CREATE TRIGGER FOR attendance_calculation_settings
-- ============================================================================

CREATE OR REPLACE FUNCTION create_default_attendance_calculation_settings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO attendance_calculation_settings (
    company_id,
    working_days_mode,
    fixed_working_days,
    fixed_vacation_days,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    'automatic',
    26,
    4,
    now(),
    now()
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_create_attendance_calculation_settings ON companies;

CREATE TRIGGER trigger_create_attendance_calculation_settings
  AFTER INSERT ON companies
  FOR EACH ROW
  EXECUTE FUNCTION create_default_attendance_calculation_settings();

-- ============================================================================
-- 4. CREATE TRIGGER FOR application_settings
-- ============================================================================

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
    80,
    50,
    true,
    true,
    5,
    15,
    true,
    true,
    false,
    true,
    true,
    false,
    500,
    'ar',
    'DD/MM/YYYY',
    'SAR',
    now(),
    now()
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_create_application_settings ON companies;

CREATE TRIGGER trigger_create_application_settings
  AFTER INSERT ON companies
  FOR EACH ROW
  EXECUTE FUNCTION create_default_application_settings();

-- ============================================================================
-- 5. RPC FUNCTION: ensure_attendance_calculation_settings
-- ============================================================================

CREATE OR REPLACE FUNCTION ensure_attendance_calculation_settings(p_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_settings record;
BEGIN
  SELECT * INTO v_settings
  FROM attendance_calculation_settings
  WHERE company_id = p_company_id;

  IF v_settings IS NULL THEN
    INSERT INTO attendance_calculation_settings (
      company_id,
      working_days_mode,
      fixed_working_days,
      fixed_vacation_days,
      created_at,
      updated_at
    ) VALUES (
      p_company_id,
      'automatic',
      26,
      4,
      now(),
      now()
    )
    ON CONFLICT DO NOTHING
    RETURNING * INTO v_settings;

    IF v_settings IS NULL THEN
      SELECT * INTO v_settings
      FROM attendance_calculation_settings
      WHERE company_id = p_company_id;
    END IF;

    RETURN jsonb_build_object(
      'created', true,
      'settings', row_to_json(v_settings)
    );
  END IF;

  RETURN jsonb_build_object(
    'created', false,
    'settings', row_to_json(v_settings)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION ensure_attendance_calculation_settings(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION ensure_attendance_calculation_settings(uuid) TO anon;

-- ============================================================================
-- 6. RPC FUNCTION: ensure_application_settings
-- ============================================================================

CREATE OR REPLACE FUNCTION ensure_application_settings(p_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_settings record;
BEGIN
  SELECT * INTO v_settings
  FROM application_settings
  WHERE company_id = p_company_id;

  IF v_settings IS NULL THEN
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
      80,
      50,
      true,
      true,
      5,
      15,
      true,
      true,
      false,
      true,
      true,
      false,
      500,
      'ar',
      'DD/MM/YYYY',
      'SAR',
      now(),
      now()
    )
    ON CONFLICT DO NOTHING
    RETURNING * INTO v_settings;

    IF v_settings IS NULL THEN
      SELECT * INTO v_settings
      FROM application_settings
      WHERE company_id = p_company_id;
    END IF;

    RETURN jsonb_build_object(
      'created', true,
      'settings', row_to_json(v_settings)
    );
  END IF;

  RETURN jsonb_build_object(
    'created', false,
    'settings', row_to_json(v_settings)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION ensure_application_settings(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION ensure_application_settings(uuid) TO anon;

-- ============================================================================
-- 7. RPC FUNCTION: ensure_all_company_settings
-- ============================================================================

CREATE OR REPLACE FUNCTION ensure_all_company_settings(p_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_auto_checkout jsonb;
  v_attendance_calc jsonb;
  v_application jsonb;
BEGIN
  v_auto_checkout := ensure_auto_checkout_settings(p_company_id);
  v_attendance_calc := ensure_attendance_calculation_settings(p_company_id);
  v_application := ensure_application_settings(p_company_id);

  RETURN jsonb_build_object(
    'success', true,
    'auto_checkout', v_auto_checkout,
    'attendance_calculation', v_attendance_calc,
    'application', v_application
  );
END;
$$;

GRANT EXECUTE ON FUNCTION ensure_all_company_settings(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION ensure_all_company_settings(uuid) TO anon;

-- ============================================================================
-- 8. VERIFICATION
-- ============================================================================

DO $$
DECLARE
  v_companies_count integer;
  v_auto_checkout_count integer;
  v_attendance_calc_count integer;
  v_application_count integer;
  v_missing_auto_checkout integer;
  v_missing_attendance_calc integer;
  v_missing_application integer;
BEGIN
  SELECT COUNT(*) INTO v_companies_count FROM companies WHERE status = 'active';
  SELECT COUNT(*) INTO v_auto_checkout_count FROM auto_checkout_settings;
  SELECT COUNT(*) INTO v_attendance_calc_count FROM attendance_calculation_settings;
  SELECT COUNT(*) INTO v_application_count FROM application_settings;

  SELECT COUNT(*) INTO v_missing_auto_checkout
  FROM companies c
  WHERE c.status = 'active'
    AND NOT EXISTS (SELECT 1 FROM auto_checkout_settings WHERE company_id = c.id);

  SELECT COUNT(*) INTO v_missing_attendance_calc
  FROM companies c
  WHERE c.status = 'active'
    AND NOT EXISTS (SELECT 1 FROM attendance_calculation_settings WHERE company_id = c.id);

  SELECT COUNT(*) INTO v_missing_application
  FROM companies c
  WHERE c.status = 'active'
    AND NOT EXISTS (SELECT 1 FROM application_settings WHERE company_id = c.id);

  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Company Settings Initialization';
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Total Active Companies: %', v_companies_count;
  RAISE NOTICE 'auto_checkout_settings: % rows (missing: %)', v_auto_checkout_count, v_missing_auto_checkout;
  RAISE NOTICE 'attendance_calculation_settings: % rows (missing: %)', v_attendance_calc_count, v_missing_attendance_calc;
  RAISE NOTICE 'application_settings: % rows (missing: %)', v_application_count, v_missing_application;

  IF v_missing_auto_checkout = 0 AND v_missing_attendance_calc = 0 AND v_missing_application = 0 THEN
    RAISE NOTICE '✓ SUCCESS: All companies have all required settings';
  ELSE
    RAISE WARNING 'Some companies still missing settings!';
  END IF;

  RAISE NOTICE '===========================================';
END $$;
