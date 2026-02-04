# Standard Template للميزات متعددة الشركات - مرجع سريع

## 📐 القاعدة الذهبية

> **امنع أي insert/update مباشر من الـ Client على جداول الطلبات أو أي جدول فيه company_id**

---

## 🎯 متى تستخدم هذا النمط؟

استخدم هذا النمط عند إضافة ميزة جديدة تحقق **جميع** الشروط التالية:

1. ✅ يستخدمها **الموظفون** (employee-facing)
2. ✅ الجدول يحتوي على **company_id**
3. ✅ تتطلب **طلبات/إدخالات** (requests/submissions)

**أمثلة:**
- ✅ طلبات إذن التأخير
- ✅ طلبات الإجازات
- ✅ تقارير الاحتيال
- ✅ طلبات تغيير الجهاز
- ✅ طلبات العمل الإضافي

---

## 🔧 الخطوات (4 خطوات فقط)

### 1️⃣ إنشاء Edge Function

```typescript
// supabase/functions/employee-submit-{feature}/index.ts

import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Validate session
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Get payload
    const payload = await req.json();
    const { field1, field2 } = payload;

    if (!field1 || !field2) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Resolve employee and company_id from database
    const { data: employee, error: employeeError } = await supabase
      .from('employees')
      .select('id, company_id, full_name, is_active')
      .eq('user_id', user.id)
      .single();

    if (employeeError || !employee) {
      return new Response(
        JSON.stringify({ error: 'Employee record not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!employee.is_active) {
      return new Response(
        JSON.stringify({ error: 'Employee account is not active' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Validate business rules (example: check for duplicates)
    const { data: existing } = await supabase
      .from('feature_table')
      .select('id')
      .eq('employee_id', employee.id)
      .eq('company_id', employee.company_id)
      .eq('some_field', field1)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ error: 'Duplicate entry' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Insert with DB-resolved company_id
    const { data: newRecord, error: insertError } = await supabase
      .from('feature_table')
      .insert({
        employee_id: employee.id,
        company_id: employee.company_id,  // ✅ من DB، ليس من Client
        field1: field1,
        field2: field2,
        status: 'pending',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to create record', details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Optional: Create notification
    await supabase
      .from('notifications')
      .insert({
        title: 'New Request',
        message: `${employee.full_name} submitted a new request`,
        type: 'feature_request',
        priority: 'normal',
        target_user_type: 'admin',
      });

    return new Response(
      JSON.stringify({
        success: true,
        record: newRecord,
        message: 'Request submitted successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

**Deploy:**
```bash
# استخدم هذا الأمر في الـ code
# mcp__supabase__deploy_edge_function({ slug: 'employee-submit-feature', verify_jwt: true })
```

---

### 2️⃣ إنشاء RLS Policies

```sql
-- Migration: supabase/migrations/{timestamp}_add_feature_table_rls.sql

/*
  # Add RLS Policies for feature_table

  ## Security
  - Employees can view their own records
  - Admins can view all records in their company
  - Only validated inserts allowed (employee exists + company_id matches)
  - Only admins can update/delete
*/

-- Enable RLS
ALTER TABLE public.feature_table ENABLE ROW LEVEL SECURITY;

-- SELECT Policy: Employee sees own records, Admin sees company records
CREATE POLICY "feature_table_select_own_company"
  ON public.feature_table
  FOR SELECT
  TO authenticated
  USING (
    -- Employee can view their own records
    (
      EXISTS (
        SELECT 1 FROM public.employees e
        WHERE e.id = feature_table.employee_id
          AND e.user_id = auth.uid()
          AND e.company_id = feature_table.company_id
      )
    )
    OR
    -- Admin can view all records in their company
    (
      EXISTS (
        SELECT 1 FROM public.admin_users au
        WHERE au.id = auth.uid()
          AND au.company_id = feature_table.company_id
      )
    )
  );

-- INSERT Policy: Validate employee exists and company_id matches
CREATE POLICY "feature_table_insert_validated"
  ON public.feature_table
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = feature_table.employee_id
        AND e.company_id = feature_table.company_id
        AND e.is_active = true
    )
  );

-- UPDATE Policy: Only admins can update
CREATE POLICY "feature_table_update_admin_only"
  ON public.feature_table
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users au
      WHERE au.id = auth.uid()
        AND au.company_id = feature_table.company_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_users au
      WHERE au.id = auth.uid()
        AND au.company_id = feature_table.company_id
    )
  );

