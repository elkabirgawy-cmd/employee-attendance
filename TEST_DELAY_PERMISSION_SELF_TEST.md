# Testing Guide: Delay Permission Self-Test System

## Quick Start Testing

This guide helps you test the delay permission self-test and auto-fix system.

---

## Test Scenario 1: Normal Operation (Old Company) ✅

### Setup
Login as employee in existing company with active session.

### Steps
1. Open employee app
2. Click delay permission button
3. Fill form:
   - Date: Today
   - Start time: 09:00
   - End time: 09:30
   - Reason: "اختبار عادي"
4. Click submit

### Expected Result
✅ **Success message immediately**: "تم إرسال طلب إذن التأخير بنجاح"

### Validation
```sql
-- Check permission was created
SELECT * FROM delay_permissions
WHERE employee_id = 'your-employee-id'
ORDER BY created_at DESC
LIMIT 1;
```

### Console Logs
```
[INITIAL] Inserting delay permission: {...}
Permission inserted successfully: {...}
```

---

## Test Scenario 2: Trigger Validation (Invalid Data) 🛡️

### Setup
Manually attempt insert with invalid company_id.

### SQL Test
```sql
-- This should fail with clear message
SELECT * FROM test_delay_permission_insert(
  'existing-employee-id'::uuid,
  'wrong-company-id'::uuid
);
```

### Expected Result
```
success | message              | error_detail
--------|---------------------|-------------
false   | Test insert failed  | Company ID mismatch: employee belongs to company xxx, but delay permission is for company yyy
```

### Validation
Trigger prevents bad data from entering database.

---

## Test Scenario 3: Self-Test with Expired Session 🔧❌

### Setup
1. Login as employee
2. Manually expire session in database:

```sql
UPDATE employee_sessions
SET expires_at = now() - interval '1 hour'
WHERE employee_id = 'your-employee-id';
```

### Steps
1. Try to submit delay permission (without refreshing app)
2. Watch for self-test

### Expected Result
1. First insert fails
2. Error message: "🔧 جاري التشخيص التلقائي..."
3. Self-test runs
4. ❌ Final error: "جلسة الموظف منتهية أو غير موجودة"

### Console Logs
```
[AUTO-FIX] Insert failed, running self-test...
[SELF-TEST] Starting delay permission self-test...
[SELF-TEST] No active session found in employee_sessions table
[AUTO-FIX] Self-test failed: جلسة الموظف منتهية أو غير موجودة
```

### Validation
```sql
-- Check debug log was created
SELECT * FROM delay_permission_debug_logs
WHERE employee_id = 'your-employee-id'
  AND fixed_action_taken = 'no_active_session'
ORDER BY created_at DESC
LIMIT 1;
```

---

## Test Scenario 4: Self-Test with Inactive Employee 🔧❌

### Setup
```sql
-- Make employee inactive
UPDATE employees
SET is_active = false
WHERE id = 'your-employee-id';
```

### Steps
1. Try to submit delay permission
2. Watch for self-test

### Expected Result
1. First insert fails
2. Self-test detects: `employee_inactive`
3. ❌ Error: "حساب الموظف غير نشط"

### Console Logs
```
[SELF-TEST] Employee is not active
[AUTO-FIX] Self-test failed: حساب الموظف غير نشط
```

### Cleanup
```sql
-- Restore employee
UPDATE employees
SET is_active = true
WHERE id = 'your-employee-id';
```

---

## Test Scenario 5: View Debug Logs (Admin) 📊

### Setup
Login as admin in Supabase SQL editor.

### Query 1: Recent Logs
```sql
SELECT
  id,
  employee_id,
  error_message_before,
  fixed_action_taken,
  success,
  created_at,
  metadata
FROM delay_permission_debug_logs
WHERE company_id = 'your-company-id'
ORDER BY created_at DESC
LIMIT 10;
```

### Query 2: Failed Actions Only
```sql
SELECT
  fixed_action_taken,
  COUNT(*) as count,
  array_agg(employee_id) as affected_employees
FROM delay_permission_debug_logs
WHERE company_id = 'your-company-id'
  AND success = false
  AND created_at > now() - interval '7 days'
GROUP BY fixed_action_taken
ORDER BY count DESC;
```

