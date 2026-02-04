/*
  # إضافة Function آمنة لإنشاء الشركة والأدمن تلقائياً
  
  ## التغييرات
  1. إنشاء Postgres Function تُنشئ company وadmin_user معاً
  2. تحديث RLS Policies لمنع INSERT المباشر في companies
  3. السماح فقط باستخدام الـ Function للتسجيل
  
  ## الأمان
  - SECURITY DEFINER لتجاوز RLS بشكل آمن
  - عزل كامل بين الشركات
  - كل أدمن يرى بيانات شركته فقط
*/

-- ============================
-- 1) إنشاء Function آمنة للتسجيل
-- ============================

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
  -- الحصول على user_id من المستخدم المسجل حالياً
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- التحقق من عدم وجود admin_user بالفعل لهذا المستخدم
  IF EXISTS (SELECT 1 FROM public.admin_users WHERE id = v_user_id) THEN
    RAISE EXCEPTION 'Admin user already exists for this account';
  END IF;

  -- 1. إنشاء الشركة الجديدة
  INSERT INTO public.companies (name, plan, status, currency_label)
  VALUES (p_company_name, 'free', 'active', 'ریال')
  RETURNING id INTO v_company_id;

  -- 2. الحصول على role_id لـ super_admin
  SELECT id INTO v_role_id
  FROM public.roles
  WHERE name = 'super_admin'
  LIMIT 1;

  -- 3. إنشاء admin_user مرتبط بالشركة
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

  -- إرجاع النتيجة
  v_result := json_build_object(
    'success', TRUE,
    'company_id', v_company_id,
    'user_id', v_user_id
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error creating company and admin: %', SQLERRM;
END;
$$;

-- منح صلاحية التنفيذ للمستخدمين المسجلين فقط
GRANT EXECUTE ON FUNCTION public.create_company_and_admin(TEXT, TEXT, TEXT) TO authenticated;

-- ============================
-- 2) تحديث RLS Policies
-- ============================

-- منع INSERT المباشر في companies من العميل
DROP POLICY IF EXISTS "companies_insert_any_auth_user" ON public.companies;

-- إبقاء SELECT policy للأدمن لرؤية شركتهم
-- (موجودة بالفعل: companies_select_own_company)

-- إبقاء UPDATE policy للأدمن لتعديل شركتهم
DROP POLICY IF EXISTS "companies_update_own_company" ON public.companies;
CREATE POLICY "companies_update_own_company"
  ON public.companies
  FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT company_id
      FROM public.admin_users
      WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    id IN (
      SELECT company_id
      FROM public.admin_users
      WHERE id = auth.uid()
    )
  );

-- ============================
-- 3) تأكيد admin_users policies
-- ============================

-- السماح للأدمن بتحديث بياناته (موجودة بالفعل)
-- admin_users_update_self

-- إضافة policy للأدمن لرؤية زملائه في نفس الشركة
DROP POLICY IF EXISTS "admin_users_select_company_members" ON public.admin_users;
CREATE POLICY "admin_users_select_company_members"
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

-- حذف policy القديمة للـ SELECT الفردي
DROP POLICY IF EXISTS "admin_users_select_self" ON public.admin_users;

-- السماح للأدمن بإضافة أعضاء جدد لشركته
DROP POLICY IF EXISTS "admin_users_insert_company_members" ON public.admin_users;
CREATE POLICY "admin_users_insert_company_members"
  ON public.admin_users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- إما المستخدم نفسه (عبر الـ function) أو أدمن في نفس الشركة
    id = auth.uid() OR
    company_id IN (
      SELECT company_id
      FROM public.admin_users
      WHERE id = auth.uid()
    )
  );

-- حذف policy القديمة للـ INSERT الفردي
DROP POLICY IF EXISTS "admin_users_insert_self" ON public.admin_users;
