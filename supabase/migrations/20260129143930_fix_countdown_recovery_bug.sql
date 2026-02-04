/*
  # Fix Countdown Recovery Bug

  ## Problem
  The recovery logic is not cancelling the pending record because the SELECT statement
  is not finding it due to SECURITY DEFINER scope issues or missing company_id check.

  ## Solution
  Add explicit logging and ensure the SELECT finds the record properly.
*/

DROP FUNCTION IF EXISTS record_heartbeat_and_check_auto_checkout(uuid, uuid, boolean, boolean, numeric, numeric, numeric);

CREATE FUNCTION record_heartbeat_and_check_auto_checkout(
  p_employee_id uuid,
  p_attendance_log_id uuid,
  p_in_branch boolean,
  p_gps_ok boolean,
  p_latitude numeric DEFAULT NULL,
  p_longitude numeric DEFAULT NULL,
  p_accuracy numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_company_id uuid;
  v_settings record;
  v_existing_pending record;
  v_is_problem boolean;
  v_reason text;
  v_ends_at timestamptz;
BEGIN
  -- Get company_id
  SELECT company_id INTO v_company_id FROM employees WHERE id = p_employee_id;
  IF v_company_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'EMPLOYEE_NOT_FOUND');
  END IF;

  -- Get settings
  SELECT * INTO v_settings FROM auto_checkout_settings WHERE company_id = v_company_id LIMIT 1;
  IF v_settings IS NULL OR v_settings.auto_checkout_enabled = false THEN
    INSERT INTO employee_location_heartbeat (employee_id, company_id, attendance_log_id, last_seen_at, in_branch, gps_ok, reason)
    VALUES (p_employee_id, v_company_id, p_attendance_log_id, now(), p_in_branch, p_gps_ok, NULL)
    ON CONFLICT (employee_id) DO UPDATE SET
      attendance_log_id = EXCLUDED.attendance_log_id, last_seen_at = EXCLUDED.last_seen_at,
      in_branch = EXCLUDED.in_branch, gps_ok = EXCLUDED.gps_ok, reason = EXCLUDED.reason;
    RETURN jsonb_build_object('success', true, 'auto_checkout_enabled', false);
  END IF;

  -- Determine problem
  v_is_problem := (NOT p_gps_ok) OR (NOT p_in_branch);
  v_reason := CASE WHEN NOT p_gps_ok THEN 'GPS_BLOCKED' WHEN NOT p_in_branch THEN 'OUTSIDE_BRANCH' ELSE NULL END;

  -- Record heartbeat
  INSERT INTO employee_location_heartbeat (employee_id, company_id, attendance_log_id, last_seen_at, in_branch, gps_ok, reason)
  VALUES (p_employee_id, v_company_id, p_attendance_log_id, now(), p_in_branch, p_gps_ok, v_reason)
  ON CONFLICT (employee_id) DO UPDATE SET
    attendance_log_id = EXCLUDED.attendance_log_id, last_seen_at = EXCLUDED.last_seen_at,
    in_branch = EXCLUDED.in_branch, gps_ok = EXCLUDED.gps_ok, reason = EXCLUDED.reason;

  -- Check for existing PENDING ONLY (ignore CANCELLED/DONE)
  -- CRITICAL: Search without company_id filter since we already filtered by employee+attendance
  SELECT * INTO v_existing_pending 
  FROM auto_checkout_pending
  WHERE employee_id = p_employee_id 
    AND attendance_log_id = p_attendance_log_id 
    AND status = 'PENDING'
  LIMIT 1;

  RAISE LOG '[HEARTBEAT] employee=%, att=%, inBranch=%, gpsOk=%, found_pending=%, is_problem=%', 
    p_employee_id, p_attendance_log_id, p_in_branch, p_gps_ok, 
    (v_existing_pending.id IS NOT NULL), v_is_problem;

  -- NO problem: RECOVERY - cancel pending and clear violation tracking
  IF NOT v_is_problem THEN
    IF v_existing_pending.id IS NOT NULL THEN
      -- Cancel the active pending
      UPDATE auto_checkout_pending 
      SET status = 'CANCELLED', 
          cancelled_at = now(), 
          cancel_reason = 'RECOVERED'
      WHERE id = v_existing_pending.id
        AND status = 'PENDING';  -- Extra safety check

      -- CRITICAL: Clear violation tracking on attendance_logs to allow future countdowns
      UPDATE attendance_logs
      SET first_location_disabled_detected_at = NULL
      WHERE id = p_attendance_log_id;
      
      RAISE LOG '[AUTO_CHECKOUT] Cancelled pending % and cleared violation tracking - employee recovered', v_existing_pending.id;
      
      -- Frontend expects: pending_cancelled
      RETURN jsonb_build_object(
        'success', true,
        'auto_checkout_enabled', true,
        'pending_cancelled', true,
        'reason', 'RECOVERED'
      );
    END IF;
    
    -- No active pending, employee is fine - also clear tracking
    UPDATE attendance_logs
    SET first_location_disabled_detected_at = NULL
    WHERE id = p_attendance_log_id
      AND first_location_disabled_detected_at IS NOT NULL;
    
    -- Frontend expects: status = 'OK'
    RETURN jsonb_build_object(
      'success', true,
      'auto_checkout_enabled', true,
      'status', 'OK'
    );
  END IF;

  -- Problem exists: check if we should execute or keep waiting
  IF v_existing_pending.id IS NOT NULL THEN
    IF now() >= v_existing_pending.ends_at THEN
      -- Execute checkout
      UPDATE attendance_logs 
      SET check_out_time = now(), 
          check_out_device_time = now(),
          check_out_latitude = p_latitude, 
          check_out_longitude = p_longitude, 
          check_out_accuracy = p_accuracy,
          checkout_type = 'AUTO', 
          checkout_reason = v_existing_pending.reason,
          total_working_hours = EXTRACT(EPOCH FROM (now() - check_in_time)) / 3600.0
      WHERE id = p_attendance_log_id AND check_out_time IS NULL;
      
      UPDATE auto_checkout_pending SET status = 'DONE', done_at = now() WHERE id = v_existing_pending.id;
      
      RAISE LOG '[AUTO_CHECKOUT] Executed auto checkout for pending %', v_existing_pending.id;
      
      -- Frontend expects: auto_checkout_executed
      RETURN jsonb_build_object(
        'success', true,
        'auto_checkout_enabled', true,
        'auto_checkout_executed', true,
        'reason', v_existing_pending.reason
      );
    END IF;
    
    -- Frontend expects: pending_active
    RETURN jsonb_build_object(
      'success', true,
      'auto_checkout_enabled', true,
      'pending_active', true,
      'reason', v_existing_pending.reason,
      'ends_at', v_existing_pending.ends_at,
      'seconds_remaining', EXTRACT(EPOCH FROM (v_existing_pending.ends_at - now()))
    );
  END IF;

  -- Create NEW pending (fresh start) - even if CANCELLED/DONE rows exist
  v_ends_at := now() + (v_settings.auto_checkout_after_seconds || ' seconds')::interval;
  
  INSERT INTO auto_checkout_pending (employee_id, company_id, attendance_log_id, reason, ends_at, status, created_at)
  VALUES (p_employee_id, v_company_id, p_attendance_log_id, v_reason, v_ends_at, 'PENDING', now())
  RETURNING id INTO v_existing_pending;
  
  RAISE LOG '[AUTO_CHECKOUT] Created NEW pending % - reason: %, ends_at: %, can restart multiple times', v_existing_pending.id, v_reason, v_ends_at;
  
  -- Frontend expects: pending_created
  RETURN jsonb_build_object(
    'success', true,
    'auto_checkout_enabled', true,
    'pending_created', true,
    'reason', v_reason,
    'ends_at', v_ends_at,
    'seconds_remaining', v_settings.auto_checkout_after_seconds
  );
END;
$$;

GRANT EXECUTE ON FUNCTION record_heartbeat_and_check_auto_checkout TO anon, authenticated, service_role;