### Query 3: Success Rate
```sql
SELECT
  COUNT(*) as total_attempts,
  SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful_fixes,
  SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) as failed_fixes,
  ROUND(SUM(CASE WHEN success THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as success_rate
FROM delay_permission_debug_logs
WHERE company_id = 'your-company-id'
  AND created_at > now() - interval '30 days';
```

---

## Test Scenario 6: Manual Trigger Test 🧪

### Test Valid Insert
```sql
SELECT * FROM test_delay_permission_insert(
  'valid-employee-id'::uuid,
  'correct-company-id'::uuid
);
```

### Expected Result
```
success | message                 | error_detail
--------|------------------------|-------------
true    | Test insert succeeded  |
```

### Test Invalid Insert (Non-existent Employee)
```sql
SELECT * FROM test_delay_permission_insert(
  'non-existent-uuid'::uuid,
  'any-company-id'::uuid
);
```

### Expected Result
```
success | message              | error_detail
--------|---------------------|-------------
false   | Test insert failed  | Employee with id xxx does not exist
```

---

## Test Scenario 7: Cleanup Old Logs 🧹

### Run Cleanup
```sql
-- Clean logs older than 30 days
SELECT cleanup_old_debug_logs(30);
```

### Expected Result
```
cleanup_old_debug_logs
----------------------
5
```
(Returns number of deleted rows)

### Validation
```sql
-- Verify old logs are gone
SELECT COUNT(*)
FROM delay_permission_debug_logs
WHERE created_at < now() - interval '30 days';
```

Should return: `0`

---

## Test Scenario 8: RLS Policy Test 🔐

### Test 1: Admin Can View Own Company Logs
```sql
-- Login as admin of Company A
-- Should see logs for Company A only
SELECT COUNT(*)
FROM delay_permission_debug_logs;
```

### Test 2: Employee Can Insert Logs
```javascript
// In browser console (as employee - anon role)
await supabase.from('delay_permission_debug_logs').insert({
  employee_id: 'employee-id',
  company_id: 'company-id',
  error_message_before: 'Test error',
  fixed_action_taken: 'test_action',
  success: false,
  metadata: { test: true }
});
```

Should succeed ✅

### Test 3: Cross-Company Isolation
```sql
-- Login as Admin of Company A
-- Try to view Company B logs
SELECT COUNT(*)
FROM delay_permission_debug_logs
WHERE company_id = 'company-b-id';
```

Should return: `0` (RLS blocks access)

---

## Test Scenario 9: Performance Test ⚡

### Measure Normal Insert Time
```javascript
console.time('normal-insert');
await supabase.from('delay_permissions').insert({...});
console.timeEnd('normal-insert');
```

Expected: ~50-100ms

### Measure Self-Test + Retry Time
```javascript
// Trigger an RLS error first
console.time('self-test-retry');
// ... submit form (will fail, run self-test, retry)
console.timeEnd('self-test-retry');
```

Expected: ~1000-2000ms

---

## Test Scenario 10: Browser Console Monitoring 🖥️

### Open Browser Console
Press F12 → Console tab

### Filter Logs
```javascript
// Filter for self-test logs only
localStorage.setItem('debug', 'self-test,auto-fix');
```

### Submit Delay Permission

### Expected Console Output (Success)
```
[INITIAL] Inserting delay permission: {company_id: "...", employee_id: "..."}
Permission inserted successfully: {id: "...", status: "pending"}
```

### Expected Console Output (Auto-Fix)
```
[INITIAL] Inserting delay permission: {...}
Insert error: {...}
[AUTO-FIX] Insert failed, running self-test...
[SELF-TEST] Starting delay permission self-test...
[SELF-TEST] Provided: {providedEmployeeId: "...", providedCompanyId: "...", originalError: "..."}
[SELF-TEST] Found employee session: {id: "...", company_id: "..."}
[SELF-TEST] All checks passed - employee and session are valid
[AUTO-FIX] Self-test result: {success: true, shouldRetry: true, actionTaken: "employee_exists"}
[AUTO-FIX] Self-test passed, retrying insert...
[RETRY] Inserting delay permission: {...}
Permission inserted successfully: {id: "...", status: "pending"}
```

