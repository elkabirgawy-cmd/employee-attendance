/*
  # Fix Absent Employees List to Match Count Exactly

  ## Problem
  The count shows correct number but modal list returns empty.
  Both functions should return the same dataset.

  ## Solution
  Rewrite get_absent_employees_list to use EXACTLY the same base query
  as get_absent_today_count, just returning rows instead of count.

  ## Changes
  1. Keep LEFT JOIN for shifts and branches (no INNER JOIN)
  2. Simplify SELECT to ensure no filtering occurs
  3. Keep WHERE clause identical to count function
  4. Simplify ORDER BY to avoid calculation errors
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

  -- Return absent employees with details
  -- THIS QUERY MUST MATCH get_absent_today_count EXACTLY
  RETURN QUERY
  SELECT
    e.id as employee_id,
    e.name as employee_name,
    e.employee_code as employee_code,
    COALESCE(b.name, '') as branch_name,
    COALESCE(s.name, 'لا يوجد') as shift_name,
    COALESCE(s.start_time, '09:00:00'::time) as shift_start_time,
    CASE
      WHEN s.id IS NOT NULL THEN
        GREATEST(0, EXTRACT(EPOCH FROM (v_current_time - (s.start_time + v_grace_period * INTERVAL '1 minute'))) / 60)::integer
      ELSE
        GREATEST(0, EXTRACT(EPOCH FROM (v_current_time - ('09:00:00'::time + v_grace_period * INTERVAL '1 minute'))) / 60)::integer
    END as minutes_late
  FROM public.employees e
  LEFT JOIN public.shifts s ON e.shift_id = s.id
  LEFT JOIN public.branches b ON e.branch_id = b.id
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

COMMENT ON FUNCTION public.get_absent_employees_list IS 'Returns list of absent employees using EXACTLY the same logic as get_absent_today_count';

-- Ensure permissions
GRANT EXECUTE ON FUNCTION public.get_absent_employees_list(date, uuid) TO authenticated;
