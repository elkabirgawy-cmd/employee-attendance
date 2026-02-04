/*
  # Fix Shifts Anonymous Access

  ## Problem
  Anonymous users (employees) cannot read shift data because:
  - No anonymous SELECT policy exists
  - Employees need shift times for check-in validation

  ## Solution
  Allow anonymous SELECT on shifts table.
  This is safe because:
  - Shift schedules are not sensitive data
  - Employees need to see their shift times
  - No financial or private data in shifts table

  ## Security
  - Read-only access for anonymous users
  - No modification allowed
*/

-- ============================================================================
-- NEW POLICY: Anonymous can read shifts
-- ============================================================================
CREATE POLICY "shifts_select_for_employees"
ON shifts
FOR SELECT
TO anon
USING (true);  -- Allow all shifts to be readable for employee check-in validation

-- Keep authenticated policy unchanged
-- (already exists: shifts_select_own_company)
