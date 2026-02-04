#!/usr/bin/env node

/**
 * E2E Test: Multi-Tenant State Restoration
 *
 * Tests that both old and new tenants have identical behavior:
 * 1. Employee checks in
 * 2. Refresh/reload state from DB
 * 3. Verify that checked-in state persists
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Test colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(emoji, message, color = colors.reset) {
  console.log(`${color}${emoji} ${message}${colors.reset}`);
}

async function testTenantStateRestore(companyName, companyId) {
  log('🏢', `Testing: ${companyName} (${companyId})`, colors.cyan);

  try {
    // 1. Get first active employee from this company
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('id, full_name, company_id, branch_id')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (empError || !employee) {
      log('⚠️', `No active employee found for ${companyName}`, colors.yellow);
      return false;
    }

    log('👤', `Employee: ${employee.full_name} (${employee.id})`, colors.blue);

    const today = new Date().toISOString().split('T')[0];

    // 2. Check if already checked in today
    const { data: existingLog, error: existError } = await supabase
      .from('attendance_logs')
      .select('id, check_in_time, check_out_time')
      .eq('employee_id', employee.id)
      .eq('company_id', companyId)
      .gte('check_in_time', `${today}T00:00:00`)
      .lte('check_in_time', `${today}T23:59:59`)
      .is('check_out_time', null)
      .maybeSingle();

    if (existError) {
      log('❌', `Error checking existing log: ${existError.message}`, colors.red);
      return false;
    }

    let logId = existingLog?.id;

    // 3. If not checked in, create a check-in
    if (!logId) {
      log('📝', 'Creating new check-in...', colors.blue);

      const { data: newLog, error: insertError } = await supabase
        .from('attendance_logs')
        .insert({
          employee_id: employee.id,
          company_id: companyId,
          branch_id: employee.branch_id,
          check_in_time: new Date().toISOString(),
          check_in_latitude: 24.7136,
          check_in_longitude: 46.6753,
          check_in_accuracy: 10
        })
        .select('id')
        .single();

      if (insertError) {
        log('❌', `Failed to create check-in: ${insertError.message}`, colors.red);
        return false;
      }

      logId = newLog.id;
      log('✅', `Check-in created: ${logId}`, colors.green);
    } else {
      log('ℹ️', `Already checked in: ${logId}`, colors.blue);
    }

    // 4. Simulate state reload (like page refresh)
    log('🔄', 'Simulating state reload from DB...', colors.blue);

    const { data: reloadedLog, error: reloadError } = await supabase
      .from('attendance_logs')
      .select('id, check_in_time, check_out_time')
      .eq('employee_id', employee.id)
      .eq('company_id', companyId)
      .gte('check_in_time', `${today}T00:00:00`)
      .lte('check_in_time', `${today}T23:59:59`)
      .is('check_out_time', null)
      .maybeSingle();

    if (reloadError) {
      log('❌', `Reload failed: ${reloadError.message}`, colors.red);
      return false;
    }

    // 5. Verify state persists
    if (!reloadedLog) {
      log('❌', 'FAILED: State not restored after reload!', colors.red);
      return false;
    }

    if (reloadedLog.id !== logId) {
      log('❌', `FAILED: Wrong log returned (expected ${logId}, got ${reloadedLog.id})`, colors.red);
      return false;
    }

    log('✅', 'SUCCESS: State restored correctly after reload', colors.green);
    log('📊', `Check-in time: ${reloadedLog.check_in_time}`, colors.blue);

    return true;

  } catch (error) {
    log('❌', `Exception: ${error.message}`, colors.red);
    return false;
  }
}

async function main() {
  log('🚀', 'Starting Multi-Tenant State Restore Tests', colors.cyan);
  console.log('='.repeat(60));

  // Get all companies
  const { data: companies, error: compError } = await supabase
    .from('companies')
    .select('id, name')
    .eq('status', 'active')
    .order('created_at', { ascending: true });

  if (compError || !companies || companies.length === 0) {
    log('❌', 'No companies found or error loading companies', colors.red);
    process.exit(1);
  }

  log('🏢', `Found ${companies.length} companies`, colors.blue);
  console.log('='.repeat(60));

  const results = [];

  for (const company of companies) {
    const passed = await testTenantStateRestore(company.name, company.id);
    results.push({ company: company.name, passed });
    console.log('');
  }

  // Summary
  console.log('='.repeat(60));
  log('📊', 'TEST SUMMARY', colors.cyan);
  console.log('='.repeat(60));

  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;

  results.forEach(result => {
    const emoji = result.passed ? '✅' : '❌';
    const color = result.passed ? colors.green : colors.red;
    log(emoji, `${result.company}: ${result.passed ? 'PASS' : 'FAIL'}`, color);
  });

  console.log('='.repeat(60));

  if (passedCount === totalCount) {
    log('🎉', `ALL TESTS PASSED (${passedCount}/${totalCount})`, colors.green);
    process.exit(0);
  } else {
    log('⚠️', `SOME TESTS FAILED (${passedCount}/${totalCount} passed)`, colors.yellow);
    process.exit(1);
  }
}

main();
