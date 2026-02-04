# Location Recovery Fix - تفعيل GPS بعد تسجيل الدخول

## المشكلة (Bug)
عند تسجيل دخول الموظف والـ Location (GPS) مقفول، ثم تفعيل الـ Location لاحقًا، كان التطبيق لا يكتشف التغيير ولا يبدأ تحديد الموقع تلقائيًا بدون عمل Refresh أو خروج/دخول للشاشة.

## السبب الجذري
- كان `watchPosition` يتم إنشاؤه مرة واحدة ويفشل عند Location OFF
- لم يكن هناك آلية لإعادة تشغيل الـ watcher عند تحول Location من OFF → ON
- لم تكن هناك دورة فحص منتظمة (polling) لمراقبة حالة الـ Location Services

## الحل المطبق (Fix)

### 1. LocationRecoveryLoop
آلية ذكية للمراقبة المستمرة:
```typescript
// كل 1.5 ثانية فحص تلقائي لحالة Location
startLocationPollingWhenOff() {
  setInterval(async () => {
    const { enabled, permission } = await recheckLocationState();

    if (enabled && permission === 'granted') {
      // Location أصبح ON! إيقاف المراقبة وإعادة تشغيل المحرك
      stopLocationPollingWhenOff();
      stopLocationWatcher();
      await ensureLocationFlow();
    }
  }, 1500);
}
```

### 2. ensureLocationFlow - المدير الرئيسي
دالة مركزية تدير حالة Location بالكامل:
```typescript
ensureLocationFlow() {
  1. فحص حالة Permission + Services
  2. إذا OFF → بدء LocationRecoveryLoop
  3. إذا ON → إيقاف جميع watchers القديمة + بدء fresh location requests
}
```

### 3. startLocationRequests - المحرك الفعلي
استراتيجية ذكية للحصول على الموقع:
```typescript
startLocationRequests() {
  // المحاولة 1: سريعة بدون highAccuracy (8 ثواني)
  try {
    position = getCurrentPosition(lowAccuracy, 8000ms);
  }

  // المحاولة 2: دقيقة مع highAccuracy (12 ثانية)
  catch {
    position = getCurrentPosition(highAccuracy, 12000ms);
  }

  // عند النجاح: تخزين الموقع ثم بدء watchPosition
  handleLocationSuccess(position);
  startLocationWatcher();
}
```

### 4. Lifecycle Triggers (دعم iOS/Safari)
مراقبة App Lifecycle لضمان الاستجابة الفورية:
```typescript
// عند عودة التطبيق للواجهة
document.addEventListener('visibilitychange', () => {
  if (visible) ensureLocationFlow();
});

// عند focus على window
window.addEventListener('focus', () => {
  ensureLocationFlow();
});

// عند app resume (iOS Safari)
window.addEventListener('pageshow', () => {
  ensureLocationFlow();
});
```

### 5. Watcher Restart Logic
ضمان عدم وجود watchers معلقة:
```typescript
// قبل بدء watcher جديد، إيقاف القديم حتمًا
stopLocationWatcher() {
  if (watchId) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
}
```

## سيناريو الاختبار (Repro + Acceptance)

### Test A: Login مع Location OFF ثم ON
```
1. إيقاف Location/GPS من إعدادات الجهاز
2. تسجيل دخول الموظف
3. انتظار 5 ثواني → يظهر "يرجى التحقق من تفعيل GPS..."
4. تفعيل Location من Control Center أو Settings
5. ✅ خلال ≤5 ثواني يتم الحصول على إحداثيات فعلية
6. ✅ يتحول Status إلى "داخل الفرع" أو "خارج الفرع"
```

### Test B: تكرار بدون Refresh
```
1. تكرار Test A ثلاث مرات متتالية
2. ✅ في كل مرة يعمل التطبيق بدون Refresh أو Logout
```

## Debug Mode
لتفعيل الـ logging التفصيلي:
```typescript
// في src/pages/EmployeeApp.tsx
const DEBUG_LOCATION_RECOVERY = true;
```

سيظهر في Console:
```
[Lifecycle] Employee loaded - starting location flow
[ensureLocationFlow] State check: { enabled: false, permission: "prompt" }
[ensureLocationFlow] Location OFF - starting recovery loop
[LocationRecoveryLoop] Started - checking every 1500ms
[LocationRecoveryLoop] Check: { enabled: false, permission: "prompt" }
[LocationRecoveryLoop] Check: { enabled: true, permission: "granted" }
[LocationRecoveryLoop] Location is ON! Restarting location engine...
[startLocationRequests] Attempt 1: lowAccuracy, 8s timeout
[startLocationRequests] Attempt 1 SUCCESS
[handleLocationSuccess] Received coordinates: { lat: 24.xxx, lng: 46.xxx }
[startLocationWatcher] Starting watch...
```

## رسائل UI
تدرج واضح في الرسائل:
1. **Location OFF**: "يرجى التحقق من تفعيل GPS وإعطاء صلاحية الموقع"
2. **Connecting**: "يتم الاتصال بخدمات الموقع..."
3. **Searching**: "جاري البحث عن إحداثيات موقعك..."
4. **Success**: عرض حالة داخل/خارج الفرع

## الفرق الأساسي (Before vs After)

### Before (القديم):
- ❌ Location OFF ثم ON → لا يعمل بدون Refresh
- ❌ watchPosition يتم إنشاؤه مرة واحدة فقط
- ❌ لا توجد آلية لاكتشاف تغيير حالة Location

### After (الجديد):
- ✅ LocationRecoveryLoop يراقب كل 1.5 ثانية
- ✅ Restart كامل للـ watcher عند اكتشاف Location ON
- ✅ Lifecycle triggers تضمن الاستجابة الفورية
- ✅ يعمل بدون Refresh أو Logout
- ✅ دعم iOS/Safari بشكل كامل

## الخلاصة
الحل يضمن تجربة مستخدم سلسة حيث يكتشف التطبيق تلقائيًا تفعيل GPS ويبدأ تحديد الموقع فورًا بدون أي تدخل يدوي من المستخدم.
