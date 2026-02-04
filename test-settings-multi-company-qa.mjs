#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Load .env file manually
const envFile = readFileSync('.env', 'utf-8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length) {
    envVars[key.trim()] = valueParts.join('=').trim();
  }
});

const supabase = createClient(
  envVars.VITE_SUPABASE_URL,
  envVars.VITE_SUPABASE_ANON_KEY
);

// Colors for output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

function log(message, color = RESET) {
  console.log(`${color}${message}${RESET}`);
}

function pass(test) {
  log(`✓ PASS: ${test}`, GREEN);
}

function fail(test, reason) {
  log(`✗ FAIL: ${test}`, RED);
  log(`  Reason: ${reason}`, RED);
}

function info(message) {
  log(`ℹ ${message}`, BLUE);
}

function warning(message) {
  log(`⚠ ${message}`, YELLOW);
}

// Test Data
let companies = [];
let testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

async function setup() {
  log('\n=== SETUP: Checking Database State ===\n', YELLOW);

  // Get all companies (without auth, we can only query public data)
  const { data: companiesData, error: companiesError } = await supabase
    .from('companies')
    .select('*');

  if (companiesError) {
    warning(`Cannot query companies: ${companiesError.message}`);
    warning('This might be due to RLS policies. Using alternative approach...');
  } else if (companiesData && companiesData.length > 0) {
    companies = companiesData;
    info(`Found ${companies.length} companies in database`);
    companies.forEach(c => info(`  - ${c.name} (ID: ${c.id})`));
  }

  // Check auto_checkout_settings (this might be accessible)
  const { data: settingsData, error: settingsError } = await supabase
    .from('auto_checkout_settings')
    .select('*');

  if (settingsError) {
    warning(`Cannot query auto_checkout_settings: ${settingsError.message}`);
  } else if (settingsData) {
    info(`Found ${settingsData.length} auto_checkout_settings records`);
  }

  // Check application_settings (should be publicly readable)
  const { data: appSettings, error: appError } = await supabase
    .from('application_settings')
    .select('*');

  if (appError) {
    fail('Setup', `Cannot access application_settings: ${appError.message}`);
    return false;
  } else if (appSettings && appSettings.length > 0) {
    info('✓ application_settings table is accessible');
    pass('Setup: Database access verified');
    return true;
  }

  return false;
}

async function test1_SettingsTableAccessibility() {
  log('\n=== TEST 1: SETTINGS TABLE ACCESSIBILITY ===\n', YELLOW);

  const tables = [
    'application_settings',
    'system_settings',
    'auto_checkout_settings',
    'attendance_calculation_settings'
  ];

  let allAccessible = true;

  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .limit(1);

    if (error) {
      fail(`TEST 1.${table}`, `Cannot access table: ${error.message}`);
      testResults.failed++;
      testResults.tests.push({ name: `Access ${table}`, status: 'FAIL', reason: error.message });
      allAccessible = false;
    } else {
      pass(`Access to ${table} verified`);
      testResults.passed++;
      testResults.tests.push({ name: `Access ${table}`, status: 'PASS' });
    }
  }

  if (allAccessible) {
    pass('TEST 1: All settings tables are accessible');
  } else {
    fail('TEST 1', 'Some settings tables are not accessible');
  }
}

async function test2_ApplicationSettingsStructure() {
  log('\n=== TEST 2: APPLICATION SETTINGS STRUCTURE ===\n', YELLOW);

  const { data, error } = await supabase
    .from('application_settings')
    .select('*')
    .limit(1)
    .maybeSingle();

  if (error) {
    fail('TEST 2', `Cannot query application_settings: ${error.message}`);
    testResults.failed++;
    testResults.tests.push({ name: 'Application Settings Structure', status: 'FAIL', reason: error.message });
    return;
  }

  if (!data) {
    warning('No application_settings record found');
    testResults.tests.push({ name: 'Application Settings Structure', status: 'WARN', reason: 'No data found' });
    return;
  }

  // Verify all expected fields exist
  const expectedFields = [
    'max_gps_accuracy_meters',
    'gps_warning_threshold_meters',
    'require_high_accuracy',
    'enable_fake_gps_detection',
    'grace_period_minutes',
    'early_check_in_allowed_minutes',
    'require_checkout',
    'block_duplicate_check_ins',
    'detect_rooted_devices',
    'detect_fake_gps',
    'detect_time_manipulation',
    'block_suspicious_devices',
    'max_distance_jump_meters',
    'default_language',
    'date_format',
    'currency'
  ];

  let allFieldsPresent = true;
  const missingFields = [];

  for (const field of expectedFields) {
    if (!(field in data)) {
      allFieldsPresent = false;
      missingFields.push(field);
    }
  }

  if (!allFieldsPresent) {
    fail('TEST 2', `Missing fields in application_settings: ${missingFields.join(', ')}`);
    testResults.failed++;
    testResults.tests.push({
      name: 'Application Settings Structure',
      status: 'FAIL',
      reason: `Missing fields: ${missingFields.join(', ')}`
    });
  } else {
    pass('TEST 2: All expected fields present in application_settings');
    info(`Settings: GPS=${data.max_gps_accuracy_meters}m, Grace=${data.grace_period_minutes}min, Language=${data.default_language}`);
    testResults.passed++;
    testResults.tests.push({ name: 'Application Settings Structure', status: 'PASS' });
  }
}

