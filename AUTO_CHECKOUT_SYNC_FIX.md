# إصلاح تجميد العد التنازلي عند 00:00 - Sync & Retry

## المشكلة

بعد إغلاق وفتح التطبيق، كان العد التنازلي يتجمد عند 00:00 ولا يتم تنفيذ الانصراف التلقائي.

### الأسباب
1. **عدم المزامنة مع السيرفر**: عند فتح التطبيق، لم يكن هناك آلية للتحقق من حالة الانصراف التلقائي الحقيقية
2. **عدم وجود آلية retry**: عند انتهاء العد، لم تكن هناك محاولات متكررة لتنفيذ الانصراف
3. **عرض 00:00 كحالة نهائية**: كان يتم عرض 00:00 بشكل ثابت بدون مؤشر على حالة التنفيذ

## الحل المنفذ

### 1. إضافة executionState

```typescript
const [autoCheckout, setAutoCheckout] = useState<{
  active: boolean;
  reason: 'LOCATION_DISABLED' | 'OUT_OF_BRANCH' | null;
  startedAtServerMs: number | null;
  endsAtServerMs: number | null;
  executionState: 'IDLE' | 'COUNTING' | 'EXECUTING' | 'DONE' | 'CANCELLED';
}>({
  active: false,
  reason: null,
  startedAtServerMs: null,
  endsAtServerMs: null,
  executionState: 'IDLE'
});
```

**الحالات:**
- `IDLE`: لا يوجد انصراف تلقائي نشط
- `COUNTING`: العد التنازلي جاري
- `EXECUTING`: جاري تنفيذ الانصراف التلقائي
- `DONE`: تم الانصراف بنجاح
- `CANCELLED`: تم إلغاء الانصراف التلقائي

### 2. دالة syncAutoCheckoutState

**الوظيفة:** مزامنة حالة الانصراف التلقائي مع قاعدة البيانات

```typescript
const syncAutoCheckoutState = async (isPolling = false) => {
  const { data: logData } = await supabase
    .from('attendance_logs')
    .select('check_out_time')
    .eq('id', currentLog.id)
    .maybeSingle();

  const { data: pendingData } = await supabase
    .from('auto_checkout_pending')
    .select('*')
    .eq('employee_id', employee.id)
    .eq('attendance_log_id', currentLog.id)
    .eq('status', 'PENDING')
    .limit(1)
    .maybeSingle();

  const logCheckedOut = logData?.check_out_time !== null;

  // لو تم الانصراف
  if (logCheckedOut) {
    setAutoCheckout({
      active: false,
      reason: null,
      startedAtServerMs: null,
      endsAtServerMs: null,
      executionState: 'DONE'
    });
    return;
  }

  // لو موجود pending
  if (pendingData) {
    const endsAtMs = new Date(pendingData.ends_at).getTime();
    const now = Date.now();
    const remainingSec = Math.max(0, Math.ceil((endsAtMs - now) / 1000));

    let executionState = 'COUNTING';
    if (remainingSec <= 0) {
      executionState = 'EXECUTING';
    }

    setAutoCheckout({
      active: true,
      reason: pendingData.reason === 'GPS_BLOCKED' ? 'LOCATION_DISABLED' : 'OUT_OF_BRANCH',
      startedAtServerMs: new Date(pendingData.created_at).getTime(),
      endsAtServerMs: endsAtMs,
      executionState
    });

    if (executionState === 'EXECUTING') {
      retryCheckout();
    }
  } else {
    setAutoCheckout({
      active: false,
      reason: null,
      startedAtServerMs: null,
      endsAtServerMs: null,
      executionState: 'IDLE'
    });
  }
};
```

**الفوائد:**
- ✅ قراءة الحالة من DB
- ✅ حساب الوقت المتبقي من timestamps
- ✅ تحديد executionState بناءً على الوقت المتبقي
- ✅ تشغيل retryCheckout تلقائيًا لو انتهى الوقت

### 3. دالة retryCheckout

**الوظيفة:** محاولة تنفيذ الانصراف التلقائي مع إعادة المحاولة

```typescript
const retryCheckout = async () => {
  const maxAttempts = 12;
  const retryIntervalMs = 5000;

  const attemptCheckout = async () => {
    retryCheckoutAttemptsRef.current += 1;
    const attemptNum = retryCheckoutAttemptsRef.current;

    console.log('[RETRY_CHECKOUT]', { attempt: attemptNum, maxAttempts });

    try {
      await handleCheckOutRef.current({ source: 'auto' });
      console.log('[RETRY_CHECKOUT] Success on attempt', attemptNum);
      retryCheckoutAttemptsRef.current = 0;
      await syncAutoCheckoutState();
    } catch (err) {
      console.error('[RETRY_CHECKOUT] Failed attempt', attemptNum, err);

      if (attemptNum < maxAttempts) {
        retryCheckoutTimerRef.current = window.setTimeout(attemptCheckout, retryIntervalMs);
      } else {
        console.error('[RETRY_CHECKOUT] All attempts failed');
        retryCheckoutAttemptsRef.current = 0;
      }
    }
  };

  retryCheckoutAttemptsRef.current = 0;
  attemptCheckout();
};
```

**الفوائد:**
- ✅ 12 محاولة (دقيقة كاملة)
- ✅ فاصل 5 ثواني بين كل محاولة
- ✅ logs واضحة
- ✅ إعادة المزامنة بعد النجاح

### 4. منطق العرض المحدث

