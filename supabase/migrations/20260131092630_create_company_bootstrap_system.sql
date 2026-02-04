-- Company Bootstrap Debug Logs
CREATE TABLE IF NOT EXISTS company_bootstrap_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  action text NOT NULL,
  status text NOT NULL,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bootstrap_logs_company ON company_bootstrap_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_bootstrap_logs_created ON company_bootstrap_logs(created_at DESC);

-- RLS for bootstrap logs (admins only)
ALTER TABLE company_bootstrap_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view company bootstrap logs"
  ON company_bootstrap_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.company_id = company_bootstrap_logs.company_id
    )
  );

CREATE POLICY "System can insert bootstrap logs"
  ON company_bootstrap_logs
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

-- Company Bootstrap Function
CREATE OR REPLACE FUNCTION bootstrap_company_defaults(p_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb := '{"success": true, "actions": []}'::jsonb;
  v_actions jsonb := '[]'::jsonb;
  v_count int;
BEGIN
  -- 1. Ensure application_settings exists
  SELECT COUNT(*) INTO v_count
  FROM application_settings
  WHERE company_id = p_company_id;

  IF v_count = 0 THEN
    INSERT INTO application_settings (company_id, max_delay_hours_per_day)
    VALUES (p_company_id, 2)
    ON CONFLICT (company_id) DO NOTHING;
    
    v_actions := v_actions || jsonb_build_object(
      'table', 'application_settings',
      'action', 'created',
      'status', 'success'
    );

    INSERT INTO company_bootstrap_logs (company_id, action, status, details)
    VALUES (p_company_id, 'create_application_settings', 'success', jsonb_build_object('max_delay_hours', 2));
  END IF;

  -- 2. Ensure auto_checkout_settings exists
  SELECT COUNT(*) INTO v_count
  FROM auto_checkout_settings
  WHERE company_id = p_company_id;

  IF v_count = 0 THEN
    INSERT INTO auto_checkout_settings (company_id, enabled, checkout_time)
    VALUES (p_company_id, false, '18:00')
    ON CONFLICT (company_id) DO NOTHING;
    
    v_actions := v_actions || jsonb_build_object(
      'table', 'auto_checkout_settings',
      'action', 'created',
      'status', 'success'
    );

    INSERT INTO company_bootstrap_logs (company_id, action, status, details)
    VALUES (p_company_id, 'create_auto_checkout_settings', 'success', jsonb_build_object('enabled', false));
  END IF;

  -- 3. Ensure payroll_settings exists
  SELECT COUNT(*) INTO v_count
  FROM payroll_settings
  WHERE company_id = p_company_id;

  IF v_count = 0 THEN
    INSERT INTO payroll_settings (company_id, currency)
    VALUES (p_company_id, 'SAR')
    ON CONFLICT (company_id) DO NOTHING;
    
    v_actions := v_actions || jsonb_build_object(
      'table', 'payroll_settings',
      'action', 'created',
      'status', 'success'
    );

    INSERT INTO company_bootstrap_logs (company_id, action, status, details)
    VALUES (p_company_id, 'create_payroll_settings', 'success', jsonb_build_object('currency', 'SAR'));
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'company_id', p_company_id,
    'actions', v_actions,
    'timestamp', now()
  );
END;
$$;

-- Auto Bootstrap Trigger on Admin Login
CREATE OR REPLACE FUNCTION trigger_bootstrap_on_admin_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Run bootstrap for the admin's company
  PERFORM bootstrap_company_defaults(NEW.company_id);
  RETURN NEW;
END;
$$;

-- Create trigger (only if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'auto_bootstrap_company'
  ) THEN
    CREATE TRIGGER auto_bootstrap_company
    AFTER INSERT ON admin_users
    FOR EACH ROW
    EXECUTE FUNCTION trigger_bootstrap_on_admin_activity();
  END IF;
END $$;
