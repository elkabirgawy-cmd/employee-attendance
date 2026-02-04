# نظام مزامنة الوقت والمنطقة الزمنية - Time Sync & Timezone System

## 📋 نظرة عامة

نظام موحد لمزامنة الوقت وتحديد المنطقة الزمنية تلقائياً باستخدام GPS، مع آليات احتياطية وإعادة محاولة تلقائية.

---

## 🎯 الأهداف الرئيسية

1. **دقة موحدة:** مصدر واحد موثوق للوقت في جميع أنحاء النظام
2. **تحديد تلقائي:** المنطقة الزمنية من GPS بدون تدخل يدوي
3. **موثوقية:** آليات احتياطية عند فشل GPS أو الشبكة
4. **تجربة سلسة:** لا يتم منع المستخدم بسبب فشل المزامنة
5. **تتبع كامل:** تسجيل جميع عمليات المزامنة للمراجعة

---

## 🏗️ البنية المعمارية

### 1️⃣ أولوية مصدر المنطقة الزمنية (Timezone Source Priority)

```
1. GPS Location (lat, lng) → Timezone API
   ↓ (إذا فشل)
2. Cached Timezone (آخر timezone ناجحة)
   ↓ (إذا لم توجد)
3. Default Timezone (Asia/Riyadh)
```

### 2️⃣ أولوية مصدر الوقت (Time Source Priority)

```
1. SERVER_GPS: Server Time + Timezone من GPS ✅
   ↓ (إذا فشل)
2. SERVER_CACHED_TZ: Server Time + Cached Timezone
   ↓ (إذا فشل)
3. DEVICE_FALLBACK: Device Time (مع تحذير)
```

---

## 📁 الملفات والوظائف

### `src/utils/timezoneDetection.ts`

الملف الأساسي الذي يحتوي على جميع وظائف المزامنة.

#### الوظائف الرئيسية:

**1. `getTimezoneFromGPS(lat, lng)`**
```typescript
// تحديد المنطقة الزمنية من إحداثيات GPS
const result = await getTimezoneFromGPS(24.7136, 46.6753);
// { timezone: 'Asia/Riyadh', source: 'GPS', timestamp: ... }
```

**2. `syncServerTimeWithGPS(lat?, lng?)`**
```typescript
// مزامنة الوقت مع تحديد timezone من GPS
const timeSync = await syncServerTimeWithGPS(24.7136, 46.6753);
// {
//   serverTime: Date,
//   source: 'SERVER_GPS',
//   timezone: 'Asia/Riyadh',
//   timezoneSource: 'GPS',
//   offset: -120,
//   syncedAt: 1673545678123
// }
```

**3. `getServerNow(timeSync)`**
```typescript
// الحصول على الوقت الحالي للخادم بدقة
const now = getServerNow(timeSync);
```

**4. `logTimeSync(timeSync, employeeId?, gpsCoordinates?)`**
```typescript
// تسجيل عملية المزامنة في قاعدة البيانات
await logTimeSync(timeSync, 'employee-123', { lat: 24.7136, lng: 46.6753 });
```

**5. `formatTimeSyncInfo(timeSync, isRTL)`**
```typescript
// تنسيق معلومات المزامنة للعرض
const message = formatTimeSyncInfo(timeSync, true);
// "تم التحديد تلقائيًا حسب الموقع (Asia/Riyadh)"
```

---

### `src/components/ServerTimeCard.tsx`

مكون عرض الوقت مع المزامنة التلقائية.

#### الخصائص (Props):
- `gpsCoordinates?: { lat, lng }` - إحداثيات GPS لتحديد المنطقة الزمنية
- `onTimeSyncUpdate?: (timeSync) => void` - callback عند نجاح المزامنة
- `employeeId?: string` - معرف الموظف للتسجيل

#### الميزات:
- ✅ مزامنة تلقائية عند التحميل
- ✅ إعادة مزامنة عند تغيير GPS
- ✅ إعادة محاولة تلقائية كل 15 ثانية عند الفشل
- ✅ عرض حالة المزامنة (GPS / Cached / Fallback)
- ✅ تسجيل تلقائي للمزامنات الناجحة

#### مثال الاستخدام:
```tsx
<ServerTimeCard
  gpsCoordinates={location}
  onTimeSyncUpdate={(sync) => setTimeSync(sync)}
  employeeId={employee?.id}
/>
```

---

## 🗄️ قاعدة البيانات

### جدول `time_sync_logs`

يسجل جميع عمليات مزامنة الوقت لأغراض المراجعة والتحليل.

