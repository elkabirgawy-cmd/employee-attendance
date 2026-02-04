# Multi-Tenant Isolation Testing Guide

## Overview

This project includes comprehensive automated tests to verify complete tenant isolation in the multi-tenant SaaS architecture.

## Test Files

1. **`test-tenant-isolation.ts`** - Full end-to-end test
   - Creates 2 test admin users
   - Tests complete CRUD isolation
   - Tests malicious company_id bypass attempts
   - Auto-cleanup after tests

2. **`test-tenant-isolation-simple.ts`** - Quick audit script
   - Verifies schema setup
   - Checks data distribution
   - Validates RLS policies and triggers

## Prerequisites

### Get Your Supabase Service Role Key

The tests require the Supabase service role key to create test users programmatically.

**⚠️ WARNING:** The service role key bypasses RLS. Keep it secret and NEVER expose it to clients!

1. Go to your Supabase Dashboard:
   ```
   https://supabase.com/dashboard/project/ixmakummrzkhwlunguhe/settings/api
   ```

2. Find the **"service_role"** key (not the anon key)

3. Add it to your `.env` file:
   ```bash
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...your_key_here...
   ```

## Running the Tests

### Full Test Suite

```bash
npm run test:isolation
```

This will:
- ✅ Create 2 test companies with admins
- ✅ Insert data as AdminA
- ✅ Verify AdminB sees empty data
- ✅ Insert data as AdminB
- ✅ Verify AdminA doesn't see AdminB's data
- ✅ Attempt malicious company_id bypass
- ✅ Report PASS/FAIL for each test
- ✅ Auto-cleanup test data

### Quick Audit

```bash
npx tsx test-tenant-isolation-simple.ts
```

This runs a quick audit without creating new users.

## What the Tests Verify

### 1. Schema Isolation
- ✅ All tenant tables have `company_id` column
- ✅ All tenant tables have RLS enabled
- ✅ All tenant tables have auto-set triggers

### 2. Company Separation
- ✅ Each admin has different `company_id`
- ✅ AdminA cannot read AdminB's company record
- ✅ Each company has independent data counts

### 3. Data Isolation - CRUD Operations

**Employees:**
- ✅ AdminA creates employees → Only visible to AdminA
- ✅ AdminB creates employees → Only visible to AdminB
- ✅ company_id auto-set by trigger

**Branches:**
- ✅ AdminA creates branches → Only visible to AdminA
- ✅ AdminB sees 0 branches

**Shifts:**
- ✅ AdminA creates shifts → Only visible to AdminA
- ✅ AdminB sees 0 shifts

**Settings Tables:**
- ✅ application_settings isolated per company
- ✅ payroll_settings isolated per company
- ✅ attendance_calculation_settings isolated per company

### 4. Security - Malicious Attempts

**Attempt 1: INSERT with wrong company_id**
- ✅ AdminA tries to insert employee with `company_id = AdminB's ID`
- ✅ Trigger overwrites with correct company_id
- ✅ AdminB never sees the malicious row

**Attempt 2: UPDATE to change company_id**
- ✅ AdminA tries to UPDATE employee's company_id to AdminB's
- ✅ RLS policy blocks the update
- ✅ Employee remains in AdminA's company

### 5. No NULL company_id
- ✅ Zero rows with `company_id IS NULL` across all tables

## Test Output Example

