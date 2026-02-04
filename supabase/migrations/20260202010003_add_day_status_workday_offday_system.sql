/*
  # Add Day Status System (WORKDAY/OFFDAY)

  ## Overview
  Implements company-level day status detection to prevent confusion when showing
  zero attendance/absences on off days. Shows clear "اليوم إجازة" badge instead.

  ## Changes
  1. Create `holidays` table for company-specific holidays
  2. Create `get_today_status()` function to determine WORKDAY vs OFFDAY
  3. Update `get_absent_today_count()` to return 0 on OFFDAY
  4. Update `get_absent_employees_list()` to return empty on OFFDAY
  5. Create `get_expected_employees_count()` for better dashboard stats

  ## Day Status Logic
  OFFDAY if:
  - Day of week matches company's weekly_off_days setting (0=Sunday, 6=Saturday)
  - Date matches a holiday in holidays table

  WORKDAY: All other days

  ## Security
  - All queries scoped by company_id
  - RLS policies on holidays table
  - SECURITY DEFINER with search_path protection
*/

-- ============================================================================
-- 1. CREATE holidays TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  holiday_date date NOT NULL,
  name text NOT NULL,
  is_recurring boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Prevent duplicate holidays for same date and company
  CONSTRAINT unique_company_holiday_date UNIQUE (company_id, holiday_date)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_holidays_company_id ON public.holidays(company_id);
CREATE INDEX IF NOT EXISTS idx_holidays_date ON public.holidays(holiday_date);
CREATE INDEX IF NOT EXISTS idx_holidays_company_date ON public.holidays(company_id, holiday_date);

-- Enable RLS
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view holidays for their company"
  ON public.holidays
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.admin_users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert holidays for their company"
  ON public.holidays
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.admin_users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can update holidays for their company"
  ON public.holidays
  FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.admin_users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.admin_users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can delete holidays for their company"
  ON public.holidays
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.admin_users WHERE id = auth.uid()
    )
  );

COMMENT ON TABLE public.holidays IS 'Company-specific holidays. Used to determine OFFDAY status.';

-- ============================================================================
-- 2. CREATE get_today_status FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_today_status(
  p_company_id uuid,
  p_check_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_day_of_week integer;
  v_weekly_off_days integer[];
  v_holiday_name text;
  v_result jsonb;
BEGIN
  -- Get day of week (0=Sunday, 1=Monday, ..., 6=Saturday)
  v_day_of_week := EXTRACT(DOW FROM p_check_date)::integer;

  -- Get company's weekly off days
  SELECT COALESCE(weekly_off_days, '{}')
  INTO v_weekly_off_days
  FROM public.attendance_calculation_settings
  WHERE company_id = p_company_id
  LIMIT 1;

  -- If no settings found, use empty array
  IF v_weekly_off_days IS NULL THEN
    v_weekly_off_days := '{}';
  END IF;

  -- Check if today is in weekly off days
  IF v_day_of_week = ANY(v_weekly_off_days) THEN
    RETURN jsonb_build_object(
      'status', 'OFFDAY',
      'reason', 'weekly_off',
      'day_of_week', v_day_of_week,
      'detail', CASE v_day_of_week
        WHEN 0 THEN 'Sunday'
        WHEN 1 THEN 'Monday'
        WHEN 2 THEN 'Tuesday'
        WHEN 3 THEN 'Wednesday'
        WHEN 4 THEN 'Thursday'
        WHEN 5 THEN 'Friday'
        WHEN 6 THEN 'Saturday'
      END
    );
  END IF;

  -- Check if today is a holiday
  SELECT name INTO v_holiday_name
  FROM public.holidays
  WHERE company_id = p_company_id
    AND holiday_date = p_check_date
  LIMIT 1;

  IF v_holiday_name IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status', 'OFFDAY',
      'reason', 'holiday',
      'detail', v_holiday_name
    );
  END IF;

  -- It's a workday
  RETURN jsonb_build_object(
    'status', 'WORKDAY',
    'reason', NULL,
    'detail', NULL
  );
END;
$$;

COMMENT ON FUNCTION public.get_today_status IS 'Determines if a given date is WORKDAY or OFFDAY for a company based on weekly_off_days and holidays.';

GRANT EXECUTE ON FUNCTION public.get_today_status(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_today_status(uuid, date) TO anon;

-- ============================================================================
-- 3. UPDATE get_absent_today_count TO RESPECT OFFDAY
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
  v_day_status jsonb;
BEGIN
  -- Check if today is OFFDAY
  v_day_status := public.get_today_status(p_company_id, p_day);
  
  IF v_day_status->>'status' = 'OFFDAY' THEN
    -- On off days, no one is counted absent
    RETURN 0;
  END IF;

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

  -- Count absent employees (only on workdays)
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

-- ============================================================================
-- 4. UPDATE get_absent_employees_list TO RESPECT OFFDAY
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
  v_day_status jsonb;
BEGIN
  -- Check if today is OFFDAY
  v_day_status := public.get_today_status(p_company_id, p_day);
  
  IF v_day_status->>'status' = 'OFFDAY' THEN
    -- On off days, return empty list
    RETURN;
  END IF;

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

  -- Return absent employees with details (only on workdays)
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

-- ============================================================================
-- 5. CREATE get_expected_employees_count FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_expected_employees_count(
  p_day date,
  p_company_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_expected_count integer;
  v_day_status jsonb;
BEGIN
  -- Check if today is OFFDAY
  v_day_status := public.get_today_status(p_company_id, p_day);
  
  IF v_day_status->>'status' = 'OFFDAY' THEN
    -- On off days, no employees are expected
    RETURN 0;
  END IF;

  -- Count active employees expected today (workday)
  SELECT COUNT(DISTINCT e.id)
  INTO v_expected_count
  FROM public.employees e
  WHERE e.company_id = p_company_id
    AND e.is_active = true
    -- Exclude employees on approved leave
    AND NOT EXISTS (
      SELECT 1 FROM public.leave_requests lr
      WHERE lr.employee_id = e.id
        AND lr.company_id = p_company_id
        AND lr.status = 'approved'
        AND lr.start_date <= p_day
        AND lr.end_date >= p_day
    )
    -- Exclude employees on free tasks
    AND NOT EXISTS (
      SELECT 1 FROM public.free_tasks ft
      WHERE ft.employee_id = e.id
        AND ft.company_id = p_company_id
        AND ft.is_active = true
        AND ft.start_at::date <= p_day
        AND ft.end_at::date >= p_day
    );

  RETURN COALESCE(v_expected_count, 0);
END;
$$;

COMMENT ON FUNCTION public.get_expected_employees_count IS 'Returns count of employees expected to work today (0 on OFFDAY).';

GRANT EXECUTE ON FUNCTION public.get_expected_employees_count(date, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_expected_employees_count(date, uuid) TO anon;