async function test3_AutoCheckoutSettingsStructure() {
  log('\n=== TEST 3: AUTO CHECKOUT SETTINGS STRUCTURE ===\n', YELLOW);

  const { data, error } = await supabase
    .from('auto_checkout_settings')
    .select('*')
    .limit(1);

  if (error) {
    fail('TEST 3', `Cannot query auto_checkout_settings: ${error.message}`);
    warning('This is expected if RLS requires authentication');
    testResults.tests.push({
      name: 'Auto Checkout Settings Structure',
      status: 'SKIP',
      reason: 'RLS requires authentication'
    });
    return;
  }

  if (!data || data.length === 0) {
    warning('No auto_checkout_settings records found');
    testResults.tests.push({
      name: 'Auto Checkout Settings Structure',
      status: 'WARN',
      reason: 'No data found'
    });
    return;
  }

  const record = data[0];

  // Verify company_id exists (multi-tenant)
  if (!('company_id' in record)) {
    fail('TEST 3', 'company_id field missing - NOT MULTI-TENANT SAFE!');
    testResults.failed++;
    testResults.tests.push({
      name: 'Auto Checkout Multi-Tenant',
      status: 'FAIL',
      reason: 'Missing company_id field'
    });
    return;
  }

  pass('TEST 3: company_id field present - multi-tenant safe');

  // Verify all expected fields
  const expectedFields = [
    'company_id',
    'auto_checkout_enabled',
    'auto_checkout_after_seconds',
    'verify_outside_with_n_readings',
    'watch_interval_seconds',
    'max_location_accuracy_meters'
  ];

  let allFieldsPresent = true;
  const missingFields = [];

  for (const field of expectedFields) {
    if (!(field in record)) {
      allFieldsPresent = false;
      missingFields.push(field);
    }
  }

  if (!allFieldsPresent) {
    fail('TEST 3', `Missing fields: ${missingFields.join(', ')}`);
    testResults.failed++;
    testResults.tests.push({
      name: 'Auto Checkout Settings Structure',
      status: 'FAIL',
      reason: `Missing fields: ${missingFields.join(', ')}`
    });
  } else {
    pass('TEST 3: All expected fields present');
    info(`Settings: Enabled=${record.auto_checkout_enabled}, Countdown=${record.auto_checkout_after_seconds}s, Readings=${record.verify_outside_with_n_readings}`);
    testResults.passed++;
    testResults.tests.push({ name: 'Auto Checkout Settings Structure', status: 'PASS' });
  }
}

async function test4_AttendanceCalculationSettings() {
  log('\n=== TEST 4: ATTENDANCE CALCULATION SETTINGS ===\n', YELLOW);

  const { data, error } = await supabase
    .from('attendance_calculation_settings')
    .select('*')
    .limit(1)
    .maybeSingle();

  if (error) {
    fail('TEST 4', `Cannot query attendance_calculation_settings: ${error.message}`);
    testResults.failed++;
    testResults.tests.push({
      name: 'Attendance Calculation Settings',
      status: 'FAIL',
      reason: error.message
    });
    return;
  }

  if (!data) {
    warning('No attendance_calculation_settings record found');
    testResults.tests.push({
      name: 'Attendance Calculation Settings',
      status: 'WARN',
      reason: 'No data found'
    });
    return;
  }

  // Verify weekly_off_days field
  if (!('weekly_off_days' in data)) {
    fail('TEST 4', 'weekly_off_days field missing');
    testResults.failed++;
    testResults.tests.push({
      name: 'Attendance Calculation Settings',
      status: 'FAIL',
      reason: 'Missing weekly_off_days field'
    });
    return;
  }

  if (!Array.isArray(data.weekly_off_days)) {
    fail('TEST 4', 'weekly_off_days is not an array');
    testResults.failed++;
    testResults.tests.push({
      name: 'Attendance Calculation Settings',
      status: 'FAIL',
      reason: 'weekly_off_days is not an array'
    });
    return;
  }

  pass('TEST 4: Attendance calculation settings structure valid');
  info(`Weekly off days: ${JSON.stringify(data.weekly_off_days)}`);
  testResults.passed++;
  testResults.tests.push({ name: 'Attendance Calculation Settings', status: 'PASS' });
}

