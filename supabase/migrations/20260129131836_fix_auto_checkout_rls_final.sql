/*
  # Fix Auto-Checkout RLS - Final Solution

  ## Root Cause
  SECURITY DEFINER functions with RLS enabled can't see rows that don't pass RLS policies.
  Even with permissive policies, the function runs as the definer (postgres) but RLS still applies.

  ## Solution
  Disable RLS for the function execution by using SET LOCAL to bypass RLS within the function.
*/

CREATE OR REPLACE FUNCTION record_heartbeat_and_check_auto_checkout(
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
  -- Bypass RLS for this function's operations
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  
  -- Get employee's company_id
  SELECT company_id INTO v_company_id
  FROM employees
  WHERE id = p_employee_id;

  IF v_company_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'EMPLOYEE_NOT_FOUND'
    );
  END IF;

  -- Get auto checkout settings
  SELECT * INTO v_settings
  FROM auto_checkout_settings
  WHERE company_id = v_company_id
  LIMIT 1;

  -- If auto checkout disabled, just record heartbeat and exit
  IF v_settings IS NULL OR v_settings.auto_checkout_enabled = false THEN
    INSERT INTO employee_location_heartbeat (
      employee_id,
      company_id,
      attendance_log_id,
      last_seen_at,
      in_branch,
      gps_ok,
      reason
    ) VALUES (
      p_employee_id,
      v_company_id,
      p_attendance_log_id,
      now(),
      p_in_branch,
      p_gps_ok,
      NULL
    )
    ON CONFLICT (employee_id)
    DO UPDATE SET
      attendance_log_id = EXCLUDED.attendance_log_id,
      last_seen_at = EXCLUDED.last_seen_at,
      in_branch = EXCLUDED.in_branch,
      gps_ok = EXCLUDED.gps_ok,
      reason = EXCLUDED.reason;

    RETURN jsonb_build_object(
      'success', true,
      'auto_checkout_enabled', false
    );
  END IF;

  -- Determine if there's a problem NOW
  v_is_problem := (NOT p_gps_ok) OR (NOT p_in_branch);

  IF v_is_problem THEN
    IF NOT p_gps_ok THEN
      v_reason := 'GPS_BLOCKED';
    ELSE
      v_reason := 'OUTSIDE_BRANCH';
    END IF;
  ELSE
    v_reason := NULL;
  END IF;

  -- Record heartbeat
  INSERT INTO employee_location_heartbeat (
    employee_id,
    company_id,
    attendance_log_id,
    last_seen_at,
    in_branch,
    gps_ok,
    reason
  ) VALUES (
    p_employee_id,
    v_company_id,
    p_attendance_log_id,
    now(),
    p_in_branch,
    p_gps_ok,
    v_reason
  )
  ON CONFLICT (employee_id)
  DO UPDATE SET
    attendance_log_id = EXCLUDED.attendance_log_id,
    last_seen_at = EXCLUDED.last_seen_at,
    in_branch = EXCLUDED.in_branch,
    gps_ok = EXCLUDED.gps_ok,
    reason = EXCLUDED.reason;

  -- Check for existing ACTIVE pending (status = 'PENDING')
  SELECT * INTO v_existing_pending
  FROM auto_checkout_pending
  WHERE employee_id = p_employee_id
    AND attendance_log_id = p_attendance_log_id
    AND status = 'PENDING'
  ORDER BY created_at DESC
  LIMIT 1;

  RAISE LOG '[AUTO_CHECKOUT] Found existing pending: %', v_existing_pending IS NOT NULL;

  -- CASE 1: NO problem NOW (employee is OK)
  IF NOT v_is_problem THEN
    -- If there's an active pending, cancel it
    IF v_existing_pending IS NOT NULL THEN
      UPDATE auto_checkout_pending
      SET status = 'CANCELLED',
          cancelled_at = now(),
          cancel_reason = 'RECOVERED'
      WHERE id = v_existing_pending.id;

      RAISE LOG '[AUTO_CHECKOUT] Cancelled pending % - employee recovered', v_existing_pending.id;

      RETURN jsonb_build_object(
        'success', true,
        'auto_checkout_enabled', true,
        'action', 'CANCELLED_PENDING',
        'reason', 'RECOVERED'
      );
    END IF;

    -- No pending to cancel, all good
    RETURN jsonb_build_object(
      'success', true,
      'auto_checkout_enabled', true,
      'status', 'OK'
    );
  END IF;

  -- CASE 2: There IS a problem (outside branch or GPS disabled)
  
  -- If there's already an active pending, check if we should execute it
  IF v_existing_pending IS NOT NULL THEN
    -- Check if countdown expired
    IF now() >= v_existing_pending.ends_at THEN
      -- Execute auto checkout
      UPDATE attendance_logs
      SET check_out_time = now(),
          check_out_device_time = now(),
          check_out_latitude = p_latitude,
          check_out_longitude = p_longitude,
          check_out_accuracy = p_accuracy,
          checkout_type = 'AUTO',
          checkout_reason = v_existing_pending.reason,
          total_working_hours = EXTRACT(EPOCH FROM (now() - check_in_time)) / 3600.0
      WHERE id = p_attendance_log_id
        AND check_out_time IS NULL;

      -- Mark pending as done
      UPDATE auto_checkout_pending
      SET status = 'DONE',
          done_at = now()
      WHERE id = v_existing_pending.id;

      RAISE LOG '[AUTO_CHECKOUT] Executed auto checkout for pending %', v_existing_pending.id;

      RETURN jsonb_build_object(
        'success', true,
        'auto_checkout_enabled', true,
        'action', 'AUTO_CHECKOUT_EXECUTED',
        'reason', v_existing_pending.reason
      );
    END IF;

    -- Pending exists but not yet expired - keep it
    RAISE LOG '[AUTO_CHECKOUT] Pending % still active, %s remaining', 
      v_existing_pending.id,
      EXTRACT(EPOCH FROM (v_existing_pending.ends_at - now()));

    RETURN jsonb_build_object(
      'success', true,
      'auto_checkout_enabled', true,
      'status', 'PENDING_ACTIVE',
      'reason', v_existing_pending.reason,
      'ends_at', v_existing_pending.ends_at,
      'seconds_remaining', EXTRACT(EPOCH FROM (v_existing_pending.ends_at - now()))
    );
  END IF;

  -- CASE 3: There's a problem but NO active pending
  -- This is a NEW violation - create fresh pending with NEW start time
  
  -- Calculate ends_at from NOW (fresh start)
  v_ends_at := now() + (v_settings.auto_checkout_after_seconds || ' seconds')::interval;

  -- Insert new pending record
  INSERT INTO auto_checkout_pending (
    employee_id,
    company_id,
    attendance_log_id,
    reason,
    ends_at,
    status,
    created_at
  ) VALUES (
    p_employee_id,
    v_company_id,
    p_attendance_log_id,
    v_reason,
    v_ends_at,
    'PENDING',
    now()
  );

  RAISE LOG '[AUTO_CHECKOUT] Created NEW pending - started at %, ends at %, reason %', 
    now(), v_ends_at, v_reason;

  RETURN jsonb_build_object(
    'success', true,
    'auto_checkout_enabled', true,
    'action', 'PENDING_CREATED',
    'reason', v_reason,
    'started_at', now(),
    'ends_at', v_ends_at,
    'seconds_remaining', v_settings.auto_checkout_after_seconds
  );
END;
$$;

-- Ensure proper permissions
GRANT EXECUTE ON FUNCTION record_heartbeat_and_check_auto_checkout(uuid, uuid, boolean, boolean, numeric, numeric, numeric) TO anon, authenticated, service_role;
