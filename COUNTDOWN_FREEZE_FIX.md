# Auto Checkout Button Flip Fix - Debounce & Stability

## المشكلة

زر الانصراف يتقلب (flipping) بسرعة على كل تحديث موقع:
- UI يتغير فورًا على أول قراءة GPS سيئة
- لا يوجد debounce/استقرار للسبب
- العداد يتأثر بتحديثات الموقع
- setState متكرر يسبب re-renders غير ضرورية

## الحل المطبق

### 1. مصدر واحد للحالة (Single Source of Truth)

```typescript
type ACState = 'IDLE' | 'WARNING' | 'COUNTDOWN' | 'AUTO_CHECKOUT_DONE';
type ACReason = 'LOCATION_DISABLED' | 'OUTSIDE_BRANCH' | null;
```

**الحالات:**
- `IDLE`: الوضع الطبيعي، الموقع داخل النطاق
- `WARNING`: تحذير - تم اكتشاف N قراءات متتالية خارج النطاق
- `COUNTDOWN`: العد التنازلي بدأ
- `AUTO_CHECKOUT_DONE`: تم تنفيذ الانصراف التلقائي

**الأسباب:**
- `null`: الموقع داخل النطاق، كل شيء طبيعي
- `LOCATION_DISABLED`: خدمة الموقع معطلة
- `OUTSIDE_BRANCH`: خارج نطاق الفرع

### 2. Debounce/استقرار للسبب

#### عند اكتشاف مشكلة (IDLE → WARNING):

```typescript
if (stateRef.current === 'IDLE') {
  if (currentRawReason !== null) {
    if (prevRawReason === currentRawReason) {
      reasonStableCountRef.current++;
    } else {
      reasonStableCountRef.current = 1; // Reset if reason changed
    }

    // Only transition to WARNING after N consecutive bad readings
    if (reasonStableCountRef.current === currentConfig.verifyOutsideWithNReadings) {
      updateStateData('WARNING', currentRawReason, reasonStableCountRef.current);
    }
  }
}
```

**كيف يعمل:**
- يحسب `rawReason` في كل watcher tick (كل 6 ثواني)
- يحتاج `N` قراءات متتالية من نفس السبب للانتقال إلى WARNING
- إذا تغير السبب، يعيد العداد من 1
- لا ينتقل إلى WARNING إلا بعد `N` قراءات متتالية

#### عند بدء العد التنازلي (WARNING → COUNTDOWN):

```typescript
if (stateRef.current === 'WARNING') {
  if (currentRawReason !== null && currentRawReason === prevRawReason) {
    reasonStableCountRef.current++;

    // Start countdown after exceeding threshold
    if (reasonStableCountRef.current > currentConfig.verifyOutsideWithNReadings) {
      startCountdown();
    }
  }
}
```

**كيف يعمل:**
- يستمر في زيادة `reasonStableCount`
- عندما يتجاوز `N`، يبدأ العد التنازلي
- UI يعرض `failCount` في حالة WARNING

#### عند عودة الموقع (WARNING/COUNTDOWN → IDLE):

```typescript
if (currentRawReason === null) {
  if (prevRawReason === null) {
    clearReasonStableCountRef.current++;
  } else {
    clearReasonStableCountRef.current = 1;
  }

  // Only reset after M consecutive good readings
  if (clearReasonStableCountRef.current >= 2) {
    resetToIdle();
  }
}
```

**كيف يعمل:**
- يحتاج `M=2` قراءات متتالية من `null` (موقع جيد)
- يمنع التقليب السريع عند GPS flickering
- يعود إلى IDLE فقط بعد تأكيد الاستقرار

### 3. فصل العداد عن تحديثات الموقع

```typescript
const startCountdown = () => {
  countdownStartAtRef.current = Date.now(); // Set ONCE
  countdownDurationSecRef.current = currentConfig.afterSeconds;

  // UI timer runs independently
  uiTimerRef.current = window.setInterval(() => {
    const elapsed = Math.floor((now - countdownStartAtRef.current) / 1000);
    const remaining = Math.max(0, countdownDurationSecRef.current - elapsed);

    // Computed from start time, not reset on GEO_UPDATE
    setStateData(prev => ({
      ...prev,
      countdownRemaining: remaining
    }));
  }, 1000);
};
```

