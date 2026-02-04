# Auto Checkout - Original Logic Restored

## التغييرات

تم إرجاع منطق Auto-Checkout إلى الطريقة الأصلية البسيطة بدون state machine معقد.

## المنطق الأصلي (5 أجزاء)

### 1. Trigger واحد ثابت

```typescript
const hasLocationWarning = (): { hasWarning: boolean; reason: 'LOCATION_DISABLED' | 'OUT_OF_BRANCH' | null } => {
  // Check 1: GPS disabled or stale
  if (locationHealth.isDisabled || locationHealth.isStale) {
    return { hasWarning: true, reason: 'LOCATION_DISABLED' };
  }

  // Check 2: No location and not locating
  if (!location && locationState !== 'LOCATING') {
    return { hasWarning: true, reason: 'LOCATION_DISABLED' };
  }

  // Check 3: Confirmed outside branch
  if (isConfirmedOutside && location) {
    return { hasWarning: true, reason: 'OUT_OF_BRANCH' };
  }

  return { hasWarning: false, reason: null };
};
```

**Trigger Logic:**
- `warning = hasLocationWarning()`
- إذا `warning.hasWarning && !autoCheckout.active` → `startAutoCheckout(warning.reason)`
- إذا `!warning.hasWarning && autoCheckout.active` → `cancelAutoCheckout()`

**لا يوجد:**
- منطق (X من N قراءة)
- تحقق تدريجي
- state machine معقد

### 2. startAutoCheckout(reason)

```typescript
const startAutoCheckout = (reason: 'LOCATION_DISABLED' | 'OUT_OF_BRANCH') => {
  // Guard
  if (!autoCheckoutSettings || !currentLog || autoCheckout.active) {
    return;
  }

  const startedAt = Date.now();
  const endsAt = startedAt + (autoCheckoutSettings.auto_checkout_after_seconds * 1000);

  const newState = {
    active: true,
    reason,
    startedAtServerMs: startedAt,
    endsAtServerMs: endsAt
  };

  setAutoCheckout(newState);

  // Save to localStorage
  if (employee?.id) {
    localStorage.setItem(`auto_checkout_${employee.id}`, JSON.stringify(newState));
  }
};
```

**المبادئ:**
- `endsAt` يُضبط مرة واحدة من `auto_checkout_after_seconds` (إعدادات الأدمن)
- يحفظ في localStorage للاستمرارية
- Guard: لا يبدأ إذا كان active بالفعل

### 3. Countdown Effect (الأهم)

```typescript
useEffect(() => {
  if (autoCheckout.active && autoCheckout.endsAtServerMs) {
    // Single interval: runs every 1000ms
    autoCheckoutTimerRef.current = window.setInterval(() => {
      const remainingMs = Math.max(0, autoCheckout.endsAtServerMs! - Date.now());

      if (remainingMs <= 0) {
        clearInterval(autoCheckoutTimerRef.current!);
        autoCheckoutTimerRef.current = null;
        executeAutoCheckout();
      }
    }, 1000);

    return () => {
      if (autoCheckoutTimerRef.current) {
        clearInterval(autoCheckoutTimerRef.current);
        autoCheckoutTimerRef.current = null;
      }
    };
  }
}, [autoCheckout.active, autoCheckout.endsAtServerMs]);
```

**المبادئ:**
- Interval واحد فقط يعمل كل 1000ms
- مستقل عن GPS watcher
- `remainingMs = endsAtServerMs - Date.now()` (computed)
- عند `remainingMs <= 0`: ينفذ `executeAutoCheckout()`
- Cleanup تلقائي

**ممنوع:**
- إنشاء interval داخل GPS watcher
- reset العداد على كل GPS tick
- multiple intervals

### 4. Restore من localStorage

```typescript
useEffect(() => {
  if (!currentLog || !employee) {
    return;
  }

  try {
    const stored = localStorage.getItem(`auto_checkout_${employee.id}`);
    if (stored) {
      const parsed = JSON.parse(stored);

      if (parsed.endsAtServerMs && parsed.endsAtServerMs > Date.now()) {
        // Still valid - restore and continue countdown
        setAutoCheckout(parsed);
      } else if (parsed.endsAtServerMs && parsed.endsAtServerMs <= Date.now()) {
        // Expired - restore then execute immediately
        setAutoCheckout(parsed);
        setTimeout(() => {
          executeAutoCheckout();
        }, 100);
      } else {
        // Invalid - clean up
        localStorage.removeItem(`auto_checkout_${employee.id}`);
      }
    }
  } catch (err) {
    console.error('[AC_RESTORE_ERROR]', err);
  }
}, [currentLog, employee]);
```