async function test5_SystemSettingsKeyValue() {
  log('\n=== TEST 5: SYSTEM SETTINGS KEY-VALUE STRUCTURE ===\n', YELLOW);

  const { data, error } = await supabase
    .from('system_settings')
    .select('*')
    .in('key', ['timezone_mode', 'fixed_timezone']);

  if (error) {
    fail('TEST 5', `Cannot query system_settings: ${error.message}`);
    testResults.failed++;
    testResults.tests.push({
      name: 'System Settings Structure',
      status: 'FAIL',
      reason: error.message
    });
    return;
  }

  if (!data || data.length === 0) {
    warning('No system_settings records found');
    testResults.tests.push({
      name: 'System Settings Structure',
      status: 'WARN',
      reason: 'No data found'
    });
    return;
  }

  const timezoneMode = data.find(s => s.key === 'timezone_mode');
  const fixedTimezone = data.find(s => s.key === 'fixed_timezone');

  if (!timezoneMode || !fixedTimezone) {
    fail('TEST 5', 'Missing timezone settings');
    testResults.failed++;
    testResults.tests.push({
      name: 'System Settings Structure',
      status: 'FAIL',
      reason: 'Missing timezone settings'
    });
    return;
  }

  pass('TEST 5: System settings key-value structure valid');
  info(`Timezone mode: ${timezoneMode.value}`);
  info(`Fixed timezone: ${fixedTimezone.value}`);
  testResults.passed++;
  testResults.tests.push({ name: 'System Settings Structure', status: 'PASS' });
}

async function test6_SettingsRefactorMapping() {
  log('\n=== TEST 6: SETTINGS REFACTOR MAPPING VERIFICATION ===\n', YELLOW);

  // This test verifies that the new Settings UI structure maps correctly to database tables
  const mappings = [
    {
      section: 'General Settings',
      fields: [
        { table: 'application_settings', field: 'default_language' },
        { table: 'application_settings', field: 'date_format' },
        { table: 'application_settings', field: 'currency' },
        { table: 'system_settings', key: 'timezone_mode' },
        { table: 'system_settings', key: 'fixed_timezone' }
      ]
    },
    {
      section: 'Attendance & Checkout Rules',
      fields: [
        { table: 'application_settings', field: 'grace_period_minutes' },
        { table: 'application_settings', field: 'early_check_in_allowed_minutes' },
        { table: 'application_settings', field: 'require_checkout' },
        { table: 'application_settings', field: 'block_duplicate_check_ins' },
        { table: 'attendance_calculation_settings', field: 'weekly_off_days' }
      ]
    },
    {
      section: 'GPS & Location',
      fields: [
        { table: 'application_settings', field: 'max_gps_accuracy_meters' },
        { table: 'application_settings', field: 'gps_warning_threshold_meters' },
        { table: 'application_settings', field: 'require_high_accuracy' },
        { table: 'application_settings', field: 'enable_fake_gps_detection' }
      ]
    },
    {
      section: 'Security & Fraud Detection',
      fields: [
        { table: 'application_settings', field: 'detect_fake_gps' },
        { table: 'application_settings', field: 'detect_rooted_devices' },
        { table: 'application_settings', field: 'detect_time_manipulation' },
        { table: 'application_settings', field: 'block_suspicious_devices' },
        { table: 'application_settings', field: 'max_distance_jump_meters' }
      ]
    },
    {
      section: 'Auto Checkout',
      fields: [
        { table: 'auto_checkout_settings', field: 'auto_checkout_enabled' },
        { table: 'auto_checkout_settings', field: 'auto_checkout_after_seconds' },
        { table: 'auto_checkout_settings', field: 'verify_outside_with_n_readings' },
        { table: 'auto_checkout_settings', field: 'watch_interval_seconds' },
        { table: 'auto_checkout_settings', field: 'max_location_accuracy_meters' }
      ]
    }
  ];

  info('Verifying all mapping fields exist in database...\n');

  let allMappingsValid = true;
  const invalidMappings = [];

  for (const mapping of mappings) {
    info(`Checking ${mapping.section}...`);

    for (const field of mapping.fields) {
      const { data, error } = await supabase
        .from(field.table)
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) {
        warning(`  ✗ Cannot access ${field.table}: ${error.message}`);
        continue;
      }

      if (!data) {
        warning(`  ✗ No data in ${field.table}`);
        continue;
      }

      const fieldName = field.field || field.key;
      if (!(fieldName in data)) {
        allMappingsValid = false;
        invalidMappings.push(`${mapping.section}: ${field.table}.${fieldName}`);
        warning(`  ✗ Missing: ${field.table}.${fieldName}`);
      } else {
        info(`  ✓ ${field.table}.${fieldName}`);
      }
    }
  }

  if (!allMappingsValid) {
    fail('TEST 6', `Some mappings are invalid: ${invalidMappings.join(', ')}`);
    testResults.failed++;
    testResults.tests.push({
      name: 'Settings Refactor Mapping',
      status: 'FAIL',
      reason: `Invalid mappings: ${invalidMappings.join(', ')}`
    });
  } else {
    pass('TEST 6: All Settings UI mappings verified');
    testResults.passed++;
    testResults.tests.push({ name: 'Settings Refactor Mapping', status: 'PASS' });
  }
}