**كيف يعمل:**
- `countdownStartAt` تُحفظ مرة واحدة عند بدء العد
- العد التنازلي يُحسب من وقت البداية (computed)
- `setInterval` منفصل يعمل كل ثانية
- لا يتأثر بتحديثات GPS (كل 6 ثواني)

### 4. أولوية عرض ثابتة (Stable UI Priority)

UI derives from state only:

```typescript
// IDLE => زر "تسجيل الانصراف" عادي
if (state === 'IDLE') {
  return <button>تسجيل الانصراف</button>;
}

// WARNING => شريط تحذير + عرض failCount
if (state === 'WARNING') {
  return (
    <button disabled style={{orange gradient}}>
      تحذير - خارج نطاق الفرع
      <div>قراءة {failCount} من {N}</div>
    </button>
  );
}

// COUNTDOWN => بطاقة العداد + الزر معطل/مخفي
if (state === 'COUNTDOWN') {
  return (
    <button disabled style={{orange gradient}}>
      انصراف تلقائي خلال
      <div>{MM:SS}</div>
    </button>
  );
}
```

**المبادئ:**
- لكل state عرض واحد ثابت
- لا يتغير العرض إلا بتغيير state
- state لا يتغير إلا بعد debounce/استقرار

### 5. منع Re-renders غير ضرورية

```typescript
const updateStateData = (newState: ACState, newReason: ACReason, failCount: number) => {
  setStateData(prev => {
    // Shallow compare to prevent unnecessary renders
    if (
      prev.state === newState &&
      prev.reason === newReason &&
      prev.failCount === failCount &&
      (newState !== 'COUNTDOWN' || prev.countdownRemaining === prev.countdownRemaining)
    ) {
      return prev; // Same state, don't trigger re-render
    }
    return {
      state: newState,
      reason: newReason,
      countdownRemaining: prev.countdownRemaining,
      failCount
    };
  });
};
```

**كيف يعمل:**
- Shallow compare قبل `setState`
- لا يُحدّث state إلا إذا تغيرت القيمة فعليًا
- يمنع re-renders عند تساوي القيم

### 6. Logs قليلة وواضحة

```typescript
const logStateChange = (
  prevState: ACState,
  nextState: ACState,
  reason: ACReason,
  reasonStableCount: number,
  clearStableCount: number
) => {
  console.log('[AC_STATE]', {
    prev: prevState,
    next: nextState,
    reason,
    reasonStableCount,
    clearStableCount,
    ts: new Date().toISOString()
  });
};
```

**فقط عند تغيير state:**
```javascript
[AC_STATE] {
  prev: 'IDLE',
  next: 'WARNING',
  reason: 'OUTSIDE_BRANCH',
  reasonStableCount: 3,
  clearStableCount: 0,
  ts: '2026-01-23T...'
}
```

## State Machine Flow

### الانتقالات (Transitions)

```
IDLE ──(N bad reads)──> WARNING ──(continue)──> COUNTDOWN ──(timer=0)──> AUTO_CHECKOUT_DONE ──> IDLE
 ↑                         ↑                       ↑
 └───(M good reads)────────┴────(M good reads)────┘
```

### تفصيل الانتقالات

#### 1. IDLE → WARNING

**الشروط:**
- قراءة `rawReason` متتالية من نفس النوع
- عدد القراءات = `verifyOutsideWithNReadings` (افتراضي: 3)

**مثال (N=3, watch interval=6s):**
```
t=0s:  IDLE, rawReason=null
t=6s:  IDLE, rawReason=OUTSIDE_BRANCH (count=1)
t=12s: IDLE, rawReason=OUTSIDE_BRANCH (count=2)
t=18s: WARNING, rawReason=OUTSIDE_BRANCH (count=3) ← Transition!
```

