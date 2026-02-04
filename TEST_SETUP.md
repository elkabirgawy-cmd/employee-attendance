# إعداد النظام للتجربة / Test Setup Guide

## ⚡ خطوات سريعة للتجربة / Quick Test Steps

### 1. تشغيل النظام / Run the System

```bash
npm run dev
```

### 2. افتح المتصفح / Open Browser

```
http://localhost:5173
```

### 3. إنشاء حساب مدير / Create Admin Account

**طريقة سهلة - من واجهة النظام:**

1. في صفحة تسجيل الدخول، اضغط على **"إنشاء حساب مدير"**
2. أو اذهب مباشرة إلى: `http://localhost:5173/register`
3. أدخل البيانات:
   - **الاسم الكامل:** مدير النظام
   - **البريد الإلكتروني:** admin@test.com
   - **كلمة المرور:** Admin123!
4. اضغط **إنشاء حساب المدير**
5. ستظهر رسالة نجاح
6. اضغط **تسجيل الدخول الآن**

### 4. تسجيل الدخول / Login

- **Email:** admin@test.com
- **Password:** Admin123!

---

## 📝 ملاحظات / Notes

✅ **لا حاجة لفتح Supabase Dashboard!**
- النظام يقوم بإنشاء المستخدمين تلقائياً
- كل شيء يعمل من واجهة النظام

✅ **يمكنك إنشاء عدة مدراء**
- كل مدير يحصل على صلاحيات Super Admin تلقائياً
- يمكنك تغيير الصلاحيات لاحقاً من Settings

---

## البيانات التجريبية الموجودة / Available Test Data

### ✅ الفروع / Branches (3)
1. **المكتب الرئيسي - الرياض**
   - Location: 24.7136, 46.6753
   - Radius: 150m

2. **فرع الشمال - الرياض**
   - Location: 24.8247, 46.6891
   - Radius: 120m

3. **فرع الجنوب - الرياض**
   - Location: 24.6478, 46.7187
   - Radius: 200m

### ✅ الوردیات / Shifts (4)
1. **Default Day Shift**: 08:00 - 17:00
2. **Morning Shift**: 06:00 - 14:00
3. **Evening Shift**: 14:00 - 22:00
4. **Night Shift**: 22:00 - 06:00

### ✅ إعدادات النظام / System Settings
- OTP: 6 digits, 5 min expiry
- GPS: Max 50m accuracy
- Fraud Detection: Enabled

---

## إضافة بيانات تجريبية إضافية / Add More Test Data

### إضافة موظفين تجريبيين / Add Sample Employees

قم بتشغيل هذا SQL في Supabase SQL Editor:

```sql
-- أولاً، أنشئ مستخدمي الموظفين في Authentication > Users
-- ثم استخدم UUIDs هنا

-- موظف 1
INSERT INTO employees (
  id,
  employee_code,
  full_name,
  email,
  phone,
  branch_id,
  shift_id,
  job_title,
  department,
  is_active,
  require_gps
)
VALUES (
  'EMPLOYEE_UUID_1',  -- من Authentication > Users
  'EMP001',
  'أحمد حسن',
  'ahmed@test.com',
  '+966501234567',
  (SELECT id FROM branches WHERE name LIKE '%الرئيسي%' LIMIT 1),
  (SELECT id FROM shifts WHERE name = 'Default Day Shift' LIMIT 1),
  'مدير مبيعات',
  'المبيعات',
  true,
  true
);

-- موظف 2
INSERT INTO employees (
  id,
  employee_code,
  full_name,
  email,
  phone,
  branch_id,
  shift_id,
  job_title,
  department,
  is_active,
  require_gps
)
VALUES (
  'EMPLOYEE_UUID_2',
  'EMP002',
  'فاطمة الراشد',
  'fatima@test.com',
  '+966502345678',
  (SELECT id FROM branches WHERE name LIKE '%الشمال%' LIMIT 1),
  (SELECT id FROM shifts WHERE name = 'Default Day Shift' LIMIT 1),
  'مدير موارد بشرية',
  'الموارد البشرية',
  true,
  true
);
```

### إضافة سجلات حضور تجريبية / Add Sample Attendance

```sql
-- سجل حضور لليوم (في الوقت)
INSERT INTO attendance_logs (
  employee_id,
  branch_id,
  check_in_time,
  check_in_device_time,
  check_in_latitude,
  check_in_longitude,
  check_in_accuracy,
  check_in_ip_address,
  status,
  is_synced
)
VALUES (
  'EMPLOYEE_UUID_1',
  (SELECT id FROM branches WHERE name LIKE '%الرئيسي%' LIMIT 1),
  NOW(),
  NOW(),
  24.7136,
  46.6753,
  12.5,
  '192.168.1.1',
  'on_time',
  true
);

-- سجل حضور متأخر
INSERT INTO attendance_logs (
  employee_id,
  branch_id,
  check_in_time,
  check_in_device_time,
  check_in_latitude,
  check_in_longitude,
  check_in_accuracy,
  check_in_ip_address,
  status,
  is_synced
)
VALUES (
  'EMPLOYEE_UUID_2',
  (SELECT id FROM branches WHERE name LIKE '%الشمال%' LIMIT 1),
  NOW() - INTERVAL '2 hours',
  NOW() - INTERVAL '2 hours',
  24.8247,
  46.6891,
  15.0,
  '192.168.1.2',
  'late',
  true
);
```

---

## استكشاف المشاكل / Troubleshooting

### المشكلة: لا يمكن تسجيل الدخول
**الحل:**
1. تأكد من إنشاء المستخدم في Authentication
2. تأكد من إضافة السجل في جدول admin_users
3. تأكد من تطابق البريد الإلكتروني والرقم السري

### المشكلة: لا تظهر البيانات
**الحل:**
1. تحقق من Row Level Security policies
2. تأكد من أن المستخدم admin (موجود في admin_users)
3. افتح Console في المتصفح للتحقق من الأخطاء

### المشكلة: خطأ في الاتصال بقاعدة البيانات
**الحل:**
1. تحقق من ملف `.env`
2. تأكد من صحة VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY
3. تأكد من اتصال الإنترنت

---

## الصفحات المتاحة للتجربة / Available Pages

1. ✅ **Dashboard** - نظرة عامة على النظام
2. ✅ **Employees** - إدارة الموظفين
3. ✅ **Branches** - إدارة الفروع
4. ✅ **Attendance** - تتبع الحضور
5. ✅ **Reports** - التقارير والتحليلات
6. ✅ **Fraud Alerts** - تنبيهات الاحتيال
7. ✅ **Settings** - إعدادات النظام

---

## ملاحظات مهمة / Important Notes

⚠️ **هذه بيئة تجريبية** / This is a test environment
- البيانات للتجربة فقط
- استخدم بيانات وهمية
- لا تستخدم معلومات حقيقية

🔐 **الأمان** / Security
- غيّر كلمات المرور في الإنتاج
- فعّل 2FA للمدراء
- راجع صلاحيات RLS

📱 **التطبيق المحمول** / Mobile App
- لم يتم تطويره بعد
- الوثائق الكاملة في SYSTEM_DOCUMENTATION.md
- استخدم React Native + Expo

---

## الدعم / Support

إذا واجهت أي مشاكل، راجع:
If you face any issues, check:

1. **الوثائق الكاملة** / Full Documentation: `SYSTEM_DOCUMENTATION.md`
2. **Supabase Logs**: Dashboard > Logs
3. **Browser Console**: F12 > Console
4. **Network Tab**: F12 > Network

---

**نجاح التجربة! 🎉**
**Happy Testing! 🎉**