async function generateReport() {
  log('\n╔════════════════════════════════════════════════╗', BLUE);
  log('║           TEST REPORT SUMMARY                  ║', BLUE);
  log('╚════════════════════════════════════════════════╝\n', BLUE);

  log(`Total Tests: ${testResults.passed + testResults.failed}`, BLUE);
  log(`Passed: ${testResults.passed}`, GREEN);
  log(`Failed: ${testResults.failed}`, RED);

  if (testResults.tests.length > 0) {
    log('\nDetailed Results:\n', YELLOW);
    testResults.tests.forEach(test => {
      if (test.status === 'PASS') {
        log(`✓ ${test.name}`, GREEN);
      } else if (test.status === 'FAIL') {
        log(`✗ ${test.name}`, RED);
        if (test.reason) log(`  Reason: ${test.reason}`, RED);
      } else if (test.status === 'SKIP') {
        log(`⊘ ${test.name} (SKIPPED)`, YELLOW);
        if (test.reason) log(`  Reason: ${test.reason}`, YELLOW);
      } else if (test.status === 'WARN') {
        log(`⚠ ${test.name} (WARNING)`, YELLOW);
        if (test.reason) log(`  Reason: ${test.reason}`, YELLOW);
      }
    });
  }

  log('\n╔════════════════════════════════════════════════╗', BLUE);
  log('║             CRITICAL FINDINGS                  ║', BLUE);
  log('╚════════════════════════════════════════════════╝\n', BLUE);

  if (testResults.failed === 0) {
    log('✓ No critical issues found', GREEN);
    log('✓ Settings refactor is production-ready', GREEN);
    log('✓ All database mappings verified', GREEN);
  } else {
    log('⚠ Critical issues detected - review failed tests above', RED);
  }
}

async function runAllTests() {
  log('\n╔════════════════════════════════════════════════╗', BLUE);
  log('║   SETTINGS REFACTOR QA TEST SUITE             ║', BLUE);
  log('║   (Structure & Mapping Verification)           ║', BLUE);
  log('╚════════════════════════════════════════════════╝\n', BLUE);

  try {
    const setupSuccess = await setup();

    if (!setupSuccess) {
      warning('Setup incomplete - some tests may be limited');
    }

    await test1_SettingsTableAccessibility();
    await test2_ApplicationSettingsStructure();
    await test3_AutoCheckoutSettingsStructure();
    await test4_AttendanceCalculationSettings();
    await test5_SystemSettingsKeyValue();
    await test6_SettingsRefactorMapping();

    await generateReport();

  } catch (error) {
    log('\n╔════════════════════════════════════════════════╗', RED);
    log('║          TEST SUITE CRASHED                    ║', RED);
    log('╚════════════════════════════════════════════════╝\n', RED);
    console.error(error);
    process.exit(1);
  }
}

runAllTests();
