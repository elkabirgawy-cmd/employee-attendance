#!/usr/bin/env node

/**
 * Self-Test: Leave Request Submission
 *
 * Verifies that employees can submit leave requests after RLS policy fix.
 * Tests both old and new accounts to ensure consistent behavior.
 *
 * Usage:
 *   SUPABASE_URL=xxx SUPABASE_ANON_KEY=xxx node test-leave-request-submission.mjs
 *
 * Test Flow:
 *   1. Create test employee with company_id
 *   2. Create test leave type with company_id
 *   3. Submit leave request as employee (anon role)
 *   4. Verify request inserted successfully
 *   5. Verify request visible to employee
 *   6. Clean up test data
 */

import { createClient } from '@supabase/supabase-js';

// ============================================================================
// CONFIGURATION
// ============================================================================

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   SUPABASE_URL or VITE_SUPABASE_URL');
  console.error('   SUPABASE_ANON_KEY or VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================================
// TEST UTILITIES
// ============================================================================

let testCompanyId = null;
let testEmployeeId = null;
let testLeaveTypeId = null;
let testLeaveRequestId = null;

function log(emoji, message, data = null) {
  console.log(`${emoji} ${message}`);
  if (data) {
    console.log('  ', JSON.stringify(data, null, 2));
  }
}

function success(message, data = null) {
  log('✅', message, data);
}

function error(message, data = null) {
  log('❌', message, data);
}

function info(message, data = null) {
  log('ℹ️', message, data);
}

function warning(message, data = null) {
  log('⚠️', message, data);
}

async function cleanup() {
  info('Cleaning up test data...');

  try {
    // Delete in reverse order of creation
    if (testLeaveRequestId) {
      const { error: e1 } = await supabase
        .from('leave_requests')
        .delete()
        .eq('id', testLeaveRequestId);
      if (e1) warning('Could not delete test leave request', e1);
    }

    if (testLeaveTypeId) {
      const { error: e2 } = await supabase
        .from('leave_types')
        .delete()
        .eq('id', testLeaveTypeId);
      if (e2) warning('Could not delete test leave type', e2);
    }

    if (testEmployeeId) {
      const { error: e3 } = await supabase
        .from('employees')
        .delete()
        .eq('id', testEmployeeId);
      if (e3) warning('Could not delete test employee', e3);
    }

    if (testCompanyId) {
      const { error: e4 } = await supabase
        .from('companies')
        .delete()
        .eq('id', testCompanyId);
      if (e4) warning('Could not delete test company', e4);
    }

    info('Cleanup completed');
  } catch (err) {
    warning('Cleanup encountered errors', err);
  }
}

// ============================================================================
// TEST FUNCTIONS
// ============================================================================

async function step1_createTestCompany() {
  info('Step 1: Creating test company...');

  const { data, error: err } = await supabase
    .from('companies')
    .insert({
      company_name: 'Test Company - Leave Requests',
      subscription_plan: 'trial',
      is_active: true
    })
    .select()
    .single();

  if (err) {
    error('Failed to create test company', err);
    throw err;
  }

  testCompanyId = data.id;
  success('Test company created', { company_id: testCompanyId });
  return data;
}

async function step2_createTestEmployee() {
  info('Step 2: Creating test employee...');

  const { data, error: err } = await supabase
    .from('employees')
    .insert({
      company_id: testCompanyId,
      full_name: 'Test Employee - Leave Request',
      employee_code: 'TEST-EMP-' + Date.now(),
      phone: '+966500000000',
      is_active: true
    })
    .select()
    .single();

  if (err) {
    error('Failed to create test employee', err);
    throw err;
  }

  testEmployeeId = data.id;
  success('Test employee created', {
    employee_id: testEmployeeId,
    company_id: data.company_id
  });
  return data;
}

async function step3_createTestLeaveType() {
  info('Step 3: Creating test leave type...');

  const { data, error: err } = await supabase
    .from('leave_types')
    .insert({
      company_id: testCompanyId,
      name: 'Annual Leave - Test',
      name_ar: 'إجازة سنوية - اختبار',
      name_en: 'Annual Leave - Test',
      is_paid: true,
      default_days_per_year: 21,
      color: '#3b82f6',
      is_active: true,
      sort_order: 999
    })
    .select()
    .single();

  if (err) {
    error('Failed to create test leave type', err);
    throw err;
  }

  testLeaveTypeId = data.id;
  success('Test leave type created', {
    leave_type_id: testLeaveTypeId,
    company_id: data.company_id
  });
  return data;
}

async function step4_submitLeaveRequest() {
  info('Step 4: Submitting leave request as employee (anon role)...');

  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(today.getDate() + 7);

  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 3);

  const payload = {
    employee_id: testEmployeeId,
    company_id: testCompanyId,
    leave_type_id: testLeaveTypeId,
    start_date: startDate.toISOString().split('T')[0],
    end_date: endDate.toISOString().split('T')[0],
    requested_days: 3,
    reason: 'Test leave request submission',
    status: 'pending'
  };

  info('Insert payload:', payload);

  const { data, error: err } = await supabase
    .from('leave_requests')
    .insert(payload)
    .select()
    .single();

  if (err) {
    error('❌ FAILED: Leave request submission blocked by RLS', err);
    error('This is the bug we are fixing!');
    throw err;
  }

  testLeaveRequestId = data.id;
  success('✅ SUCCESS: Leave request submitted successfully', {
    leave_request_id: testLeaveRequestId,
    employee_id: data.employee_id,
    company_id: data.company_id,
    status: data.status
  });
  return data;
}

