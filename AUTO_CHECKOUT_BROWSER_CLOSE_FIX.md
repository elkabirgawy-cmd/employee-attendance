# إصلاح Auto-checkout عند إغلاق المتصفح

## المشكلتان الأساسيتان

### Bug A: Auto-checkout يتفعل غلط عند إغلاق المتصفح
**السبب:**
- عند إغلاق المتصفح/التبويب، location services تتوقف تلقائياً
- `location = null` أو `locationHealth.isStale = true`
- `gpsOk = false`
- Heartbeat التالي يرسل `gpsOk=false` للـ server
- Server يعتقد أن GPS معطل ويبدأ countdown

### Bug B: Countdown لا يتوقف فور الرجوع للنطاق
**السبب:**
- Heartbeat يُرسل كل 15 ثانية
- عند الرجوع للنطاق، يجب الانتظار حتى الـ heartbeat التالي
- تأخير يصل إلى 15 ثانية قبل إلغاء countdown

---

## الحل المطبق

### 1. تتبع حالة App Visibility

**State جديدة:**
```typescript
const [isAppVisible, setIsAppVisible] = useState(!document.hidden);
const isAppVisibleRef = useRef(isAppVisible);
```

**الفائدة:** معرفة متى يكون التطبيق مرئياً أو مخفياً

### 2. منع Heartbeat عند إخفاء التطبيق

**في `sendHeartbeat()`:**
```typescript
if (!isAppVisibleRef.current) {
  console.log('[HEARTBEAT_SKIPPED] App not visible');
  return;
}
```

**في heartbeat interval:**
```typescript
if (!currentIsAppVisible) {
  console.log('[HEARTBEAT_SKIPPED] App not visible');
  return;
}
```

**النتيجة:** عدم إرسال `gpsOk=false` بسبب إغلاق الصفحة فقط

### 3. معالجة أحداث Page Lifecycle

**Events جديدة:**
```typescript
window.addEventListener('beforeunload', handleBeforeUnload);
window.addEventListener('pagehide', handlePageHide);
```

**السلوك:**
```typescript
const handleBeforeUnload = () => {
  console.log('[BEFOREUNLOAD] Stopping watchers, NO heartbeat sent');
  stopWatchingLocation(); // فقط إيقاف watchers محلياً
};
```

**المهم:** لا يتم إرسال heartbeat عند beforeunload/pagehide

### 4. State Hydration عند App Resume

**عند visibilitychange (visible):**
```typescript
if (nowVisible && !wasVisible) {
  console.log('[VISIBILITY] App resumed (was hidden, now visible)');

  // إعادة تحميل الحالة من DB
  if (employee?.id && employee?.company_id) {
    loadCurrentAttendance(employee.id, employee.company_id);
  }

  // إعادة تشغيل location watchers
  startWatchingLocation();

  // إرسال heartbeat فوري
  if (currentLogRef.current) {
    sendHeartbeat();
  }
}
```

**عند focus:**
```typescript
const handleFocus = () => {
  console.log('[FOCUS] Window focused');
  setIsAppVisible(true);
  isAppVisibleRef.current = true;

  // نفس المنطق...
}
```

### 5. تحميل Countdown State من DB

**في `loadCurrentAttendance()`:**
```typescript
// بعد تحميل attendance log
const { data: pendingData, error: pendingError } = await supabase
  .from('auto_checkout_pending')
  .select('id, reason, started_at, ends_at')
  .eq('employee_id', employeeId)
  .eq('company_id', companyId)
  .eq('attendance_log_id', data.id)
  .eq('status', 'PENDING')
  .maybeSingle();

if (!pendingError && pendingData) {
  console.log('[LOAD_ATTENDANCE] Found pending auto-checkout:', pendingData);
  const endsAtMs = pendingData.ends_at ? new Date(pendingData.ends_at).getTime() : null;
  const startedAtMs = pendingData.started_at ? new Date(pendingData.started_at).getTime() : null;
  setAutoCheckout({
    active: true,
    reason: pendingData.reason as 'LOCATION_DISABLED' | 'OUT_OF_BRANCH',
    startedAtServerMs: startedAtMs,
    endsAtServerMs: endsAtMs,
    executionState: 'COUNTING'
  });
}
```

**النتيجة:** استعادة countdown state بعد refresh/reopen

### 6. تسريع Heartbeat عند Countdown Active

**قبل:**
```typescript
locationHeartbeatIntervalRef.current = window.setInterval(() => {
  // ...
}, 15000); // دائماً 15 ثانية
```

**بعد:**
```typescript
const heartbeatInterval = autoCheckout.active ? 3000 : 15000;
console.log('[HEARTBEAT_INTERVAL]', heartbeatInterval, 'ms',
  autoCheckout.active ? '(countdown active)' : '(normal)');

locationHeartbeatIntervalRef.current = window.setInterval(() => {
  // ...
}, heartbeatInterval);
```

**الفائدة:**
- Countdown active → heartbeat كل 3 ثوانٍ (استجابة سريعة)
- Normal → heartbeat كل 15 ثانية (توفير bandwidth)

### 7. حفظ آخر Location صحيحة

