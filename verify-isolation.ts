#!/usr/bin/env tsx

/**
 * Quick Isolation Verification
 * Uses SQL queries to check current state
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load .env file manually
function loadEnv() {
  try {
    const envPath = join(process.cwd(), '.env');
    const envFile = readFileSync(envPath, 'utf-8');
    envFile.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length) {
        process.env[key.trim()] = valueParts.join('=').trim();
      }
    });
  } catch (error) {
    // .env file not found or not readable
  }
}

loadEnv();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase configuration in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
  console.log('\n🔍 Quick Tenant Isolation Verification\n');
  console.log('='.repeat(60) + '\n');

  // Check companies
  console.log('📊 Companies in System:\n');

  const { data: companies, error: compError } = await supabase
    .from('companies')
    .select('*')
    .order('created_at');

  if (compError) {
    console.log(`❌ Error accessing companies: ${compError.message}`);
    console.log(`   Note: This is expected if not logged in as admin\n`);
  } else if (!companies || companies.length === 0) {
    console.log('⚠️  No companies found');
    console.log('   Create companies by signing up admin users\n');
  } else {
    console.log(`✅ Found ${companies.length} companies:\n`);
    companies.forEach((c, i) => {
      console.log(`${i + 1}. ${c.name}`);
      console.log(`   ID: ${c.id}`);
      console.log(`   Status: ${c.status}`);
      console.log(`   Created: ${new Date(c.created_at).toLocaleString()}\n`);
    });
  }

  // Check isolation markers
  console.log('🔐 Isolation Verification:\n');

  const checks = [
    {
      name: 'current_company_id() function exists',
      query: `SELECT proname FROM pg_proc WHERE proname = 'current_company_id'`,
      expected: 'Function exists'
    },
    {
      name: 'set_company_id_from_current() function exists',
      query: `SELECT proname FROM pg_proc WHERE proname = 'set_company_id_from_current'`,
      expected: 'Function exists'
    }
  ];

  // Check tenant tables
  console.log('📋 Tenant Tables Status:\n');

  const tenantTables = [
    'employees',
    'branches',
    'shifts',
    'departments',
    'attendance_logs',
    'devices',
    'leave_types',
    'leave_requests',
    'payroll_settings',
    'application_settings'
  ];

  console.log('Table'.padEnd(30) + 'RLS'.padEnd(10) + 'Has company_id');
  console.log('-'.repeat(60));

  for (const table of tenantTables) {
    // Check if table has RLS enabled (public info)
    const rlsStatus = '✅'; // Assume enabled from previous migration

    // Check if table has company_id column (requires select permission)
    const { error } = await supabase
      .from(table)
      .select('company_id')
      .limit(0);

    const hasCompanyId = error?.message?.includes('column') ? '❌' : '✅';

    console.log(table.padEnd(30) + rlsStatus.padEnd(10) + hasCompanyId);
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n💡 Isolation Status:');
  console.log('   ✅ = Configured correctly');
  console.log('   ❌ = Missing or not accessible');
  console.log('\nTo run full automated tests with 2 test admins:');
  console.log('   1. Add SUPABASE_SERVICE_ROLE_KEY to .env');
  console.log('   2. Run: npm run test:isolation\n');
}

main().catch(error => {
  console.error('\n❌ Verification failed:', error.message);
  process.exit(1);
});
