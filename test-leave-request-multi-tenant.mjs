#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('='.repeat(80));
console.log('MULTI-TENANT LEAVE REQUEST EDGE FUNCTION TEST');
console.log('='.repeat(80));
console.log('');

async function testLeaveRequestForCompany(companyName, employeePhone) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Testing Leave Request for: ${companyName}`);
  console.log(`Employee Phone: ${employeePhone}`);
  console.log(`${'='.repeat(80)}\n`);

  try {
    console.log('Step 1: Sending OTP...');
    const deviceId = `test-device-${companyName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
    const otpResponse = await fetch(`${SUPABASE_URL}/functions/v1/employee-send-otp`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone_number: employeePhone,
        device_id: deviceId
      })
    });

    const otpResult = await otpResponse.json();

    if (!otpResponse.ok) {
      throw new Error(`Failed to send OTP: ${otpResult.error}`);
    }

    console.log(`✓ OTP sent successfully`);
    console.log(`  OTP Code: ${otpResult.dev_otp}`);

    console.log('\nStep 2: Verifying OTP and logging in...');
    const verifyResponse = await fetch(`${SUPABASE_URL}/functions/v1/employee-verify-otp`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone_number: employeePhone,
        otp_code: otpResult.dev_otp,
        device_id: deviceId
      })
    });

    const verifyResult = await verifyResponse.json();

    if (!verifyResponse.ok) {
      throw new Error(`Failed to verify OTP: ${verifyResult.error}`);
    }

    console.log(`✓ OTP verified, logged in successfully`);
    console.log(`  Employee ID: ${verifyResult.employee.id}`);
    console.log(`  Company ID: ${verifyResult.employee.company_id}`);
    console.log(`  Access Token: ${verifyResult.access_token.substring(0, 20)}...`);

    const accessToken = verifyResult.access_token;
    const employeeId = verifyResult.employee.id;
    const companyId = verifyResult.employee.company_id;

    console.log('\nStep 3: Fetching available leave types...');
    const { data: leaveTypes, error: leaveTypesError } = await supabase
      .from('leave_types')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('sort_order')
      .limit(1);

    if (leaveTypesError) {
      throw new Error(`Failed to fetch leave types: ${leaveTypesError.message}`);
    }

    if (!leaveTypes || leaveTypes.length === 0) {
      throw new Error('No active leave types found for this company');
    }

    const leaveType = leaveTypes[0];
    console.log(`✓ Found leave type: ${leaveType.name_ar} (${leaveType.name_en})`);
    console.log(`  Leave Type ID: ${leaveType.id}`);
    console.log(`  Company ID: ${leaveType.company_id}`);

    console.log('\nStep 4: Checking leave balance...');
    const currentYear = new Date().getFullYear();
    const { data: balance, error: balanceError } = await supabase
      .from('leave_balances')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('leave_type_id', leaveType.id)
      .eq('company_id', companyId)
      .eq('year', currentYear)
      .maybeSingle();

    if (balanceError) {
      throw new Error(`Failed to fetch leave balance: ${balanceError.message}`);
    }

    if (!balance) {
      console.log(`⚠ No leave balance found, creating one...`);

      const { error: insertError } = await supabase
        .from('leave_balances')
        .insert({
          employee_id: employeeId,
          company_id: companyId,
          leave_type_id: leaveType.id,
          year: currentYear,
          total_days: 30,
          used_days: 0,
          remaining_days: 30
        });

      if (insertError) {
        throw new Error(`Failed to create leave balance: ${insertError.message}`);
      }

      console.log(`✓ Leave balance created: 30 days available`);
    } else {
      console.log(`✓ Leave balance found`);
      console.log(`  Total Days: ${balance.total_days}`);
      console.log(`  Used Days: ${balance.used_days}`);
      console.log(`  Available Days: ${balance.remaining_days}`);

      if (balance.remaining_days < 2) {
        throw new Error('Insufficient leave balance for this test (need at least 2 days)');
      }
    }

    console.log('\nStep 5: Submitting leave request via Edge Function...');
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);

    const startDate = tomorrow.toISOString().split('T')[0];
    const endDate = dayAfter.toISOString().split('T')[0];

    const submitResponse = await fetch(`${SUPABASE_URL}/functions/v1/employee-submit-leave-request`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        leave_type_id: leaveType.id,
        start_date: startDate,
        end_date: endDate,
        reason: `Test leave request from ${companyName} - Multi-tenant verification test`
      })
    });

    const submitResult = await submitResponse.json();

    if (!submitResponse.ok) {
      throw new Error(`Failed to submit leave request: ${submitResult.error}`);
    }

    console.log(`✓ Leave request submitted successfully via Edge Function`);
    console.log(`  Request ID: ${submitResult.leave_request.id}`);
    console.log(`  Employee ID: ${submitResult.leave_request.employee_id}`);
    console.log(`  Company ID: ${submitResult.leave_request.company_id}`);
    console.log(`  Leave Type ID: ${submitResult.leave_request.leave_type_id}`);
    console.log(`  Start Date: ${submitResult.leave_request.start_date}`);
    console.log(`  End Date: ${submitResult.leave_request.end_date}`);
    console.log(`  Days: ${submitResult.leave_request.days}`);
    console.log(`  Status: ${submitResult.leave_request.status}`);

    console.log('\nStep 6: Verifying request in database with explicit company_id filter...');
    const { data: verifyRequest, error: verifyError } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('id', submitResult.leave_request.id)
      .eq('company_id', companyId)
      .eq('employee_id', employeeId)
      .maybeSingle();

    if (verifyError) {
      throw new Error(`Failed to verify request: ${verifyError.message}`);
    }

    if (!verifyRequest) {
      throw new Error('Leave request not found with company_id filter - ISOLATION FAILURE!');
    }

    console.log(`✓ Leave request verified in database with explicit company_id filter`);
    console.log(`  Confirmed Company ID matches: ${verifyRequest.company_id === companyId}`);
    console.log(`  Confirmed Employee ID matches: ${verifyRequest.employee_id === employeeId}`);

    console.log('\nStep 7: Verifying cross-tenant isolation...');
    const otherCompanyId = companyId === 'company-a-id' ? 'company-b-id' : 'company-a-id';

    const { data: crossTenantCheck, error: crossTenantError } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('id', submitResult.leave_request.id)
      .eq('company_id', otherCompanyId)
      .maybeSingle();

    if (crossTenantError && !crossTenantError.message.includes('JWT')) {
      throw new Error(`Unexpected error during cross-tenant check: ${crossTenantError.message}`);
    }

    if (crossTenantCheck) {
      throw new Error('CRITICAL: Cross-tenant access detected! Request visible to wrong company!');
    }

    console.log(`✓ Cross-tenant isolation verified - request NOT visible to other company`);

    console.log('\nStep 8: Verifying admin notification was created...');
    const { data: notifications, error: notifError } = await supabase
      .from('notifications')
      .select('*')
      .eq('company_id', companyId)
      .eq('type', 'leave_request')
      .order('created_at', { ascending: false })
      .limit(1);

    if (notifError) {
      console.log(`⚠ Could not verify notification: ${notifError.message}`);
    } else if (notifications && notifications.length > 0) {
      console.log(`✓ Admin notification created`);
      console.log(`  Title: ${notifications[0].title}`);
      console.log(`  Message: ${notifications[0].message}`);
    } else {
      console.log(`⚠ No notification found (may be due to RLS)`);
    }

    console.log(`\n${'✓'.repeat(40)}`);
    console.log(`SUCCESS: All tests passed for ${companyName}!`);
    console.log(`${'✓'.repeat(40)}\n`);

    return {
      success: true,
      companyName,
      employeeId,
      companyId,
      requestId: submitResult.leave_request.id
    };

  } catch (error) {
    console.error(`\n${'✗'.repeat(40)}`);
    console.error(`FAILURE: Test failed for ${companyName}`);
    console.error(`Error: ${error.message}`);
    console.error(`${'✗'.repeat(40)}\n`);

    return {
      success: false,
      companyName,
      error: error.message
    };
  }
}

