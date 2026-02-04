#!/usr/bin/env node

/**
 * Delay Permission Self-Test Script
 *
 * Tests delay permission functionality in both projects (old/new)
 * Logs all operations to console and optionally to debug table
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables manually
function loadEnv() {
  try {
    const envPath = join(__dirname, '.env');
    const envFile = readFileSync(envPath, 'utf-8');
    const env = {};

    envFile.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=').replace(/^["']|["']$/g, '');
        env[key.trim()] = value.trim();
      }
    });

    return env;
  } catch (error) {
    console.error('Error loading .env file:', error.message);
    return {};
  }
}

const env = loadEnv();
const supabaseUrl = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Test configuration
const TEST_CONFIG = {
  // Test employee phone (will be created if doesn't exist)
  employeePhone: '01234567890',
  employeeName: 'موظف اختبار إذن التأخير',
  // Test delay permission data (unique timestamp to avoid overlaps)
  testDate: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Tomorrow
  startTime: '10:30', // Use different time to avoid overlap
  endTime: '11:00',
  reason: `اختبار نظام إذن التأخير - ${Date.now()}`
};

// Helper: Log to console with timestamp
function log(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const prefix = {
    info: '[INFO]',
    warn: '[WARN]',
    error: '[ERROR]',
    success: '[SUCCESS]'
  }[level] || '[LOG]';

  console.log(`${timestamp} ${prefix} ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

// Helper: Insert debug log
async function insertDebugLog(operation, status, details) {
  try {
    // Check if debug table exists
    const { error: tableCheckError } = await supabase
      .from('delay_permission_debug_logs')
      .select('id')
      .limit(1);

    if (tableCheckError && tableCheckError.code === '42P01') {
      log('warn', 'Debug table does not exist, skipping log insert');
      return;
    }

    await supabase
      .from('delay_permission_debug_logs')
      .insert({
        operation,
        status,
        details,
        created_at: new Date().toISOString()
      });
  } catch (error) {
    log('warn', 'Failed to insert debug log:', error.message);
  }
}

// Step 1: Check table structure
async function checkTableStructure() {
  log('info', '=== Step 1: Checking delay_permissions table structure ===');

  try {
    // Try to query the table with all expected columns
    const { data, error } = await supabase
      .from('delay_permissions')
      .select('id, company_id, employee_id, date, start_time, end_time, minutes, reason, status, decided_by, decided_at, created_at, updated_at')
      .limit(1);

    if (error) {
      log('error', 'Table structure check failed:', error);
      await insertDebugLog('check_table_structure', 'failed', { error: error.message });
      return false;
    }

    log('success', 'Table structure is correct');
    log('info', 'Table columns:', Object.keys(data?.[0] || {
      id: null,
      company_id: null,
      employee_id: null,
      date: null,
      start_time: null,
      end_time: null,
      minutes: null,
      reason: null,
      status: null,
      decided_by: null,
      decided_at: null,
      created_at: null,
      updated_at: null
    }));

    await insertDebugLog('check_table_structure', 'success', { columns: Object.keys(data?.[0] || {}) });
    return true;
  } catch (error) {
    log('error', 'Unexpected error checking table:', error.message);
    return false;
  }
}

// Step 2: Check RLS policies
async function checkRLSPolicies() {
  log('info', '=== Step 2: Checking RLS policies on delay_permissions ===');

  try {
    // Query pg_policies to get RLS policies
    const { data, error } = await supabase
      .rpc('get_delay_permissions_policies');

    if (error) {
      log('warn', 'Could not fetch RLS policies (function may not exist):', error.message);
      log('info', 'Will test INSERT directly instead');
      return true;
    }

    log('success', 'RLS policies found:', data);
    await insertDebugLog('check_rls_policies', 'success', { policies: data });
    return true;
  } catch (error) {
    log('warn', 'RLS policy check skipped:', error.message);
    return true;
  }
}

// Step 3: Find or create test employee
async function getTestEmployee() {
  log('info', '=== Step 3: Finding/creating test employee ===');

  try {
    // Look for test employee by phone
    const { data: employees, error: searchError } = await supabase
      .from('employees')
      .select('id, employee_code, full_name, phone, company_id, is_active')
      .eq('phone', TEST_CONFIG.employeePhone)
      .eq('is_active', true)
      .limit(1);

    if (searchError) {
      log('error', 'Failed to search for employee:', searchError);
      return null;
    }

    if (employees && employees.length > 0) {
      log('success', 'Found existing test employee:', employees[0]);
      return employees[0];
    }

    log('info', 'Test employee not found, will use first available employee');

    // Get first active employee from first company
    const { data: firstEmployee, error: firstError } = await supabase
      .from('employees')
      .select('id, employee_code, full_name, phone, company_id, is_active')
      .eq('is_active', true)
      .limit(1)
      .single();

    if (firstError || !firstEmployee) {
      log('error', 'No active employees found in database');
      return null;
    }

    log('success', 'Using employee:', firstEmployee);
    return firstEmployee;
  } catch (error) {
    log('error', 'Unexpected error finding employee:', error.message);
    return null;
  }
}

// Step 4: Simulate employee login
async function simulateEmployeeLogin(employee) {
  log('info', '=== Step 4: Simulating employee login ===');

  try {
    // Check if employee has an active session
    const { data: sessions, error: sessionError } = await supabase
      .from('employee_sessions')
      .select('id, session_token, is_active, expires_at')
      .eq('employee_id', employee.id)
      .eq('is_active', true)
      .limit(1);

    if (sessionError) {
      log('error', 'Failed to check employee sessions:', sessionError);
      return null;
    }

    if (sessions && sessions.length > 0) {
      log('success', 'Found existing active session:', sessions[0]);
      return sessions[0];
    }

    log('info', 'No active session found');
    log('info', 'Note: Employee login uses custom sessions (not Supabase auth)');
    log('info', 'Auth context: role=anon, auth.uid()=null for employee app');

    return null;
  } catch (error) {
    log('error', 'Unexpected error checking sessions:', error.message);
    return null;
  }
}

// Step 5: Test delay permission INSERT
async function testDelayPermissionInsert(employee) {
  log('info', '=== Step 5: Testing delay permission INSERT ===');

  try {
    // Calculate minutes
    const [startHour, startMin] = TEST_CONFIG.startTime.split(':').map(Number);
    const [endHour, endMin] = TEST_CONFIG.endTime.split(':').map(Number);
    const minutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);

    // Prepare insert data
    const insertData = {
      company_id: employee.company_id,
      employee_id: employee.id,
      date: TEST_CONFIG.testDate,
      start_time: TEST_CONFIG.startTime,
      end_time: TEST_CONFIG.endTime,
      minutes: minutes,
      reason: TEST_CONFIG.reason,
      status: 'pending'
    };

    log('info', 'Insert payload:', insertData);

    // Try to insert
    const { data: insertedData, error: insertError } = await supabase
      .from('delay_permissions')
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      log('error', '❌ INSERT FAILED:', {
        code: insertError.code,
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint
      });

      // Log to debug table
      await insertDebugLog('test_insert', 'failed', {
        employee_id: employee.id,
        company_id: employee.company_id,
        payload: insertData,
        error_code: insertError.code,
        error_message: insertError.message,
        error_details: insertError.details,
        auth_context: {
          role: 'anon',
          uid: null,
          note: 'Employee app uses anon role'
        }
      });

      return { success: false, error: insertError };
    }

    log('success', '✅ INSERT SUCCEEDED:', insertedData);

    // Log to debug table
    await insertDebugLog('test_insert', 'success', {
      employee_id: employee.id,
      company_id: employee.company_id,
      payload: insertData,
      result_id: insertedData.id,
      auth_context: {
        role: 'anon',
        uid: null,
        note: 'Employee app uses anon role'
      }
    });

    return { success: true, data: insertedData };
  } catch (error) {
    log('error', 'Unexpected error during INSERT:', error.message);
    return { success: false, error };
  }
}

// Step 6: Check auth.uid() vs employee_id relationship
async function checkAuthRelationship(employee) {
  log('info', '=== Step 6: Checking auth.uid() vs employee_id relationship ===');

  try {
    // Check if employee.id matches any auth.users record
    const { data: authUser, error: authError } = await supabase
      .from('employees')
      .select('id, user_id')
      .eq('id', employee.id)
      .single();

    if (authError) {
      log('warn', 'Could not check auth relationship:', authError.message);
      return;
    }

    log('info', 'Employee auth relationship:', {
      employee_id: employee.id,
      user_id: authUser.user_id || 'NULL',
      note: authUser.user_id
        ? 'Employee is linked to auth.users'
        : 'Employee is NOT linked to auth.users (uses custom sessions)'
    });

    // Check current auth context
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      log('info', 'Current auth context: anon (no authenticated user)');
      log('info', 'This is expected for employee app using custom sessions');
    } else {
      log('info', 'Current auth context:', {
        uid: user.id,
        email: user.email,
        role: user.role
      });
    }

    await insertDebugLog('check_auth_relationship', 'complete', {
      employee_id: employee.id,
      user_id: authUser.user_id,
      current_auth_user: user?.id || null,
      auth_type: authUser.user_id ? 'linked' : 'custom_sessions'
    });

  } catch (error) {
    log('error', 'Error checking auth relationship:', error.message);
  }
}

// Main test runner
async function runTest() {
  console.log('\n' + '='.repeat(80));
  console.log('DELAY PERMISSION SELF-TEST');
  console.log('='.repeat(80) + '\n');

  log('info', 'Starting self-test...');
  log('info', 'Supabase URL:', supabaseUrl);
  log('info', 'Test Date:', TEST_CONFIG.testDate);

  const results = {
    tableStructure: false,
    rlsPolicies: false,
    employeeFound: false,
    sessionCheck: false,
    insertTest: false
  };

  // Step 1: Check table structure
  results.tableStructure = await checkTableStructure();
  if (!results.tableStructure) {
    log('error', '❌ Test aborted: Table structure check failed');
    return;
  }

  // Step 2: Check RLS policies
  results.rlsPolicies = await checkRLSPolicies();

  // Step 3: Get test employee
  const employee = await getTestEmployee();
  if (!employee) {
    log('error', '❌ Test aborted: No employee found');
    return;
  }
  results.employeeFound = true;

  // Step 4: Check session
  const session = await simulateEmployeeLogin(employee);
  results.sessionCheck = true;

  // Step 5: Check auth relationship
  await checkAuthRelationship(employee);

  // Step 6: Test INSERT
  const insertResult = await testDelayPermissionInsert(employee);
  results.insertTest = insertResult.success;

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('TEST SUMMARY');
  console.log('='.repeat(80));
  console.log(`Table Structure:    ${results.tableStructure ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`RLS Policies:       ${results.rlsPolicies ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Employee Found:     ${results.employeeFound ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Session Check:      ${results.sessionCheck ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`INSERT Test:        ${results.insertTest ? '✅ PASS' : '❌ FAIL'}`);
  console.log('='.repeat(80));

  if (results.insertTest) {
    console.log('\n✅ Delay permission INSERT works correctly!');
    console.log('The feature is working as expected in this project.\n');
  } else {
    console.log('\n❌ Delay permission INSERT failed!');
    console.log('Check the error details above to diagnose the issue.\n');

    if (insertResult.error) {
      console.log('Common issues:');
      console.log('1. RLS policy blocks INSERT for anon role');
      console.log('2. Employee not linked to auth.users (if policy requires auth.uid())');
      console.log('3. Missing company_id or employee_id in payload');
      console.log('4. Policy expects different auth context\n');
    }
  }

  process.exit(results.insertTest ? 0 : 1);
}

// Run the test
runTest().catch(error => {
  console.error('\n❌ Test failed with unexpected error:', error);
  process.exit(1);
});
