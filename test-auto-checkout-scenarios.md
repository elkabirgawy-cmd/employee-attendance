# دليل اختبار Auto-Checkout - السيناريوهات المطلوبة

## Setup

### Test Companies
```sql
-- Get test employees
SELECT
  e.id as employee_id,
  e.full_name,
  e.company_id,
  c.name as company_name,
  CASE
    WHEN c.created_at = (SELECT MIN(created_at) FROM companies WHERE status = 'active')
    THEN 'OLD_TENANT'
    WHEN c.created_at = (SELECT MAX(created_at) FROM companies WHERE status = 'active')
    THEN 'NEW_TENANT'
    ELSE 'OTHER'
  END as tenant_type
FROM employees e
JOIN companies c ON c.id = e.company_id
WHERE c.status = 'active'
  AND e.is_active = true
ORDER BY tenant_type, e.full_name
LIMIT 5;
```

---

## Scenario 1: Browser Close → No Auto-Countdown

### Objective
تأكيد أن إغلاق المتصفح/التبويب **لا يبدأ** countdown تلقائياً

### Steps - OLD_TENANT

1. **Login**
   ```
   - Navigate to /employee-login
   - Login as employee from OLD_TENANT
   ```

2. **Check-in**
   ```
   - Wait for location to be detected
   - Click "تسجيل حضور"
   - ✅ Verify: Button shows "تسجيل انصراف"
   ```

3. **Close Tab**
   ```
   - Close the browser tab/window
   - Wait 30 seconds
   ```

4. **Verify No Countdown Started**
   ```sql
   -- Run this query
   SELECT
     acp.id,
     acp.reason,
     acp.status,
     acp.started_at,
     acp.ends_at
   FROM auto_checkout_pending acp
   JOIN employees e ON e.id = acp.employee_id
   JOIN companies c ON c.id = e.company_id
   WHERE c.created_at = (SELECT MIN(created_at) FROM companies WHERE status = 'active')
     AND acp.status = 'PENDING'
   ORDER BY acp.created_at DESC
   LIMIT 5;
   ```

   **Expected:** No rows (or only rows from GPS actually being disabled)

5. **Reopen & Verify State**
   ```
   - Open new tab → navigate to /employee-login
   - Login again
   - ✅ Verify: Status still shows "تسجيل انصراف" (checked-in)
   - ✅ Verify: No countdown active
   ```

### Steps - NEW_TENANT

Repeat exact same steps but with employee from NEW_TENANT:

```sql
-- Get NEW_TENANT employee
SELECT id, full_name, phone
FROM employees
WHERE company_id = (
  SELECT id FROM companies
  WHERE created_at = (SELECT MAX(created_at) FROM companies WHERE status = 'active')
)
AND is_active = true
LIMIT 1;
```

**Expected Result:** Identical behavior to OLD_TENANT

---

## Scenario 2: Out of Range → Return → Countdown Stops Immediately

### Objective
تأكيد أن العد التنازلي يتوقف **فوراً** (خلال 3-5 ثوانٍ) عند الرجوع للنطاق

### Method A: Simulate Location Change (Recommended)

#### Steps - OLD_TENANT

1. **Login & Check-in**
   ```
   - Login as OLD_TENANT employee
   - Check-in successfully
   ```

2. **Get Branch Location**
   ```sql
   SELECT
     b.id,
     b.name,
     b.latitude,
     b.longitude,
     b.geofence_radius
   FROM branches b
   JOIN employees e ON e.branch_id = b.id
   WHERE e.id = '<EMPLOYEE_ID>';
   ```

3. **Simulate Going Outside**
   ```javascript
   // In Browser Console:

   // Get far away coordinates (outside radius)
   const branchLat = <BRANCH_LAT>;
   const branchLng = <BRANCH_LNG>;
   const radius = <GEOFENCE_RADIUS>;

   // Move 2x radius away
   const offsetKm = (radius / 1000) * 2;
   const fakeLat = branchLat + (offsetKm / 111); // ~111km per degree
   const fakeLng = branchLng + (offsetKm / 111);

   // Override geolocation
   navigator.geolocation.getCurrentPosition = function(success) {
     success({
       coords: {
         latitude: fakeLat,
         longitude: fakeLng,
         accuracy: 10
       },
       timestamp: Date.now()
     });
   };

   console.log('Simulated location:', fakeLat, fakeLng);
   ```

4. **Wait for Countdown**
   ```
   - Wait 5-10 seconds
   - ✅ Verify: Orange countdown button appears
   - ✅ Verify: Console shows "[HEARTBEAT_SENT] gpsOk=true, inBranch=false"
   - Note the countdown time
   ```

5. **Simulate Return to Branch**
   ```javascript
   // In Browser Console:

   // Return to branch location
   navigator.geolocation.getCurrentPosition = function(success) {
     success({
       coords: {
         latitude: <BRANCH_LAT>,
         longitude: <BRANCH_LNG>,
         accuracy: 10
       },
       timestamp: Date.now()
     });
   };

   console.log('Returned to branch location');
   ```

6. **Verify Countdown Stops**
   ```
   - ⏱️ Start timer
   - Watch the UI
   - ✅ Verify: Within 3-5 seconds, countdown disappears
   - ✅ Verify: Button returns to "تسجيل انصراف"
   - ✅ Verify: Console shows "[AUTO_CHECKOUT_CANCELLED]"
   ```

#### Steps - NEW_TENANT

Repeat exact same steps with NEW_TENANT employee

**Expected Result:** Countdown stops within 3-5 seconds for both tenants

---

### Method B: Disable GPS (Alternative)

#### Steps - OLD_TENANT

1. **Login & Check-in**
   ```
   - Login as OLD_TENANT employee
   - Check-in successfully
   ```

