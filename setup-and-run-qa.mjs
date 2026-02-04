import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

function loadEnv() {
  const envFile = readFileSync('.env', 'utf-8');
  const env = {};
  envFile.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      env[key.trim()] = valueParts.join('=').trim();
    }
  });
  return env;
}

const env = loadEnv();
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function setupTestData() {
  console.log('Setting up test data...\n');

  // Get first company (should exist from migrations)
  let { data: companies, error: companyError } = await supabase
    .from('companies')
    .select('*')
    .limit(1);

  if (companyError) {
    console.error('Error querying companies:', companyError);
    return null;
  }

  let companyId;

  if (!companies || companies.length === 0) {
    console.error('No companies found in database. Please run migrations first.');
    return null;
  } else {
    companyId = companies[0].id;
    console.log('✓ Using company:', companies[0].name, '(' + companyId + ')');
  }

  // Check for existing admin user for this company
  let { data: adminUsers } = await supabase
    .from('admin_users')
    .select('*')
    .eq('company_id', companyId)
    .limit(1);

  let userId;

  if (!adminUsers || adminUsers.length === 0) {
    console.log('Creating test admin user...');
    userId = crypto.randomUUID();
    const { error } = await supabase
      .from('admin_users')
      .insert({
        user_id: userId,
        company_id: companyId,
        email: 'qa-test@geoshift.com',
        role: 'super_admin'
      });

    if (error) {
      console.error('Failed to create admin user:', error);
      return null;
    }
    console.log('✓ Created admin user:', userId);
  } else {
    userId = adminUsers[0].user_id;
    console.log('✓ Using existing admin user:', userId);
  }

  return { companyId, userId };
}

class SettingsQARunner {
  constructor(companyId, userId) {
    this.companyId = companyId;
    this.userId = userId;
    this.results = [];
  }

  log(category, setting, status, reason, fixSuggestion) {
    this.results.push({ category, setting, status, reason, fixSuggestion });
    const icon = status === 'PASS' ? '✓' : '✗';
    console.log(`${icon} [${category}] ${setting}: ${status}${reason ? ` - ${reason}` : ''}`);
  }

  async testAttendanceRules() {
    const category = 'Attendance Rules';
    try {
      const testDays = [5, 6];
      const { data: beforeData } = await supabase
        .from('attendance_calculation_settings')
        .select('*')
        .eq('company_id', this.companyId)
        .limit(1)
        .maybeSingle();

      const originalDays = beforeData?.weekly_off_days || [];

      const { error: updateError } = await supabase
        .from('attendance_calculation_settings')
        .upsert({
          id: beforeData?.id || crypto.randomUUID(),
          company_id: this.companyId,
          weekly_off_days: testDays
        });

      if (updateError) {
        this.log(category, 'weekly_off_days', 'FAIL', `Update failed: ${updateError.message}`, 'Check RLS policies');
        return;
      }

      const { data: afterData } = await supabase
        .from('attendance_calculation_settings')
        .select('*')
        .eq('company_id', this.companyId)
        .limit(1)
        .maybeSingle();

      if (JSON.stringify(afterData?.weekly_off_days) !== JSON.stringify(testDays)) {
        this.log(category, 'weekly_off_days - Persistence', 'FAIL', 'Value did not persist correctly');
        return;
      }

      this.log(category, 'weekly_off_days - Write & Persist', 'PASS');

      // Restore
      if (beforeData?.id) {
        await supabase
          .from('attendance_calculation_settings')
          .update({ weekly_off_days: originalDays })
          .eq('id', beforeData.id);
      }
    } catch (error) {
      this.log(category, 'Test', 'FAIL', error.message);
    }
  }

