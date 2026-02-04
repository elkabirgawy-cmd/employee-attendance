/*
  # Seed Leave Balances for Testing

  1. Purpose
    - Initialize leave balances for all existing employees
    - Set default annual and sick leave allowances

  2. Data
    - Annual Leave: 21 days per year
    - Sick Leave: 10 days per year
    - Current year balances
*/

-- Insert leave balances for all employees for the current year
DO $$
DECLARE
  emp RECORD;
  annual_leave_type_id uuid;
  sick_leave_type_id uuid;
  current_year integer := EXTRACT(YEAR FROM CURRENT_DATE);
BEGIN
  -- Get leave type IDs
  SELECT id INTO annual_leave_type_id FROM leave_types WHERE name_ar = 'إجازة سنوية';
  SELECT id INTO sick_leave_type_id FROM leave_types WHERE name_ar = 'إجازة مرضية';

  -- Loop through all employees
  FOR emp IN SELECT id FROM employees
  LOOP
    -- Insert annual leave balance if not exists
    IF NOT EXISTS (
      SELECT 1 FROM leave_balances
      WHERE employee_id = emp.id
      AND leave_type_id = annual_leave_type_id
      AND year = current_year
    ) THEN
      INSERT INTO leave_balances (employee_id, leave_type_id, year, total_days, used_days)
      VALUES (emp.id, annual_leave_type_id, current_year, 21, 0);
    END IF;

    -- Insert sick leave balance if not exists
    IF NOT EXISTS (
      SELECT 1 FROM leave_balances
      WHERE employee_id = emp.id
      AND leave_type_id = sick_leave_type_id
      AND year = current_year
    ) THEN
      INSERT INTO leave_balances (employee_id, leave_type_id, year, total_days, used_days)
      VALUES (emp.id, sick_leave_type_id, current_year, 10, 0);
    END IF;
  END LOOP;
END $$;
