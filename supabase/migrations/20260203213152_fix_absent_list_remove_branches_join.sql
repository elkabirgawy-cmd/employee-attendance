/*
  # Fix Absent Employees List - Remove Branches Join

  ## Problem
  Count query works but list returns empty. Count query doesn't join branches,
  but list query does. This extra join might be causing the issue.

  ## Solution
  Make list query EXACTLY like count query - same FROM, same JOINs, same WHERE.
  Remove branches LEFT JOIN to match count query perfectly.

  ## Changes
  1. Remove branches LEFT JOIN (count doesn't have it)
  2. Return empty string for branch_name since we don't have it
  3. Keep everything else identical to count query
*/

CREATE OR REPLACE FUNCTION public.get_absent_employees_list(
  p_day date,
  p_company_id uuid
)
RETURNS TABLE (
  employee_id uuid,
  employee_name text,
  employee_code text,
  branch_name text,
  shift_name text,
  shift_start_time time,
  minutes_late integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_grace_period integer;
  v_late_window integer;
  v_current_time time;
BEGIN
  -- Get current time
  v_current_time := CURRENT_TIME;

  -- Get settings for this company
  SELECT
    COALESCE(grace_period_minutes, 5),
    COALESCE(max_late_window_minutes, 60)
  INTO v_grace_period, v_late_window
  FROM public.application_settings
  WHERE company_id = p_company_id
  LIMIT 1;

  -- If no settings found, use defaults
  IF v_grace_period IS NULL THEN
    v_grace_period := 5;
  END IF;
  IF v_late_window IS NULL THEN
    v_late_window := 60;
  END IF;

  -- Return absent employees - EXACT SAME STRUCTURE AS COUNT QUERY
  RETURN QUERY
  SELECT
    e.id as employee_id,
    e.name as employee_name,
    COALESCE(e.employee_code, '') as employee_code,
    ''::text as branch_name,
    COALESCE(s.name, 'لا يوجد') as shift_name,
    COALESCE(s.start_time, '09:00:00'::time) as shift_start_time,
    60 as minutes_late
  FROM public.employees e
  LEFT JOIN public.shifts s ON e.shift_id = s.id
  WHERE e.company_id = p_company_id
    AND e.is_active = true
    -- Employee has NOT checked in today
    AND NOT EXISTS (
      SELECT 1 FROM public.attendance_logs al
      WHERE al.employee_id = e.id
        AND al.company_id = p_company_id
        AND al.check_in_time::date = p_day
    )
    -- Employee is NOT on approved leave today
    AND NOT EXISTS (
      SELECT 1 FROM public.leave_requests lr
      WHERE lr.employee_id = e.id
        AND lr.company_id = p_company_id
        AND lr.status = 'approved'
        AND lr.start_date <= p_day
        AND lr.end_date >= p_day
    )
    -- Employee is NOT on active free task today
    AND NOT EXISTS (
      SELECT 1 FROM public.free_tasks ft
      WHERE ft.employee_id = e.id
        AND ft.company_id = p_company_id
        AND ft.is_active = true
        AND ft.start_at::date <= p_day
        AND ft.end_at::date >= p_day
    )
    -- Only include if grace + late window has passed
    AND (
      -- If employee has shift, check if time has passed
      (s.id IS NOT NULL AND v_current_time > (s.start_time + (v_grace_period + v_late_window) * INTERVAL '1 minute'))
      OR
      -- If no shift, fallback: count after 9 AM + grace + late window
      (s.id IS NULL AND v_current_time > ('09:00:00'::time + (v_grace_period + v_late_window) * INTERVAL '1 minute'))
    )
  ORDER BY e.name;
END;
$$;

COMMENT ON FUNCTION public.get_absent_employees_list IS 'Returns absent employees using EXACTLY the same query structure as get_absent_today_count';
