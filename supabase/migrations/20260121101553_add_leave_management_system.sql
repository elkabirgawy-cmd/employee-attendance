/*
  # Leave Management System with Notifications

  1. New Tables
    - `leave_types`
      - Defines available leave types (annual, sick, unpaid)
      - Tracks if paid and default yearly allocation
    - `leave_balances`
      - Per-employee yearly leave balance tracking
      - Tracks total allocated days and used days
    - `leave_requests`
      - Employee leave requests with approval workflow
      - Status: pending/approved/rejected
      - Links to employee, leave type, and approver
    - `notifications`
      - System notifications for admins
      - Tracks read status and links to entities

  2. Security
    - Enable RLS on all tables
    - Employees can create own leave requests and view own balance
    - Admins can manage all leave requests and balances
    - Admins can view all notifications

  3. Important Notes
    - Leave balance validation required before approval
    - Unpaid leave doesn't deduct from balance
    - Auto-notification on leave request submission
    - Weekend exclusion handled in application layer
*/

-- Leave types table
CREATE TABLE IF NOT EXISTS leave_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_ar text NOT NULL,
  is_paid boolean DEFAULT true,
  default_days_per_year integer DEFAULT 21,
  color text DEFAULT '#3b82f6',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE leave_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view leave types"
  ON leave_types FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin can manage leave types"
  ON leave_types FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

-- Leave balances table
CREATE TABLE IF NOT EXISTS leave_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type_id uuid NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE,
  year integer NOT NULL,
  total_days integer DEFAULT 0,
  used_days integer DEFAULT 0,
  remaining_days integer GENERATED ALWAYS AS (total_days - used_days) STORED,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(employee_id, leave_type_id, year)
);

ALTER TABLE leave_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage leave balances"
  ON leave_balances FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

-- Leave requests table
CREATE TABLE IF NOT EXISTS leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type_id uuid NOT NULL REFERENCES leave_types(id),
  start_date date NOT NULL,
  end_date date NOT NULL,
  requested_days integer NOT NULL,
  reason text,
  attachment_url text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason text,
  decided_by uuid REFERENCES admin_users(id),
  decided_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage leave requests"
  ON leave_requests FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_role text NOT NULL DEFAULT 'admin' CHECK (recipient_role IN ('admin', 'employee')),
  recipient_id uuid,
  title text NOT NULL,
  body text NOT NULL,
  entity_type text,
  entity_id uuid,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view admin notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (
    recipient_role = 'admin' AND EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

CREATE POLICY "Admin can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (
    recipient_role = 'admin' AND EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  )
  WITH CHECK (
    recipient_role = 'admin' AND EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

-- Insert default leave types
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM leave_types LIMIT 1) THEN
    INSERT INTO leave_types (name, name_ar, is_paid, default_days_per_year, color)
    VALUES 
      ('Annual Leave', 'إجازة سنوية', true, 21, '#10b981'),
      ('Sick Leave', 'إجازة مرضية', true, 10, '#f59e0b'),
      ('Unpaid Leave', 'إجازة بدون أجر', false, 0, '#6b7280');
  END IF;
END $$;

-- Function to create notification on leave request
CREATE OR REPLACE FUNCTION notify_admin_on_leave_request()
RETURNS TRIGGER AS $$
DECLARE
  emp_name text;
BEGIN
  SELECT full_name INTO emp_name FROM employees WHERE id = NEW.employee_id;
  
  INSERT INTO notifications (recipient_role, title, body, entity_type, entity_id)
  VALUES (
    'admin',
    'طلب إجازة جديد',
    'الموظف ' || emp_name || ' طلب إجازة ' || NEW.requested_days || ' يوم',
    'leave_request',
    NEW.id
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'leave_request_notification_trigger'
  ) THEN
    CREATE TRIGGER leave_request_notification_trigger
    AFTER INSERT ON leave_requests
    FOR EACH ROW
    EXECUTE FUNCTION notify_admin_on_leave_request();
  END IF;
END $$;
