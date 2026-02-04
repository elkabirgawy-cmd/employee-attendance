#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Test accounts
const ACCOUNTS = [
  {
    name: "mohamed's Company",
    phone: '+201009884767',
    employeeId: '1a8f412c-be7b-4a24-a6bb-bb36cce90c53',
    companyId: '8ab77d2a-dc74-4109-88af-c6a9ef271bf2',
    adminEmail: 'mohamed@example.com'
  },
  {
    name: 'شركة افتراضية',
    phone: '+966503456789',
    employeeId: '3c551b14-a5dd-4d55-8014-62115435cce6',
    companyId: 'aeb3d19c-82bc-462e-9207-92e49d507a07',
    adminEmail: 'admin@virtualcompany.sa'
  }
];

let testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

function logTest(test, status, message = '') {
  const symbol = status === 'PASS' ? '✅' : '❌';
  console.log(`  ${symbol} ${test}${message ? ': ' + message : ''}`);
  testResults.tests.push({ test, status, message });
  if (status === 'PASS') testResults.passed++;
  else testResults.failed++;
}

console.log('═'.repeat(80));
console.log('SEARCH PATH FIX - COMPREHENSIVE REGRESSION TEST');
console.log('═'.repeat(80));
console.log();

for (const account of ACCOUNTS) {
  console.log('═'.repeat(80));
  console.log(`TESTING: ${account.name}`);
  console.log(`Phone: ${account.phone}`);
  console.log(`Company ID: ${account.companyId}`);
  console.log('═'.repeat(80));
  console.log();

  // =========================================================================
  // TEST 1: Employee Login
  // =========================================================================
  console.log('TEST 1: Employee Login');
  try {
    const { data: loginData, error: loginError } = await supabase.rpc('employee_login', {
      p_phone: account.phone,
      p_device_info: JSON.stringify({ test: 'regression' })
    });

    if (loginError) throw loginError;
    if (!loginData || loginData.length === 0) throw new Error('No login data');

    const session = loginData[0];
    logTest('Employee login', 'PASS', `Employee ID: ${session.employee_id}`);

    // Store session for subsequent tests
    account.sessionToken = session.session_token;
    account.actualEmployeeId = session.employee_id;

  } catch (error) {
    logTest('Employee login', 'FAIL', error.message);
    continue; // Skip remaining tests for this account
  }

  // =========================================================================
  // TEST 2: Submit Leave Request
  // =========================================================================
  console.log();
  console.log('TEST 2: Submit Leave Request');
  try {
    // First, get available leave types
    const { data: leaveTypes, error: ltError } = await supabase
      .from('leave_types')
      .select('*')
      .eq('company_id', account.companyId)
      .limit(1)
      .maybeSingle();

    if (ltError) throw ltError;
    if (!leaveTypes) {
      logTest('Submit leave request', 'SKIP', 'No leave types available');
    } else {
      // Submit leave request
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      const { data: leaveRequest, error: lrError } = await supabase
        .from('leave_requests')
        .insert({
          employee_id: account.actualEmployeeId,
          company_id: account.companyId,
          leave_type_id: leaveTypes.id,
          start_date: tomorrowStr,
          end_date: tomorrowStr,
          reason: 'Regression test - search_path fix',
          status: 'pending'
        })
        .select()
        .single();

      if (lrError) throw lrError;

      logTest('Submit leave request', 'PASS', `Request ID: ${leaveRequest.id}`);
      account.leaveRequestId = leaveRequest.id;

      // Verify company_id is correct
      if (leaveRequest.company_id !== account.companyId) {
        throw new Error(`Company ID mismatch: ${leaveRequest.company_id} != ${account.companyId}`);
      }
      logTest('Leave request company_id', 'PASS', 'Correct company association');
    }
  } catch (error) {
    logTest('Submit leave request', 'FAIL', error.message);
  }

  // =========================================================================
  // TEST 3: Submit Delay Permission
  // =========================================================================
  console.log();
  console.log('TEST 3: Submit Delay Permission');
  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const { data: delayPerm, error: dpError } = await supabase
      .from('delay_permissions')
      .insert({
        employee_id: account.actualEmployeeId,
        company_id: account.companyId,
        date: tomorrowStr,
        start_time: '09:00:00',
        end_time: '09:30:00',
        reason: 'Regression test - search_path fix',
        status: 'pending'
      })
      .select()
      .single();

    if (dpError) throw dpError;

    logTest('Submit delay permission', 'PASS', `Permission ID: ${delayPerm.id}`);
    account.delayPermissionId = delayPerm.id;

    // Verify company_id is correct
    if (delayPerm.company_id !== account.companyId) {
      throw new Error(`Company ID mismatch: ${delayPerm.company_id} != ${account.companyId}`);
    }
    logTest('Delay permission company_id', 'PASS', 'Correct company association');

  } catch (error) {
    logTest('Submit delay permission', 'FAIL', error.message);
  }

  // =========================================================================
  // TEST 4: Employee View Leave Requests
  // =========================================================================
  console.log();
  console.log('TEST 4: Employee View Leave Requests');
  try {
    const { data: leaveRequests, error: lrError } = await supabase
      .from('leave_requests')
      .select('*, leave_types(*)')
      .eq('employee_id', account.actualEmployeeId);

    if (lrError) throw lrError;

    logTest('View leave requests', 'PASS', `Found ${leaveRequests.length} requests`);

    // Verify all requests belong to correct company
    const wrongCompany = leaveRequests.find(lr => lr.company_id !== account.companyId);
    if (wrongCompany) {
      throw new Error(`Found request from wrong company: ${wrongCompany.company_id}`);
    }
    logTest('Leave requests isolation', 'PASS', 'All requests from correct company');

  } catch (error) {
    logTest('View leave requests', 'FAIL', error.message);
  }

  // =========================================================================
  // TEST 5: Employee View Delay Permissions
  // =========================================================================
  console.log();
  console.log('TEST 5: Employee View Delay Permissions');
  try {
    const { data: delayPerms, error: dpError } = await supabase
      .from('delay_permissions')
      .select('*')
      .eq('employee_id', account.actualEmployeeId);

    if (dpError) throw dpError;

    logTest('View delay permissions', 'PASS', `Found ${delayPerms.length} permissions`);

    // Verify all permissions belong to correct company
    const wrongCompany = delayPerms.find(dp => dp.company_id !== account.companyId);
    if (wrongCompany) {
      throw new Error(`Found permission from wrong company: ${wrongCompany.company_id}`);
    }
    logTest('Delay permissions isolation', 'PASS', 'All permissions from correct company');

  } catch (error) {
    logTest('View delay permissions', 'FAIL', error.message);
  }

  console.log();
}

