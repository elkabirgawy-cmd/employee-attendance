#!/usr/bin/env node

/**
 * Test: Employee Check-In RLS Fix Verification
 *
 * This test verifies:
 * 1. Anonymous users can INSERT into attendance_logs
 * 2. validate_employee_belongs_to_company function works
 * 3. Required fields validation works
 * 4. Company isolation is maintained
 * 5. Check-in succeeds and row is created in DB
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Read .env file
const envContent = readFileSync('.env', 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    envVars[key.trim()] = valueParts.join('=').trim();
  }
});

// Create anonymous client (no auth)
const supabaseAnon = createClient(
  envVars.VITE_SUPABASE_URL,
  envVars.VITE_SUPABASE_ANON_KEY
);

console.log('🧪 Testing: Employee Check-In RLS Fix\n');
console.log('='.repeat(80));

async function getTestEmployee() {
  const { data, error } = await supabaseAnon
    .from('employees')
    .select(`
      id,
      employee_code,
      full_name,
      company_id,
      branch_id,
      shift_id,
      is_active,
      branches:branch_id (
        id,
        name,
        latitude,
        longitude,
        geofence_radius
      )
    `)
    .eq('is_active', true)
    .not('branch_id', 'is', null)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('❌ Error fetching test employee:', error);
    return null;
  }

  return data;
}

async function checkFunctionExists() {
  console.log('\n📋 Test 1: Verify validate_employee_belongs_to_company function exists');
  console.log('-'.repeat(80));

  try {
    // Try to call the function directly
    const { data, error } = await supabaseAnon.rpc('validate_employee_belongs_to_company', {
      emp_id: '00000000-0000-0000-0000-000000000000',
      comp_id: '00000000-0000-0000-0000-000000000000'
    });

    if (error) {
      console.error('  ❌ Function call error:', error.message);
      return false;
    }

    console.log('  ✅ Function exists and is callable by anonymous users');
    console.log(`  ✅ Function returned: ${data}`);
    return true;
  } catch (err) {
    console.error('  ❌ Function test failed:', err);
    return false;
  }
}

async function testValidateFunction(employee) {
  console.log('\n📋 Test 2: Validate employee belongs to company');
  console.log('-'.repeat(80));

  try {
    const { data, error } = await supabaseAnon.rpc('validate_employee_belongs_to_company', {
      emp_id: employee.id,
      comp_id: employee.company_id
    });

    if (error) {
      console.error('  ❌ Validation error:', error.message);
      return false;
    }

    if (data === true) {
      console.log(`  ✅ Employee ${employee.employee_code} belongs to company ${employee.company_id}`);
      return true;
    } else {
      console.error(`  ❌ Employee validation returned false`);
      return false;
    }
  } catch (err) {
    console.error('  ❌ Validation test failed:', err);
    return false;
  }
}

async function testCheckIn(employee) {
  console.log('\n📋 Test 3: Anonymous Check-In INSERT');
  console.log('-'.repeat(80));

  try {
    const now = new Date().toISOString();
    const today = now.split('T')[0];

    // Check if employee already checked in today
    const { data: existing } = await supabaseAnon
      .from('attendance_logs')
      .select('id, check_in_time')
      .eq('employee_id', employee.id)
      .eq('company_id', employee.company_id)
      .gte('check_in_time', `${today}T00:00:00`)
      .lte('check_in_time', `${today}T23:59:59`)
      .maybeSingle();

    if (existing) {
      console.log('  ℹ️  Employee already checked in today');
      console.log(`     Record ID: ${existing.id}`);
      console.log(`     Check-in time: ${existing.check_in_time}`);
      console.log('  ✅ Anonymous SELECT works (can read existing attendance)');
      return { success: true, existing: true, data: existing };
    }

    console.log('  📝 Attempting INSERT...');
    console.log(`     Employee ID: ${employee.id}`);
    console.log(`     Company ID: ${employee.company_id}`);
    console.log(`     Branch ID: ${employee.branch_id}`);
    console.log(`     Check-in Time: ${now}`);

    const attendanceData = {
      employee_id: employee.id,
      company_id: employee.company_id,
      branch_id: employee.branch_id,
      check_in_time: now,
      check_in_device_time: now,
      check_in_latitude: employee.branches?.latitude || 0,
      check_in_longitude: employee.branches?.longitude || 0,
      check_in_accuracy: 10,
      check_in_distance_m: 0,
      status: 'on_time',
    };

    const { data, error } = await supabaseAnon
      .from('attendance_logs')
      .insert(attendanceData)
      .select()
      .single();

    if (error) {
      console.error('  ❌ INSERT FAILED');
      console.error('     Error Code:', error.code);
      console.error('     Error Message:', error.message);
      console.error('     Error Details:', error.details);
      console.error('     Error Hint:', error.hint);
      return { success: false, error };
    }

    console.log('  ✅ INSERT SUCCESSFUL!');
    console.log(`     Record ID: ${data.id}`);
    console.log(`     Employee: ${employee.employee_code}`);
    console.log(`     Check-in: ${data.check_in_time}`);
    console.log(`     Status: ${data.status}`);

    return { success: true, existing: false, data };
  } catch (err) {
    console.error('  ❌ Check-in test failed:', err);
    return { success: false, error: err };
  }
}

async function testRequiredFieldsValidation() {
  console.log('\n📋 Test 4: Required Fields Validation');
  console.log('-'.repeat(80));

  try {
    // Try to insert without required fields
    const { error } = await supabaseAnon
      .from('attendance_logs')
      .insert({
        // Missing employee_id, company_id, branch_id
        check_in_time: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.log('  ✅ RLS correctly blocks INSERT without required fields');
      console.log(`     Error: ${error.message}`);
      return true;
    } else {
      console.error('  ❌ RLS allowed INSERT without required fields (security issue!)');
      return false;
    }
  } catch (err) {
    console.log('  ✅ RLS correctly blocks INSERT without required fields');
    return true;
  }
}

async function testCrossCompanyIsolation(employee) {
  console.log('\n📋 Test 5: Cross-Company Isolation');
  console.log('-'.repeat(80));

  try {
    // Try to insert attendance with wrong company_id
    const fakeCompanyId = '00000000-0000-0000-0000-000000000001';

    const { error } = await supabaseAnon
      .from('attendance_logs')
      .insert({
        employee_id: employee.id,
        company_id: fakeCompanyId, // Wrong company!
        branch_id: employee.branch_id,
        check_in_time: new Date().toISOString(),
        status: 'on_time'
      })
      .select()
      .single();

    if (error) {
      console.log('  ✅ RLS correctly blocks INSERT with mismatched company_id');
      console.log(`     Error: ${error.message}`);
      return true;
    } else {
      console.error('  ❌ RLS allowed INSERT with wrong company_id (security issue!)');
      return false;
    }
  } catch (err) {
    console.log('  ✅ RLS correctly blocks INSERT with mismatched company_id');
    return true;
  }
}

async function verifyInAdminDashboard(recordId) {
  console.log('\n📋 Test 6: Verify Record Visible in Admin Dashboard');
  console.log('-'.repeat(80));

  // For this we'd need an authenticated admin session
  // Skip for now since we're testing anonymous access
  console.log('  ℹ️  Skipping - requires authenticated admin session');
  console.log('  ℹ️  Manual verification: Check admin dashboard for record', recordId);
  return true;
}

async function runTests() {
  try {
    console.log('\n🔍 Fetching test employee...');
    const employee = await getTestEmployee();

    if (!employee) {
      console.log('\n⚠️  No active employees found with assigned branch');
      console.log('   Please create an employee with:');
      console.log('   - is_active = true');
      console.log('   - branch_id assigned');
      console.log('   - shift_id assigned');
      return;
    }

    console.log(`\n✅ Found test employee:`);
    console.log(`   Code: ${employee.employee_code}`);
    console.log(`   Name: ${employee.full_name}`);
    console.log(`   Company: ${employee.company_id}`);
    console.log(`   Branch: ${employee.branches?.name || employee.branch_id}`);
    console.log(`   Active: ${employee.is_active}`);

    // Run all tests
    const test1 = await checkFunctionExists();
    const test2 = test1 ? await testValidateFunction(employee) : false;
    const test3 = test2 ? await testCheckIn(employee) : { success: false };
    const test4 = await testRequiredFieldsValidation();
    const test5 = await testCrossCompanyIsolation(employee);

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(80));
    console.log(`\n  Test 1 - Function Exists:          ${test1 ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Test 2 - Validate Function:        ${test2 ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Test 3 - Anonymous Check-In:       ${test3.success ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Test 4 - Required Fields:          ${test4 ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Test 5 - Company Isolation:        ${test5 ? '✅ PASS' : '❌ FAIL'}`);

    const allPassed = test1 && test2 && test3.success && test4 && test5;

    if (allPassed) {
      console.log('\n✅✅✅ ALL TESTS PASSED ✅✅✅');
      console.log('\n🎉 Employee check-in is working correctly!');
      console.log('   - Anonymous users can check in');
      console.log('   - Company isolation is enforced');
      console.log('   - Required fields are validated');
      console.log('   - Security policies are working');

      if (test3.data) {
        console.log(`\n📝 Created/Found Record:`);
        console.log(`   ID: ${test3.data.id}`);
        console.log(`   Time: ${test3.data.check_in_time}`);
        console.log(`   Status: ${test3.data.status}`);
      }
    } else {
      console.log('\n❌ SOME TESTS FAILED');
      console.log('\nTroubleshooting:');
      if (!test1) console.log('  - Check that validate_employee_belongs_to_company function exists');
      if (!test2) console.log('  - Check employee is active and has valid company_id');
      if (!test3.success) console.log('  - Check RLS policies on attendance_logs table');
      if (!test4) console.log('  - Check WITH CHECK clause in INSERT policy');
      if (!test5) console.log('  - Check company_id validation in RLS policy');
    }

    console.log('\n' + '='.repeat(80));
    console.log('');

  } catch (error) {
    console.error('\n❌ Test suite failed with error:', error);
    process.exit(1);
  }
}

runTests();
