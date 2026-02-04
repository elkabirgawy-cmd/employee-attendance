/*
  # إصلاح المشكلة الحقيقية: Multiple Check-ins في نفس اليوم
  
  ## المشكلة المُكتشفة
  - NEW_TENANT لديه 17 open sessions لنفس الموظف في نفس اليوم
  - `.maybeSingle()` يرجع NULL عندما يكون هناك أكثر من صف واحد
  - Frontend يعتقد أن الموظف NOT checked-in ويسمح بتسجيل حضور جديد
  - الحلقة تستمر: check-in → null → check-in → null
  
  ## الإصلاح
  1. تنظيف السجلات المكررة (keep only the latest)
  2. إضافة helper functions للتحقق والاسترجاع
  3. منع multiple check-ins via validation
  
  ## النتيجة
  - كل موظف يمكن أن يكون له open session واحد فقط في اليوم
  - State restoration يعمل بشكل صحيح لكل الشركات
*/

-- =====================================================
-- 1) Clean up duplicate open sessions
-- =====================================================

-- Close all duplicate open sessions, keeping only the LATEST one per employee per day
WITH ranked_sessions AS (
  SELECT 
    al.id,
    al.employee_id,
    al.company_id,
    al.check_in_time::date as check_in_date,
    al.check_in_time,
    ROW_NUMBER() OVER (
      PARTITION BY al.employee_id, al.company_id, al.check_in_time::date
      ORDER BY al.check_in_time DESC
    ) as rn
  FROM attendance_logs al
  WHERE al.check_out_time IS NULL
),
sessions_to_close AS (
  SELECT id
  FROM ranked_sessions
  WHERE rn > 1
)
UPDATE attendance_logs
SET 
  check_out_time = check_in_time + INTERVAL '1 second',
  checkout_type = 'AUTO',
  checkout_reason = 'Duplicate session cleanup - kept only latest'
WHERE id IN (SELECT id FROM sessions_to_close);

-- Log the cleanup
DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM attendance_logs
  WHERE checkout_reason = 'Duplicate session cleanup - kept only latest';
  
  RAISE NOTICE '✅ Cleaned up % duplicate open sessions', v_count;
END $$;

-- =====================================================
-- 2) Create helper function to check for existing open session
-- =====================================================

CREATE OR REPLACE FUNCTION has_open_session_today(emp_id uuid, comp_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS(
    SELECT 1 
    FROM attendance_logs
    WHERE employee_id = emp_id
      AND company_id = comp_id
      AND check_in_time::date = CURRENT_DATE
      AND check_out_time IS NULL
  );
$$;

-- =====================================================
-- 3) Create function to get current open session (use this instead of maybeSingle)
-- =====================================================

CREATE OR REPLACE FUNCTION get_open_session_today(emp_id uuid, comp_id uuid)
RETURNS TABLE (
  id uuid,
  check_in_time timestamptz,
  check_out_time timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT 
    al.id,
    al.check_in_time,
    al.check_out_time
  FROM attendance_logs al
  WHERE al.employee_id = emp_id
    AND al.company_id = comp_id
    AND al.check_in_time::date = CURRENT_DATE
    AND al.check_out_time IS NULL
  ORDER BY al.check_in_time DESC
  LIMIT 1;
$$;

-- =====================================================
-- 4) Add trigger to prevent multiple open sessions
-- =====================================================

CREATE OR REPLACE FUNCTION prevent_duplicate_open_session()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if employee already has an open session today
  IF EXISTS(
    SELECT 1
    FROM attendance_logs
    WHERE employee_id = NEW.employee_id
      AND company_id = NEW.company_id
      AND check_in_time::date = NEW.check_in_time::date
      AND check_out_time IS NULL
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) THEN
    RAISE EXCEPTION 'Employee already has an open session today. Please check-out first.';
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_prevent_duplicate_open_session ON attendance_logs;

CREATE TRIGGER trigger_prevent_duplicate_open_session
BEFORE INSERT OR UPDATE ON attendance_logs
FOR EACH ROW
WHEN (NEW.check_out_time IS NULL)
EXECUTE FUNCTION prevent_duplicate_open_session();

-- =====================================================
-- 5) Verify the fix
-- =====================================================

DO $$
DECLARE
  v_total_companies integer;
  v_companies_with_duplicates integer;
  v_total_duplicates integer;
BEGIN
  -- Count total duplicates
  SELECT COUNT(*) INTO v_total_duplicates
  FROM (
    SELECT employee_id, company_id, check_in_time::date as day, COUNT(*) as open_count
    FROM attendance_logs
    WHERE check_out_time IS NULL
    GROUP BY employee_id, company_id, check_in_time::date
    HAVING COUNT(*) > 1
  ) duplicates;
  
  -- Count companies with duplicates
  SELECT COUNT(DISTINCT company_id) INTO v_companies_with_duplicates
  FROM (
    SELECT employee_id, company_id, check_in_time::date as day, COUNT(*) as open_count
    FROM attendance_logs
    WHERE check_out_time IS NULL
    GROUP BY employee_id, company_id, check_in_time::date
    HAVING COUNT(*) > 1
  ) duplicates;
  
  SELECT COUNT(*) INTO v_total_companies FROM companies WHERE status = 'active';
  
  IF v_companies_with_duplicates = 0 THEN
    RAISE NOTICE '✅ SUCCESS: No companies have duplicate open sessions';
    RAISE NOTICE '✅ All % companies are clean', v_total_companies;
  ELSE
    RAISE NOTICE '⚠️ WARNING: % companies still have % duplicate sessions', v_companies_with_duplicates, v_total_duplicates;
  END IF;
END $$;

-- =====================================================
-- END OF MIGRATION
-- =====================================================