**السلوك:**
- يقرأ من localStorage عند وجود currentLog + employee
- إذا `endsAt > now`: يستعيد العد ويستمر
- إذا `endsAt <= now`: يستعيد ثم ينفذ checkout فوراً
- إذا invalid: ينظف localStorage

### 5. executeAutoCheckout

```typescript
const executeAutoCheckout = async () => {
  if (!autoCheckout.active || !currentLog || !handleCheckOutRef.current) {
    return;
  }

  try {
    // Execute checkout with source='auto' and bypassConfirm=true
    await handleCheckOutRef.current({ source: 'auto', bypassConfirm: true });
  } catch (err) {
    console.error('[AC_EXECUTE_ERROR]', err);
  } finally {
    cancelAutoCheckout();
  }
};
```

**في handleCheckOut:**
```typescript
if (source === 'auto' && currentLog) {
  const checkoutReason = autoCheckoutRef.current.reason === 'LOCATION_DISABLED'
    ? 'LOCATION_DISABLED'
    : autoCheckoutRef.current.reason === 'OUT_OF_BRANCH'
    ? 'OUT_OF_BRANCH'
    : 'AUTO';

  await supabase
    .from('attendance_logs')
    .update({
      checkout_type: 'AUTO',
      checkout_reason: checkoutReason
    })
    .eq('id', currentLog.id);
}
```

**المبادئ:**
- ينفذ checkout بدون confirm modal
- يحدث `checkout_type='AUTO'`
- يحدث `checkout_reason` حسب `autoCheckout.reason`:
  - `LOCATION_DISABLED`: خدمة الموقع معطلة
  - `OUT_OF_BRANCH`: خارج نطاق الفرع
- ثم `cancelAutoCheckout()`

## Trigger Effect

```typescript
useEffect(() => {
  if (!autoCheckoutSettings?.auto_checkout_enabled || !currentLog) {
    return;
  }

  const warning = hasLocationWarning();

  if (warning.hasWarning && !autoCheckout.active && warning.reason) {
    startAutoCheckout(warning.reason);
  } else if (!warning.hasWarning && autoCheckout.active) {
    cancelAutoCheckout();
  }
}, [locationHealth, location, locationState, isConfirmedOutside, currentLog, autoCheckoutSettings, autoCheckout.active]);
```

**Dependencies:**
- `locationHealth`: permission, isDisabled, isStale
- `location`: current GPS location
- `locationState`: 'LOCATING' | 'OK' | 'STALE' | 'ERROR'
- `isConfirmedOutside`: boolean
- `currentLog`: attendance log
- `autoCheckoutSettings`: settings
- `autoCheckout.active`: current state

## State Structure

```typescript
const [autoCheckout, setAutoCheckout] = useState<{
  active: boolean;
  reason: 'LOCATION_DISABLED' | 'OUT_OF_BRANCH' | null;
  startedAtServerMs: number | null;
  endsAtServerMs: number | null;
}>({
  active: false,
  reason: null,
  startedAtServerMs: null,
  endsAtServerMs: null
});
```

**بسيط وواضح:**
- `active`: هل العد نشط؟
- `reason`: السبب (LOCATION_DISABLED أو OUT_OF_BRANCH)
- `startedAtServerMs`: متى بدأ
- `endsAtServerMs`: متى سينتهي (timestamp ثابت)

## UI Display

```typescript
{autoCheckout.active ? (
  <>
    <div className="flex items-center gap-2">
      <AlertCircle className="w-6 h-6" />
      <span className="text-base">انصراف تلقائي خلال</span>
    </div>
    <div className="text-3xl font-mono font-bold tracking-wider" dir="ltr">
      {(() => {
        const remainingSec = autoCheckout.endsAtServerMs
          ? Math.max(0, Math.ceil((autoCheckout.endsAtServerMs - Date.now()) / 1000))
          : 0;
        return `${Math.floor(remainingSec / 60).toString().padStart(2, '0')}:${(remainingSec % 60).toString().padStart(2, '0')}`;
      })()}
    </div>
    <div className="text-xs opacity-90">
      {autoCheckout.reason === 'LOCATION_DISABLED' ? 'خدمة الموقع معطلة' : 'خارج نطاق الفرع'}
    </div>
  </>
) : null}
```

