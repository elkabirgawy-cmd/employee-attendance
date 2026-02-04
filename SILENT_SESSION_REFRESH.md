# ⚠️ DEPRECATED: Silent Session Refresh

**This approach has been replaced by the iOS Safari Reload Strategy.**

See `IOS_SAFARI_LOCATION_FIX.md` for the current implementation.

---

# Silent Session Refresh - حل متقدم لتفعيل GPS بعد Login

## ⚠️ Important Note

This document describes an approach that was implemented but then **replaced** due to iOS Safari limitations.

**Problem with this approach**:
- ❌ iOS Safari does NOT emit location events when GPS is enabled within the same browser session
- ❌ Recovery loops don't work on iOS Safari
- ❌ Permission change listeners don't fire on iOS Safari

**Current solution**: iOS Safari Reload Strategy (see `IOS_SAFARI_LOCATION_FIX.md`)

---

## المشكلة الأصلية
عند تسجيل دخول الموظف والـ Location (GPS) مقفول، ثم تفعيل الـ Location لاحقًا:
- ❌ التطبيق يلف في رسائل "جاري..." بدون حصول fix فعلي
- ❌ لا يحدث تحديث للإحداثيات الفعلية (coords) بدون Refresh
- ❌ لا يتم تحديث حالة داخل/خارج الفرع

## الحل المتقدم المطبق

### 🎯 A) Silent Location Re-Init (إعادة تهيئة صامتة)

#### 1. LocationRecoveryLoop المحسّن
دورة مراقبة ذكية تعمل كل **1.5 ثانية**:

```typescript
startLocationPollingWhenOff() {
  setInterval(async () => {
    // فحص حالة Location Services + Permission
    const { enabled, permission } = await recheckLocationState();

    // ✅ اكتشاف انتقال OFF → ON
    if (enabled && permission === 'granted') {
      stopLocationPollingWhenOff();

      // 🔄 Silent Session Refresh (إذا كان login مع Location OFF)
      if (loginLocationWasOffRef.current) {
        await silentSessionRefresh();
        loginLocationWasOffRef.current = false;
      }

      // 🔥 HARD RESET للموقع
      stopLocationWatcher();
      clearTimeout(locationAttemptTimerRef.current);
      await ensureLocationFlow();
    }
  }, 1500);
}
```

#### 2. Hard Reset للموقع
عند اكتشاف Location ON، يتم:

```typescript
ensureLocationFlow() {
  // إيقاف كل شيء
  stopLocationPollingWhenOff();
  stopLocationWatcher();
  clearTimeout(locationAttemptTimerRef.current);

  // بدء fresh location requests
  await startLocationRequests();
}
```

#### 3. startLocationRequests - استراتيجية ذكية
```typescript
startLocationRequests() {
  // المحاولة 1: سريعة (lowAccuracy, 10 ثواني)
  try {
    setLocationError('يتم الاتصال بخدمات الموقع...');
    position = await getCurrentPosition(lowAccuracy, 10000ms);
  } catch {
    // المحاولة 2: دقيقة (highAccuracy, 12 ثانية)
    setLocationError('جاري البحث عن إحداثيات موقعك...');
    position = await getCurrentPosition(highAccuracy, 12000ms);
  }

  // ✅ معالجة النجاح
  await handleLocationSuccess(position);

  // 🔄 بدء watcher للتحديثات المستمرة
  startLocationWatcher();
}
```

### 🔄 B) Silent Session Refresh (تحديث صامت للجلسة)

#### الهدف
عند أول انتقال OFF → ON بعد login، تحديث:
1. ✅ بيانات الموظف (Employee Profile)
2. ✅ بيانات الفرع (Branch Geofence)
3. ✅ Token الجلسة (إذا لزم الأمر)

#### التطبيق
```typescript
silentSessionRefresh() {
  // جلب session token
  const sessionToken = localStorage.getItem('geoshift_session_token');
  const employeeData = localStorage.getItem('geoshift_employee');

  // تحديث بيانات الموظف
  const { data: empData } = await supabase
    .from('employees')
    .select('id, full_name, employee_code, phone, branch_id')
    .eq('id', emp.id)
    .maybeSingle();

  if (empData) {
    setEmployee(empData);
    localStorage.setItem('geoshift_employee', JSON.stringify(empData));

    // تحديث بيانات الفرع
    const { data: branchData } = await supabase
      .from('branches')
      .select('latitude, longitude, geofence_radius')
      .eq('id', empData.branch_id)
      .single();

    if (branchData) {
      setBranchLocation({
        lat: branchData.latitude,
        lng: branchData.longitude,
        radius: branchData.geofence_radius
      });
    }
  }
}
```

#### متى يحدث Silent Refresh؟
```typescript
// عند أول انتقال OFF → ON فقط
if (loginLocationWasOffRef.current) {
  await silentSessionRefresh();
  loginLocationWasOffRef.current = false; // ✅ لمرة واحدة فقط
}
```