-- DELETE Policy: Only admins can delete
CREATE POLICY "feature_table_delete_admin_only"
  ON public.feature_table
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users au
      WHERE au.id = auth.uid()
        AND au.company_id = feature_table.company_id
    )
  );

-- Add table comment
COMMENT ON TABLE public.feature_table IS
'Feature requests from employees.
INSERT via employee-submit-feature edge function only.
RLS enforces company isolation.';
```

---

### 3️⃣ تحديث Frontend

```typescript
// src/components/EmployeeFeatureModal.tsx (أو أي component)

async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();

  // ❌ لا تفعل هذا أبداً
  // await supabase.from('feature_table').insert({
  //   company_id: companyId,  // خطر أمني
  //   employee_id: employeeId,
  //   ...data
  // });

  // ✅ افعل هذا دائماً
  setLoading(true);
  setError('');

  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      throw new Error('الرجاء تسجيل الدخول مرة أخرى');
    }

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/employee-submit-feature`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          field1: formData.field1,
          field2: formData.field2,
          // ✅ لا company_id هنا - Server يستخرجه
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'فشل إرسال الطلب');
    }

    setSuccessMessage('تم إرسال الطلب بنجاح');

    // Refresh list
    await fetchRecords();

  } catch (error: any) {
    setError(error.message || 'حدث خطأ');
  } finally {
    setLoading(false);
  }
}
```

---

### 4️⃣ Reads تحتوي دائماً على company_id filter

```typescript
// ✅ صحيح - جميع reads تحتوي على company_id filter
async function fetchRecords() {
  const { data, error } = await supabase
    .from('feature_table')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('company_id', companyId)  // ✅ دائماً أضف هذا
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Error fetching records:', error);
    return;
  }

  setRecords(data || []);
}

// ❌ خطأ - بدون company_id filter
async function fetchRecords() {
  const { data, error } = await supabase
    .from('feature_table')
    .select('*')
    .eq('employee_id', employeeId)  // ❌ ينقصه company_id
    .limit(50);
}
```

---

## ✅ Checklist للميزة الجديدة

قبل merge أي feature جديد، تأكد من:

### Edge Function
- [ ] ✅ تتحقق من JWT
- [ ] ✅ تستخرج employee_id من user.id
- [ ] ✅ تستخرج company_id من جدول employees
- [ ] ✅ تتحقق من is_active
- [ ] ✅ تتحقق من business rules
- [ ] ✅ لا تقبل company_id من Client
- [ ] ✅ CORS headers موجودة
- [ ] ✅ Error handling شامل
- [ ] ✅ منشورة على Supabase

### RLS Policies
- [ ] ✅ RLS مفعل على الجدول
- [ ] ✅ SELECT policy (employee + admin)
- [ ] ✅ INSERT policy مع validation
- [ ] ✅ UPDATE policy (admin only عادةً)
- [ ] ✅ DELETE policy (admin only عادةً)
- [ ] ✅ كل policy تتحقق من company_id
- [ ] ✅ لا توجد policies مع USING (true)

### Frontend
- [ ] ✅ لا توجد direct inserts
- [ ] ✅ جميع inserts عبر edge function
- [ ] ✅ جميع reads تحتوي على .eq('company_id', companyId)
- [ ] ✅ Error handling واضح
- [ ] ✅ Loading states موجودة
- [ ] ✅ Success messages واضحة

### Testing
- [ ] ✅ اختبار مع شركتين مختلفتين
- [ ] ✅ التأكد من عدم رؤية بيانات شركة أخرى
- [ ] ✅ اختبار edge function مع بيانات خاطئة
- [ ] ✅ اختبار RLS policies
- [ ] ✅ Build ناجح

---

## ⚠️ الأخطاء الشائعة

### ❌ خطأ 1: Client يرسل company_id

```typescript
// ❌ خطأ
await supabase.from('feature_table').insert({
  company_id: companyId,  // من props - يمكن التلاعب به
  ...
});
```

**الحل:**
```typescript
// ✅ صحيح
await fetch('/functions/v1/employee-submit-feature', {
  body: JSON.stringify({
    // لا company_id
  })
});
```

---

### ❌ خطأ 2: Query بدون company_id filter

