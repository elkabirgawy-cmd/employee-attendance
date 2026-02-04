-- =================================================================
-- Fix Employee Check-In RLS Issue
-- =================================================================
--
-- Problem: The RLS policy on attendance_logs uses a subquery
-- that may fail when executed by anonymous users due to RLS
-- restrictions on the employees table in the subquery context.
--
-- Solution: Simplify the RLS policy to not rely on complex subqueries
-- =================================================================

-- Step 1: Drop the existing problematic policy
DROP POLICY IF EXISTS "employees_can_insert_attendance" ON attendance_logs;

-- Step 2: Create a simpler, more direct policy
-- This policy allows anonymous users to INSERT attendance
-- as long as the data references a valid active employee
CREATE POLICY "employees_can_insert_attendance"
ON attendance_logs
FOR INSERT
TO anon, authenticated
WITH CHECK (
  -- Just verify the employee_id and company_id match
  -- Don't use subquery since it may fail due to RLS
  employee_id IS NOT NULL
  AND company_id IS NOT NULL
  AND branch_id IS NOT NULL
);

-- Step 3: Add a database trigger to validate the data
-- This ensures data integrity without relying on RLS subqueries
CREATE OR REPLACE FUNCTION validate_attendance_insert()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  employee_exists boolean;
  employee_company_id uuid;
  employee_active boolean;
BEGIN
  -- Check if employee exists and is active
  SELECT 
    e.company_id,
    e.is_active,
    true
  INTO 
    employee_company_id,
    employee_active,
    employee_exists
  FROM employees e
  WHERE e.id = NEW.employee_id;
  
  -- If employee not found
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Employee not found: %', NEW.employee_id;
  END IF;
  
  -- If employee not active
  IF NOT employee_active THEN
    RAISE EXCEPTION 'Employee is not active: %', NEW.employee_id;
  END IF;
  
  -- If company_id doesn't match
  IF employee_company_id != NEW.company_id THEN
    RAISE EXCEPTION 'Company ID mismatch. Employee belongs to %, but attendance has %', 
      employee_company_id, NEW.company_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS validate_attendance_insert_trigger ON attendance_logs;
CREATE TRIGGER validate_attendance_insert_trigger
  BEFORE INSERT ON attendance_logs
  FOR EACH ROW
  EXECUTE FUNCTION validate_attendance_insert();

-- =================================================================
-- Verification
-- =================================================================
SELECT 
  'Policy Updated' as status,
  '✅ employees_can_insert_attendance policy simplified' as result
UNION ALL
SELECT 
  'Trigger Created' as status,
  '✅ validate_attendance_insert_trigger will ensure data integrity' as result;

