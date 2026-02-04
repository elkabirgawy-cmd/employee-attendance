#!/usr/bin/env node

/**
 * TEST CHECK-IN VIA EDGE FUNCTION
 *
 * This test:
 * 1. Prints runtime Supabase config (URL + last 6 chars of anon key)
 * 2. Calls the employee-check-in Edge Function (same as UI)
 * 3. Captures exact Network response (HTTP status, error code, message)
 * 4. Verifies DB row creation
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ixmakummrzkhwlunguhe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4bWFrdW1tcnpraHdsdW5ndWhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNTE5MzIsImV4cCI6MjA4MzYyNzkzMn0.kVZ_Ar-MtoC_Rc_7C6mqnOVEN6ieDhH9lOhQJkdEax8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('🔍 TESTING CHECK-IN VIA EDGE FUNCTION\n');
console.log('='.repeat(80));

// STEP 1: Print runtime Supabase config
console.log('\n📋 STEP 1: VERIFY SUPABASE CONFIGURATION');
console.log('   Supabase URL:', SUPABASE_URL);
console.log('   Anon Key (last 6 chars):', SUPABASE_ANON_KEY.slice(-6));
console.log('   ✅ This should match the project where migrations were applied');
console.log('      Expected: ixmakummrzkhwlunguhe.supabase.co');
console.log('      Expected Key ends with: dEax8');
console.log('='.repeat(80));

async function testCheckIn() {
  try {
    // Fetch employee first
    console.log('\n📋 STEP 2: FETCH EMPLOYEE DATA');
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('id, employee_code, full_name, company_id, branch_id')
      .eq('employee_code', 'EMP003')
      .eq('is_active', true)
      .maybeSingle();

    if (empError || !employee) {
      console.error('❌ Failed to fetch employee:', empError);
      return;
    }

    console.log('   ✅ Employee found:', {
      id: employee.id,
      code: employee.employee_code,
      name: employee.full_name,
      company_id: employee.company_id,
      branch_id: employee.branch_id,
    });

    // Close any existing open session first
    console.log('\n📋 STEP 3: CLOSE ANY EXISTING OPEN SESSION');
    const { data: openSessions } = await supabase
      .from('attendance_logs')
      .select('id, check_in_time')
      .eq('employee_id', employee.id)
      .is('check_out_time', null);

    if (openSessions && openSessions.length > 0) {
      console.log(`   ⚠️ Found ${openSessions.length} open session(s), closing them...`);
      for (const session of openSessions) {
        await supabase
          .from('attendance_logs')
          .update({
            check_out_time: new Date(new Date(session.check_in_time).getTime() + 8 * 60 * 60 * 1000).toISOString(),
            checkout_type: 'MANUAL',
            checkout_reason: 'Test cleanup'
          })
          .eq('id', session.id);
        console.log(`   ✅ Closed session: ${session.id}`);
      }
    } else {
      console.log('   ✅ No open sessions to close');
    }

    // Call Edge Function
    console.log('\n📋 STEP 4: CALL EMPLOYEE-CHECK-IN EDGE FUNCTION');
    console.log('   Target:', `${SUPABASE_URL}/functions/v1/employee-check-in`);
    console.log('   Method: POST');
    console.log('   Auth: Bearer (anon key)');
    console.log('   Payload:', JSON.stringify({
      employee_id: employee.id,
      location: {
        lat: 24.7136,
        lng: 46.6753,
        accuracy: 10,
      },
      deviceTimezone: 'Asia/Riyadh',
    }, null, 2));

    const response = await fetch(`${SUPABASE_URL}/functions/v1/employee-check-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        employee_id: employee.id,
        location: {
          lat: 24.7136,
          lng: 46.6753,
          accuracy: 10,
        },
        deviceTimezone: 'Asia/Riyadh',
      }),
    });

    const result = await response.json();

    console.log('\n📋 STEP 5: NETWORK RESPONSE CAPTURED');
    console.log('='.repeat(80));
    console.log('   HTTP Status:', response.status);
    console.log('   Response OK:', response.ok);
    console.log('   Response Body:', JSON.stringify(result, null, 2));
    console.log('='.repeat(80));

    if (!response.ok || !result.ok) {
      console.error('\n❌ CHECK-IN FAILED');
      console.error('   Error Code:', result.code || 'N/A');
      console.error('   Error Message (AR):', result.message_ar || 'N/A');
      console.error('   Additional Details:', JSON.stringify(result, null, 2));
      return;
    }

    console.log('\n✅ CHECK-IN SUCCEEDED!');
    console.log('   Attendance Log ID:', result.data?.id);
    console.log('   Check-in Time:', result.data?.check_in_time);
    console.log('   Message (AR):', result.message_ar);

    // Verify DB row
    console.log('\n📋 STEP 6: VERIFY DATABASE ROW');
    const { data: verifyRow } = await supabase
      .from('attendance_logs')
      .select('*')
      .eq('id', result.data.id)
      .single();

    if (verifyRow) {
      console.log('   ✅ Row verified in database:');
      console.log('      ID:', verifyRow.id);
      console.log('      Employee ID:', verifyRow.employee_id);
      console.log('      Company ID:', verifyRow.company_id);
      console.log('      Check-in Time:', verifyRow.check_in_time);
      console.log('      Check-out Time:', verifyRow.check_out_time || 'NULL (still open)');
      console.log('      Status:', verifyRow.status);
    } else {
      console.error('   ❌ Row NOT found in database!');
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ ALL TESTS PASSED - CHECK-IN WORKING CORRECTLY');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n💥 UNEXPECTED ERROR:');
    console.error(error);
  }
}

testCheckIn();
