/*
  # Fix Delay Permission RLS - Support Both Auth Methods

  Creates hybrid RLS policies supporting both Supabase auth and custom sessions.
*/

-- Add optional user_id to employees
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE employees
    ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS idx_employees_user_id ON employees(user_id);

    COMMENT ON COLUMN employees.user_id IS 
      'Optional link to auth.users. NULL for custom sessions, populated for Supabase auth users.';
  END IF;
END $$;

-- Drop existing policies
DO $$
BEGIN
  DROP POLICY IF EXISTS "delay_permissions_insert" ON delay_permissions;
  DROP POLICY IF EXISTS "delay_permissions_select" ON delay_permissions;
  DROP POLICY IF EXISTS "delay_permissions_update" ON delay_permissions;
  DROP POLICY IF EXISTS "delay_permissions_delete" ON delay_permissions;
  DROP POLICY IF EXISTS "delay_permissions_insert_hybrid" ON delay_permissions;
  DROP POLICY IF EXISTS "delay_permissions_select_hybrid" ON delay_permissions;
  DROP POLICY IF EXISTS "delay_permissions_update_admin" ON delay_permissions;
  DROP POLICY IF EXISTS "delay_permissions_delete_admin" ON delay_permissions;
  DROP POLICY IF EXISTS "Admins can view delay permissions" ON delay_permissions;
  DROP POLICY IF EXISTS "Admins can create delay permissions" ON delay_permissions;
  DROP POLICY IF EXISTS "Admins can update delay permissions" ON delay_permissions;
  DROP POLICY IF EXISTS "Admins can delete delay permissions" ON delay_permissions;
END $$;

-- INSERT: Hybrid support for both auth methods
CREATE POLICY "delay_permissions_insert_hybrid"
  ON delay_permissions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    -- Supabase auth user (has user_id link)
    (
      auth.uid() IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM employees e
        WHERE e.id = delay_permissions.employee_id
        AND e.user_id = auth.uid()
        AND e.company_id = delay_permissions.company_id
        AND e.is_active = true
      )
    )
    OR
    -- Custom session user (anon role)
    (
      auth.uid() IS NULL
      AND EXISTS (
        SELECT 1 FROM employees e
        WHERE e.id = delay_permissions.employee_id
        AND e.company_id = delay_permissions.company_id
        AND e.is_active = true
      )
    )
    OR
    -- Admin creating for employee
    (
      auth.uid() IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM admin_users au
        WHERE au.id = auth.uid()
        AND au.company_id = delay_permissions.company_id
      )
      AND EXISTS (
        SELECT 1 FROM employees e
        WHERE e.id = delay_permissions.employee_id
        AND e.company_id = delay_permissions.company_id
        AND e.is_active = true
      )
    )
  );

-- SELECT: Hybrid support
CREATE POLICY "delay_permissions_select_hybrid"
  ON delay_permissions
  FOR SELECT
  TO anon, authenticated
  USING (
    -- Supabase auth user viewing own
    (
      auth.uid() IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM employees e
        WHERE e.id = delay_permissions.employee_id
        AND e.user_id = auth.uid()
        AND e.company_id = delay_permissions.company_id
      )
    )
    OR
    -- Custom session (anon)
    (
      auth.uid() IS NULL
      AND EXISTS (
        SELECT 1 FROM employees e
        WHERE e.id = delay_permissions.employee_id
        AND e.company_id = delay_permissions.company_id
      )
    )
    OR
    -- Admin viewing company permissions
    (
      auth.uid() IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM admin_users au
        WHERE au.id = auth.uid()
        AND au.company_id = delay_permissions.company_id
      )
    )
  );

-- UPDATE: Admin only
CREATE POLICY "delay_permissions_update_admin"
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
CREATE POLICY "delay_permissions_delete_admin"
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

-- Helper: Link employee to auth user
CREATE OR REPLACE FUNCTION link_employee_to_auth_user(
  p_employee_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE employees
  SET user_id = p_user_id,
      updated_at = now()
  WHERE id = p_employee_id
  AND user_id IS NULL;

  RETURN FOUND;
END;
$$;

-- Update check_employee_session to support both methods
DROP FUNCTION IF EXISTS check_employee_session(UUID);

CREATE OR REPLACE FUNCTION check_employee_session(p_employee_id UUID)
RETURNS TABLE(
  session_id UUID,
  expires_at TIMESTAMPTZ,
  is_valid BOOLEAN,
  auth_method TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_employee_user_id UUID;
BEGIN
  -- Check if employee linked to auth user
  SELECT user_id INTO v_employee_user_id
  FROM employees
  WHERE id = p_employee_id;

  -- If linked and matches current user, valid via auth
  IF v_employee_user_id IS NOT NULL AND v_employee_user_id = auth.uid() THEN
    RETURN QUERY SELECT 
      NULL::UUID,
      NULL::TIMESTAMPTZ,
      true,
      'supabase_auth'::TEXT;
    RETURN;
  END IF;

  -- Check custom session
  RETURN QUERY
  SELECT 
    es.id,
    es.expires_at,
    CASE 
      WHEN es.expires_at IS NULL THEN true
      WHEN es.expires_at > now() THEN true
      ELSE false
    END,
    'custom_session'::TEXT
  FROM employee_sessions es
  WHERE es.employee_id = p_employee_id
  AND es.is_active = true
  ORDER BY es.created_at DESC
  LIMIT 1;
END;
$$;