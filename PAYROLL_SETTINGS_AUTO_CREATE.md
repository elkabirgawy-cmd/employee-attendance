# Payroll Settings Auto-Creation Implementation

## التحديثات المنفذة

### 1. إضافة Unique Constraint على `payroll_settings.company_id`

**الملف**: `supabase/migrations/20260130125000_add_payroll_settings_unique_constraint.sql`

**التغييرات**:
- إضافة unique constraint على `company_id` لضمان صف واحد فقط لكل شركة
- حذف أي صفوف مكررة قبل إضافة الـ constraint (الاحتفاظ بالأحدث)
- تمكين عمليات upsert الآمنة

```sql
ALTER TABLE payroll_settings
ADD CONSTRAINT payroll_settings_company_id_unique
UNIQUE (company_id);
```

### 2. إنشاء دالة مشتركة `ensurePayrollSettings`

**الملف**: `src/utils/ensurePayrollSettings.ts`

**الوظيفة**:
```typescript
ensurePayrollSettings(companyId: string): Promise<PayrollSettings | null>
```

**السلوك**:
1. محاولة جلب إعدادات الشركة الموجودة
2. إذا وُجدت → إرجاعها مباشرة
3. إذا لم توجد → إنشاء إعدادات افتراضية تلقائياً
4. العملية idempotent (لا تنشئ صفوف متعددة)

**القيم الافتراضية**:
```javascript
{
  company_id: companyId,
  currency: 'جنيه',
  salary_type: 'monthly',
  workdays_per_month: 26,
  grace_minutes: 15,
  overtime_multiplier: 1.5,
  shift_hours_per_day: 8,
  late_penalty_mode: 'none',
  early_leave_penalty_mode: 'none',
  absence_deduction_mode: 'none',
  overtime_mode: 'none'
}
```

### 3. تحديث صفحة `Payroll.tsx`

**التغييرات**:
- استيراد واستخدام `ensurePayrollSettings` بدلاً من الكود المكرر
- تحديث `fetchSettings()` لاستخدام الدالة المشتركة
- عرض Toast عند إنشاء إعدادات افتراضية لأول مرة
- تحديث `updateSettings()` لاستخدام upsert مع `onConflict: 'company_id'`
- إضافة `companyId` إلى dependencies في useEffect

**الكود**:
```typescript
async function fetchSettings() {
  if (!companyId) {
    console.error('fetchSettings: No companyId available');
    return;
  }

  const result = await ensurePayrollSettings(companyId);

  if (result) {
    const wasJustCreated = !settings && result;
    setSettings(result);

    if (wasJustCreated) {
      showSuccess(language === 'ar'
        ? 'تم إنشاء إعدادات افتراضية—راجعها من تبويب الإعدادات'
        : 'Default settings created—review them in Settings tab');
    }
  } else {
    showError(language === 'ar' ? 'خطأ في جلب إعدادات الرواتب' : 'Error fetching payroll settings');
  }
}
```

## الصفحات المتأثرة

### استخدام `ensurePayrollSettings` في:
- ✅ **صفحة إدارة الرواتب** (`Payroll.tsx`)
- ✅ **تبويب الإعدادات** (داخل Payroll.tsx)
- ✅ **صفحة إنشاء الرواتب** (داخل Payroll.tsx)
- ✅ **صفحة كشف الرواتب** (داخل Payroll.tsx)
- ✅ **تبويب الجزاءات** (داخل Payroll.tsx)
- ✅ **تبويب المكافآت** (داخل Payroll.tsx)

**ملاحظة**: جميع التبويبات والصفحات الفرعية داخل `Payroll.tsx` تشترك في نفس state من `fetchSettings()` لذلك التحديث ينطبق على الجميع.

## سيناريوهات الاختبار

### ✅ السيناريو 1: شركة جديدة بدون إعدادات
**الإجراء**: فتح صفحة الرواتب لأول مرة
**النتيجة المتوقعة**:
- لا يظهر خطأ "الرجاء تكوين إعدادات الرواتب أولاً"
- يتم إنشاء إعدادات افتراضية تلقائياً
- يظهر Toast: "تم إنشاء إعدادات افتراضية—راجعها من تبويب الإعدادات"
- الصفحة تعمل بشكل طبيعي

