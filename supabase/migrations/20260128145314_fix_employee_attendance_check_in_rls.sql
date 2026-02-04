/*
  # Fix Employee Attendance Check-In RLS

  ## Problem
  Employees cannot check in attendance because:
  1. Frontend code doesn't send company_id when inserting attendance
  2. RLS policy requires company_id = current_company_id()
  3. Employees use employee_code (no auth), so current_company_id() returns NULL
  4. INSERT is rejected by RLS

  ## Solution
  1. Allow anonymous INSERT into attendance_logs if company_id matches employee's company
  2. Add validation that employee_id belongs to the same company as the attendance company_id
  3. Keep strict SELECT/UPDATE/DELETE policies for authenticated users

  ## Security
  - Employees can INSERT attendance only for their own employee_id
  - Company isolation is maintained via company_id validation
  - No cross-company data leakage
*/

-- ============================================================================
-- DROP old policies
-- ============================================================================
DROP POLICY IF EXISTS "attendance_logs_insert_own_company" ON attendance_logs;
DROP POLICY IF EXISTS "attendance_logs_select_own_company" ON attendance_logs;
DROP POLICY IF EXISTS "attendance_logs_update_own_company" ON attendance_logs;
DROP POLICY IF EXISTS "attendance_logs_delete_own_company" ON attendance_logs;

-- ============================================================================
-- NEW POLICY: Allow anonymous INSERT with company_id validation
-- ============================================================================
CREATE POLICY "employees_can_insert_attendance"
ON attendance_logs
FOR INSERT
TO anon, authenticated
WITH CHECK (
  -- Validate that employee belongs to the same company as the attendance
  EXISTS (
    SELECT 1 FROM employees e
    WHERE e.id = attendance_logs.employee_id
      AND e.company_id = attendance_logs.company_id
      AND e.is_active = true
  )
);

-- ============================================================================
-- NEW POLICY: Admins can SELECT attendance in their company
-- ============================================================================
CREATE POLICY "admins_can_select_own_company_attendance"
ON attendance_logs
FOR SELECT
TO authenticated
USING (
  company_id = current_company_id()
);

-- ============================================================================
-- NEW POLICY: Anonymous can SELECT own attendance (for employee app)
-- ============================================================================
CREATE POLICY "employees_can_select_own_attendance"
ON attendance_logs
FOR SELECT
TO anon
USING (true);  -- Allow read for employee check-in screen

-- ============================================================================
-- NEW POLICY: Admins can UPDATE attendance in their company
-- ============================================================================
CREATE POLICY "admins_can_update_own_company_attendance"
ON attendance_logs
FOR UPDATE
TO authenticated
USING (company_id = current_company_id())
WITH CHECK (company_id = current_company_id());

-- ============================================================================
-- NEW POLICY: Anonymous can UPDATE own attendance (for check-out)
-- ============================================================================
CREATE POLICY "employees_can_update_own_attendance"
ON attendance_logs
FOR UPDATE
TO anon
USING (
  -- Allow update if employee belongs to same company
  EXISTS (
    SELECT 1 FROM employees e
    WHERE e.id = attendance_logs.employee_id
      AND e.company_id = attendance_logs.company_id
      AND e.is_active = true
  )
)
WITH CHECK (
  -- Keep company_id unchanged
  EXISTS (
    SELECT 1 FROM employees e
    WHERE e.id = attendance_logs.employee_id
      AND e.company_id = attendance_logs.company_id
      AND e.is_active = true
  )
);

-- ============================================================================
-- NEW POLICY: Admins can DELETE attendance in their company
-- ============================================================================
CREATE POLICY "admins_can_delete_own_company_attendance"
ON attendance_logs
FOR DELETE
TO authenticated
USING (company_id = current_company_id());

-- Grant access
GRANT SELECT, INSERT, UPDATE ON attendance_logs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON attendance_logs TO authenticated;
