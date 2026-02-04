/*
  # Add Present Now RPC Functions

  1. New Functions
    - `get_present_now(p_day date, p_branch_id uuid)` - Returns employees currently present (checked in but not out)
      - Takes a date and optional branch_id
      - Returns the latest attendance log per employee for that day
      - Filters to only employees who have check_in_time but no check_out_time
      - Uses DISTINCT ON to get the latest record per employee
    
    - `get_present_now_count(p_day date, p_branch_id uuid)` - Returns count of employees currently present
      - Wraps get_present_now and returns COUNT(*)
  
  2. Logic
    - For each employee, we get their LATEST attendance record for the specified day
    - Latest is determined by check_in_time DESC, created_at DESC
    - We only return records where check_in_time IS NOT NULL and check_out_time IS NULL
    - Branch filter is optional (NULL means all branches)
  
  3. Security
    - Functions are SECURITY DEFINER to bypass RLS
    - Only accessible to authenticated users
*/

-- Function to get employees currently present
CREATE OR REPLACE FUNCTION get_present_now(
  p_day date DEFAULT CURRENT_DATE,
  p_branch_id uuid DEFAULT NULL
)
RETURNS TABLE (
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
SECURITY DEFINER
LANGUAGE plpgsql
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

-- Function to get count of employees currently present
CREATE OR REPLACE FUNCTION get_present_now_count(
  p_day date DEFAULT CURRENT_DATE,
  p_branch_id uuid DEFAULT NULL
)
RETURNS bigint
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
  v_count bigint;
BEGIN
  SELECT COUNT(*)
  INTO v_count
  FROM get_present_now(p_day, p_branch_id);
  
  RETURN v_count;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_present_now(date, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_present_now_count(date, uuid) TO authenticated;