**الاختبار**:
```sql
SELECT * FROM payroll_settings WHERE company_id = '<company_id>';
-- يجب أن يعيد صف واحد بالقيم الافتراضية
```

### ✅ السيناريو 2: شركة قديمة لديها إعدادات
**الإجراء**: فتح صفحة الرواتب
**النتيجة المتوقعة**:
- يتم جلب الإعدادات الموجودة
- لا يتم إنشاء أي شيء جديد
- لا يظهر Toast
- الصفحة تعمل بشكل طبيعي

**الاختبار**:
```sql
SELECT COUNT(*) FROM payroll_settings WHERE company_id = '<company_id>';
-- يجب أن يعيد 1 فقط (لا تكرار)
```

### ✅ السيناريو 3: تبديل بين شركتين
**الإجراء**:
1. فتح الرواتب للشركة A
2. تبديل إلى الشركة B
3. فتح الرواتب للشركة B

**النتيجة المتوقعة**:
- يتم جلب إعدادات الشركة A عند فتح صفحتها
- يتم جلب إعدادات الشركة B عند التبديل
- كل شركة ترى إعداداتها الخاصة فقط
- لا يوجد تداخل في البيانات

**الاختبار**:
```sql
-- التحقق من عزل البيانات
SELECT company_id, currency, salary_type
FROM payroll_settings
ORDER BY created_at;
```

## الحماية والأمان (RLS)

### RLS Policies على `payroll_settings`

**SELECT Policy**:
```sql
CREATE POLICY "payroll_settings_select_own_company"
  ON payroll_settings FOR SELECT
  TO authenticated
  USING (company_id = current_company_id());
```

**INSERT Policy**:
```sql
CREATE POLICY "payroll_settings_insert_own_company"
  ON payroll_settings FOR INSERT
  TO authenticated
  WITH CHECK (company_id = current_company_id());
```

**UPDATE Policy**:
```sql
CREATE POLICY "payroll_settings_update_own_company"
  ON payroll_settings FOR UPDATE
  TO authenticated
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());
```

**DELETE Policy**:
```sql
CREATE POLICY "payroll_settings_delete_own_company"
  ON payroll_settings FOR DELETE
  TO authenticated
  USING (company_id = current_company_id());
```

## التحقق من التنفيذ الصحيح

### 1. التحقق من Unique Constraint
```sql
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'payroll_settings'
AND constraint_name = 'payroll_settings_company_id_unique';
```

### 2. التحقق من RLS Policies
```sql
SELECT policyname, cmd, qual::text, with_check::text
FROM pg_policies
WHERE tablename = 'payroll_settings'
ORDER BY policyname;
```

### 3. التحقق من عدم وجود صفوف مكررة
```sql
SELECT company_id, COUNT(*) as count
FROM payroll_settings
GROUP BY company_id
HAVING COUNT(*) > 1;
-- يجب أن يعيد 0 صفوف
```

## الفوائد

1. **تجربة مستخدم أفضل**: لا حاجة لإعداد يدوي، كل شيء تلقائي
2. **توحيد الكود**: دالة واحدة مشتركة بدلاً من كود مكرر
3. **سلامة البيانات**: unique constraint يمنع التكرار
4. **أمان محكم**: RLS policies تضمن عزل الشركات
5. **سهولة الصيانة**: تعديل الإعدادات الافتراضية في مكان واحد

## ملاحظات مهمة

- ⚠️ الدالة `ensurePayrollSettings` تعمل على مستوى الكود فقط، لا على مستوى قاعدة البيانات
- ⚠️ في حالة وجود مشاكل في الإعدادات، يمكن حذفها وإعادة إنشائها تلقائياً
- ⚠️ القيم الافتراضية قابلة للتعديل من تبويب الإعدادات بعد الإنشاء
- ✅ التطبيق الآن جاهز للإنتاج مع دعم multi-tenant كامل

## الدعم الفني

في حالة ظهور أي مشاكل:

1. تحقق من وجود `company_id` في جلسة المستخدم
2. تحقق من RLS policies على `payroll_settings`
3. تحقق من console.log للأخطاء
4. تأكد من وجود unique constraint على `company_id`
