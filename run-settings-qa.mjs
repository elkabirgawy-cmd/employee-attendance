import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables manually
function loadEnv() {
  const envFile = readFileSync(join(__dirname, '.env'), 'utf-8');
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
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

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
      const { data: beforeData, error: beforeError } = await supabase
        .from('attendance_calculation_settings')
        .select('*')
        .eq('company_id', this.companyId)
        .limit(1)
        .maybeSingle();

      if (beforeError) throw beforeError;

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
        this.log(category, 'weekly_off_days', 'FAIL', 'Value did not persist', 'Check upsert logic');
        return;
      }

      await supabase
        .from('attendance_calculation_settings')
        .update({ weekly_off_days: originalDays })
        .eq('id', afterData.id);

      this.log(category, 'weekly_off_days', 'PASS');
    } catch (error) {
      this.log(category, 'Test', 'FAIL', error.message, 'Check database access');
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

      if (beforeData) {
        const { error } = await supabase
          .from('application_settings')
          .update(testValues)
          .eq('id', beforeData.id);

        if (error) {
          this.log(category, 'GPS Settings', 'FAIL', error.message, 'Check UPDATE policy');
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
            this.log(category, key, 'FAIL', `Expected ${value}, got ${afterData?.[key]}`);
            allPassed = false;
          }
        }

        if (allPassed) {
          this.log(category, 'GPS Settings', 'PASS');
        }
      } else {
        this.log(category, 'GPS Settings', 'FAIL', 'No settings found', 'Initialize application_settings');
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

      const { error } = await supabase
        .from('auto_checkout_settings')
        .upsert({
          id: beforeData?.id,
          company_id: this.companyId,
          ...testValues
        });

      if (error) {
        this.log(category, 'Settings', 'FAIL', error.message, 'Check RLS policies');
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
          this.log(category, key, 'FAIL', `Expected ${value}, got ${afterData?.[key]}`);
          allPassed = false;
        }
      }

      if (allPassed) {
        this.log(category, 'Auto Checkout Settings', 'PASS');
      }
    } catch (error) {
      this.log(category, 'Test', 'FAIL', error.message);
    }
  }

  async testDevMode() {
    const category = 'Dev Mode';
    try {
      const testToken = `DUMMY_TOKEN_QA_${Date.now()}`;
      const { error } = await supabase
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

      if (error) {
        this.log(category, 'Create Test Device', 'FAIL', error.message, 'Check push_devices RLS');
        return;
      }

      const { data: deviceData } = await supabase
        .from('push_devices')
        .select('*')
        .eq('token', testToken)
        .maybeSingle();

      if (!deviceData) {
        this.log(category, 'Create Test Device', 'FAIL', 'Device not found after insert');
        return;
      }

      this.log(category, 'Create Test Device', 'PASS', `Token: ${testToken.substring(0, 20)}...`);

      // Test dry-run push
      const response = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
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

      if (result.mode === 'dry_run' && result.devicesFound > 0) {
        this.log(category, 'Dry-Run Push', 'PASS', `Found ${result.devicesFound} device(s)`);
      } else if (result.ok) {
        this.log(category, 'Dry-Run Push', 'PASS', `Sent to ${result.sent} device(s)`);
      } else {
        this.log(category, 'Dry-Run Push', 'FAIL', JSON.stringify(result));
      }

      // Cleanup
      await supabase.from('push_devices').delete().eq('token', testToken);

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

    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;

    console.log('\n' + '='.repeat(80));
    console.log(`SUMMARY: ${passed} PASS | ${failed} FAIL | ${this.results.length} TOTAL`);
    console.log(`Success Rate: ${((passed / this.results.length) * 100).toFixed(1)}%`);
    console.log('='.repeat(80) + '\n');

    return this.results;
  }
}

async function main() {
  // Get first admin user
  const { data: adminUser } = await supabase
    .from('admin_users')
    .select('user_id, company_id')
    .limit(1)
    .maybeSingle();

  if (!adminUser) {
    console.error('No admin user found in database');
    process.exit(1);
  }

  console.log(`Testing with company_id: ${adminUser.company_id}, user_id: ${adminUser.user_id}`);

  const runner = new SettingsQARunner(adminUser.company_id, adminUser.user_id);
  const results = await runner.runAll();

  const failedTests = results.filter(r => r.status === 'FAIL');
  if (failedTests.length > 0) {
    console.log('\nFAILED TESTS DETAILS:');
    console.log('='.repeat(80));
    failedTests.forEach(test => {
      console.log(`\n❌ ${test.category} / ${test.setting}`);
      if (test.reason) console.log(`   Reason: ${test.reason}`);
      if (test.fixSuggestion) console.log(`   💡 Fix: ${test.fixSuggestion}`);
    });
  }

  process.exit(failedTests.length > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
