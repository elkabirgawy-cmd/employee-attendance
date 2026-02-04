/*
  # CRITICAL FIX - Load Failed Issue

  ## Problem
  Employee screen shows "Load failed" and attendance state is lost.

  ## Root Causes
  1. Some companies missing application_settings or auto_checkout_settings
  2. No automatic creation of settings for new companies
  3. No recovery mechanism when settings are missing

  ## Solution
  1. Backfill missing settings for ALL companies
  2. Create triggers to auto-create settings for new companies
  3. Create RPC function for idempotent settings initialization
  4. Add verification

  ## Changes
  - Ensure every company has application_settings
  - Ensure every company has auto_checkout_settings
  - Add triggers for automatic settings creation
  - Add RPC function: upsert_company_settings(company_id)
*/

-- ============================================================================
-- STEP 1: BACKFILL MISSING application_settings
-- ============================================================================

DO $$
DECLARE
  v_company RECORD;
  v_inserted INTEGER := 0;
BEGIN
  FOR v_company IN 
    SELECT id, name 
    FROM companies 
    WHERE status = 'active'
      AND NOT EXISTS (
        SELECT 1 FROM application_settings WHERE company_id = companies.id
      )
  LOOP
    INSERT INTO application_settings (
      company_id,
      app_name,
      support_email,
      support_phone,
      default_language,
      maintenance_mode,
      created_at,
      updated_at
    ) VALUES (
      v_company.id,
      v_company.name,
      'support@company.com',
      '+966500000000',
      'ar',
      false,
      now(),
      now()
    );
    
    v_inserted := v_inserted + 1;
    RAISE NOTICE 'Created application_settings for company: % (ID: %)', v_company.name, v_company.id;
  END LOOP;

  IF v_inserted > 0 THEN
    RAISE NOTICE '✓ Created application_settings for % companies', v_inserted;
  ELSE
    RAISE NOTICE '✓ All companies already have application_settings';
  END IF;
END $$;

-- ============================================================================
-- STEP 2: BACKFILL MISSING auto_checkout_settings
-- ============================================================================

DO $$
DECLARE
  v_company RECORD;
  v_inserted INTEGER := 0;
BEGIN
  FOR v_company IN 
    SELECT id, name 
    FROM companies 
    WHERE status = 'active'
      AND NOT EXISTS (
        SELECT 1 FROM auto_checkout_settings WHERE company_id = companies.id
      )
  LOOP
    INSERT INTO auto_checkout_settings (
      company_id,
      enabled,
      on_location_disabled,
      on_leave_branch,
      countdown_minutes,
      created_at,
      updated_at
    ) VALUES (
      v_company.id,
      true,
      true,
      true,
      5,
      now(),
      now()
    );
    
    v_inserted := v_inserted + 1;
    RAISE NOTICE 'Created auto_checkout_settings for company: % (ID: %)', v_company.name, v_company.id;
  END LOOP;

  IF v_inserted > 0 THEN
    RAISE NOTICE '✓ Created auto_checkout_settings for % companies', v_inserted;
  ELSE
    RAISE NOTICE '✓ All companies already have auto_checkout_settings';
  END IF;
END $$;

-- ============================================================================
-- STEP 3: CREATE TRIGGER FUNCTIONS FOR AUTO-CREATION
-- ============================================================================

-- Function to create application_settings for new company
CREATE OR REPLACE FUNCTION create_default_application_settings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO application_settings (
    company_id,
    app_name,
    support_email,
    support_phone,
    default_language,
    maintenance_mode,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    NEW.name,
    'support@company.com',
    '+966500000000',
    'ar',
    false,
    now(),
    now()
  )
  ON CONFLICT (company_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Function to create auto_checkout_settings for new company
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

-- ============================================================================
-- STEP 4: CREATE TRIGGERS (DROP IF EXISTS FIRST)
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_create_application_settings ON companies;
CREATE TRIGGER trigger_create_application_settings
  AFTER INSERT ON companies
  FOR EACH ROW
  EXECUTE FUNCTION create_default_application_settings();

DROP TRIGGER IF EXISTS trigger_create_auto_checkout_settings ON companies;
CREATE TRIGGER trigger_create_auto_checkout_settings
  AFTER INSERT ON companies
  FOR EACH ROW
  EXECUTE FUNCTION create_default_auto_checkout_settings();

-- ============================================================================
-- STEP 5: CREATE RPC FUNCTION FOR IDEMPOTENT SETTINGS UPSERT
-- ============================================================================

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

  -- Upsert application_settings
  INSERT INTO application_settings (
    company_id,
    app_name,
    support_email,
    support_phone,
    default_language,
    maintenance_mode,
    created_at,
    updated_at
  ) VALUES (
    p_company_id,
    v_company_name,
    'support@company.com',
    '+966500000000',
    'ar',
    false,
    now(),
    now()
  )
  ON CONFLICT (company_id) DO UPDATE SET
    updated_at = now()
  RETURNING (xmax = 0) INTO v_app_created;

  -- Upsert auto_checkout_settings
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
    'application_settings', jsonb_build_object('created', v_app_created),
    'auto_checkout_settings', jsonb_build_object('created', v_auto_created)
  );
END;
$$;

-- ============================================================================
-- STEP 6: VERIFICATION
-- ============================================================================

DO $$
DECLARE
  v_total_companies INTEGER;
  v_companies_with_app_settings INTEGER;
  v_companies_with_auto_checkout INTEGER;
  v_missing_app INTEGER;
  v_missing_auto INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total_companies FROM companies WHERE status = 'active';
  
  SELECT COUNT(*) INTO v_companies_with_app_settings 
  FROM companies c
  WHERE c.status = 'active'
    AND EXISTS (SELECT 1 FROM application_settings WHERE company_id = c.id);
  
  SELECT COUNT(*) INTO v_companies_with_auto_checkout
  FROM companies c
  WHERE c.status = 'active'
    AND EXISTS (SELECT 1 FROM auto_checkout_settings WHERE company_id = c.id);

  v_missing_app := v_total_companies - v_companies_with_app_settings;
  v_missing_auto := v_total_companies - v_companies_with_auto_checkout;

  RAISE NOTICE '===========================================';
  RAISE NOTICE 'CRITICAL FIX VERIFICATION';
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Total active companies: %', v_total_companies;
  RAISE NOTICE 'Companies with application_settings: %', v_companies_with_app_settings;
  RAISE NOTICE 'Companies with auto_checkout_settings: %', v_companies_with_auto_checkout;
  RAISE NOTICE '';

  IF v_missing_app = 0 AND v_missing_auto = 0 THEN
    RAISE NOTICE '✓ SUCCESS: All companies have required settings';
  ELSE
    IF v_missing_app > 0 THEN
      RAISE WARNING '✗ FAILURE: % companies missing application_settings', v_missing_app;
    END IF;
    IF v_missing_auto > 0 THEN
      RAISE WARNING '✗ FAILURE: % companies missing auto_checkout_settings', v_missing_auto;
    END IF;
  END IF;

  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Triggers created:';
  RAISE NOTICE '  - trigger_create_application_settings';
  RAISE NOTICE '  - trigger_create_auto_checkout_settings';
  RAISE NOTICE '';
  RAISE NOTICE 'RPC Functions created:';
  RAISE NOTICE '  - upsert_company_settings(company_id)';
  RAISE NOTICE '===========================================';
END $$;
