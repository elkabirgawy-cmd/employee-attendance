/*
  # Fix Present Functions - Tenant Isolation

  ## Critical Security Issue

  **Problem:**
  - `get_present_today()` and `get_present_now()` functions use SECURITY DEFINER
  - They bypass RLS completely
  - NO company_id filtering = AdminA sees AdminB's data

  **Impact:**
  - Dashboard "Attendance Today" card shows ALL companies' data
  - Dashboard "Present Now" card shows ALL companies' data
  - This is a CRITICAL multi-tenant isolation breach

  ## Solution

  Add `AND al.company_id = current_company_id()` to both functions
*/

-- ============================================================================
-- FIX: get_present_today
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_present_today(
  p_day date DEFAULT CURRENT_DATE,
  p_branch_id uuid DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  employee_id uuid,
  branch_id uuid,
  check_in_time timestamptz,
  check_out_time timestamptz,
  check_in_latitude numeric,
  check_in_longitude numeric,
  check_in_accuracy numeric,
  check_out_latitude numeric,
  check_out_longitude numeric,
  check_out_accuracy numeric,
  total_working_hours numeric,
  status text,
  checkout_type text,
  created_at timestamptz,
  employee_full_name text,
  employee_code text,
  branch_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (al.employee_id)
    al.id,
    al.employee_id,
    al.branch_id,
    al.check_in_time,
    al.check_out_time,
    al.check_in_latitude,
    al.check_in_longitude,
    al.check_in_accuracy,
    al.check_out_latitude,
    al.check_out_longitude,
    al.check_out_accuracy,
    al.total_working_hours,
    al.status,
    al.checkout_type,
    al.created_at,
    e.full_name as employee_full_name,
    e.employee_code,
    b.name as branch_name
  FROM attendance_logs al
  INNER JOIN employees e ON e.id = al.employee_id
  LEFT JOIN branches b ON b.id = al.branch_id
  WHERE 
    al.check_in_time >= p_day::timestamptz
    AND al.check_in_time < (p_day + INTERVAL '1 day')::timestamptz
    AND al.check_in_time IS NOT NULL
    AND e.is_active = true
    AND (p_branch_id IS NULL OR al.branch_id = p_branch_id)
    -- ✅ CRITICAL FIX: Add company_id filtering
    AND al.company_id = current_company_id()
  ORDER BY al.employee_id, al.check_in_time DESC, al.created_at DESC;
END;
$$;

-- ============================================================================
-- FIX: get_present_now
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_present_now(
  p_day date DEFAULT CURRENT_DATE,
  p_branch_id uuid DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  employee_id uuid,
  branch_id uuid,
  check_in_time timestamptz,
  check_out_time timestamptz,
  check_in_latitude numeric,
  check_in_longitude numeric,
  check_in_accuracy numeric,
  check_out_latitude numeric,
  check_out_longitude numeric,
  check_out_accuracy numeric,
  total_working_hours numeric,
  status text,
  checkout_type text,
  created_at timestamptz,
  employee_full_name text,
  employee_code text,
  branch_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH latest_logs AS (
    SELECT DISTINCT ON (al.employee_id)
      al.id,
      al.employee_id,
      al.branch_id,
      al.check_in_time,
      al.check_out_time,
      al.check_in_latitude,
      al.check_in_longitude,
      al.check_in_accuracy,
      al.check_out_latitude,
      al.check_out_longitude,
      al.check_out_accuracy,
      al.total_working_hours,
      al.status,
      al.checkout_type,
      al.created_at,
      e.full_name as employee_full_name,
      e.employee_code,
      b.name as branch_name
    FROM attendance_logs al
    INNER JOIN employees e ON e.id = al.employee_id
    LEFT JOIN branches b ON b.id = al.branch_id
    WHERE 
      al.check_in_time >= p_day::timestamptz
      AND al.check_in_time < (p_day + INTERVAL '1 day')::timestamptz
      AND e.is_active = true
      AND (p_branch_id IS NULL OR al.branch_id = p_branch_id)
      -- ✅ CRITICAL FIX: Add company_id filtering
      AND al.company_id = current_company_id()
    ORDER BY al.employee_id, al.check_in_time DESC, al.created_at DESC
  )
  SELECT 
    ll.id,
    ll.employee_id,
    ll.branch_id,
    ll.check_in_time,
    ll.check_out_time,
    ll.check_in_latitude,
    ll.check_in_longitude,
    ll.check_in_accuracy,
    ll.check_out_latitude,
    ll.check_out_longitude,
    ll.check_out_accuracy,
    ll.total_working_hours,
    ll.status,
    ll.checkout_type,
    ll.created_at,
    ll.employee_full_name,
    ll.employee_code,
    ll.branch_name
  FROM latest_logs ll
  WHERE 
    ll.check_in_time IS NOT NULL 
    AND ll.check_out_time IS NULL;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_present_today TO authenticated;
GRANT EXECUTE ON FUNCTION get_present_now TO authenticated;
GRANT EXECUTE ON FUNCTION get_present_today_count TO authenticated;
GRANT EXECUTE ON FUNCTION get_present_now_count TO authenticated;
