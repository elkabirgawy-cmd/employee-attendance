/*
  # Fix Remaining "Always True" Policies

  ## Summary
  Fix the last two policies that have WITH CHECK (true) on business-critical tables:
  - employee_sessions_insert_own_company
  - otp_logs_insert_own_company

  These policies have the correct name suggesting they validate company_id,
  but they actually just have WITH CHECK (true) which is insecure.

  ## Changes

  ### 1. employee_sessions Table
  - FIX: Replace WITH CHECK (true) with proper validation
  - Sessions are created via edge functions during employee login
  - Edge functions use service role and bypass RLS
  - But we should still have proper policy for audit purposes

  ### 2. otp_logs Table  
  - FIX: Replace WITH CHECK (true) with proper validation
  - OTP logs are created via edge functions during employee OTP verification
  - Edge functions use service role and bypass RLS
  - But we should still have proper policy for audit purposes

  ## Impact
  ✅ No functional changes - edge functions use service role (bypass RLS)
  ✅ Better security posture for direct database access
  ✅ Cleaner Security Advisor report
*/

-- ========================================
-- FIX 1: employee_sessions - Proper Company Validation
-- ========================================

-- Drop the permissive policy
DROP POLICY IF EXISTS "employee_sessions_insert_own_company" ON public.employee_sessions;

-- Create proper policy
-- Note: Employee sessions are created by edge functions using service role
-- This policy serves as a safety net if anyone tries to insert directly
CREATE POLICY "employee_sessions_insert_validated"
  ON public.employee_sessions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    -- Validate that the employee exists and belongs to the company_id being inserted
    EXISTS (
      SELECT 1 
      FROM public.employees e
      WHERE e.id = employee_sessions.employee_id
        AND e.company_id = employee_sessions.company_id
        AND e.is_active = true
    )
  );

COMMENT ON POLICY "employee_sessions_insert_validated" ON public.employee_sessions IS
'Validates that employee exists and company_id matches employee record.
Employee sessions are created via edge functions (service role).';

-- ========================================
-- FIX 2: otp_logs - Proper Company Validation
-- ========================================

-- Drop the permissive policy
DROP POLICY IF EXISTS "otp_logs_insert_own_company" ON public.otp_logs;

-- Create proper policy
-- Note: OTP logs are created by edge functions using service role
-- This policy serves as a safety net if anyone tries to insert directly
CREATE POLICY "otp_logs_insert_validated"
  ON public.otp_logs
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    -- Validate that the employee exists and belongs to the company_id being inserted
    EXISTS (
      SELECT 1 
      FROM public.employees e
      WHERE e.id = otp_logs.employee_id
        AND e.company_id = otp_logs.company_id
        AND e.is_active = true
    )
  );

COMMENT ON POLICY "otp_logs_insert_validated" ON public.otp_logs IS
'Validates that employee exists and company_id matches employee record.
OTP logs are created via edge functions (service role).';

-- ========================================
-- VERIFICATION: Final Security Audit
-- ========================================

DO $$
DECLARE
  v_business_critical_count INTEGER;
  v_logging_system_count INTEGER;
  v_total_count INTEGER;
  v_policy RECORD;
