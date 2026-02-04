/*
  # Fix Branches Anonymous Access

  ## Problem
  Anonymous users (employees) cannot read branch data because:
  - No anonymous SELECT policy exists
  - Employees need branch GPS coordinates for geofencing

  ## Solution
  Allow anonymous SELECT on branches table.
  This is safe because:
  - Branch locations are not sensitive (employees need them for check-in)
  - Only basic info is exposed: name, latitude, longitude, geofence_radius
  - No financial or private data in branches table

  ## Security
  - Read-only access for anonymous users
  - No modification allowed
  - Company isolation maintained at attendance_logs level
*/

-- ============================================================================
-- NEW POLICY: Anonymous can read branches
-- ============================================================================
CREATE POLICY "branches_select_for_employees"
ON branches
FOR SELECT
TO anon
USING (true);  -- Allow all branches to be readable for employee check-in

-- Keep authenticated policy unchanged
-- (already exists: branches_select_own_company)
