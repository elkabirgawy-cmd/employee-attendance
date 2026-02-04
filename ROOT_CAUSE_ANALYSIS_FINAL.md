# تحليل السبب الجذري - فقدان حالة الحضور

## السبب المختصر (جملة واحدة)

**NEW_TENANT لديه 17 open sessions لنفس الموظف في نفس اليوم، و `.maybeSingle()` يرجع NULL عندما يكون هناك أكثر من صف واحد، مما يجعل Frontend يعتقد أن الموظف NOT checked-in.**

---

## المقارنة المباشرة قبل الإصلاح

### OLD_TENANT (شركة افتراضية)
- **Employee:** عمر عبدالله القحطاني
- **Company ID:** `aeb3d19c-82bc-462e-9207-92e49d507a07`
- **Open sessions today:** 1 ✅
- **Query result:** Returns single row
- **State restoration:** ✅ يعمل
- **Behavior:** حالة الحضور تبقى بعد Refresh

### NEW_TENANT (mohamed's Company)
- **Employee:** body
- **Company ID:** `8ab77d2a-dc74-4109-88af-c6a9ef271bf2`
- **Open sessions today:** 17 ❌
- **Query result:** `.maybeSingle()` returns NULL (error: multiple rows)
- **State restoration:** ❌ لا يعمل
- **Behavior:** حالة الحضور تضيع بعد Refresh

---

## الاستعلام المختلف

### الاستعلام الحالي (قبل الإصلاح)
```typescript
const { data } = await supabase
  .from('attendance_logs')
  .select('id, check_in_time, check_out_time')
  .eq('employee_id', employeeId)
  .eq('company_id', companyId)
  .gte('check_in_time', `${today}T00:00:00`)
  .lte('check_in_time', `${today}T23:59:59`)
  .is('check_out_time', null)
  .maybeSingle();  // ❌ يرجع NULL إذا كان هناك أكثر من صف
```

**المشكلة:**
- عندما يكون هناك صف واحد: `data = { id: '...', ... }` ✅
- عندما يكون هناك أكثر من صف: `data = null` ❌
- Frontend يعتقد `null` = NOT checked-in
- User يضغط "تسجيل حضور" مرة أخرى
- تُضاف session جديدة
- الحلقة تستمر...

### الاستعلام الجديد (بعد الإصلاح)
```typescript
const { data } = await supabase
  .from('attendance_logs')
  .select('id, check_in_time, check_out_time')
  .eq('employee_id', employeeId)
  .eq('company_id', companyId)
  .gte('check_in_time', `${today}T00:00:00`)
  .lte('check_in_time', `${today}T23:59:59`)
  .is('check_out_time', null)
  .order('check_in_time', { ascending: false })  // ✅ رتّب حسب الأحدث
  .limit(1)                                       // ✅ خذ واحد فقط
  .maybeSingle();                                 // ✅ الآن يرجع الأحدث دائماً
```

**الفائدة:**
- حتى لو كان هناك multiple rows، `.limit(1)` يضمن صف واحد فقط
- `.maybeSingle()` يعمل بشكل صحيح
- Frontend يحصل على الحالة الصحيحة دائماً

---

## الإصلاحات المطبقة

### 1. Database Migration

**File:** `supabase/migrations/fix_duplicate_check_ins_and_restore_state_v2.sql`

#### A) تنظيف السجلات المكررة
```sql
-- أغلق كل الجلسات المكررة، واحتفظ فقط بالأحدث
WITH ranked_sessions AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY employee_id, company_id, check_in_time::date
    ORDER BY check_in_time DESC
  ) as rn
  FROM attendance_logs
  WHERE check_out_time IS NULL
)
UPDATE attendance_logs
SET check_out_time = check_in_time + INTERVAL '1 second',
    checkout_type = 'AUTO',
    checkout_reason = 'Duplicate session cleanup'
WHERE id IN (SELECT id FROM ranked_sessions WHERE rn > 1);
```

**النتيجة:** تم إغلاق 16 session مكررة لـ NEW_TENANT

