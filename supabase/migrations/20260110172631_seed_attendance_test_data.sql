/*
  # إضافة بيانات حضور تجريبية لأسبوع كامل

  1. البيانات التجريبية
    - سجلات حضور لـ 4 موظفين
    - تغطي فترة 7 أيام (أسبوع كامل)
    - أنواع مختلفة من الحالات:
      * في الوقت المحدد (on_time)
      * متأخر (late)
      * مغادرة مبكرة (early_leave)
    - أوقات دخول وخروج واقعية
    - إحداثيات GPS تجريبية

  2. ملاحظات
    - الأوقات تتنوع بين الموظفين
    - بعض الموظفين يأتون في الوقت المحدد والبعض متأخر
    - ساعات العمل تختلف من يوم لآخر
    - اليوم السابع يحتوي على سجلات دخول فقط بدون خروج (لمحاكاة الواقع)
*/

-- حذف أي بيانات تجريبية سابقة إن وجدت
DELETE FROM attendance_logs WHERE notes = 'test_data';

-- إضافة سجلات الحضور التجريبية
-- الموظف 1: أحمد محمد العلي (EMP001)
INSERT INTO attendance_logs (
  employee_id,
  branch_id,
  check_in_time,
  check_out_time,
  check_in_latitude,
  check_in_longitude,
  check_in_accuracy,
  total_working_hours,
  status,
  notes
) VALUES
  -- اليوم 1 - السبت
  ('e0a52a49-13fc-4db2-be8c-a38fdab3fd4a', 'd21a26cd-612b-44ed-b414-56a92fc03f23',
   NOW() - INTERVAL '6 days' + INTERVAL '8 hours', NOW() - INTERVAL '6 days' + INTERVAL '17 hours', 
   24.7136, 46.6753, 15.5, 9.0, 'on_time', 'test_data'),
  
  -- اليوم 2 - الأحد (متأخر)
  ('e0a52a49-13fc-4db2-be8c-a38fdab3fd4a', 'd21a26cd-612b-44ed-b414-56a92fc03f23',
   NOW() - INTERVAL '5 days' + INTERVAL '8 hours 45 minutes', NOW() - INTERVAL '5 days' + INTERVAL '17 hours 30 minutes',
   24.7138, 46.6755, 12.3, 8.75, 'late', 'test_data'),
  
  -- اليوم 3 - الاثنين
  ('e0a52a49-13fc-4db2-be8c-a38fdab3fd4a', 'd21a26cd-612b-44ed-b414-56a92fc03f23',
   NOW() - INTERVAL '4 days' + INTERVAL '7 hours 55 minutes', NOW() - INTERVAL '4 days' + INTERVAL '17 hours',
   24.7135, 46.6752, 18.2, 9.08, 'on_time', 'test_data'),
  
  -- اليوم 4 - الثلاثاء
  ('e0a52a49-13fc-4db2-be8c-a38fdab3fd4a', 'd21a26cd-612b-44ed-b414-56a92fc03f23',
   NOW() - INTERVAL '3 days' + INTERVAL '8 hours 10 minutes', NOW() - INTERVAL '3 days' + INTERVAL '17 hours 15 minutes',
   24.7137, 46.6754, 14.1, 9.08, 'on_time', 'test_data'),
  
  -- اليوم 5 - الأربعاء
  ('e0a52a49-13fc-4db2-be8c-a38fdab3fd4a', 'd21a26cd-612b-44ed-b414-56a92fc03f23',
   NOW() - INTERVAL '2 days' + INTERVAL '8 hours', NOW() - INTERVAL '2 days' + INTERVAL '17 hours',
   24.7136, 46.6753, 16.8, 9.0, 'on_time', 'test_data'),
  
  -- اليوم 6 - الخميس (مغادرة مبكرة)
  ('e0a52a49-13fc-4db2-be8c-a38fdab3fd4a', 'd21a26cd-612b-44ed-b414-56a92fc03f23',
   NOW() - INTERVAL '1 day' + INTERVAL '8 hours', NOW() - INTERVAL '1 day' + INTERVAL '15 hours 30 minutes',
   24.7136, 46.6753, 13.5, 7.5, 'early_leave', 'test_data'),
  
  -- اليوم 7 - اليوم (لا يزال في العمل)
  ('e0a52a49-13fc-4db2-be8c-a38fdab3fd4a', 'd21a26cd-612b-44ed-b414-56a92fc03f23',
   CURRENT_DATE + INTERVAL '8 hours', NULL,
   24.7136, 46.6753, 11.2, NULL, NULL, 'test_data');

