/*
  # Fix Leave Request Notification Trigger

  1. Problem
    - Original trigger function uses `recipient_role` column
    - Notifications table was recreated with `role` column (not `recipient_role`)
    - Leave request submission fails: "column recipient_role does not exist"

  2. Solution
    - Drop old trigger and function
    - Recreate with correct column name: `role` instead of `recipient_role`
    - Also remove references to deprecated columns: `entity_type`, `entity_id`, `recipient_id`
    - Use current schema: id, user_id, role, type, title, body, data, read, priority, created_at, read_at

  3. Changes
    - Replace `recipient_role` with `role`
    - Replace `entity_type`, `entity_id` with proper notification type
    - Store additional data in `data` JSONB column
*/

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS notify_leave_request_created ON leave_requests;
DROP FUNCTION IF EXISTS create_leave_request_notification();

-- Recreate function with correct column names
CREATE OR REPLACE FUNCTION create_leave_request_notification()
RETURNS TRIGGER AS $$
DECLARE
  emp_name text;
  leave_type_name text;
BEGIN
  -- Get employee name
  SELECT full_name INTO emp_name FROM employees WHERE id = NEW.employee_id;
  
  -- Get leave type name
  SELECT name_ar INTO leave_type_name FROM leave_types WHERE id = NEW.leave_type_id;
  
  -- Insert notification with correct schema
  INSERT INTO notifications (role, type, title, body, data, priority)
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
CREATE TRIGGER notify_leave_request_created
  AFTER INSERT ON leave_requests
  FOR EACH ROW
  EXECUTE FUNCTION create_leave_request_notification();