#### B) منع المستقبل
```sql
-- Trigger يمنع إنشاء multiple open sessions
CREATE TRIGGER trigger_prevent_duplicate_open_session
BEFORE INSERT OR UPDATE ON attendance_logs
FOR EACH ROW
WHEN (NEW.check_out_time IS NULL)
EXECUTE FUNCTION prevent_duplicate_open_session();
```

#### C) Helper Functions
```sql
-- للتحقق من وجود session مفتوحة
CREATE FUNCTION has_open_session_today(emp_id uuid, comp_id uuid)
RETURNS boolean;

-- للحصول على الجلسة المفتوحة الحالية
CREATE FUNCTION get_open_session_today(emp_id uuid, comp_id uuid)
RETURNS TABLE (id uuid, check_in_time timestamptz, check_out_time timestamptz);
```

### 2. Frontend Code

**File:** `src/pages/EmployeeApp.tsx`

```typescript
// قبل:
.maybeSingle();

// بعد:
.order('check_in_time', { ascending: false })
.limit(1)
.maybeSingle();
```

**السطر:** 1420-1423

### 3. Edge Function

**File:** `supabase/functions/employee-check-in/index.ts`

```typescript
// إضافة فحص قبل check-in
const { data: existingSession } = await supabase
  .from("attendance_logs")
  .select("id")
  .eq("employee_id", employee_id)
  .eq("company_id", company.company_id)
  .gte("check_in_time", `${today}T00:00:00`)
  .is("check_out_time", null)
  .order("check_in_time", { ascending: false })
  .limit(1)
  .maybeSingle();

if (existingSession) {
  return new Response(JSON.stringify({
    ok: false,
    code: "ALREADY_CHECKED_IN",
    message_ar: "لقد سجلت حضورك بالفعل اليوم"
  }), { status: 409 });
}
```

**السطور:** 222-245 (deployed ✅)

---

## نتائج الاختبار بعد الإصلاح

### Test 1: Duplicate Cleanup
```
✅ Cleaned up 16 duplicate open sessions
✅ All companies: 0 duplicates remaining
```

### Test 2: State Restoration - NEW_TENANT
```
Employee: body
Company: 8ab77d2a-dc74-4109-88af-c6a9ef271bf2
Open sessions: 1 (was 17)
Query result: { id: 'dd180fe0-737c-43cc-93c9-1274b3b0d217', ... }
Status: ✅ CHECKED_IN (State Persists)
```

### Test 3: State Restoration - OLD_TENANT
```
Employee: عمر عبدالله القحطاني
Company: aeb3d19c-82bc-462e-9207-92e49d507a07
Open sessions: 1 (unchanged)
Query result: { id: 'd0d099dc-458e-4588-8301-392cc4637f71', ... }
Status: ✅ CHECKED_IN (State Persists)
```

### Test 4: System-wide Verification
```
Total companies: 2
Employees with duplicates: 0
Employees with one session: 4
Max open sessions per employee: 1
```

---

## الملخص

### السبب الجذري
`.maybeSingle()` في Supabase يرجع `null` عندما يكون هناك أكثر من صف واحد. NEW_TENANT كان لديه 17 open sessions لنفس الموظف، لذلك Query كان يرجع `null`، وFrontend كان يعتقد أن الموظف NOT checked-in.

### الجزء المختلف
الاستعلام لم يكن يحتوي على `.order().limit(1)` قبل `.maybeSingle()`.

### ما تم تعديله
1. **Database:** تنظيف duplicates + trigger للمنع + helper functions
2. **Frontend:** إضافة `.order().limit(1)` قبل `.maybeSingle()`
3. **Edge Function:** فحص existing session قبل check-in

### نتيجة الاختبار
**✅ OLD vs NEW: سلوك متطابق 100%**

- ✅ كلاهما لديهما open session واحدة فقط
- ✅ كلاهما Query يرجع الحالة الصحيحة
- ✅ كلاهما State يبقى بعد Refresh
- ✅ كلاهما لا يمكن check-in مرتين

---

## الملفات المعدلة

### Database
- `supabase/migrations/fix_duplicate_check_ins_and_restore_state_v2.sql`

### Frontend
- `src/pages/EmployeeApp.tsx` (line 1420-1423)

### Backend
- `supabase/functions/employee-check-in/index.ts` (deployed ✅)

---

## Build Status
✅ Build successful - no errors