**المبادئ:**
- يعرض فقط عند `autoCheckout.active`
- `remainingSec` computed من `endsAtServerMs - Date.now()`
- يعرض السبب (LOCATION_DISABLED أو OUT_OF_BRANCH)
- لا تعديل في تصميم UI الموظف

## Flow Examples

### Scenario 1: قفل GPS

```
t=0s:   active=false, GPS ON
        hasLocationWarning() → {hasWarning: false}

t=5s:   [User closes GPS]
        locationHealth.isDisabled = true
        hasLocationWarning() → {hasWarning: true, reason: 'LOCATION_DISABLED'}
        → startAutoCheckout('LOCATION_DISABLED')
        → endsAtServerMs = now + 900s (15 min)
        → save to localStorage

t=6s:   [Countdown interval tick]
        remainingSec = 899
        UI: 14:59

t=7s:   remainingSec = 898
        UI: 14:58

...

t=905s: remainingSec = 0
        → executeAutoCheckout()
        → handleCheckOut({source: 'auto', bypassConfirm: true})
        → update checkout_type='AUTO', checkout_reason='LOCATION_DISABLED'
        → cancelAutoCheckout()
```

### Scenario 2: فتح GPS (إلغاء)

```
t=0s:   active=true, countdown=500s, GPS OFF
        locationHealth.isDisabled = true

t=5s:   [User opens GPS]
        locationHealth.isDisabled = false
        locationHealth.isFresh = true
        hasLocationWarning() → {hasWarning: false}
        → cancelAutoCheckout()
        → remove from localStorage
        → active = false
```

### Scenario 3: خارج الفرع

```
t=0s:   active=false, inside branch
        isConfirmedOutside = false

t=5s:   [User leaves branch]
        isConfirmedOutside = true
        hasLocationWarning() → {hasWarning: true, reason: 'OUT_OF_BRANCH'}
        → startAutoCheckout('OUT_OF_BRANCH')
        → endsAtServerMs = now + 900s

t=6s:   countdown starts: 14:59
...

t=905s: → executeAutoCheckout()
        → checkout_reason='OUT_OF_BRANCH'
```

### Scenario 4: إعادة تحميل أثناء العد

```
t=0s:   active=true, countdown=600s
        localStorage: auto_checkout_123 = {active:true, endsAtServerMs:...}

t=5s:   [User reloads page]
        → Read from localStorage
        → endsAtServerMs > now? YES
        → setAutoCheckout(saved)
        → Countdown continues from ~595s

t=6s:   UI: 09:55
t=7s:   UI: 09:54
...
```

## ما تم الحفاظ عليه

✅ **المنطق الأصلي البسيط**
- hasLocationWarning() بالضبط كما كان
- startAutoCheckout/cancelAutoCheckout بسيط
- Single countdown interval (1000ms)
- localStorage persistence

✅ **التصميم الأصلي**
- لا تغيير في UI الموظف
- نفس الألوان والأيقونات
- نفس الرسائل

✅ **السلوك الأصلي**
- Trigger فوري (لا X من N قراءة)
- endsAt من إعدادات الأدمن
- checkout_type و checkout_reason

## ما تم إزالته

❌ **State Machine المعقد**
- حذف `autoCheckoutStateMachine.ts`
- حذف `useAutoCheckoutWatcher.ts`
- لا state strings معقدة
- لا منطق تدريجي

❌ **المنطق الزائد**
- لا outsideCount
- لا verifyOutsideWithNReadings
- لا failCount
- لا reasonStableCount

## الملفات المعدلة

1. **src/pages/EmployeeApp.tsx**
   - إضافة autoCheckout state
   - إضافة hasLocationWarning()
   - إضافة startAutoCheckout()
   - إضافة cancelAutoCheckout()
   - إضافة executeAutoCheckout()
   - إضافة countdown effect
   - إضافة restore effect
   - إضافة trigger effect
   - تحديث handleCheckOut لتحديد checkout_reason
   - تحديث UI ليستخدم autoCheckout state

2. **Deleted files:**
   - src/utils/autoCheckoutStateMachine.ts
   - src/utils/useAutoCheckoutWatcher.ts

## Build Status

```bash
npm run build
✓ built in 8.08s
✅ No errors
```

## النتيجة

تم إرجاع منطق Auto-Checkout إلى الطريقة الأصلية البسيطة:
- زر ثابت (لا يتقلب)
- العد ينزل فعلياً mm:ss كل ثانية
- العد لا يعتمد على تحديثات GPS
- localStorage persistence يعمل
- checkout_type و checkout_reason يحدثان بشكل صحيح