### 📊 تحديث lastFixTimestamp

#### في handleLocationSuccess
```typescript
handleLocationSuccess(position) {
  const newTimestamp = position.timestamp;

  // ✅ تحديث lastFixAtMs
  setLocationHealth(prev => ({
    ...prev,
    permission: 'granted',
    lastFixAtMs: newTimestamp,  // ← هنا!
    isDisabled: false,
    isFresh: true
  }));

  // ✅ تحديث health metrics
  updateLocationHealth(newLocation);

  // ✅ State: OK
  setLocationState('OK');
}
```

#### في updateLocationHealth
```typescript
updateLocationHealth(newLocation) {
  const lastFixAtMs = newLocation?.timestamp || locationHealth.lastFixAtMs;
  const lastFixAgeSec = Math.floor((nowMs - lastFixAtMs) / 1000);

  const isFresh = permission === 'granted' &&
                  lastFixAtMs !== null &&
                  lastFixAgeSec <= 30;

  setLocationHealth({
    lastFixAtMs,
    lastFixAgeSec,
    isFresh,
    isDisabled,
    isStale
  });
}
```

### 🎯 تحديد حالة داخل/خارج الفرع

```typescript
useEffect(() => {
  if (!location || !branchLocation) {
    setIsConfirmedOutside(false);
    return;
  }

  // حساب المسافة
  const distance = calculateDistance(
    location.lat, location.lng,
    branchLocation.lat, branchLocation.lng
  );

  // ✅ تحديد الحالة
  const isOutside = distance > branchLocation.radius;
  setIsConfirmedOutside(isOutside);

  // Debug
  console.log('[isConfirmedOutside]', {
    distance: Math.round(distance),
    radius: branchLocation.radius,
    status: isOutside ? 'خارج الفرع' : 'داخل الفرع'
  });
}, [location, branchLocation, locationState]);
```

## 🔍 Debug Mode

### التفعيل
```typescript
// في src/pages/EmployeeApp.tsx
const DEBUG_LOCATION_RECOVERY = true;
```

### Log Messages المتوقعة

```
[Lifecycle] Employee loaded - starting location flow
[ensureLocationFlow] State check: {
  enabled: false,
  permission: "prompt",
  loginWasOff: false
}
[ensureLocationFlow] Location OFF - marking flag and starting recovery loop

[LocationRecoveryLoop] Started - checking every 1500ms
[LocationRecoveryLoop] Check: { enabled: false, permission: "prompt", loginWasOff: true }
[LocationRecoveryLoop] Check: { enabled: true, permission: "granted", loginWasOff: true }

[LocationRecoveryLoop] Location is ON! Detected OFF→ON transition
[LocationRecoveryLoop] First OFF→ON after login - performing silent session refresh
[silentSessionRefresh] Starting silent refresh...
[silentSessionRefresh] Refreshing employee profile and branch data...
[silentSessionRefresh] Employee and branch data refreshed successfully

[LocationRecoveryLoop] Stopping all watchers and restarting location engine...
[ensureLocationFlow] Location is ON - performing HARD RESET
[ensureLocationFlow] Starting fresh location requests...

[startLocationRequests] HARD RESET - clearing all watchers and timers
[startLocationRequests] Attempt 1: lowAccuracy, 10s timeout
[startLocationRequests] Attempt 1 SUCCESS: {
  lat: 24.7136,
  lng: 46.6753,
  accuracy: 20
}

[startLocationRequests] Got position! Processing and updating lastFixTimestamp...
[handleLocationSuccess] ✅ REAL COORDS RECEIVED: {
  lat: 24.7136,
  lng: 46.6753,
  accuracy: 20,
  timestamp: "2026-01-12T15:30:45.123Z",
  lastFixAtMs: 1736697045123
}

[updateLocationHealth] Updated health metrics: {
  lastFixAtMs: 1736697045123,
  lastFixAgeSec: 0,
  isFresh: true,
  isDisabled: false,
  isStale: false
}

[handleLocationSuccess] ✅ State: LOCATION_READY | lastFixTimestamp updated

[startLocationRequests] Starting fresh continuous watcher...
[startLocationWatcher] Starting watch with highAccuracy: false
[startLocationWatcher] Watch started with ID: 123

[isConfirmedOutside] Updated status: {
  distance: 50,
  radius: 200,
  isOutside: false,
  status: "داخل الفرع"
}
```

## 🧪 Acceptance Tests