-- الموظف 2: فاطمة خالد السعيد (EMP002)
INSERT INTO attendance_logs (
  employee_id,
  branch_id,
  check_in_time,
  check_out_time,
  check_in_latitude,
  check_in_longitude,
  check_in_accuracy,
  total_working_hours,
  status,
  notes
) VALUES
  -- اليوم 1 - السبت (متأخر)
  ('2ecab7e5-a362-42c0-9306-7aa6183aa9bc', 'd21a26cd-612b-44ed-b414-56a92fc03f23',
   NOW() - INTERVAL '6 days' + INTERVAL '8 hours 30 minutes', NOW() - INTERVAL '6 days' + INTERVAL '17 hours 30 minutes',
   24.7140, 46.6758, 17.3, 9.0, 'late', 'test_data'),
  
  -- اليوم 2 - الأحد
  ('2ecab7e5-a362-42c0-9306-7aa6183aa9bc', 'd21a26cd-612b-44ed-b414-56a92fc03f23',
   NOW() - INTERVAL '5 days' + INTERVAL '8 hours', NOW() - INTERVAL '5 days' + INTERVAL '17 hours',
   24.7138, 46.6756, 14.8, 9.0, 'on_time', 'test_data'),
  
  -- اليوم 3 - الاثنين
  ('2ecab7e5-a362-42c0-9306-7aa6183aa9bc', 'd21a26cd-612b-44ed-b414-56a92fc03f23',
   NOW() - INTERVAL '4 days' + INTERVAL '7 hours 58 minutes', NOW() - INTERVAL '4 days' + INTERVAL '17 hours 5 minutes',
   24.7139, 46.6757, 13.2, 9.12, 'on_time', 'test_data'),
  
  -- اليوم 4 - الثلاثاء
  ('2ecab7e5-a362-42c0-9306-7aa6183aa9bc', 'd21a26cd-612b-44ed-b414-56a92fc03f23',
   NOW() - INTERVAL '3 days' + INTERVAL '8 hours 5 minutes', NOW() - INTERVAL '3 days' + INTERVAL '17 hours 10 minutes',
   24.7141, 46.6759, 15.9, 9.08, 'on_time', 'test_data'),
  
  -- اليوم 5 - الأربعاء (متأخر)
  ('2ecab7e5-a362-42c0-9306-7aa6183aa9bc', 'd21a26cd-612b-44ed-b414-56a92fc03f23',
   NOW() - INTERVAL '2 days' + INTERVAL '9 hours', NOW() - INTERVAL '2 days' + INTERVAL '18 hours',
   24.7140, 46.6758, 16.4, 9.0, 'late', 'test_data'),
  
  -- اليوم 6 - الخميس
  ('2ecab7e5-a362-42c0-9306-7aa6183aa9bc', 'd21a26cd-612b-44ed-b414-56a92fc03f23',
   NOW() - INTERVAL '1 day' + INTERVAL '8 hours', NOW() - INTERVAL '1 day' + INTERVAL '17 hours',
   24.7138, 46.6756, 12.7, 9.0, 'on_time', 'test_data'),
  
  -- اليوم 7 - اليوم (لا يزال في العمل)
  ('2ecab7e5-a362-42c0-9306-7aa6183aa9bc', 'd21a26cd-612b-44ed-b414-56a92fc03f23',
   CURRENT_DATE + INTERVAL '8 hours 10 minutes', NULL,
   24.7138, 46.6756, 14.3, NULL, NULL, 'test_data');

-- الموظف 3: عمر عبدالله القحطاني (EMP003)
INSERT INTO attendance_logs (
  employee_id,
  branch_id,
  check_in_time,
  check_out_time,
  check_in_latitude,
  check_in_longitude,
  check_in_accuracy,
  total_working_hours,
  status,
  notes
) VALUES
  -- اليوم 1 - السبت
  ('3c551b14-a5dd-4d55-8014-62115435cce6', 'd21a26cd-612b-44ed-b414-56a92fc03f23',
   NOW() - INTERVAL '6 days' + INTERVAL '7 hours 55 minutes', NOW() - INTERVAL '6 days' + INTERVAL '17 hours',
   24.7142, 46.6760, 19.1, 9.08, 'on_time', 'test_data'),
  
  -- اليوم 2 - الأحد
  ('3c551b14-a5dd-4d55-8014-62115435cce6', 'd21a26cd-612b-44ed-b414-56a92fc03f23',
   NOW() - INTERVAL '5 days' + INTERVAL '8 hours', NOW() - INTERVAL '5 days' + INTERVAL '17 hours 15 minutes',
   24.7143, 46.6761, 14.5, 9.25, 'on_time', 'test_data'),
  
  -- اليوم 3 - الاثنين (متأخر)
  ('3c551b14-a5dd-4d55-8014-62115435cce6', 'd21a26cd-612b-44ed-b414-56a92fc03f23',
   NOW() - INTERVAL '4 days' + INTERVAL '8 hours 40 minutes', NOW() - INTERVAL '4 days' + INTERVAL '17 hours 30 minutes',
   24.7144, 46.6762, 16.8, 8.83, 'late', 'test_data'),
  
  -- اليوم 4 - الثلاثاء
  ('3c551b14-a5dd-4d55-8014-62115435cce6', 'd21a26cd-612b-44ed-b414-56a92fc03f23',
   NOW() - INTERVAL '3 days' + INTERVAL '8 hours', NOW() - INTERVAL '3 days' + INTERVAL '17 hours',
   24.7142, 46.6760, 15.2, 9.0, 'on_time', 'test_data'),
  
  -- اليوم 5 - الأربعاء
  ('3c551b14-a5dd-4d55-8014-62115435cce6', 'd21a26cd-612b-44ed-b414-56a92fc03f23',
   NOW() - INTERVAL '2 days' + INTERVAL '8 hours 2 minutes', NOW() - INTERVAL '2 days' + INTERVAL '17 hours 5 minutes',
   24.7143, 46.6761, 13.8, 9.05, 'on_time', 'test_data'),
  
  -- اليوم 6 - الخميس
  ('3c551b14-a5dd-4d55-8014-62115435cce6', 'd21a26cd-612b-44ed-b414-56a92fc03f23',
   NOW() - INTERVAL '1 day' + INTERVAL '7 hours 58 minutes', NOW() - INTERVAL '1 day' + INTERVAL '17 hours',
   24.7144, 46.6762, 17.4, 9.03, 'on_time', 'test_data'),
  
  -- اليوم 7 - اليوم (لا يزال في العمل)
  ('3c551b14-a5dd-4d55-8014-62115435cce6', 'd21a26cd-612b-44ed-b414-56a92fc03f23',
   CURRENT_DATE + INTERVAL '7 hours 55 minutes', NULL,
   24.7142, 46.6760, 12.9, NULL, NULL, 'test_data');

