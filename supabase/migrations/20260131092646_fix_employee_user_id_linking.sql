-- Ensure user_id exists in employees (already done but double check)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE employees ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    CREATE INDEX idx_employees_user_id ON employees(user_id);
  END IF;
END $$;

-- Function to auto-link employee to auth.uid() on login
CREATE OR REPLACE FUNCTION auto_link_employee_user()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_employee_id uuid;
  v_company_id uuid;
  v_result jsonb;
BEGIN
  -- Skip if no auth.uid()
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'no_auth_user');
  END IF;

  -- Check if user already linked to an employee
  SELECT id, company_id INTO v_employee_id, v_company_id
  FROM employees
  WHERE user_id = v_user_id
  LIMIT 1;

  IF v_employee_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_linked', true,
      'employee_id', v_employee_id,
      'company_id', v_company_id
    );
  END IF;

  -- Try to find employee by email match
  SELECT e.id, e.company_id INTO v_employee_id, v_company_id
  FROM employees e
  JOIN auth.users u ON u.id = v_user_id
  WHERE e.email = u.email
  AND e.user_id IS NULL
  AND e.is_active = true
  LIMIT 1;

  IF v_employee_id IS NOT NULL THEN
    -- Link employee to user
    UPDATE employees
    SET user_id = v_user_id
    WHERE id = v_employee_id;

    RETURN jsonb_build_object(
      'success', true,
      'linked', true,
      'employee_id', v_employee_id,
      'company_id', v_company_id,
      'method', 'email_match'
    );
  END IF;

  RETURN jsonb_build_object('success', false, 'reason', 'no_match_found');
END;
$$;

-- Link existing admin users to their employee records
UPDATE employees e
SET user_id = au.id
FROM admin_users au
WHERE e.company_id = au.company_id
AND e.email IS NOT NULL
AND e.email != ''
AND au.email = e.email
AND e.user_id IS NULL;
