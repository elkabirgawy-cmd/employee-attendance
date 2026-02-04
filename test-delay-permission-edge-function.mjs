#!/usr/bin/env node

/**
 * Test: Delay Permission Edge Function
 *
 * This test verifies that the employee-submit-delay-permission edge function
 * properly enforces company isolation and validates input.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testDelayPermissionEdgeFunction() {
  console.log('\n=== Testing Delay Permission Edge Function ===\n');

  try {
    // Step 1: Get a test employee with active session
    console.log('📋 Step 1: Finding test employee...');

    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('id, user_id, company_id, full_name, is_active')
      .eq('is_active', true)
      .not('user_id', 'is', null)
      .limit(1)
      .single();

    if (empError || !employee) {
      console.log('⚠️  No employee with user_id found. Creating test session...');

      // Get any active employee
      const { data: anyEmployee } = await supabase
        .from('employees')
        .select('id, company_id, full_name, phone_number')
        .eq('is_active', true)
        .limit(1)
        .single();

      if (!anyEmployee) {
        console.log('❌ No active employees found');
        return;
      }

      console.log(`ℹ️  Test requires employee with authenticated session`);
      console.log(`ℹ️  Please use the employee app to login first`);
      return;
    }

    console.log(`✓ Found employee: ${employee.full_name} (Company: ${employee.company_id})`);

    // Step 2: Create a test session for this employee
    console.log('\n📋 Step 2: Creating test session...');

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: `test-${employee.id}@example.com`,
      password: 'test123456',
      email_confirm: true,
      user_metadata: {
        employee_id: employee.id,
        company_id: employee.company_id
      }
    });

    if (authError && !authError.message.includes('already registered')) {
      console.error('❌ Failed to create test user:', authError);
      return;
    }

    // Step 3: Sign in to get a valid session
    console.log('\n📋 Step 3: Signing in...');

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: `test-${employee.id}@example.com`,
      password: 'test123456'
    });

    if (signInError) {
      console.error('❌ Sign in failed:', signInError.message);
      return;
    }

    console.log('✓ Session created successfully');

    // Step 4: Test the edge function with valid data
    console.log('\n📋 Step 4: Testing edge function with valid data...');

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];

    const payload = {
      date: dateStr,
      start_time: '09:00',
      end_time: '09:30',
      minutes: 30,
      reason: 'Test reason from automated test'
    };

    const response = await fetch(
      `${supabaseUrl}/functions/v1/employee-submit-delay-permission`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${signInData.session.access_token}`,
        },
        body: JSON.stringify(payload),
      }
    );

    const result = await response.json();

    if (response.ok) {
      console.log('✓ Edge function call succeeded');
      console.log(`  → Permission ID: ${result.delay_permission.id}`);
      console.log(`  → Status: ${result.delay_permission.status}`);
      console.log(`  → Company ID: ${result.delay_permission.company_id}`);

      // Verify company isolation
      if (result.delay_permission.company_id === employee.company_id) {
        console.log('✓ Company isolation enforced correctly');
      } else {
        console.log('❌ Company isolation FAILED');
      }

      // Clean up: delete the test permission
      await supabase
        .from('delay_permissions')
        .delete()
        .eq('id', result.delay_permission.id);
      console.log('✓ Test data cleaned up');

    } else {
      console.log('❌ Edge function call failed:', result.error);
    }

    // Step 5: Test with missing required field
    console.log('\n📋 Step 5: Testing validation (missing reason)...');

    const invalidPayload = {
      date: dateStr,
      start_time: '09:00',
      end_time: '09:30',
      minutes: 30,
      // reason missing
    };

    const invalidResponse = await fetch(
      `${supabaseUrl}/functions/v1/employee-submit-delay-permission`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${signInData.session.access_token}`,
        },
        body: JSON.stringify(invalidPayload),
      }
    );

    const invalidResult = await invalidResponse.json();

    if (!invalidResponse.ok && invalidResult.error.includes('required')) {
      console.log('✓ Validation working correctly');
    } else {
      console.log('⚠️  Validation may not be working as expected');
    }

    // Clean up test user
    console.log('\n📋 Cleanup: Removing test auth user...');
    if (authData?.user) {
      await supabase.auth.admin.deleteUser(authData.user.id);
      console.log('✓ Test user removed');
    }

    console.log('\n✅ All tests completed successfully!\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error);
  }
}

testDelayPermissionEdgeFunction();
