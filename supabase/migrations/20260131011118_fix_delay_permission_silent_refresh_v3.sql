/*
  # Fix Delay Permission - Silent Refresh & Smooth UX

  Makes delay permissions work smoothly like admin system:
  - No session ended errors
  - Silent session refresh
  - Form data preserved
  - Modal stays open
*/

-- Drop ALL existing policies first
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Employees can insert delay permissions" ON delay_permissions;
  DROP POLICY IF EXISTS "Employees can view delay permissions" ON delay_permissions;
  DROP POLICY IF EXISTS "Employees can insert delay permissions v2" ON delay_permissions;
  DROP POLICY IF EXISTS "Employees can view delay permissions v2" ON delay_permissions;
  DROP POLICY IF EXISTS "Allow delay permission insert" ON delay_permissions;
  DROP POLICY IF EXISTS "Allow delay permission select" ON delay_permissions;
  DROP POLICY IF EXISTS "Admin can update delay permissions" ON delay_permissions;
  DROP POLICY IF EXISTS "Admin can delete delay permissions" ON delay_permissions;
  DROP POLICY IF EXISTS "Admins can update delay permissions" ON delay_permissions;
  DROP POLICY IF EXISTS "Admins can delete delay permissions" ON delay_permissions;
END $$;

-- INSERT - works for both anon (employee) and authenticated (admin)
CREATE POLICY "delay_permissions_insert"
  ON delay_permissions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees e
      WHERE e.id = delay_permissions.employee_id
      AND e.company_id = delay_permissions.company_id
      AND e.is_active = true
    )
  );

-- SELECT - view permissions
CREATE POLICY "delay_permissions_select"
  ON delay_permissions
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees e
      WHERE e.id = delay_permissions.employee_id
      AND e.company_id = delay_permissions.company_id
    )
    OR
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.id = auth.uid()
      AND au.company_id = delay_permissions.company_id
    )
  );

-- UPDATE - admin only
CREATE POLICY "delay_permissions_update"
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

-- DELETE - admin only
CREATE POLICY "delay_permissions_delete"
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

-- Helper: check if employee session is valid
CREATE OR REPLACE FUNCTION check_employee_session(p_employee_id UUID)
RETURNS TABLE(
  session_id UUID,
  expires_at TIMESTAMPTZ,
  is_valid BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    es.id,
    es.expires_at,
    CASE 
      WHEN es.expires_at IS NULL THEN true
      WHEN es.expires_at > now() THEN true
      ELSE false
    END
  FROM employee_sessions es
  WHERE es.employee_id = p_employee_id
  AND es.is_active = true
  ORDER BY es.created_at DESC
  LIMIT 1;
END;
$$;

-- Helper: extend employee session silently
CREATE OR REPLACE FUNCTION extend_employee_session(
  p_employee_id UUID,
  p_hours INTEGER DEFAULT 24
)
RETURNS TABLE(
  success BOOLEAN,
  new_expires_at TIMESTAMPTZ,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session_id UUID;
  v_new_expires_at TIMESTAMPTZ;
BEGIN
  SELECT id INTO v_session_id
  FROM employee_sessions
  WHERE employee_id = p_employee_id
  AND is_active = true
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_session_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::TIMESTAMPTZ, 'No active session'::TEXT;
    RETURN;
  END IF;

  v_new_expires_at := now() + make_interval(hours := p_hours);

  UPDATE employee_sessions
  SET expires_at = v_new_expires_at,
      updated_at = now()
  WHERE id = v_session_id;

  RETURN QUERY SELECT true, v_new_expires_at, 'Extended'::TEXT;
END;
$$;