  async testGPSLocation() {
    const category = 'GPS & Location';
    try {
      const { data: beforeData } = await supabase
        .from('application_settings')
        .select('*')
        .eq('company_id', this.companyId)
        .limit(1)
        .maybeSingle();

      const testValues = {
        max_gps_accuracy_meters: 50,
        gps_warning_threshold_meters: 30,
        require_high_accuracy: true,
        enable_fake_gps_detection: true
      };

      if (!beforeData) {
        this.log(category, 'GPS Settings', 'FAIL', 'No application_settings found', 'Initialize settings first');
        return;
      }

      const { error } = await supabase
        .from('application_settings')
        .update(testValues)
        .eq('id', beforeData.id);

      if (error) {
        this.log(category, 'GPS Settings - Write', 'FAIL', error.message, 'Check UPDATE policy');
        return;
      }

      const { data: afterData } = await supabase
        .from('application_settings')
        .select('*')
        .eq('id', beforeData.id)
        .maybeSingle();

      let allPassed = true;
      for (const [key, value] of Object.entries(testValues)) {
        if (afterData?.[key] !== value) {
          this.log(category, `${key} - Persistence`, 'FAIL', `Expected ${value}, got ${afterData?.[key]}`);
          allPassed = false;
        }
      }

      if (allPassed) {
        this.log(category, 'GPS Settings - Write & Persist', 'PASS');
      }
    } catch (error) {
      this.log(category, 'Test', 'FAIL', error.message);
    }
  }

  async testAutoCheckout() {
    const category = 'Auto Checkout';
    try {
      const { data: beforeData } = await supabase
        .from('auto_checkout_settings')
        .select('*')
        .eq('company_id', this.companyId)
        .limit(1)
        .maybeSingle();

      const testValues = {
        auto_checkout_enabled: true,
        auto_checkout_after_seconds: 1800,
        verify_outside_with_n_readings: 5,
        watch_interval_seconds: 20,
        max_location_accuracy_meters: 100
      };

      const original = beforeData ? {
        auto_checkout_enabled: beforeData.auto_checkout_enabled,
        auto_checkout_after_seconds: beforeData.auto_checkout_after_seconds,
        verify_outside_with_n_readings: beforeData.verify_outside_with_n_readings,
        watch_interval_seconds: beforeData.watch_interval_seconds,
        max_location_accuracy_meters: beforeData.max_location_accuracy_meters
      } : null;

      const { error } = await supabase
        .from('auto_checkout_settings')
        .upsert({
          id: beforeData?.id,
          company_id: this.companyId,
          ...testValues
        });

      if (error) {
        this.log(category, 'Settings - Write', 'FAIL', error.message, 'Check RLS policies');
        return;
      }

      const { data: afterData } = await supabase
        .from('auto_checkout_settings')
        .select('*')
        .eq('company_id', this.companyId)
        .limit(1)
        .maybeSingle();

      let allPassed = true;
      for (const [key, value] of Object.entries(testValues)) {
        if (afterData?.[key] !== value) {
          this.log(category, `${key} - Persistence`, 'FAIL', `Expected ${value}, got ${afterData?.[key]}`);
          allPassed = false;
        }
      }

      if (allPassed) {
        this.log(category, 'Auto Checkout - Write & Persist', 'PASS');
      }

      // Restore
      if (original && beforeData?.id) {
        await supabase
          .from('auto_checkout_settings')
          .update(original)
          .eq('id', beforeData.id);
      }
    } catch (error) {
      this.log(category, 'Test', 'FAIL', error.message);
    }
  }