**Ref جديد:**
```typescript
const lastValidLocationRef = useRef<{ lat: number; lng: number; accuracy?: number; timestamp?: number } | null>(null);
```

**التحديث:**
```typescript
if (location && gpsOk) {
  lastValidLocationRef.current = location;
}
```

**الفائدة:** الاحتفاظ بآخر موقع صالح للمقارنة/الاسترجاع

---

## سلوك الحالات المختلفة

### Scenario 1: إغلاق Tab/Browser

**قبل الإصلاح:**
1. User checked-in
2. User يغلق التبويب
3. Location services تتوقف
4. Heartbeat يرسل `gpsOk=false`
5. Server يبدأ countdown ❌

**بعد الإصلاح:**
1. User checked-in
2. User يغلق التبويب
3. `beforeunload` يُطلق
4. Location watchers تتوقف محلياً
5. **لا يُرسل heartbeat** ✅
6. User يعيد فتح التبويب
7. `visibilitychange (visible)` يُطلق
8. State يُعاد تحميله من DB
9. Heartbeat يُرسل مع الموقع الصحيح

### Scenario 2: الخروج من النطاق ثم العودة

**قبل الإصلاح:**
1. User خارج النطاق
2. Countdown يبدأ
3. User يعود داخل النطاق
4. يجب الانتظار حتى 15 ثانية للـ heartbeat التالي ❌

**بعد الإصلاح:**
1. User خارج النطاق
2. Countdown يبدأ
3. **Heartbeat interval يتغير إلى 3 ثوانٍ** ✅
4. User يعود داخل النطاق
5. **بعد 3 ثوانٍ** heartbeat يرسل `inBranch=true`
6. Server يلغي countdown فوراً ✅

### Scenario 3: GPS معطل حقاً

**السلوك:**
1. User يعطل GPS
2. `locationHealth.isDisabled = true`
3. `gpsOk = false`
4. Heartbeat يرسل `gpsOk=false`
5. Server يبدأ countdown ✅ (صحيح)
6. **Heartbeat interval = 3s** (استجابة سريعة)
7. User يفعّل GPS
8. بعد 3 ثوانٍ countdown يُلغى ✅

---

## الملفات المعدلة

**ملف واحد فقط:**
- `src/pages/EmployeeApp.tsx`

**الدوال المعدلة:**
1. **State declarations** (lines ~139-152):
   - إضافة `isAppVisible` state
   - إضافة `isAppVisibleRef`
   - إضافة `lastValidLocationRef`

2. **visibilitychange handler** (lines ~923-973):
   - معالجة hidden/visible
   - إضافة beforeunload handler
   - إضافة pagehide handler
   - State hydration عند resume

3. **sendHeartbeat()** (lines ~1631-1719):
   - فحص `isAppVisible` قبل الإرسال
   - حفظ آخر location صحيحة

4. **loadCurrentAttendance()** (lines ~1447-1526):
   - تحميل pending countdown من `auto_checkout_pending`
   - استعادة countdown state

5. **heartbeat interval useEffect** (lines ~2105-2222):
   - فحص `isAppVisible` قبل الإرسال
   - تسريع interval عند countdown active (3s vs 15s)
   - dependency على `autoCheckout.active`

---

## اختبارات التحقق

### Test 1: Browser Close (Tenant OLD)
```
1. Login as employee from OLD_TENANT
2. Check-in
3. ✅ Verify: status = CHECKED_IN
4. Close browser tab
5. Wait 30 seconds
6. Reopen tab → login
7. ✅ Verify: status = still CHECKED_IN (no auto countdown)
```

### Test 2: Browser Close (Tenant NEW)
```
1. Login as employee from NEW_TENANT
2. Check-in
3. ✅ Verify: status = CHECKED_IN
4. Close browser tab
5. Wait 30 seconds
6. Reopen tab → login
7. ✅ Verify: status = still CHECKED_IN (no auto countdown)
```

### Test 3: Out of Range → Back in Range (OLD)
```
1. Login as employee from OLD_TENANT
2. Check-in
3. Simulate: go out of branch (or disable GPS)
4. ✅ Verify: countdown starts
5. Return to branch (or enable GPS)
6. ✅ Verify: countdown stops within 3-5 seconds
```

### Test 4: Out of Range → Back in Range (NEW)
```
1. Login as employee from NEW_TENANT
2. Check-in
3. Simulate: go out of branch (or disable GPS)
4. ✅ Verify: countdown starts
5. Return to branch (or enable GPS)
6. ✅ Verify: countdown stops within 3-5 seconds
```

---

## ملخص التغييرات

### ما تم إصلاحه:
1. ✅ لا countdown عند إغلاق المتصفح (ليس GPS off حقيقي)
2. ✅ Countdown يتوقف فور الرجوع للنطاق (3s بدل 15s)
3. ✅ State hydration عند app resume
4. ✅ Countdown state يُحفظ ويُسترجع من DB

### ما لم يتم تغييره:
- ❌ UI
- ❌ النصوص
- ❌ طريقة تسجيل دخول الموظف
- ❌ Server-side logic (RPC functions)

### Performance:
- Normal operation: heartbeat كل 15s (كما هو)
- Countdown active: heartbeat كل 3s (تحسين)

---

## Build Status
✅ Build successful - no errors