#### 2. WARNING → COUNTDOWN

**الشروط:**
- استمرار `rawReason` بنفس القيمة
- عدد القراءات > `verifyOutsideWithNReadings`

**مثال:**
```
t=18s: WARNING, count=3
t=24s: WARNING, count=4
t=30s: COUNTDOWN, count=5 ← Transition!
```

#### 3. COUNTDOWN → AUTO_CHECKOUT_DONE

**الشروط:**
- العد التنازلي وصل إلى 0

**مثال:**
```
t=30s:  COUNTDOWN, remaining=900s
t=31s:  COUNTDOWN, remaining=899s
...
t=930s: COUNTDOWN, remaining=0s
t=930s: AUTO_CHECKOUT_DONE ← Transition!
t=931s: IDLE (after auto-checkout completes)
```

#### 4. WARNING/COUNTDOWN → IDLE

**الشروط:**
- `rawReason` = null (موقع جيد)
- قراءتان متتاليتان من null (M=2)

**مثال:**
```
t=18s: WARNING, count=3
t=24s: WARNING, rawReason=null (clearCount=1)
t=30s: IDLE, rawReason=null (clearCount=2) ← Transition!
```

## سيناريوهات الاختبار

### سيناريو 1: إغلاق الموقع 20 ثانية

**الإعدادات:**
- N = 3 (verifyOutsideWithNReadings)
- watch_interval = 6s
- countdown_duration = 15s (للاختبار)

**الخطوات:**
1. تسجيل الحضور (state=IDLE)
2. إغلاق GPS
3. انتظر 18 ثانية (3 قراءات × 6 ثواني)

**النتيجة المتوقعة:**
```
t=0s:  ✅ IDLE - زر انصراف عادي
t=6s:  ✅ IDLE - لا تغيير (قراءة 1)
t=12s: ✅ IDLE - لا تغيير (قراءة 2)
t=18s: ⚠️ WARNING - "تحذير - قراءة 3 من 3" (قراءة 3)
t=24s: ⏱️ COUNTDOWN - "انصراف تلقائي خلال 00:15"
t=39s: ✅ AUTO_CHECKOUT_DONE - تم الانصراف التلقائي
```

**Console Logs:**
```javascript
[AC_STATE] { prev: 'IDLE', next: 'WARNING', reason: 'LOCATION_DISABLED', reasonStableCount: 3 }
[AC_STATE] { prev: 'WARNING', next: 'COUNTDOWN', reason: 'LOCATION_DISABLED', reasonStableCount: 4 }
[AC_STATE] { prev: 'COUNTDOWN', next: 'AUTO_CHECKOUT_DONE', reason: 'LOCATION_DISABLED' }
[AC_STATE] { prev: 'AUTO_CHECKOUT_DONE', next: 'IDLE', reason: null }
```

### سيناريو 2: فتح الموقع أثناء WARNING

**الخطوات:**
1. state = WARNING (count=3)
2. فتح GPS
3. انتظر 12 ثانية (2 قراءات × 6 ثواني)

**النتيجة المتوقعة:**
```
t=0s:  ⚠️ WARNING - "تحذير - قراءة 3 من 3"
t=6s:  ⚠️ WARNING - لا تغيير (clearCount=1، لا يكفي)
t=12s: ✅ IDLE - عودة للوضع الطبيعي (clearCount=2)
```

**Console Logs:**
```javascript
[AC_STATE] { prev: 'WARNING', next: 'IDLE', reason: null, clearStableCount: 2 }
```

### سيناريو 3: GPS flickering (تقليب سريع)

**الخطوات:**
1. state = WARNING (count=3)
2. GPS flickers: OFF → ON → OFF → ON (كل 6 ثواني)

**النتيجة المتوقعة:**
```
t=0s:  ⚠️ WARNING - count=3
t=6s:  ⚠️ WARNING - ON (clearCount=1، count reset to 0)
t=12s: ⚠️ WARNING - OFF (clearCount reset, count=1)
t=18s: ⚠️ WARNING - ON (clearCount=1، count reset to 0)
```

