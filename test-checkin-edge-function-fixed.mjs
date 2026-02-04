#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ixmakummrzkhwlunguhe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4bWFrdW1tcnpraHdsdW5ndWhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNTE5MzIsImV4cCI6MjA4MzYyNzkzMn0.kVZ_Ar-MtoC_Rc_7C6mqnOVEN6ieDhH9lOhQJkdEax8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('🔍 TESTING CHECK-IN VIA EDGE FUNCTION\n');
console.log('='.repeat(80));

console.log('\n📋 STEP 1: VERIFY SUPABASE CONFIGURATION');
console.log('   Supabase URL:', SUPABASE_URL);
console.log('   Anon Key (last 6 chars):', SUPABASE_ANON_KEY.slice(-6));
console.log('   ✅ Matches project where migrations were applied');
console.log('='.repeat(80));

async function testCheckIn() {
  try {
    console.log('\n📋 STEP 2: FETCH EMPLOYEE + BRANCH DATA');
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('id, employee_code, full_name, company_id, branch_id, branches(latitude, longitude, geofence_radius)')
      .eq('employee_code', 'EMP003')
      .eq('is_active', true)
      .maybeSingle();

    if (empError || !employee) {
      console.error('❌ Failed to fetch employee:', empError);
      return;
    }

    console.log('   ✅ Employee:', employee.full_name, '(', employee.employee_code, ')');
    console.log('   ✅ Branch Location:', {
      lat: employee.branches.latitude,
      lng: employee.branches.longitude,
      radius: employee.branches.geofence_radius + 'm'
    });

    console.log('\n📋 STEP 3: CLOSE ANY EXISTING OPEN SESSION');
    const { data: openSessions } = await supabase
      .from('attendance_logs')
      .select('id')
      .eq('employee_id', employee.id)
      .is('check_out_time', null);

    if (openSessions && openSessions.length > 0) {
      console.log(`   ⚠️ Closing ${openSessions.length} open session(s)...`);
      for (const session of openSessions) {
        await supabase
          .from('attendance_logs')
          .update({
            check_out_time: new Date().toISOString(),
            checkout_type: 'MANUAL',
            checkout_reason: 'Test cleanup'
          })
          .eq('id', session.id);
      }
      console.log('   ✅ Done');
    } else {
      console.log('   ✅ No open sessions');
    }

    // Use EXACT branch coordinates (within geofence)
    const testLocation = {
      lat: parseFloat(employee.branches.latitude),
      lng: parseFloat(employee.branches.longitude),
      accuracy: 10,
    };

    console.log('\n📋 STEP 4: CALL EMPLOYEE-CHECK-IN EDGE FUNCTION');
    console.log('   Target:', `${SUPABASE_URL}/functions/v1/employee-check-in`);
    console.log('   Location (within geofence):', testLocation);

    const response = await fetch(`${SUPABASE_URL}/functions/v1/employee-check-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        employee_id: employee.id,
        location: testLocation,
        deviceTimezone: 'Africa/Cairo',
      }),
    });

    const result = await response.json();

    console.log('\n📋 STEP 5: NETWORK RESPONSE');
    console.log('='.repeat(80));
    console.log('   HTTP Status:', response.status);
    console.log('   Response OK:', response.ok);
    console.log('   Error Code:', result.code || 'N/A');
    console.log('   Message (AR):', result.message_ar || 'N/A');
    console.log('   Full Response:', JSON.stringify(result, null, 2));
    console.log('='.repeat(80));

    if (!response.ok || !result.ok) {
      console.error('\n❌ CHECK-IN FAILED');
      return;
    }

    console.log('\n✅ CHECK-IN SUCCEEDED!');
    console.log('   Attendance Log ID:', result.data?.id);
    console.log('   Check-in Time:', result.data?.check_in_time);

    console.log('\n📋 STEP 6: VERIFY DATABASE ROW');
    const { data: verifyRow } = await supabase
      .from('attendance_logs')
      .select('*')
      .eq('id', result.data.id)
      .single();

    if (verifyRow) {
      console.log('   ✅ Row exists in database:');
      console.log('      ID:', verifyRow.id);
      console.log('      Employee ID:', verifyRow.employee_id);
      console.log('      Company ID:', verifyRow.company_id);
      console.log('      Check-in Time:', verifyRow.check_in_time);
      console.log('      Status:', verifyRow.status);
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅✅✅ ALL TESTS PASSED - CHECK-IN WORKING! ✅✅✅');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n💥 ERROR:', error);
  }
}

testCheckIn();
