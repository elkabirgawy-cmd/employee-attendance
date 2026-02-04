# Delay Permission - Quick Test Guide 🧪

## Quick Verification Checklist

Use this guide to quickly verify delay permission works correctly after the fix.

---

## ✅ Test 1: Employee Can Submit (2 minutes)

### Steps
1. Open employee app
2. Login as employee
3. Click "طلب إذن تأخير" button
4. Fill form:
   - **Date**: Today
   - **Start time**: 09:00
   - **End time**: 09:30
   - **Reason**: "اختبار النظام"
5. Click "إرسال الطلب"

### Expected Result
```
✅ Success message: "تم إرسال طلب إذن التأخير بنجاح"
✅ Form resets
✅ Switch to "طلباتي" tab automatically
✅ See request with status "قيد المراجعة"
```

### If Fails
Check browser console for error and self-test logs:
```javascript
[INITIAL] Inserting delay permission: {...}
[AUTO-FIX] Insert failed, running self-test...
[SELF-TEST] ...
```

---

## ✅ Test 2: Database Validation (SQL - 1 minute)

### Run in Supabase SQL Editor

```sql
-- Test if employee can submit delay permission
SELECT * FROM test_delay_permission_submission(
  'your-employee-uuid'::uuid,
  'your-company-uuid'::uuid
);
```

### Expected Output
```
test_name        | passed | message
-----------------|--------|---------------------------
Employee Exists  | true   | ✓ Employee found
Employee Active  | true   | ✓ Employee is active
Company ID Match | true   | ✓ Company ID matches
Active Session   | true   | ✓ Active session found
Test Insert      | true   | ✓ Test insert succeeded
```

### If Any Test Fails
The message column shows what's wrong. Fix accordingly:
- **Employee not found**: Create employee record
- **Employee inactive**: Update `is_active = true`
- **No active session**: Employee needs to login
- **Company ID mismatch**: Fix employee's company_id

---

## ✅ Test 3: Admin Approval (2 minutes)

### Steps
1. Login as admin
2. Go to "طلبات إذن التأخير" page
3. Find pending request
4. Click "موافقة" (Approve)

### Expected Result
```
✅ Status changes to "معتمد"
✅ decided_by = admin user ID
✅ decided_at = current timestamp
✅ Employee sees "معتمد" badge when viewing their requests
```

### Verify in Database
```sql
SELECT
  id,
  status,
  decided_by,
  decided_at
FROM delay_permissions
WHERE id = 'request-uuid'
AND status = 'approved'
AND decided_by IS NOT NULL;
```

---

## ✅ Test 4: Duplicate Prevention (1 minute)

### Steps
1. Submit delay permission (if not done already)
2. Try to submit **same** permission again:
   - Same date
   - Same start time
   - Same end time

### Expected Result
```
❌ Error: "يوجد طلب إذن تأخير في نفس اليوم"
OR
❌ Error: "يوجد طلب إذن تأخير متداخل في نفس الوقت"
```

**Note**: The duplicate check happens in TWO places:
1. **Client-side**: Modal checks before submit
2. **Database**: Trigger + unique constraint blocks insert

---

## ✅ Test 5: Payroll Integration (5 minutes)

### Setup
1. Create attendance record with late minutes:
   ```sql
   -- Employee checked in 30 minutes late
   INSERT INTO attendance_logs (
     employee_id,
     company_id,
     check_in_time,
     late_minutes,
     date,
     shift_id
   ) VALUES (
     'employee-uuid',
     'company-uuid',
     '2026-02-01 08:30:00',
     30,
     '2026-02-01',
     'shift-uuid'
   );
   ```

2. Create approved delay permission:
   ```sql
   INSERT INTO delay_permissions (
     employee_id,
     company_id,
     date,
     start_time,
     end_time,
     minutes,
     reason,
     status
   ) VALUES (
     'employee-uuid',
     'company-uuid',
     '2026-02-01',
     '08:00',
     '08:20',
     20,
     'ظرف طارئ',
     'approved'
   );
   ```

### Steps
1. Go to Payroll page
2. Generate payroll for February
3. View employee payroll details
4. Check lateness breakdown

### Expected Result
```
✅ Original late minutes: 30
✅ Approved delay: 20
✅ Net late minutes: 10
✅ Deduction based on 10 minutes only
```

### Verify Calculation
```javascript
// In payroll breakdown metadata:
latenessBreakdown: [
  {
    date: "2026-02-01",
    lateMinutes: 30,
    permissionMinutes: 20,
    netLateMinutes: 10,
    deduction: 5.00,
    ruleApplied: "0-60 minutes: 5 SAR"
  }
]
```

---

## ✅ Test 6: Overlap Detection (2 minutes)

### Steps
1. Submit delay permission:
   - Date: 2026-02-01
   - Time: 09:00 - 09:30
   - Status: pending

2. Try to submit overlapping permission:
   - Date: 2026-02-01
   - Time: 09:15 - 09:45 (overlaps!)

### Expected Result
```
❌ Error: "يوجد طلب إذن تأخير متداخل في نفس الوقت"
```

### Test Overlap Detection Function (SQL)
```sql
SELECT * FROM check_delay_permission_overlap(
  'employee-uuid'::uuid,
  '2026-02-01'::date,
  '09:15'::time,
  '09:45'::time
);
```

**Expected**:
```
has_overlap | overlapping_count | overlapping_ids
------------|-------------------|------------------
true        | 1                 | {uuid-of-existing}
```

---

## ✅ Test 7: Self-Test with Expired Session (3 minutes)