**لا تقليب في UI:**
- UI يبقى في WARNING
- لا ينتقل إلى IDLE إلا بعد قراءتين متتاليتين من ON
- لا ينتقل إلى COUNTDOWN إلا بعد قراءات متتالية من OFF

### سيناريو 4: داخل/خارج النطاق بسرعة

**الخطوات:**
1. state = IDLE
2. خارج النطاق → داخل النطاق → خارج النطاق (كل 6 ثواني)

**النتيجة المتوقعة:**
```
t=0s:  ✅ IDLE - داخل النطاق
t=6s:  ✅ IDLE - خارج (count=1، لا يكفي)
t=12s: ✅ IDLE - داخل (count reset to 0)
t=18s: ✅ IDLE - خارج (count=1، لا يكفي)
```

**لا تقليب:**
- UI يبقى IDLE + زر انصراف عادي
- لا تظهر WARNING إلا بعد 3 قراءات متتالية خارج النطاق

## التغييرات في الكود

### ملف `src/utils/autoCheckoutStateMachine.ts`

**التغييرات الرئيسية:**

1. **إضافة failCount إلى stateData:**
```typescript
interface AutoCheckoutStateData {
  state: ACState;
  reason: ACReason;
  countdownRemaining: number;
  failCount: number; // NEW
}
```

2. **تعديل منطق IDLE → WARNING:**
```typescript
// OLD: Transition immediately on first bad reading
if (reasonStableCountRef.current === 1) {
  updateState('WARNING', currentRawReason);
}

// NEW: Wait for N consecutive bad readings
if (reasonStableCountRef.current === currentConfig.verifyOutsideWithNReadings) {
  updateStateData('WARNING', currentRawReason, reasonStableCountRef.current);
}
```

3. **إضافة shallow compare:**
```typescript
setStateData(prev => {
  if (
    prev.state === newState &&
    prev.reason === newReason &&
    prev.failCount === failCount
  ) {
    return prev; // Prevent unnecessary re-render
  }
  return { state: newState, reason: newReason, failCount, ... };
});
```

4. **تحديث failCount في WARNING:**
```typescript
if (stateRef.current === 'WARNING') {
  reasonStableCountRef.current++;
  updateStateData('WARNING', currentRawReason, reasonStableCountRef.current);
}
```

5. **Logs فقط عند تغيير state:**
```typescript
if (prevState !== newState || reasonRef.current !== newReason) {
  logStateChange(prevState, newState, ...);
}
```

## Build Status

```bash
npm run build
✓ built in 7.93s
✅ No errors
```

## ملخص الحل

تم إصلاح تقليب زر الانصراف من خلال:

1. **Debounce للسبب:** يحتاج N قراءات متتالية (افتراضي: 3) لتغيير state (لـ OUTSIDE_BRANCH فقط)
2. **Debounce للعودة:** يحتاج M قراءات متتالية (2) للعودة إلى IDLE
3. **فصل العداد:** computed من start time، لا يتأثر بتحديثات GPS
4. **Shallow compare:** منع re-renders غير ضرورية
5. **Logs محدودة:** فقط عند تغيير state

**النتيجة:**
- لا تقليب في UI على كل GPS update
- انتقال smooth بين الحالات
- يعرض failCount في WARNING للشفافية (لـ OUTSIDE_BRANCH فقط)
- استقرار كامل في العد التنازلي

## تحديث جديد: LOCATION_DISABLED

**سلوك خاص لـ LOCATION_DISABLED:**
- يتخطى verifyOutsideWithNReadings بالكامل
- ينتقل مباشرة من IDLE → COUNTDOWN
- لا يعرض "قراءة X من N"
- العد يبدأ فورًا من autoCheckoutAfterSeconds

**انظر `AUTO_CHECKOUT_LOCATION_DISABLED_FIX.md` للتفاصيل الكاملة.**