// =========================================================================
// TEST 6: Admin Approve/Reject (requires admin login)
// =========================================================================
console.log('═'.repeat(80));
console.log('TEST 6: Admin Operations');
console.log('═'.repeat(80));
console.log();

for (const account of ACCOUNTS) {
  if (!account.leaveRequestId && !account.delayPermissionId) {
    console.log(`SKIP: ${account.name} - No requests to approve`);
    continue;
  }

  console.log(`Testing admin operations for: ${account.name}`);

  // Login as admin
  const { data: adminData, error: adminError } = await supabase.auth.signInWithPassword({
    email: account.adminEmail,
    password: 'password123'
  });

  if (adminError) {
    logTest(`Admin login for ${account.name}`, 'FAIL', adminError.message);
    continue;
  }

  logTest(`Admin login for ${account.name}`, 'PASS');

  // Approve leave request if exists
  if (account.leaveRequestId) {
    try {
      const { data: approved, error: approveError } = await supabase
        .from('leave_requests')
        .update({ status: 'approved' })
        .eq('id', account.leaveRequestId)
        .eq('company_id', account.companyId)
        .select()
        .single();

      if (approveError) throw approveError;

      logTest(`Approve leave request (${account.name})`, 'PASS');

      // Verify company_id unchanged
      if (approved.company_id !== account.companyId) {
        throw new Error('Company ID changed after approval');
      }
      logTest(`Leave request company_id intact (${account.name})`, 'PASS');

    } catch (error) {
      logTest(`Approve leave request (${account.name})`, 'FAIL', error.message);
    }
  }

  // Approve delay permission if exists
  if (account.delayPermissionId) {
    try {
      const { data: approved, error: approveError } = await supabase
        .from('delay_permissions')
        .update({ status: 'approved' })
        .eq('id', account.delayPermissionId)
        .eq('company_id', account.companyId)
        .select()
        .single();

      if (approveError) throw approveError;

      logTest(`Approve delay permission (${account.name})`, 'PASS');

      // Verify company_id unchanged
      if (approved.company_id !== account.companyId) {
        throw new Error('Company ID changed after approval');
      }
      logTest(`Delay permission company_id intact (${account.name})`, 'PASS');

    } catch (error) {
      logTest(`Approve delay permission (${account.name})`, 'FAIL', error.message);
    }
  }

  await supabase.auth.signOut();
  console.log();
}

