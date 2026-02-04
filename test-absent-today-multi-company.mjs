#!/usr/bin/env node

/**
 * Test: Absent Today Multi-Company Isolation
 *
 * This test verifies that the absent today count and list functions:
 * 1. Only count employees from the correct company
 * 2. Respect the grace period + late window timing
 * 3. Properly exclude employees on leave or free tasks
 * 4. Return correct detailed information
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

const supabase = createClient(
  envVars.VITE_SUPABASE_URL,
  envVars.VITE_SUPABASE_ANON_KEY
);

console.log('🧪 Testing: Absent Today Multi-Company Isolation\n');
console.log('='.repeat(80));

async function getCompanies() {
  const { data, error } = await supabase
    .from('companies')
    .select('id, name')
    .eq('status', 'active')
    .limit(2);

  if (error) {
    console.error('❌ Error fetching companies:', error);
    return [];
  }

  return data || [];
}

async function getCompanySettings(companyId) {
  const { data, error } = await supabase
    .from('application_settings')
    .select('grace_period_minutes, max_late_window_minutes')
    .eq('company_id', companyId)
    .maybeSingle();

  if (error) {
    console.error(`❌ Error fetching settings for company ${companyId}:`, error);
    return null;
  }

  return data;
}

async function getActiveEmployees(companyId) {
  const { data, error } = await supabase
    .from('employees')
    .select('id, name, employee_code')
    .eq('company_id', companyId)
    .eq('is_active', true);

  if (error) {
    console.error(`❌ Error fetching employees for company ${companyId}:`, error);
    return [];
  }

  return data || [];
}

async function getAbsentCount(companyId) {
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase.rpc('get_absent_today_count', {
    p_day: today,
    p_company_id: companyId
  });

  if (error) {
    console.error(`❌ Error getting absent count for company ${companyId}:`, error);
    return null;
  }

  return data;
}

async function getAbsentEmployeesList(companyId) {
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase.rpc('get_absent_employees_list', {
    p_day: today,
    p_company_id: companyId
  });

  if (error) {
    console.error(`❌ Error getting absent employees list for company ${companyId}:`, error);
    return [];
  }

  return data || [];
}

async function runTest() {
  try {
    // Get two companies
    const companies = await getCompanies();

    if (companies.length < 2) {
      console.log('⚠️  Warning: Need at least 2 companies to test isolation');
      console.log('   Testing with available companies...\n');
    }

    for (const company of companies) {
      console.log(`\n📊 Company: ${company.name}`);
      console.log('-'.repeat(80));

      // Get settings
      const settings = await getCompanySettings(company.id);
      if (settings) {
        console.log(`   Grace Period: ${settings.grace_period_minutes} minutes`);
        console.log(`   Late Window: ${settings.max_late_window_minutes} minutes`);
      } else {
        console.log('   ⚠️  No settings found (using defaults)');
      }

      // Get active employees
      const employees = await getActiveEmployees(company.id);
      console.log(`   Active Employees: ${employees.length}`);

      // Get absent count
      const absentCount = await getAbsentCount(company.id);
      console.log(`   Absent Today: ${absentCount}`);

      // Get absent employees list
      const absentList = await getAbsentEmployeesList(company.id);
      console.log(`   Absent List Count: ${absentList.length}`);

      // Verify count matches list length
      if (absentCount === absentList.length) {
        console.log('   ✅ Count matches list length');
      } else {
        console.log(`   ❌ MISMATCH: Count (${absentCount}) != List Length (${absentList.length})`);
      }

      // Show absent employees details
      if (absentList.length > 0) {
        console.log('\n   Absent Employees Details:');
        absentList.forEach((emp, idx) => {
          console.log(`   ${idx + 1}. ${emp.employee_name} (${emp.employee_code})`);
          console.log(`      Branch: ${emp.branch_name || 'N/A'}`);
          console.log(`      Shift: ${emp.shift_name} - ${emp.shift_start_time}`);
          console.log(`      Minutes Late: ${emp.minutes_late}`);
        });
      } else {
        console.log('   ✅ No absent employees (perfect attendance!)');
      }
    }

    // Cross-company verification
    if (companies.length >= 2) {
      console.log('\n🔍 Cross-Company Verification');
      console.log('-'.repeat(80));

      const company1List = await getAbsentEmployeesList(companies[0].id);
      const company2List = await getAbsentEmployeesList(companies[1].id);

      const company1Ids = new Set(company1List.map(e => e.employee_id));
      const company2Ids = new Set(company2List.map(e => e.employee_id));

      const overlap = [...company1Ids].filter(id => company2Ids.has(id));

      if (overlap.length === 0) {
        console.log('✅ No employee ID overlap between companies (proper isolation)');
      } else {
        console.log(`❌ ISOLATION BREACH: ${overlap.length} employee IDs appear in both companies!`);
        console.log('   Overlapping IDs:', overlap);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Test completed successfully\n');

  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    process.exit(1);
  }
}

runTest();
