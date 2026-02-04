/*
  # Add Max Late Window and Improved Absent Logic

  ## Overview
  Adds sophisticated absence detection logic that:
  1. Only counts employees absent after their shift grace period + late window
  2. Considers shift schedules
  3. Excludes employees on leave or free tasks
  4. Provides detailed absent employee list

  ## Changes
  1. Add `max_late_window_minutes` to application_settings (default 60)
  2. Replace `get_absent_today_count()` with better logic
  3. Add `get_absent_employees_list()` for detailed list

  ## Logic
  Employee is absent if:
  - Active employee with shift assigned
  - Current time > (shift_start + grace_period + max_late_window)
  - No check-in today
  - Not on approved leave today
  - Not on active free task today

  ## Security
  - All queries scoped by company_id
  - SECURITY DEFINER with search_path protection
*/

-- ============================================================================
-- 1. ADD max_late_window_minutes TO application_settings
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'application_settings'
      AND column_name = 'max_late_window_minutes'
  ) THEN
    ALTER TABLE public.application_settings
      ADD COLUMN max_late_window_minutes integer NOT NULL DEFAULT 60
      CHECK (max_late_window_minutes >= 0 AND max_late_window_minutes <= 240);
  END IF;
END $$;

-- Update existing rows to have the default value
UPDATE public.application_settings
SET max_late_window_minutes = 60
WHERE max_late_window_minutes IS NULL;

-- ============================================================================
-- 2. IMPROVED get_absent_today_count FUNCTION
-- ============================================================================

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
  v_absent_count integer;
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

  -- Count absent employees
  SELECT COUNT(DISTINCT e.id)
  INTO v_absent_count
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
    -- Only count if grace + late window has passed
    AND (
      -- If employee has shift, check if time has passed
      (s.id IS NOT NULL AND v_current_time > (s.start_time + (v_grace_period + v_late_window) * INTERVAL '1 minute'))
      OR
      -- If no shift, fallback: count after 9 AM + grace + late window
      (s.id IS NULL AND v_current_time > ('09:00:00'::time + (v_grace_period + v_late_window) * INTERVAL '1 minute'))
    );

  RETURN COALESCE(v_absent_count, 0);
END;
$$;

COMMENT ON FUNCTION public.get_absent_today_count IS 'Calculates absent count only after shift start + grace period + late window has passed. Excludes employees on leave or free tasks.';

-- ============================================================================
-- 3. NEW get_absent_employees_list FUNCTION
-- ============================================================================

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
  RETURN QUERY
  SELECT
    e.id as employee_id,
    e.name as employee_name,
    e.employee_code as employee_code,
    b.name as branch_name,
    COALESCE(s.name, 'لا يوجد') as shift_name,
    COALESCE(s.start_time, '09:00:00'::time) as shift_start_time,
    CASE
      WHEN s.id IS NOT NULL THEN
        EXTRACT(EPOCH FROM (v_current_time - (s.start_time + v_grace_period * INTERVAL '1 minute'))) / 60
      ELSE
        EXTRACT(EPOCH FROM (v_current_time - ('09:00:00'::time + v_grace_period * INTERVAL '1 minute'))) / 60
    END::integer as minutes_late
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
      (s.id IS NOT NULL AND v_current_time > (s.start_time + (v_grace_period + v_late_window) * INTERVAL '1 minute'))
      OR
      (s.id IS NULL AND v_current_time > ('09:00:00'::time + (v_grace_period + v_late_window) * INTERVAL '1 minute'))
    )
  ORDER BY minutes_late DESC;
END;
$$;

COMMENT ON FUNCTION public.get_absent_employees_list IS 'Returns detailed list of absent employees with branch, shift, and lateness information.';

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_absent_today_count(date, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_absent_employees_list(date, uuid) TO authenticated;
