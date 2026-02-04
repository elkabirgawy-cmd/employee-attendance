# Auto Checkout - LOCATION_DISABLED Immediate Countdown

## التغييرات الجديدة

تم تعديل سلوك `LOCATION_DISABLED` ليبدأ العد التنازلي مباشرة بدون الحاجة إلى `verifyOutsideWithNReadings`.

## الفرق بين LOCATION_DISABLED و OUTSIDE_BRANCH

### 1. LOCATION_DISABLED (خدمة الموقع معطلة)

**السلوك:**
- يتخطى `verifyOutsideWithNReadings` بالكامل
- ينتقل مباشرة من `IDLE` إلى `COUNTDOWN`
- يبدأ العد التنازلي فورًا من `autoCheckoutAfterSeconds`
- لا يعرض "قراءة X من N"

**السبب:**
- عدم تمكين GPS
- رفض صلاحيات الموقع (permission denied)
- فشل في الحصول على موقع (getCurrentLocation returns null)

**Flow:**
```
IDLE ──(LOCATION_DISABLED detected)──> COUNTDOWN ──(timer=0)──> AUTO_CHECKOUT_DONE ──> IDLE
 ↑                                         ↑
 └─────────(2 good reads)─────────────────┘
```

**مثال - إغلاق GPS:**
```
t=0s:  IDLE (GPS ON)
t=6s:  COUNTDOWN (GPS OFF - immediate) ← No verifyOutsideWithNReadings!
       countdown starts at 900s
t=7s:  COUNTDOWN, remaining=899s
...
t=906s: AUTO_CHECKOUT_DONE
```

### 2. OUTSIDE_BRANCH (خارج نطاق الفرع)

**السلوك:**
- يحتاج `N` قراءات متتالية (افتراضي: 3)
- ينتقل من `IDLE` → `WARNING` → `COUNTDOWN`
- يعرض "قراءة X من N" في حالة `WARNING`

**السبب:**
- الموقع صحيح لكن المسافة > `geofence_radius`

**Flow:**
```
IDLE ──(N bad reads)──> WARNING ──(continue)──> COUNTDOWN ──(timer=0)──> AUTO_CHECKOUT_DONE ──> IDLE
 ↑                         ↑                       ↑
 └───(2 good reads)────────┴────(2 good reads)────┘
```

**مثال - خارج النطاق:**
```
t=0s:  IDLE (inside branch)
t=6s:  IDLE (outside - count=1)
t=12s: IDLE (outside - count=2)
t=18s: WARNING (outside - count=3) ← Transition to WARNING
       يعرض: "قراءة 3 من 3"
t=24s: WARNING (outside - count=4)
       يعرض: "قراءة 4 من 3"
t=30s: COUNTDOWN (outside - count=5) ← Start countdown
       countdown starts at 900s
```

## التغييرات في الكود

### autoCheckoutStateMachine.ts

#### 1. معالجة LOCATION_DISABLED في IDLE state

```typescript
if (stateRef.current === 'IDLE') {
  if (currentRawReason === 'LOCATION_DISABLED') {
    // Skip verifyOutsideWithNReadings - go directly to COUNTDOWN
    reasonStableCountRef.current = 1;
    reasonRef.current = 'LOCATION_DISABLED';
    clearReasonStableCountRef.current = 0;

    startCountdown(); // ← Direct transition!
  } else if (currentRawReason === 'OUTSIDE_BRANCH') {
    // Normal flow: use verifyOutsideWithNReadings
    if (prevRawReason === currentRawReason) {
      reasonStableCountRef.current++;
    } else {
      reasonStableCountRef.current = 1;
    }

    if (reasonStableCountRef.current === currentConfig.verifyOutsideWithNReadings) {
      updateStateData('WARNING', currentRawReason, reasonStableCountRef.current);
    }
  }
}
```

#### 2. معالجة LOCATION_DISABLED في WARNING state

```typescript
if (stateRef.current === 'WARNING') {
  if (currentRawReason === 'LOCATION_DISABLED') {
    // If location gets disabled during WARNING, skip to COUNTDOWN
    reasonStableCountRef.current = 1;
    reasonRef.current = 'LOCATION_DISABLED';
    clearReasonStableCountRef.current = 0;

    startCountdown(); // ← Override WARNING
  } else if (currentRawReason === 'OUTSIDE_BRANCH') {
    // Continue normal WARNING flow
    reasonStableCountRef.current++;
    updateStateData('WARNING', currentRawReason, reasonStableCountRef.current);
  }
}
```

### EmployeeApp.tsx

#### UI Display Logic

