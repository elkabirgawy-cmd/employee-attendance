-- Ensure user_id exists in employees
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE employees ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_employees_user_id ON employees(user_id);
  END IF;
END $$;

-- Link existing admin users to their employees if not already linked
UPDATE employees e
SET user_id = au.id
FROM admin_users au
WHERE e.company_id = au.company_id
AND e.email IS NOT NULL
AND au.email = e.email
AND e.user_id IS NULL;

-- Drop old policies
DO $$
BEGIN
  DROP POLICY IF EXISTS "delay_permissions_insert_hybrid" ON delay_permissions;
  DROP POLICY IF EXISTS "delay_permissions_select_hybrid" ON delay_permissions;
  DROP POLICY IF EXISTS "delay_permissions_update_admin" ON delay_permissions;
  DROP POLICY IF EXISTS "delay_permissions_delete_admin" ON delay_permissions;
END $$;

-- INSERT: Support both auth methods + admin
CREATE POLICY "delay_permissions_insert_final"
  ON delay_permissions
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (
    -- Method 1: Auth user linked to employee
    EXISTS (
      SELECT 1 FROM employees e
      WHERE e.id = delay_permissions.employee_id
      AND e.user_id = auth.uid()
      AND e.company_id = delay_permissions.company_id
      AND e.is_active = true
    )
    OR
    -- Method 2: Admin creating for employee
    EXISTS (
      SELECT 1 FROM admin_users au
      JOIN employees e ON e.id = delay_permissions.employee_id
      WHERE au.id = auth.uid()
      AND au.company_id = delay_permissions.company_id
      AND e.company_id = delay_permissions.company_id
      AND e.is_active = true
    )
    OR
    -- Method 3: Anon (custom session) - employee must exist
    (
      auth.uid() IS NULL
      AND EXISTS (
        SELECT 1 FROM employees e
        WHERE e.id = delay_permissions.employee_id
        AND e.company_id = delay_permissions.company_id
        AND e.is_active = true
      )
    )
  );

-- SELECT: Users see own, admins see company
CREATE POLICY "delay_permissions_select_final"
  ON delay_permissions
  FOR SELECT
  TO authenticated, anon
  USING (
    -- Auth user viewing own
    EXISTS (
      SELECT 1 FROM employees e
      WHERE e.id = delay_permissions.employee_id
      AND e.user_id = auth.uid()
    )
    OR
    -- Admin viewing company
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.id = auth.uid()
      AND au.company_id = delay_permissions.company_id
    )
    OR
    -- Anon (custom session) - can view if employee exists
    (
      auth.uid() IS NULL
      AND EXISTS (
        SELECT 1 FROM employees e
        WHERE e.id = delay_permissions.employee_id
        AND e.company_id = delay_permissions.company_id
      )
    )
  );

-- UPDATE: Admin only
CREATE POLICY "delay_permissions_update_final"
  ON delay_permissions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.id = auth.uid()
      AND au.company_id = delay_permissions.company_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.id = auth.uid()
      AND au.company_id = delay_permissions.company_id
    )
  );

-- DELETE: Admin only
CREATE POLICY "delay_permissions_delete_final"
  ON delay_permissions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.id = auth.uid()
      AND au.company_id = delay_permissions.company_id
    )
  );
