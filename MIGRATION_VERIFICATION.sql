-- ============================================
-- POST-MIGRATION VERIFICATION QUERIES
-- Run these in Supabase SQL Editor after migration
-- ============================================

-- ============================================
-- 1. ROW COUNT VERIFICATION
-- ============================================
-- Compare these counts with your Bolt database
SELECT
  schemaname,
  tablename,
  n_live_tup as row_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- ============================================
-- 2. DETAILED TABLE COUNTS
-- ============================================
SELECT 'admin_users' as table_name, COUNT(*) as count FROM admin_users
UNION ALL
SELECT 'activation_codes', COUNT(*) FROM activation_codes
UNION ALL
SELECT 'application_settings', COUNT(*) FROM application_settings
UNION ALL
SELECT 'attendance_logs', COUNT(*) FROM attendance_logs
UNION ALL
SELECT 'auto_checkout_pending', COUNT(*) FROM auto_checkout_pending
UNION ALL
SELECT 'auto_checkout_settings', COUNT(*) FROM auto_checkout_settings
UNION ALL
SELECT 'branches', COUNT(*) FROM branches
UNION ALL
SELECT 'device_approvals', COUNT(*) FROM device_approvals
UNION ALL
SELECT 'employee_logins', COUNT(*) FROM employee_logins
UNION ALL
SELECT 'employees', COUNT(*) FROM employees
UNION ALL
SELECT 'fraud_alerts', COUNT(*) FROM fraud_alerts
UNION ALL
SELECT 'generated_reports', COUNT(*) FROM generated_reports
UNION ALL
SELECT 'leave_balances', COUNT(*) FROM leave_balances
UNION ALL
SELECT 'leave_requests', COUNT(*) FROM leave_requests
UNION ALL
SELECT 'leave_types', COUNT(*) FROM leave_types
UNION ALL
SELECT 'payroll_records', COUNT(*) FROM payroll_records
UNION ALL
SELECT 'push_notification_tokens', COUNT(*) FROM push_notification_tokens
UNION ALL
SELECT 'push_notifications', COUNT(*) FROM push_notifications
UNION ALL
SELECT 'shifts', COUNT(*) FROM shifts
UNION ALL
SELECT 'time_sync_logs', COUNT(*) FROM time_sync_logs
UNION ALL
SELECT 'timezone_detection_logs', COUNT(*) FROM timezone_detection_logs
UNION ALL
SELECT 'timezone_policy_settings', COUNT(*) FROM timezone_policy_settings
ORDER BY table_name;

-- ============================================
-- 3. VERIFY FOREIGN KEY CONSTRAINTS
-- ============================================
-- Ensure all relationships are intact
SELECT
  tc.table_name,
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_name;

-- ============================================
-- 4. VERIFY INDEXES
-- ============================================
-- Check all indexes are created
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- ============================================
-- 5. VERIFY RLS POLICIES
-- ============================================
-- Ensure Row Level Security is configured
SELECT
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- Detailed RLS policies
SELECT
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  LEFT(qual::text, 50) as condition_preview
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ============================================
-- 6. VERIFY TRIGGERS
-- ============================================
-- Check all triggers are active
SELECT
  event_object_table AS table_name,
  trigger_name,
  event_manipulation AS event,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- ============================================
-- 7. VERIFY DATABASE FUNCTIONS
-- ============================================
-- List all custom functions
SELECT
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname NOT LIKE 'pg_%'
ORDER BY function_name;

-- ============================================
-- 8. VERIFY SEQUENCES
-- ============================================
-- Check that sequences are properly set
SELECT
  schemaname,
  sequencename,
  last_value,
  is_called
FROM pg_sequences
WHERE schemaname = 'public'
ORDER BY sequencename;

-- ============================================
-- 9. CHECK FOR ORPHANED RECORDS
-- ============================================
-- Verify foreign key integrity

-- Employees without branches
SELECT COUNT(*) as orphaned_employees
FROM employees
WHERE branch_id NOT IN (SELECT id FROM branches);

-- Attendance logs without employees
SELECT COUNT(*) as orphaned_attendance
FROM attendance_logs
WHERE employee_id NOT IN (SELECT id FROM employees);

-- Attendance logs without branches
SELECT COUNT(*) as orphaned_attendance_no_branch
FROM attendance_logs
WHERE branch_id NOT IN (SELECT id FROM branches);

