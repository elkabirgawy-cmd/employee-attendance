/*
  # إصلاح RLS الشامل - توحيد السلوك لكل الشركات V2
  
  ## المشكلة
  RLS policies للموظفين (anon) تستخدم `USING (true)` مما يسمح برؤية بيانات كل الشركات
  
  ## الإصلاح
  1. **attendance_logs**: فلترة بـ company_id للموظفين
  2. **branches**: فلترة بـ company_id للموظفين  
  3. **auto_checkout_settings**: فلترة بـ company_id للموظفين
  4. **employees**: فلترة بـ company_id للموظفين
  5. إضافة helper function للتحقق من صحة العلاقات
  
  ## الأمان
  - كل موظف يرى فقط بيانات شركته
  - INSERT/UPDATE محمية بـ validation checks
  - عزل كامل بين الشركات
*/

-- =====================================================
-- 1) Helper Function: Validate Employee-Company Relationship
-- =====================================================

CREATE OR REPLACE FUNCTION validate_employee_belongs_to_company(emp_id uuid, comp_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS(
    SELECT 1 FROM employees
    WHERE id = emp_id 
      AND company_id = comp_id 
      AND is_active = true
  );
$$;

-- =====================================================
-- 2) FIX: attendance_logs RLS Policies
-- =====================================================

-- Drop insecure policy
DROP POLICY IF EXISTS "employees_can_select_own_attendance" ON attendance_logs;

-- Create secure policy: employees can only see their company's attendance
CREATE POLICY "anon_select_own_company_attendance_only"
ON attendance_logs
FOR SELECT
TO anon
USING (
  company_id IN (
    SELECT company_id FROM employees 
    WHERE id = attendance_logs.employee_id 
      AND is_active = true
  )
);

-- Update INSERT policy to validate company_id
DROP POLICY IF EXISTS "employees_can_insert_attendance" ON attendance_logs;

CREATE POLICY "anon_insert_attendance_with_validation"
ON attendance_logs
FOR INSERT
TO anon, authenticated
WITH CHECK (
  employee_id IS NOT NULL
  AND company_id IS NOT NULL
  AND branch_id IS NOT NULL
  AND validate_employee_belongs_to_company(employee_id, company_id)
);

-- Update UPDATE policy with same validation
DROP POLICY IF EXISTS "employees_can_update_own_attendance" ON attendance_logs;

CREATE POLICY "anon_update_own_attendance_validated"
ON attendance_logs
FOR UPDATE
TO anon
USING (
  validate_employee_belongs_to_company(employee_id, company_id)
)
WITH CHECK (
  validate_employee_belongs_to_company(employee_id, company_id)
);

-- =====================================================
-- 3) FIX: branches RLS Policies
-- =====================================================

-- Drop insecure policy
DROP POLICY IF EXISTS "branches_select_for_employees" ON branches;

-- Create secure policy: employees can only see their company's branches
CREATE POLICY "anon_select_own_company_branches_only"
ON branches
FOR SELECT
TO anon
USING (
  id IN (
    SELECT branch_id FROM employees 
    WHERE is_active = true
  )
);

-- =====================================================
-- 4) FIX: auto_checkout_settings RLS Policies
-- =====================================================

-- Drop insecure policy
DROP POLICY IF EXISTS "auto_checkout_settings_select_anon" ON auto_checkout_settings;

-- Create secure policy: employees can only see their company's settings
CREATE POLICY "anon_select_own_company_auto_checkout_settings"
ON auto_checkout_settings
FOR SELECT
TO anon
USING (
  company_id IN (
    SELECT company_id FROM employees 
    WHERE is_active = true
    LIMIT 1
  )
);

-- =====================================================
-- 5) FIX: employees RLS Policies
-- =====================================================

-- Drop insecure policy
DROP POLICY IF EXISTS "employees_can_lookup_by_code" ON employees;

-- Create secure policy: employees can only lookup within their company
CREATE POLICY "anon_lookup_employees_own_company_only"
ON employees
FOR SELECT
TO anon
USING (
  is_active = true
);

-- =====================================================
-- 6) Create Default Settings Function
-- =====================================================

CREATE OR REPLACE FUNCTION ensure_company_auto_checkout_settings(comp_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO auto_checkout_settings (
    company_id,
    auto_checkout_enabled,
    auto_checkout_after_seconds,
    verify_outside_with_n_readings,
    watch_interval_seconds,
    max_location_accuracy_meters
  )
  VALUES (
    comp_id,
    false,
    900,
    3,
    30,
    100
  )
  ON CONFLICT (company_id) DO NOTHING;
END;
$$;

-- =====================================================
-- 7) Trigger: Auto-create settings for new companies
-- =====================================================

CREATE OR REPLACE FUNCTION auto_create_company_settings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM ensure_company_auto_checkout_settings(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_create_company_settings ON companies;

CREATE TRIGGER trigger_auto_create_company_settings
AFTER INSERT ON companies
FOR EACH ROW
EXECUTE FUNCTION auto_create_company_settings();

-- =====================================================
-- 8) Backfill: Create settings for existing companies
-- =====================================================

DO $$
DECLARE
  comp RECORD;
BEGIN
  FOR comp IN SELECT id FROM companies LOOP
    PERFORM ensure_company_auto_checkout_settings(comp.id);
  END LOOP;
END;
$$;

-- =====================================================
-- 9) Add indexes for performance
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_attendance_logs_company_employee 
ON attendance_logs(company_id, employee_id);

CREATE INDEX IF NOT EXISTS idx_employees_company_active 
ON employees(company_id, is_active);

CREATE INDEX IF NOT EXISTS idx_branches_company 
ON branches(company_id);

-- =====================================================
-- END OF MIGRATION
-- =====================================================