BEGIN
  -- Count business-critical tables (have company_id) with USING/WITH CHECK (true)
  SELECT COUNT(DISTINCT p.tablename) INTO v_business_critical_count
  FROM pg_policies p
  JOIN information_schema.columns c 
    ON c.table_name = p.tablename 
    AND c.column_name = 'company_id'
    AND c.table_schema = 'public'
  WHERE p.schemaname = 'public'
    AND (p.qual = 'true' OR p.with_check = 'true')
    AND p.tablename NOT IN (
      -- Acceptable system/logging tables
      'audit_logs',
      'company_bootstrap_logs',
      'delay_permission_debug_logs',
      'employee_location_heartbeat',
      'time_sync_logs'
    );

  -- Count acceptable logging/system tables
  SELECT COUNT(DISTINCT tablename) INTO v_logging_system_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (qual = 'true' OR with_check = 'true')
    AND tablename IN (
      'audit_logs',
      'company_bootstrap_logs',
      'delay_permission_debug_logs',
      'employee_location_heartbeat',
      'time_sync_logs',
      'password_recovery_requests',
      'timezone_resolution_cache'
    );

  -- Total count
  SELECT COUNT(DISTINCT tablename) INTO v_total_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (qual = 'true' OR with_check = 'true');

  -- Report
  RAISE NOTICE '';
  RAISE NOTICE '╔════════════════════════════════════════════════════╗';
  RAISE NOTICE '║   SECURITY ADVISOR - POLICY AUDIT RESULTS          ║';
  RAISE NOTICE '╚════════════════════════════════════════════════════╝';
  RAISE NOTICE '';
  RAISE NOTICE 'Business-Critical Tables with USING/WITH CHECK (true): %', v_business_critical_count;
  RAISE NOTICE 'Logging/System Tables with USING/WITH CHECK (true):    % (acceptable)', v_logging_system_count;
  RAISE NOTICE 'Total Tables with USING/WITH CHECK (true):             %', v_total_count;
  RAISE NOTICE '';

  IF v_business_critical_count = 0 THEN
    RAISE NOTICE '✅ SUCCESS: All business-critical tables have proper RLS policies!';
    RAISE NOTICE '';
    RAISE NOTICE 'Remaining permissive policies are on:';
    RAISE NOTICE '  → Logging tables (audit_logs, time_sync_logs, etc.)';
    RAISE NOTICE '  → System tables (password_recovery_requests, timezone_resolution_cache)';
    RAISE NOTICE '  → Debug tables (delay_permission_debug_logs)';
    RAISE NOTICE '';
    RAISE NOTICE 'These are ACCEPTABLE because:';
    RAISE NOTICE '  1. They contain non-sensitive operational data';
    RAISE NOTICE '  2. They are append-only logs for debugging';
    RAISE NOTICE '  3. They do not affect business logic or data isolation';
  ELSE
    RAISE WARNING '⚠️  ATTENTION: % business-critical tables still have permissive policies', v_business_critical_count;
    RAISE WARNING '';
    RAISE WARNING 'Tables requiring review:';
    
    FOR v_policy IN 
      SELECT DISTINCT p.tablename
      FROM pg_policies p
      JOIN information_schema.columns c 
        ON c.table_name = p.tablename 
        AND c.column_name = 'company_id'
        AND c.table_schema = 'public'
      WHERE p.schemaname = 'public'
        AND (p.qual = 'true' OR p.with_check = 'true')
        AND p.tablename NOT IN (
          'audit_logs',
          'company_bootstrap_logs',
          'delay_permission_debug_logs',
          'employee_location_heartbeat',
          'time_sync_logs'
        )
    LOOP
      RAISE WARNING '  → %', v_policy.tablename;
    END LOOP;
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════';
END $$;

-- ========================================
-- Summary of Policy Changes
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '╔════════════════════════════════════════════════════╗';
  RAISE NOTICE '║   MIGRATION SUMMARY                                 ║';
  RAISE NOTICE '╚════════════════════════════════════════════════════╝';
  RAISE NOTICE '';
  RAISE NOTICE 'Policies Fixed in This Migration:';
  RAISE NOTICE '  1. employee_sessions_insert_own_company';
  RAISE NOTICE '     → Now validates: employee exists + company_id matches';
  RAISE NOTICE '';
  RAISE NOTICE '  2. otp_logs_insert_own_company';
  RAISE NOTICE '     → Now validates: employee exists + company_id matches';
  RAISE NOTICE '';
  RAISE NOTICE 'Previous Migration Fixed:';
  RAISE NOTICE '  • application_settings (removed duplicate policy)';
  RAISE NOTICE '  • attendance_calculation_settings (removed anon policy)';
  RAISE NOTICE '  • shifts (removed anon policy)';
  RAISE NOTICE '  • notifications (removed permissive policy)';
  RAISE NOTICE '  • delay_permissions (removed duplicates)';
  RAISE NOTICE '';
  RAISE NOTICE 'Impact on Edge Functions:';
  RAISE NOTICE '  ✓ No impact - edge functions use service role (bypass RLS)';
  RAISE NOTICE '';
  RAISE NOTICE 'Impact on Admin/Employee UI:';
  RAISE NOTICE '  ✓ No impact - authenticated policies handle access';
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════';
  RAISE NOTICE '';
END $$;
