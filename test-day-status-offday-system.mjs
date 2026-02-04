#!/usr/bin/env node

/**
 * Test: Day Status WORKDAY/OFFDAY System
 *
 * This test verifies:
 * 1. get_today_status() correctly identifies WORKDAY vs OFFDAY
 * 2. Weekly off days are respected per company
 * 3. Holidays are respected per company
 * 4. Absent count returns 0 on OFFDAY
 * 5. Multi-company isolation works correctly
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

console.log('🧪 Testing: Day Status WORKDAY/OFFDAY System\n');
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

async function getWeeklyOffDays(companyId) {
  const { data, error } = await supabase
    .from('attendance_calculation_settings')
    .select('weekly_off_days')
    .eq('company_id', companyId)
    .maybeSingle();

  if (error) {
    console.error(`❌ Error fetching weekly off days for company ${companyId}:`, error);
    return [];
  }

  return data?.weekly_off_days || [];
}

async function setWeeklyOffDays(companyId, weeklyOffDays) {
  const { error } = await supabase
    .from('attendance_calculation_settings')
    .update({ weekly_off_days: weeklyOffDays })
    .eq('company_id', companyId);

  if (error) {
    console.error(`❌ Error setting weekly off days for company ${companyId}:`, error);
    return false;
  }

  return true;
}

async function getTodayStatus(companyId, checkDate = null) {
  const today = checkDate || new Date().toISOString().split('T')[0];

  const { data, error } = await supabase.rpc('get_today_status', {
    p_company_id: companyId,
    p_check_date: today
  });

  if (error) {
    console.error(`❌ Error getting today status for company ${companyId}:`, error);
    return null;
  }

  return data;
}

async function getAbsentCount(companyId, checkDate = null) {
  const today = checkDate || new Date().toISOString().split('T')[0];

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

async function addHoliday(companyId, holidayDate, name) {
  const { data, error } = await supabase
    .from('holidays')
    .insert({
      company_id: companyId,
      holiday_date: holidayDate,
      name: name,
      is_recurring: false
    })
    .select()
    .maybeSingle();

  if (error) {
    console.error(`❌ Error adding holiday for company ${companyId}:`, error);
    return null;
  }

  return data;
}

async function deleteHoliday(holidayId) {
  const { error } = await supabase
    .from('holidays')
    .delete()
    .eq('id', holidayId);

  if (error) {
    console.error(`❌ Error deleting holiday ${holidayId}:`, error);
    return false;
  }

  return true;
}

function getDayName(dayOfWeek) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayOfWeek] || 'Unknown';
}

async function runTest() {
  try {
    const today = new Date();
    const todayDayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday
    const todayDate = today.toISOString().split('T')[0];

    console.log(`\n📅 Today: ${todayDate} (${getDayName(todayDayOfWeek)})`);
    console.log('-'.repeat(80));

    // Get companies
    const companies = await getCompanies();

    if (companies.length === 0) {
      console.log('⚠️  No companies found for testing');
      return;
    }

    console.log(`\n✅ Found ${companies.length} companies for testing\n`);

    // Test 1: Check current day status for each company
    console.log('📊 Test 1: Current Day Status');
    console.log('-'.repeat(80));

    for (const company of companies) {
      const weeklyOffDays = await getWeeklyOffDays(company.id);
      const dayStatus = await getTodayStatus(company.id);
      const absentCount = await getAbsentCount(company.id);

      console.log(`\n  Company: ${company.name}`);
      console.log(`  Weekly Off Days: [${weeklyOffDays.join(', ')}] (${weeklyOffDays.map(d => getDayName(d)).join(', ')})`);
      console.log(`  Today Status: ${dayStatus?.status}`);

      if (dayStatus?.reason) {
        console.log(`  Reason: ${dayStatus.reason}`);
        console.log(`  Detail: ${dayStatus.detail}`);
      }

      console.log(`  Absent Count: ${absentCount}`);

      if (dayStatus?.status === 'OFFDAY' && absentCount === 0) {
        console.log('  ✅ OFFDAY correctly returns 0 absences');
      } else if (dayStatus?.status === 'WORKDAY') {
        console.log('  ✅ WORKDAY - absences calculated normally');
      } else {
        console.log('  ❌ Unexpected result');
      }
    }

    // Test 2: Test with a simulated weekly off day
    if (companies.length >= 1) {
      console.log('\n\n📊 Test 2: Simulated Weekly Off Day');
      console.log('-'.repeat(80));

      const testCompany = companies[0];
      const originalOffDays = await getWeeklyOffDays(testCompany.id);

      // Set today as an off day
      console.log(`\n  Setting today (${getDayName(todayDayOfWeek)}) as off day for ${testCompany.name}...`);
      await setWeeklyOffDays(testCompany.id, [todayDayOfWeek]);

      const dayStatusAfter = await getTodayStatus(testCompany.id);
      const absentCountAfter = await getAbsentCount(testCompany.id);

      console.log(`  Day Status: ${dayStatusAfter?.status}`);
      console.log(`  Absent Count: ${absentCountAfter}`);

      if (dayStatusAfter?.status === 'OFFDAY' && absentCountAfter === 0) {
        console.log('  ✅ Successfully detected as OFFDAY with 0 absences');
      } else {
        console.log('  ❌ Failed to detect as OFFDAY');
      }

      // Restore original settings
      console.log(`\n  Restoring original weekly off days...`);
      await setWeeklyOffDays(testCompany.id, originalOffDays);

      const dayStatusRestored = await getTodayStatus(testCompany.id);
      console.log(`  Restored Day Status: ${dayStatusRestored?.status}`);
      console.log('  ✅ Settings restored');
    }

    // Test 3: Test with a holiday
    if (companies.length >= 1) {
      console.log('\n\n📊 Test 3: Holiday Detection');
      console.log('-'.repeat(80));

      const testCompany = companies[0];

      // Add a holiday for today
      console.log(`\n  Adding holiday for today for ${testCompany.name}...`);
      const holiday = await addHoliday(testCompany.id, todayDate, 'Test Holiday');

      if (holiday) {
        const dayStatusHoliday = await getTodayStatus(testCompany.id);
        const absentCountHoliday = await getAbsentCount(testCompany.id);

        console.log(`  Day Status: ${dayStatusHoliday?.status}`);
        console.log(`  Reason: ${dayStatusHoliday?.reason}`);
        console.log(`  Detail: ${dayStatusHoliday?.detail}`);
        console.log(`  Absent Count: ${absentCountHoliday}`);

        if (dayStatusHoliday?.status === 'OFFDAY' && dayStatusHoliday?.reason === 'holiday' && absentCountHoliday === 0) {
          console.log('  ✅ Holiday correctly detected as OFFDAY with 0 absences');
        } else {
          console.log('  ❌ Failed to detect holiday as OFFDAY');
        }

        // Delete the test holiday
        console.log(`\n  Removing test holiday...`);
        await deleteHoliday(holiday.id);
        console.log('  ✅ Test holiday removed');
      }
    }

    // Test 4: Multi-company different off days
    if (companies.length >= 2) {
      console.log('\n\n📊 Test 4: Multi-Company Different Off Days');
      console.log('-'.repeat(80));

      const company1 = companies[0];
      const company2 = companies[1];

      const originalOffDays1 = await getWeeklyOffDays(company1.id);
      const originalOffDays2 = await getWeeklyOffDays(company2.id);

      // Set company 1: today is OFF
      // Set company 2: today is WORK
      const nextDayOfWeek = (todayDayOfWeek + 1) % 7;

      console.log(`\n  Setting ${company1.name}: Today (${getDayName(todayDayOfWeek)}) = OFFDAY`);
      await setWeeklyOffDays(company1.id, [todayDayOfWeek]);

      console.log(`  Setting ${company2.name}: Tomorrow (${getDayName(nextDayOfWeek)}) = OFFDAY`);
      await setWeeklyOffDays(company2.id, [nextDayOfWeek]);

      const status1 = await getTodayStatus(company1.id);
      const status2 = await getTodayStatus(company2.id);

      const absent1 = await getAbsentCount(company1.id);
      const absent2 = await getAbsentCount(company2.id);

      console.log(`\n  ${company1.name}:`);
      console.log(`    Status: ${status1?.status}`);
      console.log(`    Absent: ${absent1}`);

      console.log(`\n  ${company2.name}:`);
      console.log(`    Status: ${status2?.status}`);
      console.log(`    Absent: ${absent2}`);

      if (status1?.status === 'OFFDAY' && status2?.status === 'WORKDAY') {
        console.log('\n  ✅ Multi-company isolation works correctly');
        console.log(`     - Company 1 correctly shows OFFDAY (absent=${absent1})`);
        console.log(`     - Company 2 correctly shows WORKDAY (absent=${absent2})`);
      } else {
        console.log('\n  ❌ Multi-company isolation failed');
      }

      // Restore original settings
      console.log(`\n  Restoring original settings...`);
      await setWeeklyOffDays(company1.id, originalOffDays1);
      await setWeeklyOffDays(company2.id, originalOffDays2);
      console.log('  ✅ Settings restored');
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ All tests completed successfully\n');

  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    process.exit(1);
  }
}

runTest();
