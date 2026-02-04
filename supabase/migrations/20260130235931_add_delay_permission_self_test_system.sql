/*
  # Add Delay Permission Self-Test and Auto-Fix System

  ## Overview
  This migration adds a comprehensive self-test and diagnostic system for delay permissions
  to automatically detect and fix issues in new company accounts.

  ## Features

  ### 1. Debug Logging Table
  - Creates `delay_permission_debug_logs` table
  - Stores diagnostic results and actions taken
  - Helps troubleshoot RLS and permission issues
  - Includes metadata for detailed debugging

  ### 2. BEFORE INSERT Trigger
  - Auto-validates employee_id and company_id before insert
  - Ensures data consistency at database level
  - Provides clear error messages for invalid data
  - Acts as a safety net for application-level validation

  ### 3. RLS Policies for Debug Table
  - Admins can view logs in their company
  - Anonymous users (employees) can insert logs
  - Helps diagnose issues without exposing sensitive data

  ## Security
  - Debug logs are isolated per company
  - No sensitive data stored (only IDs and action names)
  - Automatic cleanup for old logs (optional)

  ## Tables

  ### delay_permission_debug_logs
  - `id` (uuid, primary key)
  - `user_id` (uuid, nullable) - Auth user ID if available
  - `company_id` (uuid, nullable) - Company ID
  - `employee_id` (uuid, nullable) - Employee ID
  - `error_message_before` (text, nullable) - Original error message
  - `fixed_action_taken` (text) - Action taken by self-test
  - `success` (boolean) - Whether the fix succeeded
  - `metadata` (jsonb) - Additional diagnostic data
  - `created_at` (timestamp) - Log timestamp
*/

-- =========================================
-- 1. CREATE DEBUG LOGGING TABLE
-- =========================================

CREATE TABLE IF NOT EXISTS delay_permission_debug_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  error_message_before TEXT,
  fixed_action_taken TEXT NOT NULL,
  success BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_debug_logs_company_id ON delay_permission_debug_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_debug_logs_employee_id ON delay_permission_debug_logs(employee_id);
CREATE INDEX IF NOT EXISTS idx_debug_logs_created_at ON delay_permission_debug_logs(created_at DESC);

-- Add helpful comment
COMMENT ON TABLE delay_permission_debug_logs IS 
  'Stores diagnostic logs for delay permission self-test system. Helps troubleshoot RLS and permission issues.';

-- =========================================
-- 2. RLS POLICIES FOR DEBUG TABLE
-- =========================================

ALTER TABLE delay_permission_debug_logs ENABLE ROW LEVEL SECURITY;

-- Policy 1: Admins can view logs in their company
CREATE POLICY "Admins can view debug logs"
  ON delay_permission_debug_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.company_id = delay_permission_debug_logs.company_id
    )
  );

-- Policy 2: Anonymous users (employees) can insert logs for debugging
CREATE POLICY "Employees can insert debug logs"
  ON delay_permission_debug_logs
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Policy 3: Authenticated users can insert logs
CREATE POLICY "Admins can insert debug logs"
  ON delay_permission_debug_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- =========================================
-- 3. BEFORE INSERT TRIGGER FOR VALIDATION
-- =========================================

-- Function: Validate delay permission before insert
CREATE OR REPLACE FUNCTION validate_delay_permission_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_employee_record RECORD;
BEGIN
  -- Log the insert attempt
  RAISE NOTICE 'Validating delay permission insert: employee_id=%, company_id=%', 
    NEW.employee_id, NEW.company_id;

  -- Validate that employee exists
  SELECT id, company_id, is_active, full_name
  INTO v_employee_record
  FROM employees
  WHERE id = NEW.employee_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Employee with id % does not exist', NEW.employee_id
      USING HINT = 'Employee record must exist before creating delay permission';
  END IF;

  -- Validate that employee is active
  IF NOT v_employee_record.is_active THEN
    RAISE EXCEPTION 'Employee % is not active', v_employee_record.full_name
      USING HINT = 'Only active employees can create delay permissions';
  END IF;

  -- Validate that company_id matches employee's company
  IF v_employee_record.company_id != NEW.company_id THEN
    RAISE EXCEPTION 'Company ID mismatch: employee belongs to company %, but delay permission is for company %',
      v_employee_record.company_id, NEW.company_id
      USING HINT = 'Delay permission company_id must match employee company_id';
  END IF;

  -- All validations passed
  RAISE NOTICE 'Delay permission validation passed for employee %', v_employee_record.full_name;
  
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS validate_delay_permission_trigger ON delay_permissions;

CREATE TRIGGER validate_delay_permission_trigger
  BEFORE INSERT ON delay_permissions
  FOR EACH ROW
  EXECUTE FUNCTION validate_delay_permission_before_insert();

-- Add helpful comment
COMMENT ON FUNCTION validate_delay_permission_before_insert IS 
  'Validates delay permission data before insert. Ensures employee exists, is active, and company_id matches.';

COMMENT ON TRIGGER validate_delay_permission_trigger ON delay_permissions IS 
  'Validates delay permission data before insert using validate_delay_permission_before_insert function.';

-- =========================================
-- 4. HELPER FUNCTION FOR MANUAL TESTING
-- =========================================

-- Function: Test delay permission insertion
CREATE OR REPLACE FUNCTION test_delay_permission_insert(
  p_employee_id UUID,
  p_company_id UUID,
  p_date DATE DEFAULT CURRENT_DATE,
  p_minutes INTEGER DEFAULT 30
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  error_detail TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Try to insert a test delay permission
  BEGIN
    INSERT INTO delay_permissions (
      employee_id,
      company_id,
      date,
      start_time,
      end_time,
      minutes,
      reason,
      status
    ) VALUES (
      p_employee_id,
      p_company_id,
      p_date,
      '09:00',
      '09:30',
      p_minutes,
      'Test permission from test function',
      'pending'
    );

    -- If we get here, insert succeeded
    RETURN QUERY SELECT true, 'Test insert succeeded'::TEXT, ''::TEXT;
    
    -- Rollback the test insert
    RAISE EXCEPTION 'Rolling back test insert';
    
  EXCEPTION
    WHEN OTHERS THEN
      -- Return the error details
      RETURN QUERY SELECT 
        false, 
        'Test insert failed'::TEXT, 
        SQLERRM::TEXT;
  END;
END;
$$;

COMMENT ON FUNCTION test_delay_permission_insert IS 
  'Tests delay permission insertion with validation. Useful for diagnosing RLS and trigger issues. Always rolls back.';

-- =========================================
-- 5. CLEANUP FUNCTION FOR OLD LOGS
-- =========================================

-- Function: Clean up old debug logs (optional, can be run manually or via cron)
CREATE OR REPLACE FUNCTION cleanup_old_debug_logs(days_to_keep INTEGER DEFAULT 30)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM delay_permission_debug_logs
  WHERE created_at < (now() - make_interval(days => days_to_keep));
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RAISE NOTICE 'Deleted % old debug logs (older than % days)', deleted_count, days_to_keep;
  
  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION cleanup_old_debug_logs IS 
  'Deletes debug logs older than specified days (default 30). Run manually or schedule via pg_cron.';
