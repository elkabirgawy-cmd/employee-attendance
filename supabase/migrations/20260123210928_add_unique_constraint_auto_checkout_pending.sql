/*
  # Add unique constraint for auto_checkout_pending upsert

  ## Changes
  
  1. Add unique constraint on (employee_id, attendance_log_id)
     - Allows upsert to work properly
     - Prevents duplicate pending records for same employee and attendance log
     - Only one pending auto checkout per employee per shift
*/

-- Add unique constraint for upsert
CREATE UNIQUE INDEX IF NOT EXISTS idx_auto_checkout_pending_employee_log 
  ON auto_checkout_pending(employee_id, attendance_log_id)
  WHERE status = 'PENDING';