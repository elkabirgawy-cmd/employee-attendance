/*
  # إضافة بيانات حضور وهمية واقعية لشهر كامل (يناير 2026)

  ## نظرة عامة
  هذا الملف يضيف بيانات حضور وهمية واقعية لشهر يناير 2026 كامل (31 يوم)
  لاختبار نظام التقارير بشكل شامل.

  ## البيانات المضافة
  - عدد الموظفين: 4 موظفين
  - عدد أيام العمل: 22 يوم (من 31 يوم - استثناء الجمعة والسبت)
  - إجمالي السجلات: ~85 سجل حضور
  - الفترة: 2026-01-01 إلى 2026-01-31

  ## السيناريوهات
  - 80% حضور في الوقت
  - 15% متأخر
  - 5% غياب عشوائي
  - ساعات عمل: 7.5 - 10.5 ساعة
*/

DO $$
DECLARE
  v_employees uuid[] := ARRAY[
    '2ecab7e5-a362-42c0-9306-7aa6183aa9bc',
    '3c551b14-a5dd-4d55-8014-62115435cce6',
    '281087ac-ff2b-49d2-9eba-0556ae3d9ef8',
    'e0a52a49-13fc-4db2-be8c-a38fdab3fd4a'
  ];
  v_branches uuid[] := ARRAY[
    'd21a26cd-612b-44ed-b414-56a92fc03f23',
    'dd2cb47f-05b2-468e-8f59-8221cae71e3b'
  ];
  v_current_date date;
  v_employee_id uuid;
  v_branch_id uuid;
  v_device_id uuid;
  v_check_in timestamptz;
  v_check_out timestamptz;
  v_working_hours decimal;
  v_is_late boolean;
  v_status text;
  v_day_of_week int;
  v_random_minutes int;
  v_device_exists boolean;
  v_ip_address inet;
BEGIN
  DELETE FROM attendance_logs 
  WHERE check_in_time >= '2026-01-01' AND check_in_time < '2026-02-01';

  FOR i IN 1..array_length(v_employees, 1) LOOP
    v_employee_id := v_employees[i];
    
    SELECT EXISTS(
      SELECT 1 FROM devices WHERE employee_id = v_employee_id AND is_active = true
    ) INTO v_device_exists;
    
    IF NOT v_device_exists THEN
      INSERT INTO devices (
        employee_id,
        device_id,
        device_name,
        device_model,
        os_type,
        os_version,
        app_version,
        is_rooted_jailbroken,
        is_active
      ) VALUES (
        v_employee_id,
        'dummy_device_' || v_employee_id,
        CASE WHEN i % 2 = 0 THEN 'Samsung Galaxy S21' ELSE 'iPhone 13 Pro' END,
        CASE WHEN i % 2 = 0 THEN 'SM-G991B' ELSE 'iPhone14,3' END,
        CASE WHEN i % 2 = 0 THEN 'android' ELSE 'ios' END,
        CASE WHEN i % 2 = 0 THEN '13.0' ELSE '17.2.1' END,
        '1.0.0',
        false,
        true
      );
    END IF;
  END LOOP;

  FOR day_num IN 1..31 LOOP
    v_current_date := ('2026-01-' || LPAD(day_num::text, 2, '0'))::date;
    v_day_of_week := EXTRACT(DOW FROM v_current_date);
    
    IF v_day_of_week NOT IN (5, 6) THEN
      FOR i IN 1..array_length(v_employees, 1) LOOP
        v_employee_id := v_employees[i];
        v_branch_id := v_branches[1 + (random() * (array_length(v_branches, 1) - 1))::int];
        
        SELECT id INTO v_device_id
        FROM devices
        WHERE employee_id = v_employee_id AND is_active = true
        LIMIT 1;
        
        IF random() < 0.9 THEN
          v_random_minutes := (random() * 90)::int - 15;
          v_check_in := (v_current_date + time '08:00:00' + (v_random_minutes || ' minutes')::interval)::timestamptz;
          v_is_late := v_random_minutes > 15;
          v_working_hours := 7.5 + (random() * 3);
          v_check_out := v_check_in + (v_working_hours || ' hours')::interval;
          v_status := CASE WHEN v_is_late THEN 'late' ELSE 'on_time' END;
          v_ip_address := ('192.168.1.' || (2 + (random() * 253)::int))::inet;
          
          INSERT INTO attendance_logs (
            employee_id,
            branch_id,
            device_id,
            check_in_time,
            check_in_device_time,
            check_in_latitude,
            check_in_longitude,
            check_in_accuracy,
            check_in_ip_address,
            check_out_time,
            check_out_device_time,
            check_out_latitude,
            check_out_longitude,
            check_out_accuracy,
            check_out_ip_address,
            total_working_hours,
            status,
            is_synced,
            checkout_type,
            created_at
          ) VALUES (
            v_employee_id,
            v_branch_id,
            v_device_id,
            v_check_in,
            v_check_in - interval '2 seconds',
            CASE 
              WHEN v_branch_id = 'd21a26cd-612b-44ed-b414-56a92fc03f23' 
              THEN 30.57043 + (random() * 0.0001 - 0.00005)
              ELSE 30.570486 + (random() * 0.0001 - 0.00005)
            END,
            CASE 
              WHEN v_branch_id = 'd21a26cd-612b-44ed-b414-56a92fc03f23' 
              THEN 31.002282 + (random() * 0.0001 - 0.00005)
              ELSE 31.002277 + (random() * 0.0001 - 0.00005)
            END,
            5 + (random() * 45)::decimal,
            v_ip_address,
            v_check_out,
            v_check_out - interval '2 seconds',
            CASE 
              WHEN v_branch_id = 'd21a26cd-612b-44ed-b414-56a92fc03f23' 
              THEN 30.57043 + (random() * 0.0001 - 0.00005)
              ELSE 30.570486 + (random() * 0.0001 - 0.00005)
            END,
            CASE 
              WHEN v_branch_id = 'd21a26cd-612b-44ed-b414-56a92fc03f23' 
              THEN 31.002282 + (random() * 0.0001 - 0.00005)
              ELSE 31.002277 + (random() * 0.0001 - 0.00005)
            END,
            5 + (random() * 45)::decimal,
            v_ip_address,
            v_working_hours,
            v_status,
            true,
            'manual',
            v_check_in
          );
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  RAISE NOTICE 'تم إضافة بيانات حضور وهمية لشهر يناير 2026 بنجاح';
END $$;
