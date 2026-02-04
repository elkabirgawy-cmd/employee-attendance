/*
  # إصلاح شامل لإعادة استخدام العد التنازلي

  ## المشكلة
  عند الخروج من الفرع مرة أخرى بعد العودة، يبدأ العد التنازلي من الوقت المتبقي
  من المرة السابقة بدلاً من البدء من الوقت الكامل.

  ## السبب المحتمل
  قد يكون هناك سجل PENDING قديم لم يتم إلغاؤه (ربما لأن heartbeat لم يُرسل
  عند العودة للفرع). عند الخروج مرة أخرى، يجد النظام السجل القديم ويستخدمه.

  ## الحل
  عند اكتشاف مشكلة (خارج الفرع أو GPS مغلق):
  1. إذا وُجدت سجلات CANCELLED سابقة، هذا يعني أن الموظف عاد ثم خرج مرة أخرى
  2. في هذه الحالة، احذف جميع السجلات (PENDING و CANCELLED)
  3. أنشئ سجل PENDING جديد تماماً بوقت كامل من البداية
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
  v_has_cancelled_entries boolean;
  v_is_problem boolean;
  v_reason text;
  v_ends_at timestamptz;
  v_should_checkout boolean := false;
BEGIN
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

  -- Get auto checkout settings for this company
  SELECT * INTO v_settings
  FROM auto_checkout_settings
  WHERE company_id = v_company_id
  LIMIT 1;

  -- If no settings or auto checkout disabled, just record heartbeat and exit
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
      'auto_checkout_enabled', false,
      'heartbeat_recorded', true
    );
  END IF;

  -- Determine if there's a problem
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

  -- Upsert heartbeat
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

  -- Check for existing pending auto checkout
  SELECT * INTO v_existing_pending
  FROM auto_checkout_pending
  WHERE employee_id = p_employee_id
    AND attendance_log_id = p_attendance_log_id
    AND status = 'PENDING'
  LIMIT 1;

  -- Check if there are any cancelled entries (indicates recovery happened)
  SELECT EXISTS(
    SELECT 1
    FROM auto_checkout_pending
    WHERE employee_id = p_employee_id
      AND attendance_log_id = p_attendance_log_id
      AND status = 'CANCELLED'
    LIMIT 1
  ) INTO v_has_cancelled_entries;

  -- If no problem now, cancel any existing pending checkout
  IF NOT v_is_problem THEN
    IF v_existing_pending IS NOT NULL THEN
      UPDATE auto_checkout_pending
      SET status = 'CANCELLED',
          cancelled_at = now(),
          cancel_reason = 'RECOVERED'
      WHERE id = v_existing_pending.id;

      RETURN jsonb_build_object(
        'success', true,
        'auto_checkout_enabled', true,
        'pending_cancelled', true,
        'reason', 'RECOVERED'
      );
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'auto_checkout_enabled', true,
      'status', 'OK'
    );
  END IF;

  -- There IS a problem
  
  -- CRITICAL FIX: If we have cancelled entries, this means the employee
  -- returned and left again. We must start fresh, not resume old countdown.
  IF v_has_cancelled_entries AND v_existing_pending IS NOT NULL THEN
    -- Delete the old PENDING entry (it's stale from before recovery)
    DELETE FROM auto_checkout_pending
    WHERE id = v_existing_pending.id;
    
    -- Also delete all CANCELLED entries
    DELETE FROM auto_checkout_pending
    WHERE employee_id = p_employee_id
      AND attendance_log_id = p_attendance_log_id
      AND status = 'CANCELLED';
    
    -- Reset so we create a fresh entry below
    v_existing_pending := NULL;
  END IF;

  -- If no pending entry exists, create one
  IF v_existing_pending IS NULL THEN
    -- Clean up any remaining old entries
    DELETE FROM auto_checkout_pending
    WHERE employee_id = p_employee_id
      AND attendance_log_id = p_attendance_log_id;

    -- Create new pending entry with FRESH ends_at from NOW
    v_ends_at := now() + (v_settings.auto_checkout_after_seconds || ' seconds')::interval;

    INSERT INTO auto_checkout_pending (
      employee_id,
      company_id,
      attendance_log_id,
      reason,
      ends_at,
      status
    ) VALUES (
      p_employee_id,
      v_company_id,
      p_attendance_log_id,
      v_reason,
      v_ends_at,
      'PENDING'
    );

    RETURN jsonb_build_object(
      'success', true,
      'auto_checkout_enabled', true,
      'pending_created', true,
      'reason', v_reason,
      'ends_at', v_ends_at
    );
  END IF;

  -- Pending entry exists, check if it's time to execute
  IF now() >= v_existing_pending.ends_at THEN
    v_should_checkout := true;
  END IF;

  IF v_should_checkout THEN
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

    RETURN jsonb_build_object(
      'success', true,
      'auto_checkout_enabled', true,
      'auto_checkout_executed', true,
      'reason', v_existing_pending.reason
    );
  END IF;

  -- Pending exists but not yet time to execute
  RETURN jsonb_build_object(
    'success', true,
    'auto_checkout_enabled', true,
    'pending_active', true,
    'reason', v_existing_pending.reason,
    'ends_at', v_existing_pending.ends_at,
    'seconds_remaining', EXTRACT(EPOCH FROM (v_existing_pending.ends_at - now()))
  );
END;
$$;

GRANT EXECUTE ON FUNCTION record_heartbeat_and_check_auto_checkout(uuid, uuid, boolean, boolean, numeric, numeric, numeric) TO anon, authenticated;