### Test A: Login مع Location OFF ثم ON
```
1. ✅ إيقاف Location/GPS من إعدادات الجهاز
2. ✅ تسجيل دخول للموظف
3. ✅ انتظار 5 ثواني → رسالة "يرجى التحقق من تفعيل GPS..."
4. ✅ تفعيل Location من Control Center أو Settings
5. ✅ خلال ≤5 ثواني:
   - Silent session refresh يحدث في الخلفية
   - يتم الحصول على إحداثيات فعلية (coords)
   - تحديث lastFixTimestamp
   - تحول الحالة إلى "داخل الفرع" أو "خارج الفرع"
   - توقف رسائل "جاري..."
```

### Test B: تكرار 3 مرات بدون Refresh
```
1. ✅ تكرار Test A ثلاث مرات متتالية
2. ✅ في كل مرة يعمل التطبيق بدون:
   - Browser Refresh
   - Logout ثم Login
   - App Restart
```

### Test C: Silent Refresh مرة واحدة فقط
```
1. ✅ Login مع Location OFF
2. ✅ تفعيل Location → silent refresh يحدث
3. ✅ إيقاف Location
4. ✅ تفعيل Location مرة أخرى → NO silent refresh (لأن loginLocationWasOffRef = false)
5. ✅ فقط hard reset للموقع يحدث
```

## 🎨 تدرج رسائل UI

### المراحل
1. **Location OFF**
   - "يرجى التحقق من تفعيل GPS وإعطاء صلاحية الموقع"
   - Spinner يدور

2. **Location ON - Connecting**
   - "يتم الاتصال بخدمات الموقع..."
   - Spinner يدور

3. **Searching for Coords**
   - "جاري البحث عن إحداثيات موقعك..."
   - Spinner يدور

4. **Success - Inside/Outside**
   - ✅ "موقعك الحالي: داخل الفرع" (أخضر)
   - أو ⚠️ "موقعك الحالي: خارج الفرع" (أحمر)
   - لا spinner

## 🔧 Technical Details

### loginLocationWasOffRef
```typescript
// Ref (لا يسبب re-render)
const loginLocationWasOffRef = useRef<boolean>(false);

// يتم تعيينه عند اكتشاف Location OFF
loginLocationWasOffRef.current = true;

// يتم إعادته لـ false بعد أول silent refresh
loginLocationWasOffRef.current = false;
```

### Hard Reset Components
1. ✅ stopLocationPollingWhenOff()
2. ✅ stopLocationWatcher()
3. ✅ clearTimeout(locationAttemptTimerRef.current)
4. ✅ getCurrentPosition() جديد
5. ✅ watchPosition() جديد

### Silent Refresh Components
1. ✅ refetchEmployeeProfile()
2. ✅ refetchBranchGeofence()
3. ✅ updateLocalStorage()
4. ✅ setState() بدون UI change

## 📈 الفوائد

### 1. استقرار أفضل
- لا توجد watchers معلقة
- hard reset كامل عند كل OFF→ON
- منع memory leaks

### 2. بيانات محدثة
- silent refresh يضمن:
  - بيانات الموظف محدثة
  - بيانات الفرع صحيحة
  - geofence radius دقيق

### 3. تجربة مستخدم سلسة
- لا حاجة لـ Refresh
- لا حاجة لـ Logout/Login
- automatic recovery

### 4. دعم iOS/Safari
- visibilitychange
- focus
- pageshow

## 🔒 الأمان

### لا تأثير على UI
- Silent refresh بدون رسائل
- لا loading indicators إضافية
- فقط background updates

### لا API calls زائدة
- Silent refresh يحدث **مرة واحدة فقط** بعد login
- بعدها فقط location updates

### Session Safety
- التحقق من session token قبل refresh
- fallback graceful إذا فشل refresh
- لا logout إجباري

## 📊 الفرق بين القديم والجديد

| الميزة | القديم ❌ | الجديد ✅ |
|-------|---------|----------|
| Location OFF→ON | لا يعمل بدون Refresh | يعمل تلقائيًا |
| Watcher Management | watcher واحد قديم | hard reset + fresh watcher |
| Session Refresh | لا يوجد | silent refresh عند أول OFF→ON |
| lastFixTimestamp | لا يُحدَّث | يُحدَّث فورًا |
| Inside/Outside Status | لا يتحول | يتحول تلقائيًا |
| Recovery Loop Interval | 2000ms | 1500ms (أسرع) |
| Debug Logging | محدود | شامل ومفصّل |
| iOS Support | جزئي | كامل (pageshow) |

## 🎯 الخلاصة

الحل الجديد يجمع بين:
1. **LocationRecoveryLoop**: مراقبة مستمرة كل 1.5 ثانية
2. **Hard Reset**: إيقاف كل watchers قديمة + بدء جديدة
3. **Silent Session Refresh**: تحديث بيانات الموظف/الفرع بدون UI change
4. **lastFixTimestamp Update**: تحديث فوري عند الحصول على coords
5. **Inside/Outside Detection**: automatic عبر useEffect

النتيجة: تجربة مستخدم سلسة ومستقرة بدون الحاجة لأي تدخل يدوي!
