#!/usr/bin/env node

/**
 * Test: Countdown Reuse Prevention
 *
 * Scenario:
 * 1. Employee checks in
 * 2. Employee leaves branch → countdown starts (e.g., 300 seconds)
 * 3. Wait 10 seconds → countdown should be at ~290 seconds
 * 4. Employee returns to branch → countdown cancelled
 * 5. Employee leaves branch AGAIN → countdown should start fresh at 300 seconds (NOT 290)
 *
 * This tests that the countdown always starts fresh after recovery, not resuming old time.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file
const envContent = readFileSync(join(__dirname, '.env'), 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=:#]+)=(.*)$/);
  if (match) {
    env[match[1].trim()] = match[2].trim();
  }
});

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Test configuration
const TEST_EMPLOYEE_CODE = 'EMP001';
const WAIT_TIME_SECONDS = 10; // How long to wait during countdown

// Branch coordinates (from actual database - Branch A)
const BRANCH_LAT = 30.57043;
const BRANCH_LNG = 31.002282;
const GEOFENCE_RADIUS = 50;

// Positions
const INSIDE_BRANCH = { lat: BRANCH_LAT, lng: BRANCH_LNG };
const OUTSIDE_BRANCH = { lat: 30.5750, lng: 31.0070 }; // ~500m away, definitely outside 50m radius

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function callHeartbeat(employeeId, companyId, attendanceLogId, location, permissionState) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/employee-heartbeat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      employee_id: employeeId,
      company_id: companyId,
      location,
      permission_state: permissionState
    })
  });

  const data = await response.json();

  // Also get the current pending status
  const { data: pending } = await supabase
    .from('auto_checkout_pending')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('attendance_log_id', attendanceLogId)
    .order('created_at', { ascending: false })
    .limit(5);

  return { heartbeatResponse: data, pendingRecords: pending };
}

async function checkPendingCountdown(employeeId, attendanceLogId) {
  const { data, error } = await supabase
    .from('auto_checkout_pending')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('attendance_log_id', attendanceLogId)
    .eq('status', 'PENDING')
    .maybeSingle();

  if (error) {
    console.error('Error checking pending:', error);
    return null;
  }

  if (!data) {
    return null;
  }

  const now = new Date();
  const endsAt = new Date(data.ends_at);
  const secondsRemaining = Math.max(0, Math.floor((endsAt - now) / 1000));

  return {
    ...data,
    seconds_remaining: secondsRemaining
  };
}

async function runTest() {
  console.log('🧪 COUNTDOWN REUSE TEST - Starting...\n');
  console.log('=' .repeat(80));

  try {
    // Step 1: Get employee
    console.log('\n📋 STEP 1: Get Employee');
    console.log('-'.repeat(80));

    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('id, employee_code, full_name, company_id, branch_id')
      .eq('employee_code', TEST_EMPLOYEE_CODE)
      .maybeSingle();

    if (empError || !employee) {
      throw new Error(`Employee ${TEST_EMPLOYEE_CODE} not found`);
    }

    console.log(`✅ Found: ${employee.full_name} (${employee.employee_code})`);
    console.log(`   Company ID: ${employee.company_id}`);
    console.log(`   Branch ID: ${employee.branch_id}`);

    // Step 2: Check existing auto-checkout settings
    console.log('\n⚙️  STEP 2: Check Auto-Checkout Settings');
    console.log('-'.repeat(80));

    const { data: settings, error: settingsError } = await supabase
      .from('auto_checkout_settings')
      .select('*')
      .eq('company_id', employee.company_id)
      .maybeSingle();

    if (settingsError) {
      console.log('⚠️  Error reading settings:', settingsError);
      console.log('Will proceed assuming auto-checkout is enabled with 300 seconds');
    }

    console.log('Settings data:', settings);

    // Use default values if we can't read settings (RLS issue)
    const autoCheckoutEnabled = settings?.auto_checkout_enabled ?? true;
    const actualDuration = settings?.auto_checkout_after_seconds ?? 300;

    if (!autoCheckoutEnabled) {
      console.log('⚠️  Auto-checkout is not enabled for this company');
      console.log('Please enable it in the Settings page first.');
      return;
    }

    console.log(`✅ Auto-checkout enabled: ${actualDuration} seconds (${actualDuration/60} minutes)`);

    // Step 3: Clean up any existing attendance for today
    console.log('\n🧹 STEP 3: Clean Up Existing Attendance');
    console.log('-'.repeat(80));

    const today = new Date().toISOString().split('T')[0];
    await supabase
      .from('attendance_logs')
      .delete()
      .eq('employee_id', employee.id)
      .gte('check_in_time', `${today}T00:00:00`)
      .lte('check_in_time', `${today}T23:59:59`);

    await supabase
      .from('auto_checkout_pending')
      .delete()
      .eq('employee_id', employee.id);

    console.log('✅ Cleaned up existing records');

    // Step 4: Check in
    console.log('\n✅ STEP 4: Check In Employee');
    console.log('-'.repeat(80));

    const { data: attendance, error: checkInError } = await supabase
      .from('attendance_logs')
      .insert({
        employee_id: employee.id,
        company_id: employee.company_id,
        branch_id: employee.branch_id,
        check_in_time: new Date().toISOString(),
        check_in_device_time: new Date().toISOString(),
        check_in_latitude: INSIDE_BRANCH.lat,
        check_in_longitude: INSIDE_BRANCH.lng,
        check_in_accuracy: 10,
        status: 'on_time'
      })
      .select()
      .single();

    if (checkInError || !attendance) {
      throw new Error(`Check-in failed: ${checkInError?.message}`);
    }

    console.log(`✅ Checked in successfully`);
    console.log(`   Attendance Log ID: ${attendance.id}`);

    // Step 5: First heartbeat - INSIDE branch (should be OK)
    console.log('\n💚 STEP 5: First Heartbeat - INSIDE Branch');
    console.log('-'.repeat(80));

    const result1 = await callHeartbeat(
      employee.id,
      employee.company_id,
      attendance.id,
      { lat: INSIDE_BRANCH.lat, lng: INSIDE_BRANCH.lng, accuracy: 10 },
      'granted'
    );

    console.log('Response:', result1.heartbeatResponse);
    console.log('✅ Heartbeat sent (inside branch)');

    // Step 6: Leave branch - countdown should START
    console.log('\n⚠️  STEP 6: Leave Branch - Countdown Should Start');
    console.log('-'.repeat(80));

    const result2 = await callHeartbeat(
      employee.id,
      employee.company_id,
      attendance.id,
      { lat: OUTSIDE_BRANCH.lat, lng: OUTSIDE_BRANCH.lng, accuracy: 10 },
      'granted'
    );

    console.log('Response:', result2.heartbeatResponse);
    console.log('Pending records:', result2.pendingRecords);

    const pending1 = await checkPendingCountdown(employee.id, attendance.id);

    if (!pending1) {
      throw new Error('❌ FAILED: No pending countdown created!');
    }

    console.log(`✅ Countdown started: ${pending1.seconds_remaining} seconds remaining`);
    console.log(`   Expected: ~${actualDuration} seconds`);
    console.log(`   Reason: ${pending1.reason}`);

    const initialRemaining = pending1.seconds_remaining;

    // Step 7: Wait and verify countdown is progressing
    console.log(`\n⏳ STEP 7: Wait ${WAIT_TIME_SECONDS} Seconds - Countdown Should Progress`);
    console.log('-'.repeat(80));

    await sleep(WAIT_TIME_SECONDS * 1000);

    const pending2 = await checkPendingCountdown(employee.id, attendance.id);

    if (!pending2) {
      throw new Error('❌ FAILED: Countdown disappeared!');
    }

    console.log(`✅ Countdown progressed: ${pending2.seconds_remaining} seconds remaining`);
    console.log(`   Initial: ${initialRemaining} seconds`);
    console.log(`   After wait: ${pending2.seconds_remaining} seconds`);
    console.log(`   Difference: ~${initialRemaining - pending2.seconds_remaining} seconds`);

    const remainingAfterWait = pending2.seconds_remaining;

    // Step 8: Return to branch - countdown should CANCEL
    console.log('\n💚 STEP 8: Return to Branch - Countdown Should Cancel');
    console.log('-'.repeat(80));

    const result3 = await callHeartbeat(
      employee.id,
      employee.company_id,
      attendance.id,
      { lat: INSIDE_BRANCH.lat, lng: INSIDE_BRANCH.lng, accuracy: 10 },
      'granted'
    );

    console.log('Response:', result3.heartbeatResponse);
    console.log('Pending records after return:', result3.pendingRecords);

    const pending3 = await checkPendingCountdown(employee.id, attendance.id);

    if (pending3) {
      throw new Error('❌ FAILED: Countdown still active after returning to branch!');
    }

    console.log('✅ Countdown cancelled (no active PENDING record)');

    // Step 9: Leave branch AGAIN - countdown should start FRESH
    console.log('\n⚠️  STEP 9: Leave Branch AGAIN - Countdown Should Start FRESH');
    console.log('-'.repeat(80));

    await sleep(2000); // Small delay to ensure database is updated

    const result4 = await callHeartbeat(
      employee.id,
      employee.company_id,
      attendance.id,
      { lat: OUTSIDE_BRANCH.lat, lng: OUTSIDE_BRANCH.lng, accuracy: 10 },
      'granted'
    );

    console.log('Response:', result4.heartbeatResponse);
    console.log('Pending records after leaving again:', result4.pendingRecords);

    const pending4 = await checkPendingCountdown(employee.id, attendance.id);

    if (!pending4) {
      throw new Error('❌ FAILED: No new countdown created on second leave!');
    }

    console.log(`\n🎯 NEW COUNTDOWN: ${pending4.seconds_remaining} seconds remaining`);
    console.log(`   Expected: ~${actualDuration} seconds (FRESH START)`);
    console.log(`   Previous remaining: ${remainingAfterWait} seconds`);

    // CRITICAL TEST: The new countdown should be close to full duration, NOT the old remaining time
    const isCloseToFull = Math.abs(pending4.seconds_remaining - actualDuration) < 5;
    const isCloseToOld = Math.abs(pending4.seconds_remaining - remainingAfterWait) < 5;

    console.log('\n' + '='.repeat(80));
    console.log('🔍 ANALYSIS');
    console.log('='.repeat(80));
    console.log(`New countdown: ${pending4.seconds_remaining} seconds`);
    console.log(`Expected (fresh): ${actualDuration} seconds`);
    console.log(`Old remaining: ${remainingAfterWait} seconds`);
    console.log(`Is close to fresh duration? ${isCloseToFull ? '✅ YES' : '❌ NO'}`);
    console.log(`Is close to old remaining? ${isCloseToOld ? '❌ YES (BUG!)' : '✅ NO (GOOD)'}`);

    if (isCloseToFull && !isCloseToOld) {
      console.log('\n' + '='.repeat(80));
      console.log('✅✅✅ TEST PASSED! ✅✅✅');
      console.log('='.repeat(80));
      console.log('Countdown correctly starts fresh after recovery, not resuming old time.');
    } else if (isCloseToOld) {
      console.log('\n' + '='.repeat(80));
      console.log('❌❌❌ TEST FAILED! ❌❌❌');
      console.log('='.repeat(80));
      console.log('⚠️  BUG: Countdown resumed from old remaining time instead of starting fresh!');
      console.log(`    Expected: ~${actualDuration}s`);
      console.log(`    Got: ${pending4.seconds_remaining}s (close to old ${remainingAfterWait}s)`);
    } else {
      console.log('\n' + '='.repeat(80));
      console.log('⚠️  TEST INCONCLUSIVE');
      console.log('='.repeat(80));
      console.log('Result is not clearly matching either expected outcome.');
    }

  } catch (error) {
    console.error('\n' + '='.repeat(80));
    console.error('💥 TEST ERROR');
    console.error('='.repeat(80));
    console.error(error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runTest();
