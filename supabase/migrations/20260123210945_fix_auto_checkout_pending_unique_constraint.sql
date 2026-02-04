/*
  # Fix unique constraint for auto_checkout_pending

  ## Changes
  
  1. Drop partial unique index
  2. Add proper handling for upsert logic
  
  Note: We keep only one PENDING record per employee+log by having the client
  cancel the previous one before creating a new one, or by updating the existing one.
*/

-- Drop the partial unique index since it doesn't work well with upsert
DROP INDEX IF EXISTS idx_auto_checkout_pending_employee_log;

-- We'll handle uniqueness in the application logic instead
-- The client will update existing PENDING records or cancel them before creating new ones