2. **Disable Location Permission**
   ```
   Chrome:
   - Click lock icon in address bar
   - Set Location to "Block"

   Safari iOS:
   - Settings → Privacy → Location Services
   - Find browser → Set to "Never"
   ```

3. **Wait for Countdown**
   ```
   - Wait 10-15 seconds
   - ✅ Verify: Orange countdown appears
   - ✅ Verify: Reason is "LOCATION_DISABLED"
   ```

4. **Re-enable Location**
   ```
   - Re-enable location permission
   - Refresh page if needed
   ```

5. **Verify Countdown Stops**
   ```
   - ⏱️ Within 3-5 seconds
   - ✅ Verify: Countdown disappears
   - ✅ Verify: Back to normal "تسجيل انصراف"
   ```

#### Steps - NEW_TENANT

Repeat with NEW_TENANT employee

**Expected Result:** Identical behavior

---

## Scenario 3: Refresh During Countdown

### Objective
تأكيد أن countdown state يُسترجع بعد refresh

### Steps - Both Tenants

1. **Trigger Countdown**
   ```
   - Use Method A or B from Scenario 2
   - Start countdown
   - Wait until countdown shows 5-10 minutes remaining
   ```

2. **Refresh Page**
   ```
   - Press F5 or Cmd+R
   - Login again if needed
   ```

3. **Verify State Restored**
   ```
   - ✅ Verify: Countdown continues from same time
   - ✅ Verify: Orange button still shows
   - ✅ Verify: Console shows "[LOAD_ATTENDANCE] Found pending auto-checkout"
   ```

---

## Verification Queries

### Check Active Countdowns
```sql
SELECT
  c.name as company,
  e.full_name as employee,
  acp.reason,
  acp.started_at,
  acp.ends_at,
  EXTRACT(EPOCH FROM (acp.ends_at - NOW())) as seconds_remaining,
  acp.status
FROM auto_checkout_pending acp
JOIN employees e ON e.id = acp.employee_id
JOIN companies c ON c.id = e.company_id
WHERE acp.status = 'PENDING'
ORDER BY acp.started_at DESC;
```

### Check Heartbeat Logs
```sql
SELECT
  al.id,
  al.employee_id,
  al.last_heartbeat_at,
  al.check_in_time,
  al.check_out_time,
  EXTRACT(EPOCH FROM (NOW() - al.last_heartbeat_at)) as seconds_since_heartbeat
FROM attendance_logs al
WHERE al.check_out_time IS NULL
  AND al.check_in_time::date = CURRENT_DATE
ORDER BY al.last_heartbeat_at DESC;
```

---

## Expected Console Logs

### Normal Check-in (No Issues)
```
[HEARTBEAT_SENT] { gpsOk: true, inBranch: true, response: { status: 'OK' } }
[HEARTBEAT_INTERVAL] 15000 ms (normal)
```

### Out of Range
```
[HEARTBEAT_SENT] { gpsOk: true, inBranch: false, response: { pending_created: true, reason: 'OUT_OF_BRANCH' } }
[HEARTBEAT_INTERVAL] 3000 ms (countdown active)
```

### Return to Range
```
[HEARTBEAT_SENT] { gpsOk: true, inBranch: true, response: { pending_cancelled: true } }
[AUTO_CHECKOUT_CANCELLED] BACK_IN_RANGE
[HEARTBEAT_INTERVAL] 15000 ms (normal)
```

### GPS Disabled
```
[HEARTBEAT_SENT] { gpsOk: false, inBranch: false, response: { pending_created: true, reason: 'LOCATION_DISABLED' } }
[HEARTBEAT_INTERVAL] 3000 ms (countdown active)
```

### Browser Close
```
[BEFOREUNLOAD] Stopping watchers, NO heartbeat sent
```

### Browser Resume
```
[VISIBILITY] App resumed (was hidden, now visible)
[LOAD_ATTENDANCE] Found pending auto-checkout: { id: '...', reason: 'OUT_OF_BRANCH' }
[HEARTBEAT_SENT] { gpsOk: true, inBranch: true }
```

---

## Success Criteria

### ✅ Scenario 1 Pass Criteria:
- [ ] OLD_TENANT: No countdown after browser close
- [ ] NEW_TENANT: No countdown after browser close
- [ ] Both: State persists after reopen

### ✅ Scenario 2 Pass Criteria:
- [ ] OLD_TENANT: Countdown stops within 3-5s after return
- [ ] NEW_TENANT: Countdown stops within 3-5s after return
- [ ] Both: Console shows "[AUTO_CHECKOUT_CANCELLED]"

### ✅ Scenario 3 Pass Criteria:
- [ ] OLD_TENANT: Countdown state restored after refresh
- [ ] NEW_TENANT: Countdown state restored after refresh
- [ ] Both: Time continues from correct point

---

## Troubleshooting

### If countdown doesn't start when it should:
```sql
-- Check auto_checkout settings
SELECT * FROM auto_checkout_settings;

-- Should be enabled
UPDATE auto_checkout_settings
SET auto_checkout_enabled = true,
    auto_checkout_after_seconds = 900
WHERE id = 1;
```

### If countdown doesn't stop:
- Check console for "[HEARTBEAT_SENT]" logs
- Verify gpsOk=true and inBranch=true
- Check heartbeat interval (should be 3000ms during countdown)

### If state not restored:
- Check "[LOAD_ATTENDANCE]" log
- Verify auto_checkout_pending table has PENDING record
- Check employee_id and company_id match

---

## Notes

- All tests should be performed with actual GPS (not mocked) for production validation
- Browser console must be open to see debug logs
- Each test should be isolated (logout between tests)
- Document any deviations from expected behavior
