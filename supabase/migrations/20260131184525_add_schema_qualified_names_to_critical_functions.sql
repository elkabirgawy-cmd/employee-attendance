/*
  # إضافة Schema-Qualified Names للـ Functions الحرجة
  
  1. التغييرات
    - تعديل Functions المستخدمة في طلبات الإجازة وإذن التأخير
    - إضافة public. قبل كل اسم جدول
    
  2. Functions المعدلة
    - get_employee_company_id
    - validate_employee_belongs_to_company  
    - check_delay_permission_overlap
    - validate_delay_permission_before_insert
    - create_leave_request_notification
    
  3. ملاحظات
    - search_path تم تحديثه مسبقاً إلى public, pg_temp
    - لا تغيير في RLS policies
    - فقط إضافة schema-qualified names للأمان
*/

-- 1. get_employee_company_id
CREATE OR REPLACE FUNCTION public.get_employee_company_id(p_employee_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
v_company_id UUID;
BEGIN
SELECT company_id INTO v_company_id
FROM public.employees  -- schema-qualified
WHERE id = p_employee_id;

RETURN v_company_id;
END;
$function$;

-- 2. validate_employee_belongs_to_company
CREATE OR REPLACE FUNCTION public.validate_employee_belongs_to_company(emp_id uuid, comp_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
SELECT EXISTS(
SELECT 1 FROM public.employees  -- schema-qualified
WHERE id = emp_id 
AND company_id = comp_id 
AND is_active = true
);
$function$;

-- 3. check_delay_permission_overlap
CREATE OR REPLACE FUNCTION public.check_delay_permission_overlap(
  p_employee_id uuid, 
  p_date date, 
  p_start_time time without time zone, 
  p_end_time time without time zone, 
  p_exclude_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(has_overlap boolean, overlapping_count integer, overlapping_ids uuid[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
v_overlapping_ids UUID[];
v_count INTEGER;
BEGIN
-- Find overlapping delay permissions
SELECT 
  array_agg(id),
  COUNT(*)
INTO v_overlapping_ids, v_count
FROM public.delay_permissions  -- schema-qualified
WHERE employee_id = p_employee_id
AND date = p_date
AND status IN ('pending', 'approved')
AND (p_exclude_id IS NULL OR id != p_exclude_id)
AND (
  -- Time ranges overlap if:
  -- new start is between existing start and end
  (p_start_time >= start_time AND p_start_time < end_time)
  OR
  -- new end is between existing start and end
  (p_end_time > start_time AND p_end_time <= end_time)
  OR
  -- new range completely contains existing range
  (p_start_time <= start_time AND p_end_time >= end_time)
);

RETURN QUERY SELECT
  v_count > 0,
  COALESCE(v_count, 0),
  COALESCE(v_overlapping_ids, ARRAY[]::UUID[]);
END;
$function$;

-- 4. validate_delay_permission_before_insert
CREATE OR REPLACE FUNCTION public.validate_delay_permission_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
v_employee_record RECORD;
v_overlap_result RECORD;
BEGIN
-- Validation 1: Employee exists
SELECT id, company_id, is_active, full_name
INTO v_employee_record
FROM public.employees  -- schema-qualified
WHERE id = NEW.employee_id;

IF NOT FOUND THEN
  RAISE EXCEPTION 'الموظف غير موجود'
  USING HINT = 'Employee with id ' || NEW.employee_id || ' does not exist';
END IF;

-- Validation 2: Employee is active
IF NOT v_employee_record.is_active THEN
  RAISE EXCEPTION 'حساب الموظف غير نشط'
  USING HINT = 'Employee ' || v_employee_record.full_name || ' is not active';
END IF;

-- Validation 3: Company ID matches
IF v_employee_record.company_id != NEW.company_id THEN
  RAISE EXCEPTION 'عدم تطابق معرف الشركة'
  USING HINT = 'Company ID mismatch: employee belongs to ' || v_employee_record.company_id || ', but permission is for ' || NEW.company_id;
END IF;

-- Validation 4: Check for overlapping permissions
SELECT * INTO v_overlap_result
FROM public.check_delay_permission_overlap(  -- schema-qualified
  NEW.employee_id,
  NEW.date,
  NEW.start_time,
  NEW.end_time,
  NEW.id
);

IF v_overlap_result.has_overlap THEN
  RAISE EXCEPTION 'يوجد طلب إذن تأخير متداخل في نفس الوقت'
  USING HINT = 'Found ' || v_overlap_result.overlapping_count || ' overlapping delay permission(s)';
END IF;

-- All validations passed
RETURN NEW;
END;
$function$;

-- 5. create_leave_request_notification
CREATE OR REPLACE FUNCTION public.create_leave_request_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
emp_name text;
leave_type_name text;
BEGIN
-- Get employee name
SELECT full_name INTO emp_name 
FROM public.employees  -- schema-qualified
WHERE id = NEW.employee_id;

-- Get leave type name
SELECT name_ar INTO leave_type_name 
FROM public.leave_types  -- schema-qualified
WHERE id = NEW.leave_type_id;

-- Insert notification with correct schema
INSERT INTO public.notifications (  -- schema-qualified
  role, type, title, body, data, priority
)
VALUES (
  'admin',
  'leave_request',
  'طلب إجازة جديد',
  emp_name || ' قدم طلب إجازة (' || leave_type_name || ') من ' || 
  TO_CHAR(NEW.start_date, 'YYYY-MM-DD') || ' إلى ' || 
  TO_CHAR(NEW.end_date, 'YYYY-MM-DD'),
  jsonb_build_object(
    'employee_id', NEW.employee_id,
    'employee_name', emp_name,
    'leave_request_id', NEW.id,
    'leave_type', leave_type_name,
    'start_date', NEW.start_date,
    'end_date', NEW.end_date,
    'requested_days', NEW.requested_days
  ),
  'high'
);

RETURN NEW;
END;
$function$;