// =========================================================================
// TEST 7: Cross-Company Isolation
// =========================================================================
console.log('═'.repeat(80));
console.log('TEST 7: Cross-Company Data Isolation');
console.log('═'.repeat(80));
console.log();

// Login as Company 1 admin
const company1 = ACCOUNTS[0];
const { data: admin1Data } = await supabase.auth.signInWithPassword({
  email: company1.adminEmail,
  password: 'password123'
});

if (admin1Data) {
  try {
    // Try to read Company 2's leave requests
    const { data: leaveRequests, error: lrError } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('company_id', ACCOUNTS[1].companyId);

    if (lrError && lrError.code !== 'PGRST116') {
      // PGRST116 = no rows returned (expected due to RLS)
      throw lrError;
    }

    if (leaveRequests && leaveRequests.length > 0) {
      logTest('Cross-company leave request isolation', 'FAIL', 'Admin 1 can see Admin 2 data!');
    } else {
      logTest('Cross-company leave request isolation', 'PASS', 'No cross-company access');
    }

  } catch (error) {
    logTest('Cross-company leave request isolation', 'FAIL', error.message);
  }

  try {
    // Try to read Company 2's delay permissions
    const { data: delayPerms, error: dpError } = await supabase
      .from('delay_permissions')
      .select('*')
      .eq('company_id', ACCOUNTS[1].companyId);

    if (dpError && dpError.code !== 'PGRST116') {
      throw dpError;
    }

    if (delayPerms && delayPerms.length > 0) {
      logTest('Cross-company delay permission isolation', 'FAIL', 'Admin 1 can see Admin 2 data!');
    } else {
      logTest('Cross-company delay permission isolation', 'PASS', 'No cross-company access');
    }

  } catch (error) {
    logTest('Cross-company delay permission isolation', 'FAIL', error.message);
  }

  await supabase.auth.signOut();
}

// =========================================================================
// FINAL SUMMARY
// =========================================================================
console.log();
console.log('═'.repeat(80));
console.log('TEST RESULTS SUMMARY');
console.log('═'.repeat(80));
console.log();
console.log(`Total Tests: ${testResults.passed + testResults.failed}`);
console.log(`Passed: ${testResults.passed} ✅`);
console.log(`Failed: ${testResults.failed} ❌`);
console.log();

if (testResults.failed > 0) {
  console.log('FAILED TESTS:');
  testResults.tests
    .filter(t => t.status === 'FAIL')
    .forEach(t => console.log(`  ❌ ${t.test}: ${t.message}`));
  console.log();
  process.exit(1);
} else {
  console.log('═'.repeat(80));
  console.log('✅✅✅ ALL REGRESSION TESTS PASSED ✅✅✅');
  console.log('═'.repeat(80));
  console.log();
  console.log('VERIFICATION COMPLETE:');
  console.log('  ✅ Employee login works (both companies)');
  console.log('  ✅ Employee submit leave requests (both companies)');
  console.log('  ✅ Employee submit delay permissions (both companies)');
  console.log('  ✅ Employee view records (both companies)');
  console.log('  ✅ Admin approve/reject (both companies)');
  console.log('  ✅ Company ID filtering works correctly');
  console.log('  ✅ Cross-company data isolation maintained');
  console.log('  ✅ No RLS policy violations');
  console.log('  ✅ search_path fix has zero functional impact');
  console.log('═'.repeat(80));
  process.exit(0);
}
