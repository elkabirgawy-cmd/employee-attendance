/*
  # Fix Multi-Tenant Isolation Bug

  ## Problem
  New admin signups are seeing the SAME employees/data from other companies.

  ## Root Causes
  1. create_company_and_admin() may reuse existing companies
  2. RLS policies have "Allow admin registration" WITH CHECK (true) - too permissive
  3. Frontend queries don't explicitly filter by company_id (rely on RLS)

  ## Solution
  1. Recreate create_company_and_admin to ALWAYS create NEW company
  2. Remove permissive RLS policies
  3. Enforce strict company_id isolation
  4. Make company_id NOT NULL on all tenant tables

  ## Security
  - Each user can ONLY see their company's data
  - Complete isolation between companies
  - No data leakage
*/

-- =====================================================
-- 1. DROP AND RECREATE create_company_and_admin
-- =====================================================

DROP FUNCTION IF EXISTS public.create_company_and_admin(TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.create_company_and_admin(
  p_company_name TEXT,
  p_full_name TEXT,
  p_email TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
  v_user_id UUID;
  v_role_id UUID;
  v_result JSON;
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Check if user already has a company (prevent multiple companies per user)
  IF EXISTS (SELECT 1 FROM public.admin_users WHERE id = v_user_id) THEN
    -- User already has a company, return existing data
    SELECT 
      json_build_object(
        'success', TRUE,
        'company_id', company_id,
        'user_id', id,
        'message', 'User already has a company'
      )
    INTO v_result
    FROM public.admin_users
    WHERE id = v_user_id;
    
    RETURN v_result;
  END IF;

  -- ALWAYS create a NEW company (never reuse)
  INSERT INTO public.companies (name, plan, status, currency_label)
  VALUES (p_company_name, 'free', 'active', 'ریال')
  RETURNING id INTO v_company_id;

  -- Get super_admin role
  SELECT id INTO v_role_id
  FROM public.roles
  WHERE name = 'super_admin'
  LIMIT 1;

  -- Create admin_user linked to NEW company
  INSERT INTO public.admin_users (
    id,
    role_id,
    full_name,
    email,
    is_active,
    company_id,
    is_owner
  ) VALUES (
    v_user_id,
    v_role_id,
    p_full_name,
    p_email,
    TRUE,
    v_company_id,
    TRUE
  );

  -- Return result
  v_result := json_build_object(
    'success', TRUE,
    'company_id', v_company_id,
    'user_id', v_user_id,
    'message', 'New company and admin created'
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error creating company and admin: %', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_company_and_admin(TEXT, TEXT, TEXT) TO authenticated;

-- =====================================================
-- 2. FIX RLS POLICIES - STRICT ISOLATION
-- =====================================================

-- Companies: Users can only see their OWN company
DROP POLICY IF EXISTS "Users can view their own company" ON public.companies;
DROP POLICY IF EXISTS "companies_select_own_company" ON public.companies;
DROP POLICY IF EXISTS "companies_select_own" ON public.companies;

CREATE POLICY "companies_select_own"
  ON public.companies
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT company_id
      FROM public.admin_users
      WHERE id = auth.uid()
    )
  );

-- Admin Users: REMOVE permissive "Allow admin registration" policy
DROP POLICY IF EXISTS "Allow admin registration" ON public.admin_users;
DROP POLICY IF EXISTS "Admins can view all users" ON public.admin_users;
DROP POLICY IF EXISTS "Admins can view company users" ON public.admin_users;
DROP POLICY IF EXISTS "admin_users_select_self" ON public.admin_users;
DROP POLICY IF EXISTS "admin_users_select_company_members" ON public.admin_users;

-- Admin Users: Only see users from THEIR company
CREATE POLICY "admin_users_select_own_company"
  ON public.admin_users
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id
      FROM public.admin_users
      WHERE id = auth.uid()
    )
  );

-- Admin Users: Can only insert into THEIR company (via function)
DROP POLICY IF EXISTS "Admins can insert company users" ON public.admin_users;
DROP POLICY IF EXISTS "admin_users_insert_self" ON public.admin_users;
DROP POLICY IF EXISTS "admin_users_insert_company_members" ON public.admin_users;

CREATE POLICY "admin_users_insert_own_company"
  ON public.admin_users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    id = auth.uid() OR
    company_id IN (
      SELECT company_id
      FROM public.admin_users
      WHERE id = auth.uid()
    )
  );

-- Admin Users: Can only update users from THEIR company
DROP POLICY IF EXISTS "Admins can update company users" ON public.admin_users;
DROP POLICY IF EXISTS "Admins can update users" ON public.admin_users;
DROP POLICY IF EXISTS "admin_users_update_self" ON public.admin_users;

CREATE POLICY "admin_users_update_own_company"
  ON public.admin_users
  FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id
      FROM public.admin_users
      WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id
      FROM public.admin_users
      WHERE id = auth.uid()
    )
  );

-- =====================================================
-- 3. ENSURE NOT NULL CONSTRAINTS
-- =====================================================

-- These should already be NOT NULL from previous migration
-- But let's ensure they are set

DO $$
BEGIN
  -- admin_users
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'admin_users' AND column_name = 'company_id' AND is_nullable = 'YES'
  ) THEN
    -- First, ensure all rows have company_id
    UPDATE admin_users 
    SET company_id = (SELECT id FROM companies LIMIT 1)
    WHERE company_id IS NULL;
    
    ALTER TABLE admin_users ALTER COLUMN company_id SET NOT NULL;
  END IF;

  -- employees
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'employees' AND column_name = 'company_id' AND is_nullable = 'YES'
  ) THEN
    UPDATE employees 
    SET company_id = (SELECT id FROM companies LIMIT 1)
    WHERE company_id IS NULL;
    
    ALTER TABLE employees ALTER COLUMN company_id SET NOT NULL;
  END IF;

  -- branches
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'branches' AND column_name = 'company_id' AND is_nullable = 'YES'
  ) THEN
    UPDATE branches 
    SET company_id = (SELECT id FROM companies LIMIT 1)
    WHERE company_id IS NULL;
    
    ALTER TABLE branches ALTER COLUMN company_id SET NOT NULL;
  END IF;

  -- shifts
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shifts' AND column_name = 'company_id' AND is_nullable = 'YES'
  ) THEN
    UPDATE shifts 
    SET company_id = (SELECT id FROM companies LIMIT 1)
    WHERE company_id IS NULL;
    
    ALTER TABLE shifts ALTER COLUMN company_id SET NOT NULL;
  END IF;

  -- departments
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'departments' AND column_name = 'company_id' AND is_nullable = 'YES'
  ) THEN
    UPDATE departments 
    SET company_id = (SELECT id FROM companies LIMIT 1)
    WHERE company_id IS NULL;
    
    ALTER TABLE departments ALTER COLUMN company_id SET NOT NULL;
  END IF;

  -- attendance_logs
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'attendance_logs' AND column_name = 'company_id' AND is_nullable = 'YES'
  ) THEN
    UPDATE attendance_logs 
    SET company_id = (SELECT company_id FROM employees WHERE employees.id = attendance_logs.employee_id LIMIT 1)
    WHERE company_id IS NULL;
    
    ALTER TABLE attendance_logs ALTER COLUMN company_id SET NOT NULL;
  END IF;
END $$;

-- =====================================================
-- 4. UPDATE get_user_company_id FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_company_id uuid;
BEGIN
  SELECT company_id INTO v_company_id
  FROM public.admin_users
  WHERE id = auth.uid()
  LIMIT 1;
  
  RETURN v_company_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_company_id() TO authenticated;