### Setup
1. Login as employee (note: this creates active session)
2. Manually expire session in database:
   ```sql
   UPDATE employee_sessions
   SET expires_at = now() - interval '1 hour'
   WHERE employee_id = 'your-employee-uuid';
   ```

### Steps
1. Try to submit delay permission (WITHOUT refreshing page)
2. Watch browser console

### Expected Result
```
[INITIAL] Inserting delay permission: {...}
Insert error: {...}
[AUTO-FIX] Insert failed, running self-test...
[SELF-TEST] Starting delay permission self-test...
[SELF-TEST] ✓ Found employee session: {id: "...", company_id: "..."}
[SELF-TEST] ✓ Employee found: أحمد محمد
[SELF-TEST] ✓ Employee is active
[SELF-TEST] ✓ Company ID matches
[SELF-TEST] ✗ No active session in employee_sessions table
[AUTO-FIX] Self-test failed: جلسة الموظف منتهية. الرجاء تسجيل الدخول مرة أخرى

UI shows: ❌ "جلسة الموظف منتهية. الرجاء تسجيل الدخول مرة أخرى"
```

### Cleanup
```sql
-- Restore session
UPDATE employee_sessions
SET expires_at = now() + interval '24 hours'
WHERE employee_id = 'your-employee-uuid';
```

---

## ✅ Test 8: New Company Registration (5 minutes)

### Steps
1. Register new company
2. Create first employee
3. Employee logs in
4. Submit delay permission

### Expected Result
```
✅ No setup required
✅ Insert succeeds immediately
✅ RLS allows access
✅ Status: "pending"
✅ Message: "تم إرسال طلب إذن التأخير بنجاح"
```

**Important**: This tests that new companies work out-of-the-box with NO manual configuration.

---

## ✅ Test 9: Multi-Tenant Isolation (3 minutes)

### Setup
- Company A: employee-a-uuid
- Company B: employee-b-uuid

### Steps
1. Login as employee from Company A
2. Submit delay permission
3. Try to view Company B's delay permissions (manual SQL):
   ```sql
   SELECT * FROM delay_permissions
   WHERE company_id = 'company-b-uuid';
   ```

### Expected Result (as anonymous user)
```
✅ Query returns 0 rows (RLS blocks cross-company access)
```

### Verify RLS Works
```sql
-- As employee from Company A, try to insert for Company B
INSERT INTO delay_permissions (
  employee_id, -- employee from Company A
  company_id,  -- Company B's ID (WRONG!)
  date,
  start_time,
  end_time,
  minutes,
  reason,
  status
) VALUES (...);
```

**Expected**: ❌ RLS policy violation (company_id mismatch)

---

## 🔍 Quick Diagnostic Commands

### Check Employee Status
```sql
SELECT
  e.id,
  e.full_name,
  e.company_id,
  e.is_active,
  c.name as company_name,
  es.expires_at as session_expires
FROM employees e
JOIN companies c ON c.id = e.company_id
LEFT JOIN employee_sessions es ON es.employee_id = e.id
WHERE e.id = 'employee-uuid';
```

### Check Delay Permission Status
```sql
SELECT
  dp.id,
  e.full_name,
  dp.date,
  dp.start_time || ' - ' || dp.end_time as time_range,
  dp.minutes,
  dp.status,
  dp.reason,
  a.full_name as decided_by_admin,
  dp.decided_at
FROM delay_permissions dp
JOIN employees e ON e.id = dp.employee_id
LEFT JOIN admin_users a ON a.id = dp.decided_by
WHERE dp.company_id = 'company-uuid'
ORDER BY dp.created_at DESC
LIMIT 10;
```

### Check RLS Policies
```sql
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'delay_permissions'
ORDER BY policyname;
```

---

## 📊 Success Criteria

All tests should pass:
- ✅ Test 1: Employee can submit
- ✅ Test 2: Database validation passes
- ✅ Test 3: Admin can approve
- ✅ Test 4: Duplicates prevented
- ✅ Test 5: Payroll calculates correctly
- ✅ Test 6: Overlaps detected
- ✅ Test 7: Self-test works
- ✅ Test 8: New company works
- ✅ Test 9: Multi-tenant isolated

---

## 🐛 Common Issues & Fixes

### Issue 1: "لا توجد جلسة موظف نشطة"
**Cause**: No active session in employee_sessions table
**Fix**: Employee needs to login again

### Issue 2: "حساب الموظف غير نشط"
**Cause**: Employee is_active = false
**Fix**:
```sql
UPDATE employees
SET is_active = true
WHERE id = 'employee-uuid';
```

### Issue 3: "عدم تطابق معرف الشركة"
**Cause**: Employee's company_id doesn't match provided company_id
**Fix**: Verify and correct company_id

### Issue 4: Insert fails with no clear message
**Cause**: RLS policy blocking
**Fix**: Check employee_sessions exists and is not expired

---

## 🎯 Quick 30-Second Test

**Fastest way to verify it works**:

```sql
-- 1. Check employee can submit (should return all true)
SELECT * FROM test_delay_permission_submission(
  'employee-uuid'::uuid,
  'company-uuid'::uuid
);

-- 2. If all true, system is working correctly! ✅
```

---

## 📝 Test Checklist

Print and check off:

```
□ Employee can submit delay permission
□ Database validation works
□ Admin can approve/reject
□ Duplicates are prevented
□ Overlaps are detected
□ Payroll excludes approved delays
□ Self-test diagnoses issues
□ New companies work immediately
□ Multi-tenant isolation works
□ Clear Arabic error messages
```

**All checked? System is ready for production! 🚀**