  async testDevMode() {
    const category = 'Dev Mode';
    try {
      const testToken = `DUMMY_TOKEN_QA_${Date.now()}`;

      // Test: Create test device
      const { error: insertError } = await supabase
        .from('push_devices')
        .upsert({
          user_id: this.userId,
          role: 'admin',
          company_id: this.companyId,
          platform: 'web',
          token: testToken,
          enabled: true,
          device_id: 'qa-test-device',
          last_seen_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,role,platform'
        });

      if (insertError) {
        this.log(category, 'Create Test Device', 'FAIL', insertError.message, 'Check push_devices RLS INSERT policy');
        return;
      }

      // Verify device exists
      const { data: deviceData, error: deviceError } = await supabase
        .from('push_devices')
        .select('*')
        .eq('token', testToken)
        .maybeSingle();

      if (deviceError || !deviceData) {
        this.log(category, 'Create Test Device - Persistence', 'FAIL', 'Device not found after insert', 'Check SELECT policy');
        return;
      }

      this.log(category, 'Create Test Device - Write & Persist', 'PASS');

      // Test: Dry-run push notification
      try {
        const response = await fetch(`${env.VITE_SUPABASE_URL}/functions/v1/send-push`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            company_id: this.companyId,
            userId: this.userId,
            role: 'admin',
            title: 'QA Test',
            body: 'Automated test',
            type: 'test',
            priority: 'normal',
          }),
        });

        const result = await response.json();

        if (result.mode === 'dry_run') {
          if (result.devicesFound > 0) {
            this.log(category, 'Dry-Run Push Edge Function', 'PASS', `Found ${result.devicesFound} device(s)`);
          } else {
            this.log(category, 'Dry-Run Push Edge Function', 'FAIL', 'Expected at least 1 device');
          }
        } else if (result.ok) {
          this.log(category, 'Live Push Edge Function', 'PASS', `Sent to ${result.sent} device(s)`);
        } else {
          this.log(category, 'Push Edge Function', 'FAIL', JSON.stringify(result));
        }
      } catch (fetchError) {
        this.log(category, 'Push Edge Function Call', 'FAIL', fetchError.message, 'Check edge function deployment');
      }

      // Cleanup
      await supabase.from('push_devices').delete().eq('token', testToken);

    } catch (error) {
      this.log(category, 'Test', 'FAIL', error.message);
    }
  }

  async testNotificationPermissions() {
    const category = 'Notifications';
    // This test is mostly UI/browser-based, so we'll just verify table access
    try {
      const { error } = await supabase
        .from('notifications')
        .select('count')
        .limit(0);

      if (error) {
        this.log(category, 'Table Access', 'FAIL', error.message);
      } else {
        this.log(category, 'Table Access', 'PASS', 'Can query notifications table');
      }
    } catch (error) {
      this.log(category, 'Test', 'FAIL', error.message);
    }
  }

  async runAll() {
    console.log('\n' + '='.repeat(80));
    console.log('SETTINGS QA TEST REPORT');
    console.log('='.repeat(80) + '\n');

    await this.testAttendanceRules();
    await this.testGPSLocation();
    await this.testAutoCheckout();
    await this.testDevMode();
    await this.testNotificationPermissions();

    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;

    console.log('\n' + '='.repeat(80));
    console.log(`SUMMARY: ${passed} PASS | ${failed} FAIL | ${this.results.length} TOTAL`);
    console.log(`Success Rate: ${this.results.length > 0 ? ((passed / this.results.length) * 100).toFixed(1) : 0}%`);
    console.log('='.repeat(80) + '\n');

    return { results: this.results, passed, failed };
  }
}

async function main() {
  const testData = await setupTestData();

  if (!testData) {
    console.error('Failed to setup test data');
    process.exit(1);
  }

  const { companyId, userId } = testData;
  console.log(`\nRunning QA tests with:`);
  console.log(`  Company ID: ${companyId}`);
  console.log(`  User ID: ${userId}\n`);

  const runner = new SettingsQARunner(companyId, userId);
  const { results, passed, failed } = await runner.runAll();

  const failedTests = results.filter(r => r.status === 'FAIL');
  if (failedTests.length > 0) {
    console.log('\nFAILED TESTS DETAILS:');
    console.log('='.repeat(80));
    failedTests.forEach(test => {
      console.log(`\n❌ ${test.category} / ${test.setting}`);
      if (test.reason) console.log(`   Reason: ${test.reason}`);
      if (test.fixSuggestion) console.log(`   💡 Fix: ${test.fixSuggestion}`);
    });
    console.log('\n');
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
