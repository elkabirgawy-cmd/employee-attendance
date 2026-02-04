# Leave Request Multi-Tenant Standard Implementation

## Overview
This document describes the implementation of the leave request system following the official multi-company feature rules. The leave request feature is now fully compliant with multi-tenant isolation requirements and serves as the standard pattern for all future request-based features.

## Implementation Date
2026-01-31

## Multi-Company Compliance Checklist

### ✅ 1. SCHEMA (Isolation by Design)
- **Table**: `leave_requests`
- **Required Fields**:
  - `id` (uuid PK)
  - `company_id` (uuid NOT NULL)
  - `employee_id` (uuid NOT NULL)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)
- **Foreign Keys**:
  - `company_id` → `companies(id)`
  - `employee_id` → `employees(id)`
- **Indexes**:
  - `(company_id)`
  - `(company_id, created_at DESC)`
  - `(company_id, employee_id)`

### ✅ 2. GUARDRAILS (Prevent Wrong Inserts)
- RLS policies enforce company_id validation
- No direct client inserts allowed
- All writes go through Edge Function
- Edge Function derives company_id from authenticated employee

### ✅ 3. WRITE PATH (Functions Only)
**Edge Function**: `employee-submit-leave-request`

**Location**: `/supabase/functions/employee-submit-leave-request/index.ts`

**Security Features**:
- Validates authenticated session via JWT
- Derives company_id from employee record (NOT from client input)
- Validates leave type belongs to same company
- Checks leave balance before submission
- Calculates days automatically
- Creates admin notification
- Returns clean success/error messages

**Request Flow**:
```
Client → Edge Function → Validate Session → Fetch Employee (with company_id)
  → Validate Leave Type → Check Balance → Insert with company_id → Notify Admin
```

### ✅ 4. READ PATH (Always Filter by company_id)
All queries include explicit `company_id` filters:

**Files Updated**:
1. `/src/components/LeaveRequestModal.tsx`
   - `fetchLeaveTypes()`: Added `.eq('company_id', companyId)`
   - `fetchLeaveBalances()`: Added `.eq('company_id', companyId)`
   - `fetchLeaveRequests()`: Added `.eq('company_id', companyId)`

2. `/src/pages/LeaveRequests.tsx` (Admin)
   - `fetchRequests()`: Added `.eq('company_id', companyId)`
   - `handleApprove()`: Added `.eq('company_id', companyId)` to UPDATE
   - `handleReject()`: Added `.eq('company_id', companyId)` to UPDATE
   - `fetchLeaveBalances()`: Added `.eq('company_id', companyId)`
   - `fetchDelayPermissions()`: Added `.eq('company_id', companyId)`

3. `/src/components/LeaveHistoryModal.tsx`
   - Added `companyId` prop
   - `fetchLeaveRequests()`: Added `.eq('company_id', companyId)`
   - `fetchDelayPermissions()`: Added `.eq('company_id', companyId)`

4. `/src/pages/EmployeeApp.tsx`
   - `fetchPendingRequestsCount()`: Added `.eq('company_id', employee.company_id)`

5. `/src/pages/Payroll.tsx`
   - Leave request query: Added `.eq('company_id', companyId)`

### ✅ 5. DEFAULTS / BOOTSTRAP
- Leave types are created per company during setup
- Leave balances are seeded per employee per company
- New companies get default leave types automatically
- System is idempotent - safe to run multiple times

### ✅ 6. TEST MATRIX
**Test Script**: `/test-leave-request-multi-tenant.mjs`

**Tests**:
- Creates leave request on Company A (legacy)
- Creates leave request on Company B (new)
- Verifies company_id is correctly set
- Verifies cross-tenant isolation
- Verifies admin notifications
- Confirms identical behavior across companies

## Edge Function Details

### Endpoint
```
POST /functions/v1/employee-submit-leave-request
```

### Authentication
- Requires valid Supabase Auth JWT token
- Token passed in `Authorization: Bearer <token>` header

### Request Body
```json
{
  "leave_type_id": "uuid",
  "start_date": "YYYY-MM-DD",
  "end_date": "YYYY-MM-DD",
  "reason": "string (optional)"
}
```

### Response (Success)
```json
{
  "success": true,
  "leave_request": {
    "id": "uuid",
    "employee_id": "uuid",
    "company_id": "uuid",
    "leave_type_id": "uuid",
    "start_date": "YYYY-MM-DD",
    "end_date": "YYYY-MM-DD",
    "days": 2,
    "status": "pending",
    "created_at": "timestamp"
  },
  "message": "Leave request submitted successfully"
}
```