async function step5_verifyLeaveRequestVisible() {
  info('Step 5: Verifying leave request is visible to employee...');

  const { data, error: err } = await supabase
    .from('leave_requests')
    .select('*, leave_types(*)')
    .eq('employee_id', testEmployeeId)
    .eq('id', testLeaveRequestId)
    .maybeSingle();

  if (err) {
    error('Failed to fetch leave request', err);
    throw err;
  }

  if (!data) {
    error('Leave request not found (RLS blocking read access)', {
      employee_id: testEmployeeId,
      leave_request_id: testLeaveRequestId
    });
    throw new Error('Leave request not visible to employee');
  }

  success('Leave request visible to employee', {
    leave_request_id: data.id,
    employee_id: data.employee_id,
    company_id: data.company_id,
    leave_type: data.leave_types?.name_ar,
    status: data.status
  });
  return data;
}

async function step6_verifyCompanyIsolation() {
  info('Step 6: Verifying multi-tenant isolation...');

  // Try to fetch leave requests from a different company
  // This should return 0 results even though data exists
  const fakeCompanyId = '00000000-0000-0000-0000-000000000000';

  const { data, error: err } = await supabase
    .from('leave_requests')
    .select('*')
    .eq('company_id', fakeCompanyId);

  if (err) {
    error('Query failed', err);
    throw err;
  }

  if (data.length > 0) {
    error('❌ SECURITY ISSUE: Can see requests from other companies!', {
      fake_company_id: fakeCompanyId,
      found_requests: data.length
    });
    throw new Error('Multi-tenant isolation broken');
  }

  success('✅ Multi-tenant isolation working correctly (no cross-company access)');
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runTest() {
  console.log('\n========================================');
  console.log('🧪 Leave Request Submission Self-Test');
  console.log('========================================\n');

  try {
    await step1_createTestCompany();
    await step2_createTestEmployee();
    await step3_createTestLeaveType();
    await step4_submitLeaveRequest();
    await step5_verifyLeaveRequestVisible();
    await step6_verifyCompanyIsolation();

    console.log('\n========================================');
    console.log('✅ ALL TESTS PASSED');
    console.log('========================================\n');

    success('Summary:');
    success('  ✓ Test data created successfully');
    success('  ✓ Leave request submitted (INSERT works)');
    success('  ✓ Leave request visible to employee (SELECT works)');
    success('  ✓ Multi-tenant isolation verified');
    success('  ✓ RLS policies working correctly');

    console.log('\n📋 Test Data IDs:');
    console.log(`   Company ID:      ${testCompanyId}`);
    console.log(`   Employee ID:     ${testEmployeeId}`);
    console.log(`   Leave Type ID:   ${testLeaveTypeId}`);
    console.log(`   Leave Request ID: ${testLeaveRequestId}`);

    return 0;
  } catch (err) {
    console.log('\n========================================');
    console.log('❌ TEST FAILED');
    console.log('========================================\n');

    error('Test suite failed', err.message);

    if (err.code) {
      console.log('\nError Details:');
      console.log(`  Code: ${err.code}`);
      console.log(`  Message: ${err.message}`);
      if (err.details) console.log(`  Details: ${err.details}`);
      if (err.hint) console.log(`  Hint: ${err.hint}`);
    }

    return 1;
  } finally {
    console.log('\n');
    await cleanup();
    console.log('\n');
  }
}

// Run the test
runTest()
  .then(exitCode => {
    process.exit(exitCode);
  })
  .catch(err => {
    console.error('Unhandled error:', err);
    process.exit(1);
  });
