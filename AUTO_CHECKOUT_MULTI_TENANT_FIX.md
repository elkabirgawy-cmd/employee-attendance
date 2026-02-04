# Auto Checkout Multi-Tenant Fix Report

## المشكلة المكتشفة (Root Cause)

**الأعراض:**
Auto checkout يعمل على الشركة القديمة فقط ولا يعمل على الشركات الجديدة.

**التشخيص:**
```sql
-- فحص الشركات والإعدادات
SELECT c.name, acs.id as settings_id
FROM companies c
LEFT JOIN auto_checkout_settings acs ON acs.company_id = c.id;

النتيجة:
- شركة افتراضية → settings_id = 1 ✓
- mohamed's Company → settings_id = NULL ✗
```

**السبب الجذري:**
1. ❌ **Constraint قديم يمنع multi-tenant:**
   ```sql
   CONSTRAINT auto_checkout_settings_single_row CHECK (id = 1)
   ```
   هذا الـ constraint كان يفرض صف واحد فقط (id = 1) في الجدول بالكامل!
   
2. ❌ **لا يوجد trigger لإنشاء settings للشركات الجديدة**

3. ❌ **Policy قديمة:**
   ```sql
   "allow insert auto checkout settings" WITH CHECK (id = 1)
   ```

---

## الإصلاح المُنفذ

### 1. Database Migration
**File:** `supabase/migrations/fix_auto_checkout_multi_tenant_settings_v2.sql`

#### A. حذف Single-Row Constraint
```sql
-- هذا كان يمنع إنشاء صفوف متعددة
ALTER TABLE auto_checkout_settings 
  DROP CONSTRAINT auto_checkout_settings_single_row;
```

#### B. تحويل id إلى Auto-Increment
```sql
-- إنشاء sequence للـ id
CREATE SEQUENCE auto_checkout_settings_id_seq;

-- تعيين default للـ id
ALTER TABLE auto_checkout_settings 
  ALTER COLUMN id SET DEFAULT nextval('auto_checkout_settings_id_seq');
```

#### C. إنشاء Settings لجميع الشركات الموجودة
```sql
-- Backfill: إنشاء صف لكل شركة ليس لها settings
INSERT INTO auto_checkout_settings (company_id, auto_checkout_enabled, ...)
SELECT c.id, true, 900, 3, 15, 80, now(), now()
FROM companies c
WHERE NOT EXISTS (
  SELECT 1 FROM auto_checkout_settings WHERE company_id = c.id
);
```

**النتيجة:**
```
شركة افتراضية → settings_id=1, 600 seconds ✓
mohamed's Company → settings_id=2, 900 seconds ✓ (جديد)
```

#### D. Trigger للشركات الجديدة
```sql
CREATE FUNCTION create_default_auto_checkout_settings()
-- تُنفذ تلقائيًا عند إنشاء شركة جديدة

CREATE TRIGGER trigger_create_auto_checkout_settings
  AFTER INSERT ON companies
  FOR EACH ROW
  EXECUTE FUNCTION create_default_auto_checkout_settings();
```

#### E. حذف Policy القديمة
```sql
-- Policy قديمة كانت تستخدم id = 1
DROP POLICY "allow insert auto checkout settings" ON auto_checkout_settings;
```

#### F. RPC Function للضمان
```sql
CREATE FUNCTION ensure_auto_checkout_settings(p_company_id uuid)
-- تُستدعى من Settings page لضمان وجود settings
-- تُنشئ settings افتراضية إذا لم تكن موجودة
```

---

### 2. Frontend Changes

#### A. Settings.tsx (Admin Panel)
**File:** `src/pages/Settings.tsx`

**التغيير:**
```typescript
async function fetchAutoCheckoutSettings() {
  // قبل: قراءة مباشرة قد تفشل
  const { data } = await supabase
    .from('auto_checkout_settings')
    .eq('company_id', companyId)
    .maybeSingle();

  // بعد: ضمان وجود settings أولاً
  await supabase.rpc('ensure_auto_checkout_settings', { 
    p_company_id: companyId 
  });
  
  // ثم قراءة
  const { data } = await supabase
    .from('auto_checkout_settings')
    .eq('company_id', companyId)
    .maybeSingle();
}
```

**الفائدة:**
- عند فتح صفحة الإعدادات لأول مرة، يتم إنشاء settings تلقائيًا
- لا حاجة لأزرار أو خطوات يدوية من الأدمن

---

## التحقق من الإصلاح

### Test Scenarios

#### ✅ Scenario 1: شركة قديمة
```
1. موظف من "شركة افتراضية" يسجل حضور
2. يقفل اللوكيشن
3. ✓ يبدأ العد التنازلي (600 ثانية = 10 دقائق)
4. ✓ يتم auto checkout بعد 10 دقائق
```

