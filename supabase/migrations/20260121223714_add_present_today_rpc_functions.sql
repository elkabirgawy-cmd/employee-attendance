/*
  # Add Present Today RPC Functions

  1. New Functions
    - `get_present_today(p_day date, p_branch_id uuid)` - Returns all employees who checked in today
      - Takes a date and optional branch_id
      - Returns ALL employees who have check_in_time on that day
      - Does NOT filter by check_out (includes both checked out and still present)
      - Uses DISTINCT ON to avoid duplicate employees (in case of multiple check-ins)
    
    - `get_present_today_count(p_day date, p_branch_id uuid)` - Returns count of employees who checked in today
      - Wraps get_present_today and returns COUNT(*)
  
  2. Difference from "Present Now"
    - "Present Today" = Anyone who checked in today (regardless of check-out status)
    - "Present Now" = Only those who checked in but haven't checked out yet
    - This is a separate, broader category
  
  3. Logic
    - For each employee, get ALL attendance records for the specified day
    - Use DISTINCT ON to avoid counting the same employee multiple times
    - NO filter on check_out_time (that's the key difference)
    - Branch filter is optional (NULL means all branches)
  
  4. Security
    - Functions are SECURITY DEFINER to bypass RLS
    - Only accessible to authenticated users
*/

-- Function to get all employees who checked in today
CREATE OR REPLACE FUNCTION get_present_today(
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
  ORDER BY al.employee_id, al.check_in_time DESC, al.created_at DESC;
END;
$$;

-- Function to get count of employees who checked in today
CREATE OR REPLACE FUNCTION get_present_today_count(
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
  FROM get_present_today(p_day, p_branch_id);
  
  RETURN v_count;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_present_today(date, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_present_today_count(date, uuid) TO authenticated;
