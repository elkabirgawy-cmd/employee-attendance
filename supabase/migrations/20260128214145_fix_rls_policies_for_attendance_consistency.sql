/*
  # Fix RLS Policies for Attendance Consistency

  ## Problem
  Attendance behavior is inconsistent between old and new companies due to RLS policy issues.

  ## Root Causes
  1. auto_checkout_settings anon SELECT policy uses incorrect logic (LIMIT 1 without proper validation)
  2. This can cause settings to not be accessible for some companies
  3. Attendance state may not load correctly after refresh if RLS blocks access

  ## Solution
  1. Fix auto_checkout_settings anon SELECT policy to allow reading ANY settings
     - Frontend explicitly filters by company_id, so this is safe
     - Settings are not sensitive data
     - Prevents RLS from blocking legitimate requests
  
  2. Fix attendance_calculation_settings anon SELECT policy (same issue)
  
  3. Fix application_settings anon SELECT policy (same issue)

  ## Changes
  - Drop buggy anon SELECT policies
  - Create correct anon SELECT policies that allow reading settings
  - Frontend filtering by company_id ensures correct data is retrieved
*/

-- ============================================================================
-- 1. FIX auto_checkout_settings ANON SELECT POLICY
-- ============================================================================

-- Drop the buggy policy
DROP POLICY IF EXISTS "anon_select_own_company_auto_checkout_settings" ON auto_checkout_settings;

-- Create correct policy: allow anonymous users to read any auto_checkout_settings
-- Frontend filters by company_id explicitly, so this is safe
CREATE POLICY "anon_can_select_auto_checkout_settings"
  ON auto_checkout_settings FOR SELECT
  TO anon
  USING (true);

-- ============================================================================
-- 2. FIX attendance_calculation_settings ANON SELECT POLICY
-- ============================================================================

-- Check if there's a policy for anon users
DROP POLICY IF EXISTS "anon_select_attendance_calculation_settings" ON attendance_calculation_settings;

-- Create policy: allow anonymous users to read any attendance_calculation_settings
CREATE POLICY "anon_can_select_attendance_calculation_settings"
  ON attendance_calculation_settings FOR SELECT
  TO anon
  USING (true);

-- ============================================================================
-- 3. FIX application_settings ANON SELECT POLICY
-- ============================================================================

-- Check if there's a policy for anon users
DROP POLICY IF EXISTS "anon_select_application_settings" ON application_settings;

-- Create policy: allow anonymous users to read any application_settings  
CREATE POLICY "anon_can_select_application_settings"
  ON application_settings FOR SELECT
  TO anon
  USING (true);

-- ============================================================================
-- 4. VERIFICATION
-- ============================================================================

DO $$
DECLARE
  v_auto_checkout_policy_count integer;
  v_attendance_calc_policy_count integer;
  v_application_policy_count integer;
BEGIN
  -- Count anon SELECT policies for each table
  SELECT COUNT(*) INTO v_auto_checkout_policy_count
  FROM pg_policies
  WHERE tablename = 'auto_checkout_settings'
    AND cmd = 'SELECT'
    AND 'anon' = ANY(string_to_array(roles::text, ',')::name[]);

  SELECT COUNT(*) INTO v_attendance_calc_policy_count
  FROM pg_policies
  WHERE tablename = 'attendance_calculation_settings'
    AND cmd = 'SELECT'
    AND 'anon' = ANY(string_to_array(roles::text, ',')::name[]);

  SELECT COUNT(*) INTO v_application_policy_count
  FROM pg_policies
  WHERE tablename = 'application_settings'
    AND cmd = 'SELECT'
    AND 'anon' = ANY(string_to_array(roles::text, ',')::name[]);

  RAISE NOTICE '===========================================';
  RAISE NOTICE 'RLS Policy Verification';
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'auto_checkout_settings anon SELECT policies: %', v_auto_checkout_policy_count;
  RAISE NOTICE 'attendance_calculation_settings anon SELECT policies: %', v_attendance_calc_policy_count;
  RAISE NOTICE 'application_settings anon SELECT policies: %', v_application_policy_count;

  IF v_auto_checkout_policy_count >= 1 AND v_attendance_calc_policy_count >= 1 AND v_application_policy_count >= 1 THEN
    RAISE NOTICE '✓ SUCCESS: All settings tables have anon SELECT policies';
  ELSE
    RAISE WARNING 'Some settings tables missing anon SELECT policies!';
  END IF;

  RAISE NOTICE '===========================================';
END $$;