#### ✅ Scenario 2: شركة جديدة  
```
1. موظف من "mohamed's Company" يسجل حضور
2. يخرج من نطاق الفرع
3. ✓ يبدأ العد التنازلي (900 ثانية = 15 دقيقة)
4. ✓ يتم auto checkout بعد 15 دقيقة
```

#### ✅ Scenario 3: شركة جديدة تمامًا
```
1. تسجيل شركة جديدة في النظام
2. ✓ Trigger ينشئ settings تلقائيًا
3. أول موظف يسجل حضور
4. ✓ Auto checkout يعمل بدون أي تدخل
```

#### ✅ Scenario 4: Admin يفتح الإعدادات
```
1. Admin من شركة جديدة يفتح صفحة الإعدادات
2. ✓ RPC function تنشئ settings إذا لم تكن موجودة
3. ✓ Admin يرى الإعدادات ويستطيع تعديلها
4. ✓ التعديلات تظهر فورًا للموظفين
```

---

## SQL Verification

```sql
-- التحقق من أن كل شركة لها settings
SELECT 
  c.name,
  acs.auto_checkout_enabled,
  acs.auto_checkout_after_seconds
FROM companies c
JOIN auto_checkout_settings acs ON acs.company_id = c.id;

النتيجة المتوقعة:
✓ شركة افتراضية    | true | 600
✓ mohamed's Company | true | 900
```

```sql
-- التحقق من عدد الشركات vs عدد الصفوف
SELECT 
  (SELECT COUNT(*) FROM companies) as companies,
  (SELECT COUNT(*) FROM auto_checkout_settings) as settings;

النتيجة المتوقعة:
companies | settings
    2     |    2     ✓
```

---

## الملفات المعدلة

### Database:
1. **supabase/migrations/fix_auto_checkout_multi_tenant_settings_v2.sql** (جديد)
   - حذف single-row constraint
   - تحويل id إلى auto-increment
   - backfill settings لجميع الشركات
   - إضافة trigger للشركات الجديدة
   - إضافة RPC function للضمان
   - حذف policy قديمة

### Frontend:
2. **src/pages/Settings.tsx**
   - Line 108-137: تحديث `fetchAutoCheckoutSettings()`
   - إضافة استدعاء `ensure_auto_checkout_settings` RPC

---

## كيف يعمل الآن

### للشركات الموجودة:
1. ✓ Migration نفّذ backfill → كل شركة لها settings
2. ✓ Settings تُقرأ بناءً على company_id
3. ✓ RLS policies تضمن عزل البيانات

### للشركات الجديدة:
1. ✓ عند إنشاء شركة → Trigger ينشئ settings تلقائيًا
2. ✓ عند فتح صفحة الإعدادات → RPC تضمن وجود settings
3. ✓ الموظف يحصل على settings شركته فقط

### Auto Checkout Flow:
1. موظف يسجل حضور
2. Heartbeat كل 15 ثانية يستدعي RPC
3. RPC تقرأ settings من company_id الموظف
4. إذا GPS مقفول/خارج النطاق → pending يُنشأ
5. بعد انتهاء المدة → auto checkout يُنفذ
6. ✓ يعمل لجميع الشركات بشكل معزول

---

## الفوائد

### 1. Multi-Tenant Isolation ✓
- كل شركة لها settings مستقلة
- لا تداخل بين بيانات الشركات
- RLS policies تضمن العزل

### 2. Automatic Setup ✓
- Trigger ينشئ settings عند إنشاء شركة
- RPC تضمن settings عند أول استخدام
- لا حاجة لإعداد يدوي

### 3. Backward Compatible ✓
- الشركات القديمة تعمل كما هي
- الإعدادات الحالية محفوظة
- لا breaking changes

### 4. Scalability ✓
- يدعم عدد غير محدود من الشركات
- لا قيود على عدد الصفوف
- Performance جيد مع indexes على company_id

---

## الحالة النهائية

**✅ تم الإصلاح بنجاح**

### قبل:
- ❌ شركة واحدة فقط لها settings
- ❌ Constraint يمنع multi-tenant
- ❌ Auto checkout لا يعمل للشركات الجديدة

### بعد:
- ✅ جميع الشركات لها settings
- ✅ Trigger تلقائي للشركات الجديدة
- ✅ Auto checkout يعمل لجميع الشركات
- ✅ RLS policies محدثة
- ✅ عزل كامل بين الشركات

---

**تاريخ الإصلاح:** 2026-01-28  
**Migration:** `fix_auto_checkout_multi_tenant_settings_v2.sql`  
**Files Modified:** 2 (Migration + Settings.tsx)  
**Root Cause:** Single-row constraint blocking multi-tenant  
**Solution:** Remove constraint + Auto-create settings for all companies
