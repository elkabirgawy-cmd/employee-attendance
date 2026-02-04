# إصلاح موحد لنظام إذن التأخير

## المشكلة الأساسية
- إذن التأخير يعمل في الحسابات القديمة ✓
- إذن التأخير يفشل في الحسابات الجديدة ✗
- السبب: RLS policies + employee.user_id linking

---

## الحل المنفذ

### 1. Company Bootstrap System

**الهدف**: ضمان وجود إعدادات افتراضية لكل شركة

**الآلية**:
```sql
-- Function: bootstrap_company_defaults(company_id)
-- تنشأ تلقائياً:
- application_settings (max_delay_hours = 2)
- auto_checkout_settings (enabled = false)
- payroll_settings (currency = SAR)
```

**التفعيل**:
- عند إنشاء admin جديد (Trigger)
- عند فتح صفحة الإعدادات
- عند تشغيل Self-Test

**Logs**:
```sql
company_bootstrap_logs (
  company_id, action, status, details, created_at
)
```

---

### 2. Employee-User Linking

**المشكلة**: `employees.user_id = NULL` في الحسابات الجديدة

**الحل**:
```sql
-- Function: auto_link_employee_user()
-- تربط تلقائياً employee.user_id = auth.uid()
-- الشرط: email match + same company + is_active
```

**التنفيذ**:
- عند تسجيل دخول الموظف
- عند فتح delay permission modal
- عند تشغيل Self-Test

---

### 3. RLS Policies (Strict)

**delay_permissions INSERT**:
```sql
-- السماح فقط إذا:
1. auth.uid() = employee.user_id
   AND employee.id = delay_permissions.employee_id
   AND employee.company_id = delay_permissions.company_id
   AND employee.is_active = true

2. أو admin في نفس الشركة
```

**delay_permissions SELECT**:
```sql
-- الموظف يرى طلباته فقط
-- Admin يرى طلبات شركته فقط
```

**delay_permissions UPDATE/DELETE**:
```sql
-- Admin فقط
```

---

### 4. Self-Test Engine

**الموقع**: Settings → زر "اختبار وإصلاح النظام"

**الخطوات**:
1. ✓ Bootstrap company defaults
2. ✓ Auto-link employee to user
3. ✓ Test INSERT delay_permission
4. ✓ Test SELECT delay_permission
5. ✓ Cleanup test data

**Auto-Fix**:
- عند فشل أي خطوة: زر "إصلاح تلقائي"
- يشغل Bootstrap + Auto-link
- يعيد الاختبار

**Debug Logs**:
```sql
delay_permission_debug_logs (
  step, ok, error_message, user_id, company_id, employee_id, details
)
```

---

## طريقة الاختبار

### الاختبار اليدوي (Admin):

1. افتح: الإعدادات → "اختبار وإصلاح النظام"
2. اضغط: "تشغيل الاختبار"
3. النتيجة:
   - ✅ جميع الخطوات نجحت = النظام يعمل
   - ❌ فشل خطوة = اضغط "إصلاح تلقائي"

### الاختبار الفني (Developer):

1. افتح: `/dev/delay-permission-test`
2. اضغط: "Run E2E Test"
3. الفحص:
   - Session check
   - Employee lookup by user_id
   - INSERT + SELECT + DELETE
   - Environment info

---

## التحقق من نجاح الإصلاح

### قاعدة البيانات:

```sql
-- 1. تحقق من user_id
SELECT id, full_name, email, user_id, company_id
FROM employees
WHERE company_id = 'YOUR_COMPANY_ID';

-- 2. تحقق من Bootstrap
SELECT * FROM application_settings WHERE company_id = 'YOUR_COMPANY_ID';
SELECT * FROM auto_checkout_settings WHERE company_id = 'YOUR_COMPANY_ID';
SELECT * FROM payroll_settings WHERE company_id = 'YOUR_COMPANY_ID';

-- 3. تحقق من RLS Policies
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE tablename = 'delay_permissions';

-- 4. فحص Debug Logs
SELECT * FROM delay_permission_debug_logs
ORDER BY created_at DESC
LIMIT 10;
```

### تطبيق الموظف:

1. سجل دخول موظف (بحساب auth عادي)
2. افتح: إذن التأخير
3. املأ النموذج واضغط "إرسال"
4. النتيجة:
   - ✅ "تم إرسال الطلب" = يعمل
   - ❌ Error = راجع console + debug logs

---

## الفرق بين الحسابين

### الحساب القديم:
- ✓ employee.user_id موجود
- ✓ application_settings موجود
- ✓ RLS policies تعمل

### الحساب الجديد (قبل الإصلاح):
- ✗ employee.user_id = NULL
- ✗ application_settings مفقود
- ✗ RLS policies ترفض INSERT

### الحساب الجديد (بعد الإصلاح):
- ✓ auto_link_employee_user() → user_id موجود
- ✓ bootstrap_company_defaults() → settings موجودة
- ✓ RLS policies strict → تعمل

---

## الملفات المعدلة

### Database Migrations:
- `create_company_bootstrap_system.sql`
- `fix_employee_user_id_linking.sql`
- `fix_delay_permissions_rls_strict.sql`

### Frontend Components:
- `src/components/SystemSelfTestModal.tsx` (جديد)
- `src/pages/Settings.tsx` (زر Self-Test)
- `src/pages/DelayPermissionTest.tsx` (للمطورين)
- `src/components/EmployeeDelayPermissionModal.tsx` (إزالة session loop)

### Database Functions:
- `bootstrap_company_defaults(company_id)`
- `auto_link_employee_user()`

### Database Tables:
- `company_bootstrap_logs`
- `delay_permission_debug_logs` (موجود مسبقاً)

---

## صيانة مستقبلية

### عند إضافة ميزة جديدة:

1. أضف الإعدادات الافتراضية في `bootstrap_company_defaults()`
2. أضف RLS policies صارمة (auth.uid() + company_id)
3. أضف اختبار في Self-Test Engine
4. اختبر على الحسابين

### عند مواجهة مشكلة RLS:

1. شغّل Self-Test
2. افحص Debug Logs
3. راجع RLS policies في pg_policies
4. استخدم Auto-Fix

---

## نصائح التشخيص

### خطأ: "new row violates row-level security policy"

**السبب**: `employee.user_id = NULL` أو RLS policy خاطئ

**الحل**:
```sql
-- 1. تحقق من user_id
SELECT id, full_name, user_id FROM employees WHERE id = 'EMPLOYEE_ID';

-- 2. إذا NULL: شغّل auto-link
SELECT auto_link_employee_user();

-- 3. إذا ما زال يفشل: راجع RLS
SELECT * FROM pg_policies WHERE tablename = 'delay_permissions';
```

### خطأ: "انتهت الجلسة"

**السبب**: Session checking قديم (تم إزالته)

**الحل**: تأكد من التحديثات الأخيرة في `EmployeeDelayPermissionModal.tsx`

---

## الخلاصة

✅ **النظام الآن موحد**: نفس الكود يعمل على جميع الحسابات

✅ **Bootstrap تلقائي**: كل شركة جديدة تحصل على إعدادات افتراضية

✅ **RLS صارم**: security أولاً مع وضوح الأخطاء

✅ **Self-Test**: اختبار وإصلاح تلقائي بضغطة زر

✅ **Debug Logs**: تتبع كامل لكل عملية
