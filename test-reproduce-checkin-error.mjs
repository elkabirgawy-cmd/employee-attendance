#!/usr/bin/env node

/**
 * REPRODUCE EXACT CHECK-IN ERROR
 *
 * This test simulates the EXACT check-in request from the employee screen
 * and captures the REAL backend error.
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ixmakummrzkhwlunguhe.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4bWFrdW1tcnpraHdsdW5ndWhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNTE5MzIsImV4cCI6MjA4MzYyNzkzMn0.kVZ_Ar-MtoC_Rc_7C6mqnOVEN6ieDhH9lOhQJkdEax8' // Using anon key like the UI
);

console.log('🔍 REPRODUCING CHECK-IN ERROR...\n');
console.log('='.repeat(80));

async function reproduceCheckInError() {
  try {
    // Step 1: Fetch an active employee (same as UI)
    console.log('\n📋 Step 1: Fetch employee data...');
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select(`
        id,
        employee_code,
        full_name,
        company_id,
        branch_id,
        is_active
      `)
      .eq('employee_code', 'EMP003')
      .eq('is_active', true)
      .maybeSingle();

    if (empError) {
      console.error('❌ Failed to fetch employee:', empError);
      return;
    }

    if (!employee) {
      console.error('❌ Employee EMP003 not found or not active');
      return;
    }

    console.log('✅ Employee found:', {
      id: employee.id,
      code: employee.employee_code,
      name: employee.full_name,
      company_id: employee.company_id,
      branch_id: employee.branch_id,
    });

    // Step 2: Check auth session (like UI does)
    console.log('\n📋 Step 2: Check auth session...');
    const { data: { session } } = await supabase.auth.getSession();
    console.log('Auth Session:', session ? 'EXISTS (authenticated)' : 'NULL (anonymous)');
    console.log('Auth Role:', session ? session.user.role : 'anon');

    // Step 3: Attempt INSERT (EXACT same data structure as UI)
    console.log('\n📋 Step 3: Attempt check-in INSERT...');

    const now = new Date().toISOString();
    const attendanceData = {
      employee_id: employee.id,
      company_id: employee.company_id,
      branch_id: employee.branch_id,
      check_in_time: now,
      check_in_device_time: now,
      check_in_latitude: 24.7136, // Mock GPS
      check_in_longitude: 46.6753,
      check_in_accuracy: 10,
      check_in_distance_m: 50,
      status: 'on_time',
    };

    console.log('Data to insert:', JSON.stringify(attendanceData, null, 2));
    console.log('\nAttempting INSERT to attendance_logs table...');

    const { data: insertedData, error } = await supabase
      .from('attendance_logs')
      .insert(attendanceData)
      .select()
      .single();

    if (error) {
      console.error('\n' + '❌'.repeat(40));
      console.error('❌ INSERT FAILED - BACKEND ERROR CAPTURED:');
      console.error('❌'.repeat(40));
      console.error('\n📊 ERROR DETAILS:\n');
      console.error('Status Code:', error.status || 'N/A');
      console.error('Error Code:', error.code || 'N/A');
      console.error('Error Message:', error.message || 'N/A');
      console.error('Error Details:', error.details || 'N/A');
      console.error('Error Hint:', error.hint || 'N/A');
      console.error('\n📄 FULL ERROR OBJECT:\n');
      console.error(JSON.stringify(error, null, 2));
      console.error('\n' + '='.repeat(80));

      // Analyze error type
      if (error.message && error.message.includes('row-level security')) {
        console.error('\n🔒 ROOT CAUSE: RLS POLICY BLOCKING INSERT');
        console.error('   - The anon role does not have INSERT permission on attendance_logs');
        console.error('   - OR the RLS policy WITH CHECK condition is failing');
        console.error('\n💡 SOLUTION:');
        console.error('   - Check RLS policies on attendance_logs table');
        console.error('   - Ensure anon role has GRANT INSERT on attendance_logs');
        console.error('   - Verify WITH CHECK condition allows this insert');
      } else if (error.message && error.message.includes('permission denied')) {
        console.error('\n🔒 ROOT CAUSE: PERMISSION DENIED');
        console.error('   - Missing GRANT on table or function');
        console.error('\n💡 SOLUTION:');
        console.error('   - Run: GRANT INSERT ON attendance_logs TO anon;');
      } else if (error.code === '23503') {
        console.error('\n🔗 ROOT CAUSE: FOREIGN KEY VIOLATION');
        console.error('   - One of: employee_id, company_id, or branch_id does not exist');
        console.error('\n💡 SOLUTION:');
        console.error('   - Verify FK constraints and referenced tables');
      } else if (error.code === '23502') {
        console.error('\n⚠️ ROOT CAUSE: NOT NULL VIOLATION');
        console.error('   - A required column is missing');
        console.error('\n💡 SOLUTION:');
        console.error('   - Add the missing column to the insert payload');
      }

      return;
    }

    console.log('\n✅✅✅ SUCCESS! Check-in worked!');
    console.log('Inserted Row ID:', insertedData.id);
    console.log('Check-in Time:', insertedData.check_in_time);
    console.log('\n' + '='.repeat(80));

  } catch (error) {
    console.error('\n💥 UNEXPECTED ERROR:');
    console.error(error);
  }
}

reproduceCheckInError();