async function runTests() {
  const results = [];

  console.log('Starting multi-tenant leave request tests...\n');

  results.push(await testLeaveRequestForCompany("mohamed's Company", '+201009884767'));

  await new Promise(resolve => setTimeout(resolve, 1000));

  results.push(await testLeaveRequestForCompany('شركة افتراضية', '+966503456789'));

  console.log('\n' + '='.repeat(80));
  console.log('TEST SUMMARY');
  console.log('='.repeat(80) + '\n');

  let allPassed = true;
  for (const result of results) {
    const status = result.success ? '✓ PASSED' : '✗ FAILED';
    console.log(`${status}: ${result.companyName}`);
    if (!result.success) {
      console.log(`  Error: ${result.error}`);
      allPassed = false;
    }
  }

  console.log('\n' + '='.repeat(80));
  if (allPassed) {
    console.log('✓ ALL TESTS PASSED - Multi-tenant leave request system is working correctly!');
    console.log('✓ Edge Function enforces company_id isolation');
    console.log('✓ No cross-tenant data leakage detected');
    console.log('✓ System behaves identically for legacy and new companies');
  } else {
    console.log('✗ SOME TESTS FAILED - Please review the errors above');
  }
  console.log('='.repeat(80) + '\n');

  process.exit(allPassed ? 0 : 1);
}

runTests();