-- الموظف 4: نورة إبراهيم المطيري (EMP006)
INSERT INTO attendance_logs (
  employee_id,
  branch_id,
  check_in_time,
  check_out_time,
  check_in_latitude,
  check_in_longitude,
  check_in_accuracy,
  total_working_hours,
  status,
  notes
) VALUES
  -- اليوم 1 - السبت
  ('281087ac-ff2b-49d2-9eba-0556ae3d9ef8', 'd21a26cd-612b-44ed-b414-56a92fc03f23',
   NOW() - INTERVAL '6 days' + INTERVAL '8 hours', NOW() - INTERVAL '6 days' + INTERVAL '17 hours',
   24.7145, 46.6763, 14.7, 9.0, 'on_time', 'test_data'),
  
  -- اليوم 2 - الأحد (متأخر)
  ('281087ac-ff2b-49d2-9eba-0556ae3d9ef8', 'd21a26cd-612b-44ed-b414-56a92fc03f23',
   NOW() - INTERVAL '5 days' + INTERVAL '8 hours 20 minutes', NOW() - INTERVAL '5 days' + INTERVAL '17 hours 20 minutes',
   24.7146, 46.6764, 18.3, 9.0, 'late', 'test_data'),
  
  -- اليوم 3 - الاثنين
  ('281087ac-ff2b-49d2-9eba-0556ae3d9ef8', 'd21a26cd-612b-44ed-b414-56a92fc03f23',
   NOW() - INTERVAL '4 days' + INTERVAL '8 hours', NOW() - INTERVAL '4 days' + INTERVAL '17 hours',
   24.7145, 46.6763, 15.9, 9.0, 'on_time', 'test_data'),
  
  -- اليوم 4 - الثلاثاء
  ('281087ac-ff2b-49d2-9eba-0556ae3d9ef8', 'd21a26cd-612b-44ed-b414-56a92fc03f23',
   NOW() - INTERVAL '3 days' + INTERVAL '7 hours 58 minutes', NOW() - INTERVAL '3 days' + INTERVAL '17 hours 5 minutes',
   24.7147, 46.6765, 13.6, 9.12, 'on_time', 'test_data'),
  
  -- اليوم 5 - الأربعاء
  ('281087ac-ff2b-49d2-9eba-0556ae3d9ef8', 'd21a26cd-612b-44ed-b414-56a92fc03f23',
   NOW() - INTERVAL '2 days' + INTERVAL '8 hours 5 minutes', NOW() - INTERVAL '2 days' + INTERVAL '17 hours 10 minutes',
   24.7145, 46.6763, 16.2, 9.08, 'on_time', 'test_data'),
  
  -- اليوم 6 - الخميس (مغادرة مبكرة)
  ('281087ac-ff2b-49d2-9eba-0556ae3d9ef8', 'd21a26cd-612b-44ed-b414-56a92fc03f23',
   NOW() - INTERVAL '1 day' + INTERVAL '8 hours', NOW() - INTERVAL '1 day' + INTERVAL '16 hours',
   24.7146, 46.6764, 14.1, 8.0, 'early_leave', 'test_data'),
  
  -- اليوم 7 - اليوم (لا يزال في العمل)
  ('281087ac-ff2b-49d2-9eba-0556ae3d9ef8', 'd21a26cd-612b-44ed-b414-56a92fc03f23',
   CURRENT_DATE + INTERVAL '8 hours 5 minutes', NULL,
   24.7145, 46.6763, 15.8, NULL, NULL, 'test_data');
