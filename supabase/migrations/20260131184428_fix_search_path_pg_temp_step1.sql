/*
  # تحديث Search Path للأمان - الخطوة 1
  
  1. التغييرات
    - تغيير search_path من `public, extensions` إلى `public, pg_temp`
    - لكل الـ 48 function
    
  2. ملاحظات
    - لا تغيير في RLS policies
    - لا تغيير في logic الـ functions
    - فقط تغيير search_path
*/

-- Update all 48 functions to use public, pg_temp

ALTER FUNCTION public.auto_create_company_settings()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.auto_link_employee_user()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.bootstrap_company_defaults(p_company_id uuid)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.check_delay_permission_overlap(p_employee_id uuid, p_date date, p_start_time time without time zone, p_end_time time without time zone, p_exclude_id uuid)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.check_employee_session(p_employee_id uuid)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.cleanup_old_debug_logs(days_to_keep integer)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.create_default_application_settings()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.create_default_attendance_calculation_settings()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.create_default_auto_checkout_settings()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.create_leave_request_notification()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.current_company_id()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.ensure_all_company_settings(p_company_id uuid)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.ensure_application_settings(p_company_id uuid)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.ensure_attendance_calculation_settings(p_company_id uuid)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.ensure_auto_checkout_settings(p_company_id uuid)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.ensure_company_auto_checkout_settings(comp_id uuid)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.extend_employee_session(p_employee_id uuid, p_hours integer)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.get_active_attendance_session(p_employee_id uuid, p_company_id uuid)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.get_auto_checkout_settings_for_employee(p_employee_id uuid)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.get_employee_company_id(p_employee_id uuid)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.get_open_session_today(emp_id uuid, comp_id uuid)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.get_present_now_count(p_day date, p_branch_id uuid)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.get_present_today_count(p_day date, p_branch_id uuid)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.get_user_company_id()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.has_open_session_today(emp_id uuid, comp_id uuid)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.initialize_company_settings(p_company_id uuid)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.link_employee_to_auth_user(p_employee_id uuid, p_user_id uuid)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.record_heartbeat_and_check_auto_checkout(p_employee_id uuid, p_attendance_log_id uuid, p_in_branch boolean, p_gps_ok boolean, p_latitude numeric, p_longitude numeric, p_accuracy numeric)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.set_company_id_from_current()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.test_delay_permission_insert(p_employee_id uuid, p_company_id uuid, p_date date, p_minutes integer)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.test_delay_permission_submission(p_employee_id uuid, p_company_id uuid, p_date date)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.trigger_bootstrap_on_admin_activity()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.trigger_initialize_company_settings()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.upsert_company_settings(p_company_id uuid)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.validate_delay_permission_before_insert()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.validate_employee_belongs_to_company(emp_id uuid, comp_id uuid)
  SET search_path = public, pg_temp;

-- SECURITY INVOKER functions
ALTER FUNCTION public.calculate_delay_minutes(p_start_time time without time zone, p_end_time time without time zone)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.check_late_deduction_overlap(p_company_id uuid, p_from_minutes integer, p_to_minutes integer, p_rule_id uuid)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.cleanup_old_timezone_cache()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.debug_check_pending(p_employee_id uuid, p_attendance_log_id uuid)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.prevent_duplicate_open_session()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.update_attendance_locations()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.update_branch_location()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.update_delay_permissions_updated_at()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.update_device_push_tokens_updated_at()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.update_overtime_settings_updated_at()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.update_updated_at()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.update_updated_at_column()
  SET search_path = public, pg_temp;