```typescript
{autoCheckoutIsActive ? (
  <>
    <div className="flex items-center gap-2">
      <AlertCircle className="w-6 h-6" />
      <span className="text-base">
        {autoCheckoutState.state === 'WARNING'
          ? 'تحذير - خارج نطاق الفرع'
          : 'انصراف تلقائي خلال'}
      </span>
    </div>

    {/* Countdown timer */}
    {autoCheckoutState.state === 'COUNTDOWN' ? (
      <div className="text-3xl font-mono font-bold tracking-wider" dir="ltr">
        {Math.floor(autoCheckoutState.countdownRemaining / 60).toString().padStart(2, '0')}:
        {(autoCheckoutState.countdownRemaining % 60).toString().padStart(2, '0')}
      </div>
    ) : autoCheckoutState.reason === 'OUTSIDE_BRANCH' ? (
      /* Only show failCount for OUTSIDE_BRANCH in WARNING state */
      <div className="text-sm opacity-90">
        قراءة {autoCheckoutState.failCount} من {autoCheckoutSettings?.verify_outside_with_n_readings || 3}
      </div>
    ) : null /* Don't show failCount for LOCATION_DISABLED */}

    {/* Reason text */}
    <div className="text-xs opacity-90">
      {autoCheckoutState.reason === 'LOCATION_DISABLED'
        ? 'خدمة الموقع معطلة'
        : 'خارج نطاق الفرع'}
    </div>
  </>
) : ...}
```

**المنطق:**
1. في `WARNING` state مع `OUTSIDE_BRANCH`: يعرض "قراءة X من N"
2. في `COUNTDOWN` state: يعرض العداد MM:SS
3. في `COUNTDOWN` state مع `LOCATION_DISABLED`: لا يعرض failCount

## العد التنازلي المستقل (Independent Countdown)

### التأكد من العمل بدون GEO_UPDATE

```typescript
const startCountdown = () => {
  countdownStartAtRef.current = Date.now(); // Set ONCE
  countdownDurationSecRef.current = currentConfig.afterSeconds;

  // Independent UI timer - runs every 1 second
  uiTimerRef.current = window.setInterval(() => {
    const now = Date.now();
    const elapsed = Math.floor((now - countdownStartAtRef.current) / 1000);
    const remaining = Math.max(0, countdownDurationSecRef.current - elapsed);

    // Updates UI every second, regardless of GEO_UPDATE frequency
    setStateData(prev => ({
      ...prev,
      countdownRemaining: remaining
    }));

    if (remaining <= 0) {
      // Execute auto-checkout
      onAutoCheckout();
    }
  }, 1000); // ← Every 1 second, NOT tied to watchIntervalSeconds!
};
```

**المبادئ:**
- `setInterval(1000)` منفصل تمامًا عن `watcherTick`
- `countdownStartAt` تُحفظ مرة واحدة
- `remaining` يُحسب من وقت البداية (computed)
- لا يتأثر بـ GEO_UPDATE (كل 6 ثواني)

## الاستقرار عند إعادة تمكين الموقع

### لا إلغاء فوري للعد

```typescript
if (stateRef.current === 'COUNTDOWN') {
  if (currentRawReason === null) {
    // Location re-enabled or back inside branch
    if (prevRawReason === null) {
      clearReasonStableCountRef.current++;
    } else {
      clearReasonStableCountRef.current = 1;
    }

    // Only reset after M=2 consecutive good readings
    if (clearReasonStableCountRef.current >= 2) {
      resetToIdle(); // ← Stop countdown after stability
    }
  } else {
    // Still have a problem, reset clear counter
    clearReasonStableCountRef.current = 0;
  }
}
```

**كيف يعمل:**
- عند إعادة تمكين GPS أثناء `COUNTDOWN`: لا يُلغى فورًا
- يحتاج قراءتين متتاليتين (M=2) من `null` (موقع جيد)
- يمنع الإلغاء الخاطئ عند GPS flickering

## سيناريوهات الاختبار

### سيناريو 1: إغلاق GPS مباشرة

**الإعدادات:**
- verifyOutsideWithNReadings = 3
- watch_interval = 6s
- countdown_duration = 900s (15 دقيقة)

**الخطوات:**
1. تسجيل الحضور (state=IDLE)
2. إغلاق GPS
3. انتظر 6 ثواني (قراءة واحدة فقط)

**النتيجة المتوقعة:**
```
t=0s:  IDLE - GPS ON
t=6s:  COUNTDOWN - GPS OFF (immediate, no WARNING!)
       reason: LOCATION_DISABLED
       countdown: 15:00
t=7s:  COUNTDOWN, countdown: 14:59
...
t=906s: AUTO_CHECKOUT_DONE
```

**Console Logs:**
```javascript
[AC_STATE] {
  prev: 'IDLE',
  next: 'COUNTDOWN', // ← Direct transition!
  reason: 'LOCATION_DISABLED',
  reasonStableCount: 1,
  clearStableCount: 0
}
```

### سيناريو 2: خارج النطاق مع GPS ON

**الخطوات:**
1. تسجيل الحضور (state=IDLE)
2. الخروج من نطاق الفرع
3. انتظر 18 ثانية (3 قراءات)

