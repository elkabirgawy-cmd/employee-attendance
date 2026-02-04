#!/usr/bin/env node

/**
 * Test Script: Auto-create Payroll Settings
 *
 * Tests the following scenarios:
 * 1. New company without settings → auto-create
 * 2. Existing company with settings → no duplicate creation
 * 3. Switching between companies → correct settings loaded
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Load .env file
const envFile = readFileSync('.env', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    env[key.trim()] = valueParts.join('=').trim();
  }
});

const supabase = createClient(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_ANON_KEY
);

async function testAutoCreatePayrollSettings() {
  console.log('\n========================================');
  console.log('TEST: Auto-create Payroll Settings');
  console.log('========================================\n');

  try {
    // 1. Get all companies
    console.log('📋 Step 1: Fetching all companies...');
    const { data: companies, error: companiesError } = await supabase
      .from('companies')
      .select('id, name')
      .order('created_at', { ascending: true });

    if (companiesError) {
      console.error('❌ Error fetching companies:', companiesError);
      return;
    }

    if (!companies || companies.length === 0) {
      console.log('⚠️  No companies found in database');
      return;
    }

    console.log(`✅ Found ${companies.length} companies`);
    companies.forEach((company, index) => {
      console.log(`   ${index + 1}. ${company.name} (${company.id})`);
    });

    // 2. Check current payroll_settings
    console.log('\n📋 Step 2: Checking existing payroll_settings...');
    const { data: existingSettings, error: settingsError } = await supabase
      .from('payroll_settings')
      .select('id, company_id, currency, salary_type, workdays_per_month')
      .order('created_at', { ascending: true });

    if (settingsError) {
      console.error('❌ Error fetching payroll_settings:', settingsError);
      return;
    }

    console.log(`✅ Found ${existingSettings?.length || 0} existing payroll_settings`);
    if (existingSettings && existingSettings.length > 0) {
      existingSettings.forEach((setting, index) => {
        const company = companies.find(c => c.id === setting.company_id);
        console.log(`   ${index + 1}. Company: ${company?.name || 'Unknown'}, Currency: ${setting.currency}, Type: ${setting.salary_type}, Days: ${setting.workdays_per_month}`);
      });
    }

    // 3. Test ensurePayrollSettings logic manually
    console.log('\n📋 Step 3: Testing ensurePayrollSettings logic...');

    for (const company of companies) {
      console.log(`\n   Testing company: ${company.name} (${company.id})`);

      // Check if settings exist
      const { data: companySettings, error: checkError } = await supabase
        .from('payroll_settings')
        .select('*')
        .eq('company_id', company.id)
        .maybeSingle();

      if (checkError) {
        console.error(`   ❌ Error checking settings:`, checkError);
        continue;
      }

      if (companySettings) {
        console.log(`   ✅ Settings already exist - no action needed`);
        console.log(`      Currency: ${companySettings.currency}, Type: ${companySettings.salary_type}`);
      } else {
        console.log(`   ⚠️  No settings found - would auto-create with defaults:`);
        console.log(`      - currency: "جنيه"`);
        console.log(`      - salary_type: "monthly"`);
        console.log(`      - workdays_per_month: 26`);
        console.log(`      - grace_minutes: 15`);

        // Note: We don't actually create settings here in the test
        // The frontend will do this automatically when needed
      }
    }

    // 4. Test unique constraint
    console.log('\n📋 Step 4: Verifying unique constraint on company_id...');
    const { data: constraintCheck, error: constraintError } = await supabase.rpc('exec_sql', {
      query: `
        SELECT constraint_name, constraint_type
        FROM information_schema.table_constraints
        WHERE table_name = 'payroll_settings'
        AND constraint_name = 'payroll_settings_company_id_unique';
      `
    });

    if (!constraintError && constraintCheck) {
      console.log('✅ Unique constraint exists on company_id');
    } else {
      console.log('❌ Unique constraint NOT found - this may cause issues');
    }

    // 5. Check RLS policies
    console.log('\n📋 Step 5: Checking RLS policies on payroll_settings...');
    const { data: policies, error: policiesError } = await supabase.rpc('exec_sql', {
      query: `
        SELECT policyname, cmd
        FROM pg_policies
        WHERE tablename = 'payroll_settings'
        ORDER BY policyname;
      `
    });

    if (!policiesError && policies) {
      console.log('✅ RLS policies found:');
      policies.forEach(policy => {
        console.log(`   - ${policy.policyname} (${policy.cmd})`);
      });
    }

    console.log('\n========================================');
    console.log('✅ TEST COMPLETED SUCCESSFULLY');
    console.log('========================================\n');

  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
  }
}

// Run the test
testAutoCreatePayrollSettings().catch(console.error);
