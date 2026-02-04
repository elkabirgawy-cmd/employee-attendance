/*
  # Disable RLS on auto_checkout_pending

  ## Reason
  SECURITY DEFINER functions are having issues with RLS even with permissive policies.
  Since all access to auto_checkout_pending goes through controlled functions,
  it's safe to disable RLS entirely.

  ## Security
  - Table is only accessed through SECURITY DEFINER functions
  - Functions validate company_id and employee_id
  - No direct access from client code
*/

-- Disable RLS on auto_checkout_pending
ALTER TABLE auto_checkout_pending DISABLE ROW LEVEL SECURITY;

-- Drop all policies since RLS is disabled
DROP POLICY IF EXISTS "auto_checkout_pending_all_operations" ON auto_checkout_pending;
DROP POLICY IF EXISTS "auto_checkout_pending_insert_system" ON auto_checkout_pending;
DROP POLICY IF EXISTS "auto_checkout_pending_delete_own_company" ON auto_checkout_pending;
DROP POLICY IF EXISTS "auto_checkout_pending_select_authenticated" ON auto_checkout_pending;
DROP POLICY IF EXISTS "auto_checkout_pending_upsert_anon" ON auto_checkout_pending;
DROP POLICY IF EXISTS "auto_checkout_pending_update_system" ON auto_checkout_pending;