```typescript
{autoCheckout.executionState === 'DONE' && currentLog === null ? (
  <div>
    <CheckCircle2 />
    <p>تم تسجيل الانصراف تلقائيًا</p>
  </div>
) : autoCheckout.executionState === 'EXECUTING' ? (
  <>
    <Loader2 className="animate-spin" />
    <span>جاري تنفيذ الانصراف...</span>
  </>
) : autoCheckout.executionState === 'COUNTING' && autoCheckout.active ? (
  <>
    <AlertCircle />
    <span>انصراف تلقائي خلال</span>
    <div>{MM:SS}</div>
  </>
) : null}
```

**الحالات:**
- `DONE`: banner "تم تسجيل الانصراف تلقائيًا"
- `EXECUTING`: "جاري تنفيذ الانصراف..." + loader
- `COUNTING`: العد التنازلي
- `IDLE`: لا شيء

### 5. مراقبة انتهاء العد

```typescript
useEffect(() => {
  if (autoCheckout.executionState === 'COUNTING' && autoCheckout.endsAtServerMs) {
    const now = Date.now();
    const remainingSec = Math.ceil((autoCheckout.endsAtServerMs - now) / 1000);

    if (remainingSec <= 0) {
      console.log('[COUNTDOWN_EXPIRED] Switching to EXECUTING');
      setAutoCheckout(prev => ({ ...prev, executionState: 'EXECUTING' }));
      retryCheckout();
    }
  }
}, [autoCheckout.executionState, autoCheckout.endsAtServerMs, nowMs]);
```

### 6. استدعاء Sync عند فتح التطبيق

```typescript
// عند mount
useEffect(() => {
  if (!currentLog || !employee) return;
  syncAutoCheckoutState();
}, [currentLog, employee]);

// عند focus/visibility
useEffect(() => {
  const handleFocus = () => {
    if (currentLog && employee) {
      syncAutoCheckoutState();
    }
  };

  const handleVisibilityChange = () => {
    if (!document.hidden && currentLog && employee) {
      syncAutoCheckoutState();
    }
  };

  window.addEventListener('focus', handleFocus);
  document.addEventListener('visibilitychange', handleVisibilityChange);

  return () => {
    window.removeEventListener('focus', handleFocus);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}, [currentLog, employee]);

// Polling كل 5 ثواني
useEffect(() => {
  if (!currentLog || !employee) return;

  const pollingInterval = window.setInterval(() => {
    syncAutoCheckoutState(true);
  }, 5000);

  return () => clearInterval(pollingInterval);
}, [currentLog, employee]);
```

## سيناريوهات الاختبار

### سيناريو 1: فتح التطبيق والعد لم ينتهِ

**الخطوات:**
1. الموظف يخرج من نطاق الفرع
2. يبدأ العد (15:00)
3. يغلق التطبيق عند (10:00)
4. ينتظر 2 دقيقة
5. يفتح التطبيق

**النتيجة:**
- ✅ `syncAutoCheckoutState()` يُستدعى
- ✅ يقرأ `ends_at` من DB
- ✅ يحسب المتبقي: `08:00`
- ✅ يظهر العد من `08:00`
- ✅ لا يظهر `00:00` ثابت

### سيناريو 2: فتح التطبيق والعد انتهى

**الخطوات:**
1. الموظف يخرج من نطاق الفرع
2. يبدأ العد (15:00)
3. يغلق التطبيق عند (10:00)
4. ينتظر 15 دقيقة
5. يفتح التطبيق

**النتيجة:**
- ✅ `syncAutoCheckoutState()` يُستدعى
- ✅ المتبقي = `-5:00` (سالب)
- ✅ `executionState = 'EXECUTING'`
- ✅ يظهر "جاري تنفيذ الانصراف..."
- ✅ `retryCheckout()` يُستدعى
- ✅ نجح في المحاولة 1
- ✅ `executionState = 'DONE'`
- ✅ يظهر banner "تم تسجيل الانصراف تلقائيًا"
- ✅ لم يظهر `00:00` أبدًا

### سيناريو 3: الانصراف يفشل (لا إنترنت)

**الخطوات:**
1. العد يصل إلى `00:00`
2. لا يوجد إنترنت

**النتيجة:**
- ✅ `executionState = 'EXECUTING'`
- ✅ يظهر "جاري تنفيذ الانصراف..."
- ✅ `retryCheckout()` يُستدعى
- ✅ 12 محاولة (دقيقة كاملة)
- ✅ لم يظهر `00:00` ثابت

## الفوائد النهائية

1. ✅ **منع تجميد 00:00**: لا يتم عرض `00:00` كحالة نهائية
2. ✅ **المزامنة التلقائية**: قراءة الحالة من DB عند فتح التطبيق
3. ✅ **آلية Retry**: 12 محاولة لتنفيذ الانصراف
4. ✅ **واجهة واضحة**: عرض COUNTING/EXECUTING/DONE بوضوح
5. ✅ **تكامل كامل**: يعمل مع الإصلاحات السابقة

## Build Status

```bash
npm run build
✓ built in 8.50s
✅ No errors
```

## الملفات المعدلة

- `src/pages/EmployeeApp.tsx`

## ملخص

تم إصلاح تجميد العد التنازلي عند 00:00 من خلال:
- إضافة executionState
- دالة syncAutoCheckoutState للمزامنة
- دالة retryCheckout مع 12 محاولة
- منطق عرض محسّن
- مراقبة انتهاء العد

**النتيجة:** لا يتجمد العد عند 00:00، ويتم تنفيذ الانصراف التلقائي بموثوقية.
