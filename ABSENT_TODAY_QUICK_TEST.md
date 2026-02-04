# Quick Test Guide: Absent Today Feature

## 🚀 Fast QA Checklist (5 minutes)

### Test 1: Basic Display ✓
```
1. Open admin dashboard
2. Look for "الغياب اليوم" card (second card after attendance)
3. Check color: Green (0) or Amber (>0)

Expected: Card visible with correct styling
```

### Test 2: Modal Opens ✓
```
1. Click the "الغياب اليوم" card
2. Modal should open with title "الموظفون الغائبون اليوم"
3. Check if loading spinner appears briefly
4. Click X or "إغلاق" to close

Expected: Modal opens smoothly, closes properly
```

### Test 3: Timing Logic ✓
```
Before grace + late window (e.g., 9:30 AM for 9:00 AM shift):
1. Check absent count
Expected: 0 or low count

After grace + late window (e.g., 10:30 AM for 9:00 AM shift):
1. Check absent count again
Expected: Count increased (employees now counted)
```

### Test 4: Exclusions Work ✓
```
Setup:
1. Create test employee "Test Employee A"
2. Don't check them in
3. Wait until late window passes
4. Check absent count → Should be 1
5. Approve leave for "Test Employee A" for today
6. Refresh dashboard
Expected: Absent count decreased by 1
```

### Test 5: Multi-Company Isolation ✓
```
If you have access to 2 companies:
1. Login to Company A → Note absent count
2. Login to Company B → Note absent count
3. Verify counts are different (based on each company's data)

Or run automated test:
node test-absent-today-multi-company.mjs
```

---

## 🔧 Quick Settings Check

### View Current Settings
```sql
SELECT
  c.name as company,
  a.grace_period_minutes,
  a.max_late_window_minutes,
  (SELECT COUNT(*) FROM employees WHERE company_id = c.id AND is_active = true) as active_employees
FROM companies c
JOIN application_settings a ON a.company_id = c.id
WHERE c.status = 'active';
```

### Adjust Late Window (if needed)
```sql
-- Make stricter (30 minutes)
UPDATE application_settings
SET max_late_window_minutes = 30
WHERE company_id = 'YOUR-COMPANY-UUID';

-- Make more lenient (120 minutes)
UPDATE application_settings
SET max_late_window_minutes = 120
WHERE company_id = 'YOUR-COMPANY-UUID';
```

---

## 🐛 Quick Troubleshooting

### Count seems wrong?
```sql
-- Check raw data
SELECT
  (SELECT COUNT(*) FROM employees WHERE company_id = 'COMPANY_ID' AND is_active = true) as total_active,
  (SELECT COUNT(DISTINCT employee_id) FROM attendance_logs WHERE company_id = 'COMPANY_ID' AND check_in_time::date = CURRENT_DATE) as checked_in,
  (SELECT COUNT(DISTINCT employee_id) FROM leave_requests WHERE company_id = 'COMPANY_ID' AND status = 'approved' AND start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE) as on_leave,
  (SELECT COUNT(DISTINCT employee_id) FROM free_tasks WHERE company_id = 'COMPANY_ID' AND is_active = true AND start_at::date <= CURRENT_DATE AND end_at::date >= CURRENT_DATE) as on_free_task;
```

### Modal not showing employees?
```javascript
// Browser console
const { data, error } = await supabase.rpc('get_absent_employees_list', {
  p_day: new Date().toISOString().split('T')[0],
  p_company_id: 'YOUR-COMPANY-UUID'
});
console.log('Absent List:', data, 'Error:', error);
```

---

## ✅ Expected Behavior Summary

| Time | Employee Status | Should Count Absent? |
|------|----------------|---------------------|
| Before shift start | Not checked in | ❌ No (too early) |
| Within grace period | Not checked in | ❌ No (grace active) |
| Within late window | Not checked in | ❌ No (buffer active) |
| After late window | Not checked in | ✅ Yes (now absent) |
| Anytime | On approved leave | ❌ No (excluded) |
| Anytime | On free task | ❌ No (excluded) |
| Anytime | Has checked in | ❌ No (present) |
| Anytime | Inactive employee | ❌ No (not counted) |

---

## 📊 Sample Test Data

### Create Test Scenario (SQL)
```sql
-- Assumes you have a company with ID 'test-company-id'

-- Create test employees
INSERT INTO employees (company_id, name, employee_code, is_active, shift_id, branch_id)
VALUES
  ('test-company-id', 'Ahmed Test (Will Check In)', 'TEST001', true, 'shift-id', 'branch-id'),
  ('test-company-id', 'Sara Test (On Leave)', 'TEST002', true, 'shift-id', 'branch-id'),
  ('test-company-id', 'Khaled Test (Free Task)', 'TEST003', true, 'shift-id', 'branch-id'),
  ('test-company-id', 'Fatima Test (Actually Absent)', 'TEST004', true, 'shift-id', 'branch-id'),
  ('test-company-id', 'Ali Test (Inactive)', 'TEST005', false, 'shift-id', 'branch-id');

-- Create leave for Sara
INSERT INTO leave_requests (company_id, employee_id, start_date, end_date, status)
VALUES ('test-company-id', 'sara-employee-id', CURRENT_DATE, CURRENT_DATE, 'approved');

-- Create free task for Khaled
INSERT INTO free_tasks (company_id, employee_id, start_at, end_at, is_active)
VALUES ('test-company-id', 'khaled-employee-id', CURRENT_DATE || ' 08:00:00', CURRENT_DATE || ' 17:00:00', true);

-- Check in Ahmed
INSERT INTO attendance_logs (company_id, employee_id, check_in_time)
VALUES ('test-company-id', 'ahmed-employee-id', NOW());
```

**Expected Absent Count**: 1 (only Fatima)

---

## 🎯 Success Criteria

✅ All tests pass
✅ Modal opens and closes smoothly
✅ Count updates in real-time
✅ Timing logic prevents premature counting
✅ Exclusions work correctly
✅ Multi-company isolation verified
✅ Build succeeds with no errors

---

**Quick Test Status**: Ready for QA
**Estimated Test Time**: 5-10 minutes
