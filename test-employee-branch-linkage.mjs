#!/usr/bin/env node
/**
 * Test: Employee→Branch Linkage Verification
 * 
 * Checks if employees have valid branch_id and if it belongs to their company
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envContent = readFileSync('.env', 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim();
  }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseKey = envVars.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('\n🔍 Employee→Branch Linkage Verification\n');
console.log('='.repeat(70));

async function testEmployeeBranchLinkage() {
  try {
    // Get all employees
    const { data: employees, error: empError } = await supabase
      .from('employees')
      .select('id, employee_code, full_name, branch_id, company_id, is_active')
      .order('created_at', { ascending: false });

    if (empError) {
      console.error('❌ Error fetching employees:', empError.message);
      return false;
    }

    if (!employees || employees.length === 0) {
      console.log('⚠️  No employees found');
      return true;
    }

    console.log(`\n📊 Found ${employees.length} employees\n`);

    let issuesFound = 0;

    for (const emp of employees) {
      console.log(`Employee: ${emp.full_name} (${emp.employee_code})`);
      console.log(`  ID: ${emp.id}`);
      console.log(`  Company: ${emp.company_id || '❌ MISSING'}`);
      console.log(`  Branch: ${emp.branch_id || '❌ MISSING'}`);
      console.log(`  Active: ${emp.is_active}`);

      // Check 1: Missing company_id
      if (!emp.company_id) {
        console.log('  ⚠️  ISSUE: Missing company_id');
        issuesFound++;
      }

      // Check 2: Missing branch_id
      if (!emp.branch_id) {
        console.log('  ⚠️  ISSUE: Missing branch_id');
        issuesFound++;
      } else {
        // Check 3: Verify branch belongs to same company
        const { data: branch, error: branchError } = await supabase
          .from('branches')
          .select('id, name, company_id')
          .eq('id', emp.branch_id)
          .maybeSingle();

        if (branchError) {
          console.log(`  ⚠️  ISSUE: Cannot read branch: ${branchError.message}`);
          issuesFound++;
        } else if (!branch) {
          console.log('  ⚠️  ISSUE: Branch not found (invalid branch_id)');
          issuesFound++;
        } else {
          console.log(`  ✓ Branch: ${branch.name} (${branch.id})`);
          
          if (branch.company_id !== emp.company_id) {
            console.log(`  ❌ CRITICAL: Branch belongs to different company!`);
            console.log(`    Employee company: ${emp.company_id}`);
            console.log(`    Branch company: ${branch.company_id}`);
            issuesFound++;
          } else {
            console.log(`  ✓ Branch belongs to correct company`);
          }
        }
      }

      console.log('');
    }

    if (issuesFound > 0) {
      console.log(`\n❌ Found ${issuesFound} issue(s)\n`);
      return false;
    } else {
      console.log('\n✅ All employees have valid branch linkage\n');
      return true;
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

const success = await testEmployeeBranchLinkage();
process.exit(success ? 0 : 1);
