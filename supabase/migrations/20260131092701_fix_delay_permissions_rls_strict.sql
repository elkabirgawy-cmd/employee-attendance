-- Drop all existing policies on delay_permissions
DROP POLICY IF EXISTS "delay_permissions_insert_final" ON delay_permissions;
DROP POLICY IF EXISTS "delay_permissions_select_final" ON delay_permissions;
DROP POLICY IF EXISTS "delay_permissions_update_final" ON delay_permissions;
DROP POLICY IF EXISTS "delay_permissions_delete_final" ON delay_permissions;

-- INSERT Policy: Employee (auth user) or Admin
CREATE POLICY "delay_permissions_insert_strict"
  ON delay_permissions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Auth user is employee and matches employee_id
    (
      EXISTS (
        SELECT 1 FROM employees e
        WHERE e.id = delay_permissions.employee_id
        AND e.user_id = auth.uid()
        AND e.company_id = delay_permissions.company_id
        AND e.is_active = true
      )
    )
    OR
    -- Auth user is admin in same company
    (
      EXISTS (
        SELECT 1 FROM admin_users au
        JOIN employees e ON e.id = delay_permissions.employee_id
        WHERE au.id = auth.uid()
        AND au.company_id = delay_permissions.company_id
        AND e.company_id = delay_permissions.company_id
        AND e.is_active = true
      )
    )
  );

-- SELECT Policy: Employee sees own, Admin sees company
CREATE POLICY "delay_permissions_select_strict"
  ON delay_permissions
  FOR SELECT
  TO authenticated
  USING (
    -- Auth user viewing own records
    EXISTS (
      SELECT 1 FROM employees e
      WHERE e.id = delay_permissions.employee_id
      AND e.user_id = auth.uid()
    )
    OR
    -- Admin viewing company records
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.id = auth.uid()
      AND au.company_id = delay_permissions.company_id
    )
  );

-- UPDATE Policy: Admin only
CREATE POLICY "delay_permissions_update_strict"
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

-- DELETE Policy: Admin only
CREATE POLICY "delay_permissions_delete_strict"
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

-- Ensure debug logs table has proper RLS
DROP POLICY IF EXISTS "Anyone can insert debug logs" ON delay_permission_debug_logs;

CREATE POLICY "Authenticated can insert debug logs"
  ON delay_permission_debug_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
