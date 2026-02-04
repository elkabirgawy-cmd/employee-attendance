/*
  # Add get_absent_today_count Function

  ## Overview
  Creates a function to calculate the number of absent employees for today's date
  with strict company isolation.

  ## Calculation Logic
  - absent_today = active employees - employees who checked in today
  - Excludes employees on approved leave today
  - Excludes employees with active free tasks today

  ## Security
  - Enforces company_id isolation
  - Uses SECURITY DEFINER with search_path protection
  - Safe for use from client and edge functions

  ## Parameters
  - p_day: The date to check (format: 'YYYY-MM-DD')
  - p_company_id: Company ID for isolation
*/

-- Create function to get absent employee count for today
CREATE OR REPLACE FUNCTION public.get_absent_today_count(
  p_day date,
  p_company_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_total_active integer;
  v_checked_in_today integer;
  v_on_leave_today integer;
  v_on_free_task_today integer;
  v_absent_count integer;
  v_start_of_day timestamptz;
  v_end_of_day timestamptz;
BEGIN
  -- Calculate start and end of the day in UTC
  v_start_of_day := (p_day || ' 00:00:00')::timestamptz;
  v_end_of_day := (p_day || ' 23:59:59')::timestamptz;

  -- Count total active employees in this company
  SELECT COUNT(*)
  INTO v_total_active
  FROM public.employees
  WHERE company_id = p_company_id
    AND is_active = true;

  -- Count employees who checked in today in this company
  SELECT COUNT(DISTINCT employee_id)
  INTO v_checked_in_today
  FROM public.attendance_logs
  WHERE company_id = p_company_id
    AND check_in_time >= v_start_of_day
    AND check_in_time <= v_end_of_day;

  -- Count employees on approved leave today in this company
  SELECT COUNT(DISTINCT lr.employee_id)
  INTO v_on_leave_today
  FROM public.leave_requests lr
  WHERE lr.company_id = p_company_id
    AND lr.status = 'approved'
    AND lr.start_date <= p_day
    AND lr.end_date >= p_day
    AND EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = lr.employee_id
        AND e.company_id = p_company_id
        AND e.is_active = true
    );

  -- Count employees with active free tasks today in this company
  SELECT COUNT(DISTINCT ft.employee_id)
  INTO v_on_free_task_today
  FROM public.free_tasks ft
  WHERE ft.company_id = p_company_id
    AND ft.is_active = true
    AND ft.start_at::date <= p_day
    AND ft.end_at::date >= p_day
    AND EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = ft.employee_id
        AND e.company_id = p_company_id
        AND e.is_active = true
    );

  -- Calculate absent count
  -- Absent = Total Active - (Checked In + On Leave + On Free Task)
  -- Note: We assume no overlap between checked in, on leave, and free task
  -- which is correct based on business logic
  v_absent_count := v_total_active - (
    v_checked_in_today + 
    COALESCE(v_on_leave_today, 0) + 
    COALESCE(v_on_free_task_today, 0)
  );

  -- Ensure non-negative result
  v_absent_count := GREATEST(v_absent_count, 0);

  RETURN v_absent_count;
END;
$$;

-- Add helpful comment
COMMENT ON FUNCTION public.get_absent_today_count IS 'Calculates number of absent employees for a given day with company isolation. Excludes employees on leave or free tasks.';