### Response (Error)
```json
{
  "error": "Error message"
}
```

### Validation Rules
1. Session must be valid
2. Employee record must exist
3. Leave type must belong to employee's company
4. Start date must be before or equal to end date
5. Employee must have sufficient leave balance
6. All fields must be valid UUIDs/dates

## Client Integration

### Before (Direct Insert - NOT COMPLIANT)
```typescript
const { error } = await supabase
  .from('leave_requests')
  .insert({
    employee_id: employeeId,
    company_id: companyId,  // Client provides company_id - UNSAFE!
    leave_type_id: formData.leave_type_id,
    start_date: formData.start_date,
    end_date: formData.end_date,
    status: 'pending'
  });
```

### After (Edge Function - COMPLIANT)
```typescript
const { data: { session } } = await supabase.auth.getSession();

const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/employee-submit-leave-request`;

const response = await fetch(apiUrl, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    leave_type_id: formData.leave_type_id,
    start_date: formData.start_date,
    end_date: formData.end_date,
    reason: formData.reason || null
  })
});

const result = await response.json();
```

## Security Benefits

### 1. Company ID Derivation
- Client NEVER provides company_id
- Edge Function derives it from authenticated employee
- Impossible to submit requests for wrong company

### 2. Validation in Function
- Leave type ownership verified
- Leave balance checked server-side
- Cannot bypass client-side validation

### 3. Complete Audit Trail
- All requests logged with correct company_id
- Admin notifications created automatically
- Clear error messages for debugging

### 4. RLS as Backup
- RLS policies still enforce company_id
- Double layer of protection
- Defense in depth approach

## Migration Notes

### For Existing Features
This pattern should be applied to:
- ✅ Delay permissions (already uses Edge Function)
- ⚠️ Penalties/bonuses (if they allow employee submission)
- ⚠️ Overtime requests (if implemented)
- ⚠️ Any future request-based features

### Migration Steps
1. Create Edge Function with session validation
2. Add company_id derivation from employee
3. Add server-side validation
4. Update client to call Edge Function
5. Add explicit company_id filters to all reads
6. Test on multiple companies
7. Verify cross-tenant isolation

## Standard Pattern Summary

**THE OFFICIAL RULE**:
```
NO direct inserts from client/UI for ANY request-based feature.

ALWAYS use Edge Functions with:
1. Session validation
2. Company ID derivation from employee (NOT from client)
3. Server-side validation
4. RLS-safe inserts
5. Clean UI-friendly responses
6. Explicit company_id filters on ALL reads
```

## Testing Verification

### Test Commands
```bash
# Run multi-tenant test
node test-leave-request-multi-tenant.mjs

# Build verification
npm run build
```

### Expected Outcomes
- ✅ Both companies can submit leave requests
- ✅ Requests have correct company_id
- ✅ No cross-tenant data leakage
- ✅ Identical behavior across tenants
- ✅ Clean error handling
- ✅ Admin notifications work

## Files Modified

### Edge Functions
1. Created: `/supabase/functions/employee-submit-leave-request/index.ts`

### Frontend Components
1. `/src/components/LeaveRequestModal.tsx` - Uses Edge Function, explicit filters
2. `/src/components/LeaveHistoryModal.tsx` - Added company_id prop, explicit filters
3. `/src/pages/LeaveRequests.tsx` - Explicit company_id filters on all operations
4. `/src/pages/EmployeeApp.tsx` - Explicit filters, pass company_id to modal
5. `/src/pages/Payroll.tsx` - Explicit filters for leave data

### Test Scripts
1. Created: `/test-leave-request-multi-tenant.mjs`

## Compliance Status

| Rule | Status | Notes |
|------|--------|-------|
| Schema Isolation | ✅ | All required fields present |
| Guardrails | ✅ | Edge Function enforces correctness |
| Write Path | ✅ | All writes via Edge Function |
| Read Path | ✅ | Explicit company_id filters everywhere |
| Defaults/Bootstrap | ✅ | Leave types seeded per company |
| Test Matrix | ✅ | Multi-tenant test created |

## Next Steps

1. Apply this pattern to all existing request-based features
2. Use as template for future features
3. Update developer documentation
4. Add to onboarding checklist

## Conclusion

The leave request system is now fully compliant with multi-tenant requirements and serves as the official standard pattern. All future request-based features MUST follow this same approach to ensure data isolation, security, and consistency across tenants.