-- Leave requests without employees
SELECT COUNT(*) as orphaned_leave_requests
FROM leave_requests
WHERE employee_id NOT IN (SELECT id FROM employees);

-- Payroll records without employees
SELECT COUNT(*) as orphaned_payroll
FROM payroll_records
WHERE employee_id NOT IN (SELECT id FROM employees);

-- ============================================
-- 10. VERIFY DATA INTEGRITY
-- ============================================
-- Check for NULL values in critical columns

-- Employees with missing data
SELECT
  COUNT(*) as total_employees,
  COUNT(CASE WHEN full_name IS NULL THEN 1 END) as missing_name,
  COUNT(CASE WHEN phone IS NULL THEN 1 END) as missing_phone,
  COUNT(CASE WHEN branch_id IS NULL THEN 1 END) as missing_branch
FROM employees;

-- Attendance logs with missing data
SELECT
  COUNT(*) as total_attendance,
  COUNT(CASE WHEN employee_id IS NULL THEN 1 END) as missing_employee,
  COUNT(CASE WHEN check_in_time IS NULL THEN 1 END) as missing_checkin,
  COUNT(CASE WHEN branch_id IS NULL THEN 1 END) as missing_branch
FROM attendance_logs;

-- ============================================
-- 11. SAMPLE DATA VERIFICATION
-- ============================================
-- View sample records from key tables

-- Sample admin users
SELECT id, email, full_name, created_at
FROM admin_users
LIMIT 5;

-- Sample employees
SELECT id, full_name, phone, branch_id, hire_date, is_active
FROM employees
LIMIT 5;

-- Sample branches
SELECT id, name, latitude, longitude, radius_meters, is_active
FROM branches
LIMIT 5;

-- Recent attendance logs
SELECT
  id,
  employee_id,
  branch_id,
  check_in_time,
  check_out_time,
  checkout_type
FROM attendance_logs
ORDER BY check_in_time DESC
LIMIT 10;

-- ============================================
-- 12. VERIFY UNIQUE CONSTRAINTS
-- ============================================
-- Check for duplicate values that should be unique

-- Duplicate emails in admin_users
SELECT email, COUNT(*) as count
FROM admin_users
GROUP BY email
HAVING COUNT(*) > 1;

-- Duplicate phone numbers in employees
SELECT phone, COUNT(*) as count
FROM employees
WHERE phone IS NOT NULL
GROUP BY phone
HAVING COUNT(*) > 1;

-- ============================================
-- 13. CHECK TABLE SIZES
-- ============================================
-- Verify tables are not empty when they shouldn't be
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
  pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- ============================================
-- 14. VERIFY DATE RANGES
-- ============================================
-- Check that dates are reasonable

-- Employee hire dates
SELECT
  MIN(hire_date) as earliest_hire,
  MAX(hire_date) as latest_hire,
  COUNT(*) as total_employees
FROM employees
WHERE hire_date IS NOT NULL;

-- Attendance log date range
SELECT
  MIN(check_in_time) as earliest_attendance,
  MAX(check_in_time) as latest_attendance,
  COUNT(*) as total_logs
FROM attendance_logs;

-- Leave request date range
SELECT
  MIN(start_date) as earliest_leave,
  MAX(end_date) as latest_leave,
  COUNT(*) as total_requests
FROM leave_requests;

-- ============================================
-- 15. FINAL CHECKLIST SUMMARY
-- ============================================
SELECT
  'Tables' as check_type,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public') as count,
  '22 expected' as expected
UNION ALL
SELECT
  'Foreign Keys',
  (SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public'),
  'Multiple expected'
UNION ALL
SELECT
  'Indexes',
  (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public'),
  'Multiple expected'
UNION ALL
SELECT
  'RLS Policies',
  (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public'),
  'Multiple expected'
UNION ALL
SELECT
  'Triggers',
  (SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_schema = 'public'),
  'Multiple expected'
UNION ALL
SELECT
  'Functions',
  (SELECT COUNT(*) FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public'),
  'Multiple expected';

-- ============================================
-- NOTES:
-- ============================================
-- ✅ All row counts should match your Bolt database
-- ✅ No orphaned records (0 in all orphaned checks)
-- ✅ No duplicate values in unique columns
-- ✅ All foreign key constraints should exist
-- ✅ RLS policies should be present for all tables
-- ✅ Sequences should have reasonable last_value
-- ✅ Date ranges should be realistic
-- ============================================