**النتيجة المتوقعة:**
```
t=0s:  IDLE - داخل النطاق
t=6s:  IDLE - خارج النطاق (count=1)
t=12s: IDLE - خارج النطاق (count=2)
t=18s: WARNING - خارج النطاق (count=3)
       يعرض: "قراءة 3 من 3"
t=24s: WARNING (count=4)
       يعرض: "قراءة 4 من 3"
t=30s: COUNTDOWN (count=5)
       countdown: 15:00
```

**Console Logs:**
```javascript
[AC_STATE] { prev: 'IDLE', next: 'WARNING', reason: 'OUTSIDE_BRANCH', reasonStableCount: 3 }
[AC_STATE] { prev: 'WARNING', next: 'COUNTDOWN', reason: 'OUTSIDE_BRANCH', reasonStableCount: 5 }
```

### سيناريو 3: إعادة تمكين GPS أثناء COUNTDOWN

**الخطوات:**
1. state = COUNTDOWN (GPS OFF, 5 دقائق متبقية)
2. فتح GPS
3. انتظر 12 ثانية (2 قراءات)

**النتيجة المتوقعة:**
```
t=0s:  COUNTDOWN - GPS OFF, 05:00 متبقي
t=6s:  COUNTDOWN - GPS ON (clearCount=1، لا يكفي)
       countdown continues: 04:54
t=12s: IDLE - GPS ON (clearCount=2، إلغاء العد)
```

**Console Logs:**
```javascript
[AC_STATE] {
  prev: 'COUNTDOWN',
  next: 'IDLE',
  reason: null,
  clearStableCount: 2
}
```

### سيناريو 4: GPS flickering أثناء COUNTDOWN

**الخطوات:**
1. state = COUNTDOWN (GPS OFF)
2. GPS flickers: OFF → ON → OFF → ON (كل 6 ثواني)

**النتيجة المتوقعة:**
```
t=0s:  COUNTDOWN - GPS OFF
t=6s:  COUNTDOWN - GPS ON (clearCount=1)
t=12s: COUNTDOWN - GPS OFF (clearCount reset to 0)
t=18s: COUNTDOWN - GPS ON (clearCount=1)
t=24s: COUNTDOWN - GPS OFF (clearCount reset to 0)
```

**لا إلغاء خاطئ:**
- countdown يستمر حتى يحصل على قراءتين متتاليتين من GPS ON
- لا يتأثر بـ flickering

### سيناريو 5: إغلاق GPS أثناء WARNING (OUTSIDE_BRANCH)

**الخطوات:**
1. state = WARNING (خارج النطاق، count=3)
2. إغلاق GPS
3. انتظر 6 ثواني (قراءة واحدة)

**النتيجة المتوقعة:**
```
t=0s:  WARNING - خارج النطاق, count=3
       يعرض: "قراءة 3 من 3"
t=6s:  COUNTDOWN - GPS OFF (override WARNING!)
       reason changed: LOCATION_DISABLED
       countdown: 15:00
       لا يعرض: "X من N"
```

**Console Logs:**
```javascript
[AC_STATE] {
  prev: 'WARNING',
  next: 'COUNTDOWN',
  reason: 'LOCATION_DISABLED', // ← Reason changed
  reasonStableCount: 1
}
```

## ملخص السلوك

| Reason | verifyOutsideWithNReadings | States Flow | Shows failCount |
|--------|---------------------------|-------------|-----------------|
| LOCATION_DISABLED | ❌ تخطي | IDLE → COUNTDOWN | ❌ لا |
| OUTSIDE_BRANCH | ✅ يحتاج N قراءات | IDLE → WARNING → COUNTDOWN | ✅ نعم (في WARNING) |

### في WARNING state:
- `OUTSIDE_BRANCH`: يعرض "قراءة X من N"
- `LOCATION_DISABLED`: لا ينطبق (يذهب مباشرة إلى COUNTDOWN)

### في COUNTDOWN state:
- يعرض العداد MM:SS فقط
- لا يعرض failCount لأي reason

## Build Status

```bash
npm run build
✓ built in 7.61s
✅ No errors
```

## الخلاصة

التغييرات المطبقة:

1. **LOCATION_DISABLED يبدأ العد مباشرة** - لا ينتظر N قراءات
2. **OUTSIDE_BRANCH يستخدم المنطق القديم** - يحتاج N قراءات
3. **العداد مستقل** - يعمل بـ setInterval(1000) بدون اعتماد على GEO_UPDATE
4. **استقرار عند إعادة التمكين** - يحتاج M=2 قراءات متتالية للإلغاء
5. **لا يعرض failCount لـ LOCATION_DISABLED** - فقط للـ OUTSIDE_BRANCH في WARNING

النتيجة: سلوك أسرع وأكثر وضوحًا للموظف عند إغلاق GPS.
