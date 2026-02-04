/*
  # Fix RLS Policies for Open SaaS Registration

  ## Changes
  1. Enable RLS on companies and admin_users
  2. Allow any authenticated user to create a company (open SaaS)
  3. Allow admins to see only their own company
  4. Allow admins to insert themselves during registration
  5. Allow admins to see only their own data

  ## Security
  - Open registration for new companies
  - Strict isolation per company
  - Each admin can only access their own company's data
*/

-- ✅ 1) Enable RLS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- ✅ 2) Allow any authenticated user to create a new company (Open SaaS)
DROP POLICY IF EXISTS "companies_insert_any_auth_user" ON public.companies;
CREATE POLICY "companies_insert_any_auth_user"
  ON public.companies
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ✅ 3) Allow admins to see only their own company
DROP POLICY IF EXISTS "companies_select_own_company" ON public.companies;
DROP POLICY IF EXISTS "Users can view their own company" ON public.companies;
CREATE POLICY "companies_select_own_company"
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

-- ✅ 4) Allow admins to insert themselves during registration
DROP POLICY IF EXISTS "admin_users_insert_self" ON public.admin_users;
DROP POLICY IF EXISTS "Allow admin registration" ON public.admin_users;
DROP POLICY IF EXISTS "Admins can insert company users" ON public.admin_users;
CREATE POLICY "admin_users_insert_self"
  ON public.admin_users
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- ✅ 5) Allow admins to see only their own data
DROP POLICY IF EXISTS "admin_users_select_self" ON public.admin_users;
DROP POLICY IF EXISTS "Admins can view company users" ON public.admin_users;
CREATE POLICY "admin_users_select_self"
  ON public.admin_users
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Keep update policy for admins
DROP POLICY IF EXISTS "Admins can update users" ON public.admin_users;
DROP POLICY IF EXISTS "Admins can update company users" ON public.admin_users;
CREATE POLICY "admin_users_update_self"
  ON public.admin_users
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