---

## Automated Test Script

### Create Test File: `test-delay-permission-self-test.mjs`

```javascript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testSelfTestSystem() {
  console.log('🧪 Testing Delay Permission Self-Test System...\n');

  // Test 1: Check debug table exists
  console.log('Test 1: Check debug table exists');
  const { data: tables, error: tablesError } = await supabase
    .from('delay_permission_debug_logs')
    .select('id')
    .limit(1);

  if (tablesError && tablesError.code === '42P01') {
    console.log('❌ FAIL: Debug table does not exist');
    return;
  }
  console.log('✅ PASS: Debug table exists\n');

  // Test 2: Check trigger exists
  console.log('Test 2: Check trigger exists');
  const { data: triggerData, error: triggerError } = await supabase
    .rpc('test_delay_permission_insert', {
      p_employee_id: '00000000-0000-0000-0000-000000000000',
      p_company_id: '00000000-0000-0000-0000-000000000000'
    });

  if (!triggerError) {
    console.log('✅ PASS: Trigger function exists\n');
  } else {
    console.log('⚠️  WARN: Trigger function may not exist\n');
  }

  // Test 3: Check cleanup function exists
  console.log('Test 3: Check cleanup function exists');
  const { data: cleanupData, error: cleanupError } = await supabase
    .rpc('cleanup_old_debug_logs', { days_to_keep: 30 });

  if (!cleanupError) {
    console.log('✅ PASS: Cleanup function exists');
    console.log(`   Cleaned ${cleanupData} old logs\n`);
  } else {
    console.log('⚠️  WARN: Cleanup function may not exist\n');
  }

  console.log('🎉 Self-Test System Tests Complete!');
}

testSelfTestSystem().catch(console.error);
```

### Run Test
```bash
node test-delay-permission-self-test.mjs
```

---

## Troubleshooting

### Issue: Self-test doesn't run

**Check**:
1. Is insert actually failing?
2. Check browser console for errors
3. Verify `delayPermissionSelfTest.ts` is imported

**Fix**:
```javascript
// In EmployeeDelayPermissionModal.tsx
import { runDelayPermissionSelfTest } from '../utils/delayPermissionSelfTest';
```

### Issue: Debug logs not appearing

**Check**:
```sql
-- Verify table exists
SELECT * FROM delay_permission_debug_logs LIMIT 1;

-- Check RLS policies
SELECT * FROM pg_policies
WHERE tablename = 'delay_permission_debug_logs';
```

**Fix**:
Re-run migration if needed.

### Issue: Trigger not working

**Check**:
```sql
-- Verify trigger exists
SELECT * FROM pg_trigger
WHERE tgname = 'validate_delay_permission_trigger';
```

**Fix**:
```sql
-- Recreate trigger
DROP TRIGGER IF EXISTS validate_delay_permission_trigger ON delay_permissions;
CREATE TRIGGER validate_delay_permission_trigger
  BEFORE INSERT ON delay_permissions
  FOR EACH ROW
  EXECUTE FUNCTION validate_delay_permission_before_insert();
```

---

## Success Criteria Checklist

- [ ] Normal insert works (old company)
- [ ] Self-test runs on RLS error
- [ ] Self-test logs to console
- [ ] Self-test logs to database
- [ ] Retry works after successful self-test
- [ ] Clear error messages shown
- [ ] Trigger validates data
- [ ] Admin can view logs
- [ ] RLS isolates companies
- [ ] Cleanup function works
- [ ] Test function works
- [ ] Performance acceptable (<2s total)

---

## Summary

The self-test system provides:
- ✅ Automatic diagnostics
- ✅ Clear error messages
- ✅ Debug logging
- ✅ Database validation
- ✅ Performance monitoring
- ✅ Admin tools

**Test thoroughly before production deployment!** 🚀
