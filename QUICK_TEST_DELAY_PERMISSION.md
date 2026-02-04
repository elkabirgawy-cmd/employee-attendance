# اختبار سريع - إذن التأخير

## الاختبار من واجهة Admin (موصى به)

### الخطوات:

1. **سجل دخول كـ Admin**
   ```
   انتقل إلى صفحة الإعدادات
   ```

2. **شغّل Self-Test**
   ```
   اضغط: "اختبار وإصلاح النظام" (في الزاوية اليمنى العليا)
   اضغط: "تشغيل الاختبار"
   ```

3. **افحص النتائج**
   ```
   ✅ جميع الاختبارات نجحت
      ↳ النظام يعمل بشكل صحيح

   ❌ فشل اختبار
      ↳ اضغط "إصلاح تلقائي"
      ↳ أعد الاختبار
   ```

---

## الاختبار من تطبيق الموظف (واقعي)

### الخطوات:

1. **سجل دخول كموظف**
   ```
   رقم الهاتف: (استخدم موظف موجود)
   OTP: (الكود المرسل)
   ```

2. **افتح إذن التأخير**
   ```
   من القائمة السفلية: "الطلبات"
   اختر: "إذن تأخير"
   ```

3. **املأ النموذج**
   ```
   التاريخ: (اليوم)
   من الساعة: 09:00
   إلى الساعة: 09:30
   السبب: "اختبار النظام"
   ```

4. **أرسل الطلب**
   ```
   اضغط: "إرسال الطلب"

   ✅ "تم إرسال الطلب بنجاح"
      ↳ يعمل

   ❌ رسالة خطأ
      ↳ افتح Console (F12)
      ↳ ابحث عن [INSERT-ERROR]
      ↳ راجع السبب أدناه
   ```

---

## تشخيص الأخطاء الشائعة

### خطأ: "new row violates row-level security policy"

**السبب**: `employee.user_id` غير مرتبط

**الحل السريع**:
```sql
-- في Supabase SQL Editor:
SELECT auto_link_employee_user();
```

**الحل من UI**:
1. افتح Settings → "اختبار وإصلاح النظام"
2. اضغط "إصلاح تلقائي"

---

### خطأ: "لا يمكن إرسال الطلب"

**الأسباب المحتملة**:
1. الموظف غير مرتبط بحساب (user_id = NULL)
2. RLS policy ترفض
3. إعدادات الشركة مفقودة

**الحل**:
```sql
-- 1. تحقق من الربط
SELECT id, full_name, email, user_id
FROM employees
WHERE id = 'EMPLOYEE_ID';

-- إذا user_id = NULL:
SELECT auto_link_employee_user();

-- 2. تحقق من الإعدادات
SELECT * FROM application_settings WHERE company_id = 'COMPANY_ID';

-- إذا فارغ:
SELECT bootstrap_company_defaults('COMPANY_ID');
```

---

### خطأ: "يوجد طلب إذن في نفس اليوم"

**السبب**: طلب سابق في نفس التاريخ

**الحل**:
- غيّر التاريخ في النموذج
- أو احذف الطلب السابق من لوحة Admin

---

## الاختبار الفني (للمطورين)

### 1. E2E Test Page

```
افتح: /dev/delay-permission-test
اضغط: "Run E2E Test"
```

**النتيجة المتوقعة**:
```
✅ Get Session
✅ Extract User ID
✅ Get Employee
✅ INSERT delay_permission
✅ SELECT verify
✅ DELETE cleanup
✅ Environment Info
```

### 2. SQL Direct Test

```sql
-- Test 1: Check user linking
SELECT
  e.id,
  e.full_name,
  e.email,
  e.user_id,
  e.company_id,
  u.email as auth_email
FROM employees e
LEFT JOIN auth.users u ON u.id = e.user_id
WHERE e.company_id = 'YOUR_COMPANY_ID'
LIMIT 5;

-- Test 2: Check Bootstrap
SELECT
  'application_settings' as table_name,
  COUNT(*) as count
FROM application_settings
WHERE company_id = 'YOUR_COMPANY_ID'
UNION ALL
SELECT
  'auto_checkout_settings',
  COUNT(*)
FROM auto_checkout_settings
WHERE company_id = 'YOUR_COMPANY_ID'
UNION ALL
SELECT
  'payroll_settings',
  COUNT(*)
FROM payroll_settings
WHERE company_id = 'YOUR_COMPANY_ID';

-- Test 3: Simulate INSERT (as user)
-- يجب تشغيله من context الموظف
INSERT INTO delay_permissions (
  company_id,
  employee_id,
  date,
  start_time,
  end_time,
  minutes,
  reason,
  status,
  is_test
) VALUES (
  'COMPANY_ID',
  'EMPLOYEE_ID',
  CURRENT_DATE,
  '09:00',
  '09:30',
  30,
  'SQL Test',
  'pending',
  true
) RETURNING id;

-- Test 4: Check Debug Logs
SELECT
  step,
  ok,
  error_message,
  created_at
FROM delay_permission_debug_logs
WHERE company_id = 'YOUR_COMPANY_ID'
ORDER BY created_at DESC
LIMIT 10;
```

---

## التحقق من النجاح الكامل

### Checklist:

- [ ] Self-Test يمر بنجاح (5/5 steps)
- [ ] الموظف يستطيع إرسال إذن تأخير
- [ ] الطلب يظهر في تاريخ الطلبات
- [ ] Admin يرى الطلب في "إدارة أذونات التأخير"
- [ ] RLS policies موجودة وصحيحة
- [ ] Bootstrap logs تظهر في company_bootstrap_logs
- [ ] Debug logs تظهر في delay_permission_debug_logs

### قاعدة البيانات:

```sql
-- Verify RLS Policies
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'delay_permissions'
ORDER BY policyname;

-- Expected policies:
-- delay_permissions_insert_strict (INSERT, authenticated)
-- delay_permissions_select_strict (SELECT, authenticated)
-- delay_permissions_update_strict (UPDATE, authenticated)
-- delay_permissions_delete_strict (DELETE, authenticated)
```

---

## الاختبار بين حسابين

### الهدف: التأكد من عمل النظام على الحسابات القديمة والجديدة

### الحساب القديم (Old):
```
1. سجل دخول كـ Admin
2. شغّل Self-Test
3. النتيجة: ✅ (كل شيء موجود مسبقاً)
```

### الحساب الجديد (New):
```
1. سجل دخول كـ Admin
2. شغّل Self-Test
3. النتيجة المتوقعة:
   - Bootstrap: ✅ (ينشئ الإعدادات)
   - Auto-link: ✅ (يربط user_id)
   - INSERT: ✅ (يعمل بعد الربط)
```

---

## الخلاصة

✅ **Self-Test هو الطريقة الأسرع والأدق**

✅ **Auto-Fix يحل معظم المشاكل تلقائياً**

✅ **Debug Logs تعطيك السبب الدقيق للفشل**

✅ **النظام الآن موحد ويعمل على جميع الحسابات**

---

## دعم إضافي

إذا استمر الفشل بعد Auto-Fix:

1. افحص Console logs (F12)
2. افحص delay_permission_debug_logs
3. تحقق من:
   - `auth.uid()` موجود
   - `employee.user_id = auth.uid()`
   - `employee.company_id` صحيح
   - RLS policies موجودة

4. أرسل التفاصيل التالية:
   ```sql
   -- نسخ هذه البيانات:
   SELECT * FROM delay_permission_debug_logs
   WHERE created_at > NOW() - INTERVAL '1 hour'
   ORDER BY created_at DESC;
   ```