#### البنية:
```sql
CREATE TABLE time_sync_logs (
  id uuid PRIMARY KEY,
  employee_id uuid REFERENCES employees(id),
  time_source text,          -- SERVER_GPS, SERVER_CACHED_TZ, DEVICE_FALLBACK
  timezone_source text,      -- GPS, MANUAL, CACHED, DEFAULT
  timezone text,             -- e.g., Asia/Riyadh
  gps_latitude numeric,
  gps_longitude numeric,
  server_time timestamptz,
  device_time timestamptz,
  time_drift_seconds numeric,
  synced_at timestamptz,
  created_at timestamptz
);
```

#### الفهارس (Indexes):
- `idx_time_sync_logs_employee_id` - للبحث السريع بمعرف الموظف
- `idx_time_sync_logs_synced_at` - للفرز الزمني
- `idx_time_sync_logs_time_source` - لتحليل مصادر الوقت

---

## 🔄 سير العمل (Workflow)

### المسار الأمثل (Happy Path):

```
1. المستخدم يفتح التطبيق
   ↓
2. يتم طلب GPS permissions
   ↓
3. الحصول على GPS (lat, lng)
   ↓
4. getTimezoneFromGPS(lat, lng)
   → "Asia/Riyadh"
   → Cache في localStorage
   ↓
5. syncServerTime("Asia/Riyadh")
   → يحصل على server time من worldtimeapi.org
   → يحسب offset = server - device
   ↓
6. logTimeSync() → تسجيل في قاعدة البيانات
   ↓
7. عرض الوقت الدقيق للمستخدم
   ✅ "تم التحديد تلقائيًا حسب الموقع (Asia/Riyadh)"
```

### المسار الاحتياطي (Fallback Path):

```
1. GPS غير متاح / فشل
   ↓
2. التحقق من localStorage
   → وجد timezone محفوظة؟
   ↓ نعم
3. استخدام cached timezone
   ✅ "المنطقة الزمنية المحفوظة (Asia/Riyadh)"

   ↓ لا
4. استخدام DEFAULT_TIMEZONE
   ⚠️ "المنطقة الزمنية الافتراضية (Asia/Riyadh)"
```

### مسار الفشل الكامل (Total Failure):

```
1. GPS فشل + Network فشل
   ↓
2. لا يمكن الوصول إلى worldtimeapi.org
   ↓
3. DEVICE_FALLBACK mode
   ↓
4. استخدام device time مؤقتاً
   ⚠️ "يتعذر التحقق من دقة الوقت حاليًا، سيتم إعادة المحاولة تلقائيًا"
   ↓
5. إعادة محاولة كل 15 ثانية
   ↓
6. عند نجاح المزامنة → التحديث التلقائي
```

---

## 🎨 واجهة المستخدم (UI States)

### 1. Loading State
```
┌─────────────────────────────┐
│  ⏱️ جاري التحميل...         │
└─────────────────────────────┘
```

### 2. Success - GPS Detected
```
┌─────────────────────────────┐
│  🕐 02:30 م                 │
│  📅 الأحد · 12 يناير 2026  │
│  🕐 تم التحديد تلقائيًا     │
│     حسب الموقع             │
│     (Asia/Riyadh)          │
└─────────────────────────────┘
```
**لون:** أخضر ✅

### 3. Success - Cached Timezone
```
┌─────────────────────────────┐
│  🕐 02:30 م                 │
│  📅 الأحد · 12 يناير 2026  │
│  🕐 المنطقة الزمنية المحفوظة│
│     (Asia/Riyadh)          │
└─────────────────────────────┘
```
**لون:** أزرق 📘

### 4. Fallback - Retrying
```
┌─────────────────────────────┐
│  🕐 02:30 م                 │
│  📅 الأحد · 12 يناير 2026  │
│  🔄 يتعذر التحقق من دقة     │
│     الوقت حاليًا، سيتم      │
│     إعادة المحاولة تلقائيًا │
└─────────────────────────────┘
```
**لون:** برتقالي ⚠️
**أيقونة:** دوران مستمر 🔄

---

## ⚠️ سلوكيات مهمة

### 1. لا يتم منع المستخدم
❌ **خطأ:** منع تسجيل الحضور بسبب فشل time sync
✅ **صحيح:** السماح بالعمل مع تحذير

### 2. لا تُحسب مخالفات
- ❌ لا تسجيل تأخير
- ❌ لا تسجيل احتيال
- ❌ لا تسجيل مخالفات

**فقط** عند:
```typescript
if (timeSync.source === 'DEVICE_FALLBACK') {
  // لا تحسب أي شيء
  return;
}
```

### 3. التحديث التلقائي
- إعادة محاولة كل 15 ثانية عند الفشل
- عند نجاح المزامنة:
  - ✅ إخفاء التحذير
  - ✅ تحديث الوقت
  - ✅ تسجيل في قاعدة البيانات
  - ✅ تحديث timezone

---

## 🧪 الاختبار (Testing)

### سيناريوهات الاختبار:

#### 1. GPS متاح + Network متاح
```
Expected:
- source: SERVER_GPS
- timezoneSource: GPS
- timezone: تلقائي من GPS
- رسالة: "تم التحديد تلقائيًا حسب الموقع"
```

#### 2. GPS متاح + Network غير متاح
```
Expected:
- source: DEVICE_FALLBACK
- رسالة: "يتعذر التحقق من دقة الوقت..."
- إعادة محاولة كل 15 ثانية
```

#### 3. GPS غير متاح + Cached Timezone موجودة
```
Expected:
- source: SERVER_CACHED_TZ
- timezoneSource: CACHED
- timezone: من localStorage
- رسالة: "المنطقة الزمنية المحفوظة"
```

#### 4. انتقال من منطقة زمنية لأخرى
```
Scenario:
- المستخدم في الرياض (Asia/Riyadh)
- ينتقل إلى دبي (Asia/Dubai)

Expected:
- عند تحديث GPS
- getTimezoneFromGPS() مع الإحداثيات الجديدة
- timezone تتغير تلقائيًا
- تسجيل جديد في time_sync_logs
```

---

## 📊 التحليلات والتقارير

### استعلامات مفيدة:

**1. إحصائيات مصادر الوقت:**
```sql
SELECT
  time_source,
  COUNT(*) as count,
  ROUND(AVG(time_drift_seconds), 2) as avg_drift
FROM time_sync_logs
WHERE synced_at >= NOW() - INTERVAL '7 days'
GROUP BY time_source
ORDER BY count DESC;
```

**2. الموظفون مع مشاكل مزامنة:**
```sql
SELECT
  e.full_name,
  COUNT(*) as fallback_count
FROM time_sync_logs t
JOIN employees e ON e.id = t.employee_id
WHERE t.time_source = 'DEVICE_FALLBACK'
  AND t.synced_at >= NOW() - INTERVAL '24 hours'
GROUP BY e.full_name
HAVING COUNT(*) > 5
ORDER BY fallback_count DESC;
```

**3. تحليل انحراف الوقت:**
```sql
SELECT
  employee_id,
  MAX(ABS(time_drift_seconds)) as max_drift,
  AVG(ABS(time_drift_seconds)) as avg_drift
FROM time_sync_logs
WHERE synced_at >= NOW() - INTERVAL '7 days'
  AND time_source != 'DEVICE_FALLBACK'
GROUP BY employee_id
HAVING MAX(ABS(time_drift_seconds)) > 60
ORDER BY max_drift DESC;
```

---

## 🔧 إعدادات قابلة للتخصيص

### Constants في `timezoneDetection.ts`:

```typescript
const DEFAULT_TIMEZONE = 'Asia/Riyadh';  // المنطقة الافتراضية
const CACHE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;  // 7 أيام
```

### في `ServerTimeCard.tsx`:

```typescript
const RETRY_INTERVAL_MS = 15000;  // 15 ثانية
```

---

## 🚀 الميزات المستقبلية (Future Enhancements)

### 1. Manual Timezone Override (Admin)
```typescript
interface TimezoneSettings {
  allow_manual_override: boolean;
  manual_timezone?: string;
  manual_set_by?: string;
  manual_set_at?: Date;
}
```

### 2. Offline Mode Support
```typescript
// Cache multiple timezone API responses
interface TimezoneCache {
  [key: string]: {  // "lat,lng" as key
    timezone: string;
    timestamp: number;
  }
}
```

### 3. Smart Retry Strategy
```typescript
// Exponential backoff with jitter
const retryDelays = [5, 10, 15, 30, 60]; // seconds
```

---

## 📝 ملاحظات للمطورين

### ⚠️ تحذيرات مهمة:

1. **لا تستخدم `new Date()` مباشرة**
   ```typescript
   ❌ const now = new Date();
   ✅ const now = getServerNow(timeSync);
   ```

2. **تحقق دائماً من source قبل الاحتساب**
   ```typescript
   if (timeSync?.source === 'DEVICE_FALLBACK') {
     // لا تحسب تأخير أو مخالفات
     return;
   }
   ```

3. **لا تمنع المستخدم أبداً**
   ```typescript
   ❌ if (!timeSync) throw new Error('Time sync required');
   ✅ if (!timeSync) return allowWithWarning();
   ```

---

## 🎯 الخلاصة

نظام مزامنة الوقت والمنطقة الزمنية:
- ✅ تلقائي بالكامل
- ✅ موثوق مع آليات احتياطية
- ✅ لا يعطل تجربة المستخدم
- ✅ قابل للتتبع والتحليل
- ✅ دقيق ومتسق عبر النظام

**الهدف النهائي:** دقة وقت موحدة بدون تعقيد أو إزعاج للمستخدم.