```
🚀 Multi-Tenant Isolation Test Harness

Testing complete tenant isolation across all tables...

📝 Creating test admin: test-admin-a-1234567890@test.com
   ✓ Auth user created: uuid-a
   ✓ Company created: company-uuid-a
   ✓ Admin user record created
   ✓ Signed in successfully

📝 Creating test admin: test-admin-b-1234567890@test.com
   ✓ Auth user created: uuid-b
   ✓ Company created: company-uuid-b
   ✓ Admin user record created
   ✓ Signed in successfully

=== TEST: Company ID Isolation ===

✅ AdminA and AdminB have different company_id
   Expected: Different company_id values
   Actual: Different company_id

✅ AdminA can read own company record
   Expected: Company record returned
   Actual: Company record found

✅ AdminA CANNOT read AdminB's company
   Expected: No access to other company
   Actual: No access

=== TEST: Employee Data Isolation ===

✅ AdminA can create employees
   Expected: 2 employees created
   Actual: 2 employees created

✅ Employee company_id auto-set to AdminA company
   Expected: company-uuid-a
   Actual: company-uuid-a

✅ AdminA sees exactly 2 employees
   Expected: 2 employees
   Actual: 2 employees

✅ AdminB sees 0 employees (AdminA data invisible)
   Expected: 0 employees
   Actual: 0 employees

✅ AdminB sees exactly 1 employee (own data)
   Expected: 1 employee
   Actual: 1 employee

✅ AdminA still sees 2 employees (AdminB data invisible)
   Expected: 2 employees
   Actual: 2 employees

...

=== TEST: Malicious company_id Bypass Attempt ===

✅ Malicious company_id is overridden by trigger
   Expected: company_id set to AdminA: company-uuid-a
   Actual: company_id set to: company-uuid-a

✅ AdminB still sees only own employee
   Expected: 1 employee
   Actual: 1 employee

✅ Malicious UPDATE to change company_id is blocked
   Expected: Update blocked or company_id unchanged
   Actual: Blocked: new row violates row-level security policy

============================================================
FINAL TEST REPORT
============================================================

Total Tests: 25
✅ Passed: 25
❌ Failed: 0
Success Rate: 100.0%

============================================================

🎉 ALL TESTS PASSED! Tenant isolation is SECURE.

🧹 Cleaning up test data...
✓ Cleaned up 2 test users
```

## Interpreting Results

### All Tests Pass (100%)
✅ **SECURE** - Complete tenant isolation is working correctly.

### Some Tests Fail
❌ **SECURITY RISK** - Tenant isolation has issues that need fixing.

Common failures and fixes:

#### "AdminA can see AdminB's data"
**Problem:** RLS policies not filtering by company_id
**Fix:** Update RLS policies to use `WHERE company_id = current_company_id()`

#### "company_id is NULL"
**Problem:** Trigger not setting company_id on INSERT
**Fix:** Add BEFORE INSERT trigger to auto-set company_id

#### "Malicious company_id not overridden"
**Problem:** Trigger not overriding client-provided company_id
**Fix:** Update trigger to ALWAYS set `NEW.company_id = current_company_id()`

## Auto-Fix Process

If tests fail, the harness will:

1. Report the specific failures
2. Suggest fixes for each issue
3. You can apply fixes by updating migrations
4. Re-run tests until all pass

## Continuous Testing

Run these tests:
- ✅ After any database migration
- ✅ After adding new tenant tables
- ✅ Before deploying to production
- ✅ As part of CI/CD pipeline

## Security Best Practices

1. **NEVER** accept `company_id` from frontend
2. **ALWAYS** use triggers to set `company_id`
3. **ALWAYS** filter by `current_company_id()` in RLS policies
4. **NEVER** disable RLS on tenant tables
5. **ALWAYS** run these tests after schema changes

## Troubleshooting

### Test fails with "Missing SUPABASE_SERVICE_ROLE_KEY"
Add the key to `.env` file (see Prerequisites above)

### Test fails with "Failed to create auth user"
Check that email confirmation is disabled or use admin API

### Test fails with "current_company_id() returns NULL"
Check that admin_users record exists with valid company_id

### Tests pass but production has leaks
RLS policies might have permissive rules (USING true)
Run: `SELECT * FROM pg_policies WHERE qual = 'true';`

## Support

For issues or questions:
1. Check the `TENANT_ISOLATION_REPORT.md` for architecture details
2. Run `TENANT_ISOLATION_AUDIT.sql` for detailed schema analysis
3. Review RLS policies: `SELECT * FROM pg_policies;`
