#!/usr/bin/env tsx

/**
 * Multi-Tenant Isolation Test Harness
 *
 * This script tests complete tenant isolation by:
 * 1. Creating two test admins with different companies
 * 2. Creating data as AdminA
 * 3. Verifying AdminB sees EMPTY data
 * 4. Creating data as AdminB
 * 5. Verifying AdminA doesn't see AdminB's data
 * 6. Attempting malicious insert with wrong company_id
 * 7. Reporting PASS/FAIL for each check
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load .env file manually
function loadEnv() {
  try {
    const envPath = join(process.cwd(), '.env');
    const envFile = readFileSync(envPath, 'utf-8');
    envFile.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length) {
        process.env[key.trim()] = valueParts.join('=').trim();
      }
    });
  } catch (error) {
    // .env file not found
  }
}

loadEnv();

// Configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing environment variables!');
  console.error('Required: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

// Admin service client (bypasses RLS)
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Test data
const TEST_TIMESTAMP = Date.now();
const ADMIN_A_EMAIL = `test-admin-a-${TEST_TIMESTAMP}@test.com`;
const ADMIN_B_EMAIL = `test-admin-b-${TEST_TIMESTAMP}@test.com`;
const TEST_PASSWORD = 'TestPass123!@#';

interface TestResult {
  test: string;
  status: 'PASS' | 'FAIL';
  expected: string;
  actual: string;
  details?: any;
}

const results: TestResult[] = [];

function logTest(result: TestResult) {
  const icon = result.status === 'PASS' ? '✅' : '❌';
  console.log(`${icon} ${result.test}`);
  console.log(`   Expected: ${result.expected}`);
  console.log(`   Actual: ${result.actual}`);
  if (result.details) {
    console.log(`   Details: ${JSON.stringify(result.details, null, 2)}`);
  }
  console.log('');
  results.push(result);
}

async function cleanup() {
  console.log('🧹 Cleaning up test data...');

  // Delete test users
  const { data: users } = await supabaseAdmin.auth.admin.listUsers();
  const testUsers = users.users.filter(u =>
    u.email?.includes(`test-admin-${TEST_TIMESTAMP}`)
  );

  for (const user of testUsers) {
    await supabaseAdmin.auth.admin.deleteUser(user.id);
  }

  console.log(`✓ Cleaned up ${testUsers.length} test users\n`);
}

async function createTestAdmin(email: string, name: string): Promise<{
  userId: string;
  companyId: string;
  client: SupabaseClient;
}> {
  console.log(`\n📝 Creating test admin: ${email}`);

  // Create auth user
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: name }
  });

  if (authError || !authData.user) {
    throw new Error(`Failed to create auth user: ${authError?.message}`);
  }

  console.log(`   ✓ Auth user created: ${authData.user.id}`);

  // Create company
  const { data: company, error: companyError } = await supabaseAdmin
    .from('companies')
    .insert({
      name: `${name}'s Company`,
      plan: 'free',
      status: 'active'
    })
    .select()
    .single();

  if (companyError || !company) {
    throw new Error(`Failed to create company: ${companyError?.message}`);
  }

  console.log(`   ✓ Company created: ${company.id}`);

  // Create admin_users record
  const { error: adminError } = await supabaseAdmin
    .from('admin_users')
    .insert({
      id: authData.user.id,
      company_id: company.id,
      email,
      full_name: name,
      is_active: true,
      is_owner: true
    });

  if (adminError) {
    throw new Error(`Failed to create admin_users: ${adminError.message}`);
  }

  console.log(`   ✓ Admin user record created`);

  // Create client for this admin
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // Sign in
  const { data: sessionData, error: signInError } = await client.auth.signInWithPassword({
    email,
    password: TEST_PASSWORD
  });

  if (signInError || !sessionData.session) {
    throw new Error(`Failed to sign in: ${signInError?.message}`);
  }

  console.log(`   ✓ Signed in successfully`);

  return {
    userId: authData.user.id,
    companyId: company.id,
    client
  };
}

async function testCompanyIsolation(adminA: any, adminB: any) {
  console.log('\n=== TEST: Company ID Isolation ===\n');

  // Test 1: Different company IDs
  logTest({
    test: 'AdminA and AdminB have different company_id',
    status: adminA.companyId !== adminB.companyId ? 'PASS' : 'FAIL',
    expected: 'Different company_id values',
    actual: adminA.companyId === adminB.companyId ? 'Same company_id' : 'Different company_id',
    details: {
      adminA_company: adminA.companyId,
      adminB_company: adminB.companyId
    }
  });

  // Test 2: AdminA can read own company
  const { data: companyA } = await adminA.client
    .from('companies')
    .select('*')
    .eq('id', adminA.companyId)
    .single();

  logTest({
    test: 'AdminA can read own company record',
    status: companyA ? 'PASS' : 'FAIL',
    expected: 'Company record returned',
    actual: companyA ? 'Company record found' : 'No company found',
    details: companyA
  });

  // Test 3: AdminA CANNOT read AdminB's company
  const { data: companyBFromA } = await adminA.client
    .from('companies')
    .select('*')
    .eq('id', adminB.companyId)
    .single();

  logTest({
    test: 'AdminA CANNOT read AdminB\'s company',
    status: !companyBFromA ? 'PASS' : 'FAIL',
    expected: 'No access to other company',
    actual: companyBFromA ? 'Can access other company (SECURITY ISSUE!)' : 'No access',
    details: companyBFromA
  });
}

async function testEmployeeIsolation(adminA: any, adminB: any) {
  console.log('\n=== TEST: Employee Data Isolation ===\n');

  // AdminA creates employees
  const { data: empA1, error: empA1Error } = await adminA.client
    .from('employees')
    .insert({
      employee_code: `EMP-A-${TEST_TIMESTAMP}-001`,
      full_name: 'Employee A1',
      email: `emp-a1-${TEST_TIMESTAMP}@test.com`,
      phone: '+1234567801',
      is_active: true
    })
    .select()
    .single();

  const { data: empA2 } = await adminA.client
    .from('employees')
    .insert({
      employee_code: `EMP-A-${TEST_TIMESTAMP}-002`,
      full_name: 'Employee A2',
      email: `emp-a2-${TEST_TIMESTAMP}@test.com`,
      phone: '+1234567802',
      is_active: true
    })
    .select()
    .single();

  logTest({
    test: 'AdminA can create employees',
    status: empA1 && empA2 ? 'PASS' : 'FAIL',
    expected: '2 employees created',
    actual: empA1 && empA2 ? '2 employees created' : `Error: ${empA1Error?.message}`,
    details: { empA1, empA2 }
  });

  // Verify company_id was auto-set
  logTest({
    test: 'Employee company_id auto-set to AdminA company',
    status: empA1?.company_id === adminA.companyId ? 'PASS' : 'FAIL',
    expected: adminA.companyId,
    actual: empA1?.company_id || 'null',
    details: { employee: empA1 }
  });

  // AdminA counts employees
  const { data: empCountA, count: countA } = await adminA.client
    .from('employees')
    .select('*', { count: 'exact', head: false });

  logTest({
    test: 'AdminA sees exactly 2 employees',
    status: countA === 2 ? 'PASS' : 'FAIL',
    expected: '2 employees',
    actual: `${countA} employees`,
    details: empCountA
  });

  // AdminB counts employees (should be 0)
  const { data: empCountB, count: countB } = await adminB.client
    .from('employees')
    .select('*', { count: 'exact', head: false });

  logTest({
    test: 'AdminB sees 0 employees (AdminA data invisible)',
    status: countB === 0 ? 'PASS' : 'FAIL',
    expected: '0 employees',
    actual: `${countB} employees`,
    details: empCountB
  });

  // AdminB creates employee
  const { data: empB1 } = await adminB.client
    .from('employees')
    .insert({
      employee_code: `EMP-B-${TEST_TIMESTAMP}-001`,
      full_name: 'Employee B1',
      email: `emp-b1-${TEST_TIMESTAMP}@test.com`,
      phone: '+1234567803',
      is_active: true
    })
    .select()
    .single();

  // AdminB counts employees (should be 1)
  const { count: countB2 } = await adminB.client
    .from('employees')
    .select('*', { count: 'exact', head: true });

  logTest({
    test: 'AdminB sees exactly 1 employee (own data)',
    status: countB2 === 1 ? 'PASS' : 'FAIL',
    expected: '1 employee',
    actual: `${countB2} employees`
  });

  // AdminA still sees only 2 employees
  const { count: countA2 } = await adminA.client
    .from('employees')
    .select('*', { count: 'exact', head: true });

  logTest({
    test: 'AdminA still sees 2 employees (AdminB data invisible)',
    status: countA2 === 2 ? 'PASS' : 'FAIL',
    expected: '2 employees',
    actual: `${countA2} employees`
  });

  return { empA1, empB1 };
}

async function testBranchIsolation(adminA: any, adminB: any) {
  console.log('\n=== TEST: Branch Data Isolation ===\n');

  // AdminA creates branch
  const { data: branchA, error: branchAError } = await adminA.client
    .from('branches')
    .insert({
      name: 'Branch A Main',
      latitude: 25.276987,
      longitude: 55.296249,
      geofence_radius: 100,
      is_active: true
    })
    .select()
    .single();

  logTest({
    test: 'AdminA can create branch',
    status: branchA ? 'PASS' : 'FAIL',
    expected: 'Branch created',
    actual: branchA ? 'Branch created' : `Error: ${branchAError?.message}`,
    details: branchA
  });

  // AdminB counts branches (should be 0)
  const { count: countB } = await adminB.client
    .from('branches')
    .select('*', { count: 'exact', head: true });

  logTest({
    test: 'AdminB sees 0 branches',
    status: countB === 0 ? 'PASS' : 'FAIL',
    expected: '0 branches',
    actual: `${countB} branches`
  });

  return branchA;
}

async function testShiftIsolation(adminA: any, adminB: any) {
  console.log('\n=== TEST: Shift Data Isolation ===\n');

  // AdminA creates shift
  const { data: shiftA, error: shiftAError } = await adminA.client
    .from('shifts')
    .insert({
      name: 'Morning Shift',
      start_time: '09:00:00',
      end_time: '17:00:00',
      is_active: true
    })
    .select()
    .single();

  logTest({
    test: 'AdminA can create shift',
    status: shiftA ? 'PASS' : 'FAIL',
    expected: 'Shift created',
    actual: shiftA ? 'Shift created' : `Error: ${shiftAError?.message}`,
    details: shiftA
  });

  // AdminB counts shifts (should be 0)
  const { count: countB } = await adminB.client
    .from('shifts')
    .select('*', { count: 'exact', head: true });

  logTest({
    test: 'AdminB sees 0 shifts',
    status: countB === 0 ? 'PASS' : 'FAIL',
    expected: '0 shifts',
    actual: `${countB} shifts`
  });

  return shiftA;
}

async function testSettingsIsolation(adminA: any, adminB: any) {
  console.log('\n=== TEST: Settings/Config Isolation ===\n');

  // Test application_settings
  const { data: settingsA, error: settingsAError } = await adminA.client
    .from('application_settings')
    .insert({
      max_gps_accuracy_meters: 75,
      require_high_accuracy: true,
      currency: 'USD'
    })
    .select()
    .single();

  logTest({
    test: 'AdminA can create application settings',
    status: settingsA ? 'PASS' : 'FAIL',
    expected: 'Settings created',
    actual: settingsA ? 'Settings created' : `Error: ${settingsAError?.message}`,
    details: settingsA
  });

  // AdminB reads application_settings (should be 0)
  const { count: countB } = await adminB.client
    .from('application_settings')
    .select('*', { count: 'exact', head: true });

  logTest({
    test: 'AdminB sees 0 application_settings',
    status: countB === 0 ? 'PASS' : 'FAIL',
    expected: '0 settings',
    actual: `${countB} settings`
  });

  // Test payroll_settings
  const { data: payrollA } = await adminA.client
    .from('payroll_settings')
    .insert({
      workdays_per_month: 26,
      currency: 'USD'
    })
    .select()
    .single();

  const { count: payrollCountB } = await adminB.client
    .from('payroll_settings')
    .select('*', { count: 'exact', head: true });

  logTest({
    test: 'AdminB sees 0 payroll_settings',
    status: payrollCountB === 0 ? 'PASS' : 'FAIL',
    expected: '0 payroll settings',
    actual: `${payrollCountB} payroll settings`
  });
}

async function testMaliciousInsert(adminA: any, adminB: any, empA1: any) {
  console.log('\n=== TEST: Malicious company_id Bypass Attempt ===\n');

  // Attempt 1: AdminA tries to insert employee with AdminB's company_id
  const { data: maliciousEmp, error: maliciousError } = await adminA.client
    .from('employees')
    .insert({
      employee_code: `MALICIOUS-${TEST_TIMESTAMP}`,
      full_name: 'Malicious Employee',
      email: `malicious-${TEST_TIMESTAMP}@test.com`,
      phone: '+9999999999',
      company_id: adminB.companyId, // Trying to insert into AdminB's company!
      is_active: true
    })
    .select()
    .single();

  // Check if insertion succeeded
  if (maliciousEmp) {
    // Check what company_id was actually set
    const actualCompanyId = maliciousEmp.company_id;

    logTest({
      test: 'Malicious company_id is overridden by trigger',
      status: actualCompanyId === adminA.companyId ? 'PASS' : 'FAIL',
      expected: `company_id set to AdminA: ${adminA.companyId}`,
      actual: `company_id set to: ${actualCompanyId}`,
      details: {
        attempted: adminB.companyId,
        actual: actualCompanyId,
        employee: maliciousEmp
      }
    });
  } else {
    logTest({
      test: 'Malicious insert blocked by RLS',
      status: maliciousError ? 'PASS' : 'FAIL',
      expected: 'Insert blocked or company_id overridden',
      actual: maliciousError ? `Blocked: ${maliciousError.message}` : 'Insert succeeded',
      details: { error: maliciousError }
    });
  }

  // Verify AdminB still doesn't see malicious employee
  const { count: countB } = await adminB.client
    .from('employees')
    .select('*', { count: 'exact', head: true });

  logTest({
    test: 'AdminB still sees only own employee (malicious insert not visible)',
    status: countB === 1 ? 'PASS' : 'FAIL',
    expected: '1 employee',
    actual: `${countB} employees`
  });

  // Attempt 2: AdminA tries to UPDATE employee with AdminB's company_id
  if (empA1) {
    const { data: maliciousUpdate, error: updateError } = await adminA.client
      .from('employees')
      .update({ company_id: adminB.companyId })
      .eq('id', empA1.id)
      .select()
      .single();

    logTest({
      test: 'Malicious UPDATE to change company_id is blocked',
      status: updateError || maliciousUpdate?.company_id === adminA.companyId ? 'PASS' : 'FAIL',
      expected: 'Update blocked or company_id unchanged',
      actual: updateError ? `Blocked: ${updateError.message}` : `company_id: ${maliciousUpdate?.company_id}`,
      details: { error: updateError, result: maliciousUpdate }
    });
  }
}

async function generateReport() {
  console.log('\n' + '='.repeat(60));
  console.log('FINAL TEST REPORT');
  console.log('='.repeat(60) + '\n');

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const total = results.length;

  console.log(`Total Tests: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%\n`);

  if (failed > 0) {
    console.log('FAILED TESTS:');
    console.log('-'.repeat(60));
    results
      .filter(r => r.status === 'FAIL')
      .forEach(r => {
        console.log(`❌ ${r.test}`);
        console.log(`   Expected: ${r.expected}`);
        console.log(`   Actual: ${r.actual}`);
        if (r.details) {
          console.log(`   Details: ${JSON.stringify(r.details, null, 2)}`);
        }
        console.log('');
      });
  }

  console.log('='.repeat(60));

  if (failed === 0) {
    console.log('\n🎉 ALL TESTS PASSED! Tenant isolation is SECURE.\n');
    return 0;
  } else {
    console.log('\n⚠️  SOME TESTS FAILED! Tenant isolation has SECURITY ISSUES.\n');
    return 1;
  }
}

async function main() {
  console.log('🚀 Multi-Tenant Isolation Test Harness\n');
  console.log('Testing complete tenant isolation across all tables...\n');

  let adminA: any = null;
  let adminB: any = null;
  let exitCode = 0;

  try {
    // Create test admins
    adminA = await createTestAdmin(ADMIN_A_EMAIL, 'Admin A');
    adminB = await createTestAdmin(ADMIN_B_EMAIL, 'Admin B');

    // Run tests
    await testCompanyIsolation(adminA, adminB);
    const { empA1 } = await testEmployeeIsolation(adminA, adminB);
    await testBranchIsolation(adminA, adminB);
    await testShiftIsolation(adminA, adminB);
    await testSettingsIsolation(adminA, adminB);
    await testMaliciousInsert(adminA, adminB, empA1);

    // Generate report
    exitCode = await generateReport();

  } catch (error: any) {
    console.error('\n❌ TEST HARNESS ERROR:', error.message);
    console.error(error.stack);
    exitCode = 1;
  } finally {
    // Cleanup
    await cleanup();
  }

  process.exit(exitCode);
}

main();