```typescript
// ❌ خطأ
const { data } = await supabase
  .from('feature_table')
  .select('*')
  .eq('employee_id', employeeId);  // ينقصه company_id
```

**الحل:**
```typescript
// ✅ صحيح
const { data } = await supabase
  .from('feature_table')
  .select('*')
  .eq('employee_id', employeeId)
  .eq('company_id', companyId);  // دائماً
```

---

### ❌ خطأ 3: RLS Policy مع USING (true)

```sql
-- ❌ خطأ
CREATE POLICY "feature_insert"
  ON feature_table
  FOR INSERT
  WITH CHECK (true);  -- يسمح للجميع
```

**الحل:**
```sql
-- ✅ صحيح
CREATE POLICY "feature_insert_validated"
  ON feature_table
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees
      WHERE id = feature_table.employee_id
        AND company_id = feature_table.company_id
    )
  );
```

---

### ❌ خطأ 4: نسيان التحقق من is_active

```typescript
// ❌ خطأ - قد يكون الموظف معطل
const { data: employee } = await supabase
  .from('employees')
  .select('id, company_id')
  .eq('user_id', user.id)
  .single();
```

**الحل:**
```typescript
// ✅ صحيح
const { data: employee } = await supabase
  .from('employees')
  .select('id, company_id, is_active')
  .eq('user_id', user.id)
  .single();

if (!employee.is_active) {
  return error('Employee account is not active');
}
```

---

## 🎓 أمثلة واقعية

### مثال 1: طلب إذن التأخير ✅

**Edge Function:** `employee-submit-delay-permission`
**الجدول:** `delay_permissions`
**الاستخدام:** الموظف يطلب إذن للتأخير

```typescript
// Frontend
await fetch('/functions/v1/employee-submit-delay-permission', {
  body: JSON.stringify({
    date: '2024-01-15',
    start_time: '09:00',
    end_time: '09:30',
    minutes: 30,
    reason: 'عذر طبي'
    // ✅ لا company_id
  })
});
```

---

### مثال 2: طلب إجازة ✅

**Edge Function:** `employee-submit-leave-request`
**الجدول:** `leave_requests`
**الاستخدام:** الموظف يطلب إجازة

```typescript
// Frontend
await fetch('/functions/v1/employee-submit-leave-request', {
  body: JSON.stringify({
    leave_type_id: 'uuid...',
    start_date: '2024-02-01',
    end_date: '2024-02-05',
    reason: 'إجازة عائلية'
    // ✅ لا company_id
  })
});
```

---

### مثال 3: تقرير احتيال ✅

**Edge Function:** `employee-report-fraud`
**الجدول:** `fraud_alerts`
**الاستخدام:** النظام يكتشف mock location

```typescript
// Frontend
await fetch('/functions/v1/employee-report-fraud', {
  body: JSON.stringify({
    alert_type: 'mock_location',
    description: 'Mock location detected',
    severity: 'high',
    metadata: {
      latitude: 24.7136,
      longitude: 46.6753
    }
    // ✅ لا company_id
  })
});
```

---

## 📚 مراجع إضافية

- **التقرير الكامل:** `MULTI_TENANT_STANDARD_TEMPLATE_APPLIED.md`
- **Before/After:** `MULTI_COMPANY_BEFORE_AFTER.md`
- **Security Advisor Fix:** `SECURITY_ADVISOR_FIX_COMPLETE.md`

---

## 🎯 تذكر

> **القاعدة الذهبية:**
> Client = UI فقط | Server = Logic + company_id

### الهيكل الصحيح

```
┌──────────────┐
│   Client     │
│   (UI only)  │  ← لا company_id هنا
└──────┬───────┘
       │
       │ POST /functions/v1/employee-submit-{feature}
       │ { data } ← بدون company_id
       ▼
┌────────────────────┐
│  Edge Function     │
│  (Service Role)    │  ← يستخرج company_id من DB
│                    │  ← يتحقق من validation
│                    │  ← يدخل مع company_id صحيح
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│   Database         │
│   (RLS enabled)    │  ← طبقة أمان إضافية
└────────────────────┘
```

---

## ✅ الحالة

**Standard Template مطبق على:**
- ✅ delay_permissions
- ✅ leave_requests
- ✅ fraud_alerts
- ✅ employee_vacation_requests

**جاهز للاستخدام في ميزات جديدة** 🚀
