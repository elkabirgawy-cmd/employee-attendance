/*
  # Security Advisor Error Fixes - Internal Tables

  This migration fixes Security Advisor ERRORS by:
  1. Making auto_checkout_pending internal-only (Edge Function access)
  2. Restricting client write access to spatial_ref_sys (PostGIS system table)

  ## Changes

  1. auto_checkout_pending (Internal Table)
     - REVOKE all privileges from anon and authenticated
     - Enable RLS with FORCE
     - Drop existing permissive policy
     - Only service_role and Edge Functions can access

  2. spatial_ref_sys (PostGIS System Table)
     - REVOKE write privileges (INSERT, UPDATE, DELETE, TRUNCATE) from anon/authenticated
     - Keep SELECT for read-only access
     - Do NOT enable RLS (system table)

  ## Safety
  - No changes to leave_requests or delay_permissions
  - No UI/flow modifications
  - Edge Functions continue to work via service_role
*/

-- ============================================================================
-- 1. FIX auto_checkout_pending (Make it internal-only)
-- ============================================================================

-- Drop the existing permissive policy
DROP POLICY IF EXISTS "Employees can read own auto_checkout_pending" ON auto_checkout_pending;

-- Revoke all privileges from anon and authenticated roles
REVOKE ALL PRIVILEGES ON TABLE auto_checkout_pending FROM anon;
REVOKE ALL PRIVILEGES ON TABLE auto_checkout_pending FROM authenticated;

-- Enable RLS with FORCE (extra safety layer)
ALTER TABLE auto_checkout_pending ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_checkout_pending FORCE ROW LEVEL SECURITY;

-- Ensure service_role retains full access (Edge Functions use this)
GRANT ALL PRIVILEGES ON TABLE auto_checkout_pending TO service_role;

-- ============================================================================
-- 2. FIX spatial_ref_sys (Restrict write access, keep read)
-- ============================================================================

-- Revoke write privileges from anon and authenticated
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE spatial_ref_sys FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE spatial_ref_sys FROM authenticated;

-- Keep SELECT for read-only access (PostGIS might need it)
GRANT SELECT ON TABLE spatial_ref_sys TO anon;
GRANT SELECT ON TABLE spatial_ref_sys TO authenticated;

-- Ensure service_role retains full access
GRANT ALL PRIVILEGES ON TABLE spatial_ref_sys TO service_role;
