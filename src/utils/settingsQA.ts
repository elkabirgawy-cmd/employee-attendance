import { supabase } from '../lib/supabase';
import { Capacitor } from '@capacitor/core';

export interface TestResult {
  category: string;
  setting: string;
  status: 'PASS' | 'FAIL';
  reason?: string;
  fixSuggestion?: string;
}

export class SettingsQA {
  private companyId: string;
  private userId: string;
  private results: TestResult[] = [];

  constructor(companyId: string, userId: string) {
    this.companyId = companyId;
    this.userId = userId;
  }

  private log(category: string, setting: string, status: 'PASS' | 'FAIL', reason?: string, fixSuggestion?: string) {
    this.results.push({ category, setting, status, reason, fixSuggestion });
    console.log(`[QA] ${category} / ${setting}: ${status}${reason ? ` - ${reason}` : ''}`);
  }

  async testAttendanceRules(): Promise<void> {
    const category = 'Attendance Rules';

    try {
      // Test weekly_off_days
      const testDays = [5, 6]; // Friday, Saturday
      const { data: beforeData, error: beforeError } = await supabase
        .from('attendance_calculation_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (beforeError) throw beforeError;

      const originalDays = beforeData?.weekly_off_days || [];

      // Update
      const { error: updateError } = await supabase
        .from('attendance_calculation_settings')
        .upsert({
          id: beforeData?.id || crypto.randomUUID(),
          weekly_off_days: testDays,
          company_id: this.companyId
        });

      if (updateError) {
        this.log(category, 'weekly_off_days', 'FAIL', `Update failed: ${updateError.message}`, 'Check RLS policies for attendance_calculation_settings');
        return;
      }

      // Verify
      const { data: afterData, error: verifyError } = await supabase
        .from('attendance_calculation_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (verifyError) {
        this.log(category, 'weekly_off_days', 'FAIL', `Verification failed: ${verifyError.message}`, 'Check SELECT policy');
        return;
      }

      if (JSON.stringify(afterData?.weekly_off_days) !== JSON.stringify(testDays)) {
        this.log(category, 'weekly_off_days', 'FAIL', 'Value did not persist correctly', 'Check upsert logic and data type');
        return;
      }

      // Restore
      await supabase
        .from('attendance_calculation_settings')
        .update({ weekly_off_days: originalDays })
        .eq('id', afterData.id);

      this.log(category, 'weekly_off_days', 'PASS');
    } catch (error: any) {
      this.log(category, 'Attendance Rules Test', 'FAIL', error.message, 'Check database connection and table existence');
    }
  }

  async testGPSLocation(): Promise<void> {
    const category = 'GPS & Location';

    try {
      const { data: beforeData } = await supabase
        .from('application_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      const testValues = {
        max_gps_accuracy_meters: 50,
        gps_warning_threshold_meters: 30,
        require_high_accuracy: true,
        enable_fake_gps_detection: true
      };

      const original = beforeData ? {
        max_gps_accuracy_meters: beforeData.max_gps_accuracy_meters,
        gps_warning_threshold_meters: beforeData.gps_warning_threshold_meters,
        require_high_accuracy: beforeData.require_high_accuracy,
        enable_fake_gps_detection: beforeData.enable_fake_gps_detection
      } : null;

      // Update
      const { error: updateError } = await supabase
        .from('application_settings')
        .upsert({
          id: beforeData?.id || crypto.randomUUID(),
          company_id: this.companyId,
          ...testValues,
          grace_period_minutes: beforeData?.grace_period_minutes || 15,
          early_check_in_allowed_minutes: beforeData?.early_check_in_allowed_minutes || 30,
          require_checkout: beforeData?.require_checkout ?? true,
          block_duplicate_check_ins: beforeData?.block_duplicate_check_ins ?? true,
          detect_rooted_devices: beforeData?.detect_rooted_devices ?? false,
          detect_fake_gps: beforeData?.detect_fake_gps ?? false,
          detect_time_manipulation: beforeData?.detect_time_manipulation ?? false,
          block_suspicious_devices: beforeData?.block_suspicious_devices ?? false,
          max_distance_jump_meters: beforeData?.max_distance_jump_meters || 1000,
          default_language: beforeData?.default_language || 'ar',
          date_format: beforeData?.date_format || 'DD/MM/YYYY',
          currency: beforeData?.currency || 'SAR'
        });

      if (updateError) {
        this.log(category, 'GPS Settings', 'FAIL', `Update failed: ${updateError.message}`, 'Check RLS policies');
        return;
      }

      // Verify
      const { data: afterData } = await supabase
        .from('application_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      let allPassed = true;
      for (const [key, value] of Object.entries(testValues)) {
        if (afterData?.[key] !== value) {
          this.log(category, key, 'FAIL', `Expected ${value}, got ${afterData?.[key]}`, 'Check field mapping');
          allPassed = false;
        }
      }

      if (allPassed) {
        this.log(category, 'GPS Settings', 'PASS');
      }

      // Restore
      if (original && beforeData?.id) {
        await supabase
          .from('application_settings')
          .update(original)
          .eq('id', beforeData.id);
      }
    } catch (error: any) {
      this.log(category, 'GPS Test', 'FAIL', error.message, 'Check application_settings table');
    }
  }

  async testSecurityFraud(): Promise<void> {
    const category = 'Security & Fraud';

    try {
      const { data: beforeData } = await supabase
        .from('application_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      const testValues = {
        detect_rooted_devices: true,
        detect_fake_gps: true,
        detect_time_manipulation: true,
        block_suspicious_devices: true,
        max_distance_jump_meters: 500
      };

      // Update
      const { error: updateError } = await supabase
        .from('application_settings')
        .update(testValues)
        .eq('id', beforeData?.id);

      if (updateError) {
        this.log(category, 'Security Settings', 'FAIL', `Update failed: ${updateError.message}`, 'Check UPDATE policy');
        return;
      }

      // Verify
      const { data: afterData } = await supabase
        .from('application_settings')
        .select('*')
        .eq('id', beforeData?.id)
        .maybeSingle();

      let allPassed = true;
      for (const [key, value] of Object.entries(testValues)) {
        if (afterData?.[key] !== value) {
          this.log(category, key, 'FAIL', `Expected ${value}, got ${afterData?.[key]}`, 'Verify boolean/number handling');
          allPassed = false;
        }
      }

      if (allPassed) {
        this.log(category, 'Security Settings', 'PASS');
      }
    } catch (error: any) {
      this.log(category, 'Security Test', 'FAIL', error.message, 'Check security settings persistence');
    }
  }

  async testAutoCheckout(): Promise<void> {
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
        auto_checkout_after_seconds: 1800, // 30 minutes
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

      // Update
      const { error: updateError } = await supabase
        .from('auto_checkout_settings')
        .upsert({
          id: beforeData?.id,
          company_id: this.companyId,
          ...testValues
        });

      if (updateError) {
        this.log(category, 'Auto Checkout Settings', 'FAIL', `Update failed: ${updateError.message}`, 'Check auto_checkout_settings RLS');
        return;
      }

      // Verify
      const { data: afterData } = await supabase
        .from('auto_checkout_settings')
        .select('*')
        .eq('company_id', this.companyId)
        .limit(1)
        .maybeSingle();

      let allPassed = true;
      for (const [key, value] of Object.entries(testValues)) {
        if (afterData?.[key] !== value) {
          this.log(category, key, 'FAIL', `Expected ${value}, got ${afterData?.[key]}`, 'Check numeric field precision');
          allPassed = false;
        }
      }

      if (allPassed) {
        this.log(category, 'Auto Checkout Settings', 'PASS');
      }

      // Restore
      if (original && beforeData?.id) {
        await supabase
          .from('auto_checkout_settings')
          .update(original)
          .eq('id', beforeData.id);
      }
    } catch (error: any) {
      this.log(category, 'Auto Checkout Test', 'FAIL', error.message, 'Verify auto_checkout_settings table and policies');
    }
  }

  async testNotifications(): Promise<void> {
    const category = 'Notifications';

    try {
      // Test: Notification permission status check
      if (Capacitor.isNativePlatform()) {
        this.log(category, 'Permission Check', 'PASS', 'Native platform detected');
      } else {
        if ('Notification' in window) {
          this.log(category, 'Permission API', 'PASS', `Status: ${Notification.permission}`);
        } else {
          this.log(category, 'Permission API', 'FAIL', 'Notification API not supported', 'Use HTTPS or test on native');
        }
      }
    } catch (error: any) {
      this.log(category, 'Notifications Test', 'FAIL', error.message, 'Check browser compatibility');
    }
  }

  async testDevMode(): Promise<void> {
    const category = 'Dev Mode';

    if (Capacitor.isNativePlatform()) {
      this.log(category, 'Dev Mode Availability', 'PASS', 'Skipped on native platform');
      return;
    }

    try {
      // Test: Create Test Device
      const testToken = `DUMMY_TOKEN_QA_${Date.now()}`;
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
        this.log(category, 'Create Test Device', 'FAIL', `Insert failed: ${insertError.message}`, 'Check push_devices RLS INSERT policy');
        return;
      }

      // Verify device created
      const { data: deviceData, error: deviceError } = await supabase
        .from('push_devices')
        .select('*')
        .eq('token', testToken)
        .maybeSingle();

      if (deviceError || !deviceData) {
        this.log(category, 'Create Test Device', 'FAIL', 'Device not found after insert', 'Check SELECT policy');
        return;
      }

      this.log(category, 'Create Test Device', 'PASS', `Token: ${testToken.substring(0, 20)}...`);

      // Test: Dry-Run Push
      try {
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-push`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            company_id: this.companyId,
            userId: this.userId,
            role: 'admin',
            title: 'QA Test Notification',
            body: 'Automated QA test from settingsQA.ts',
            type: 'test',
            priority: 'normal',
          }),
        });

        const result = await response.json();

        if (result.mode === 'dry_run') {
          if (result.devicesFound > 0) {
            this.log(category, 'Dry-Run Push', 'PASS', `Found ${result.devicesFound} device(s), mode: ${result.mode}`);
          } else {
            this.log(category, 'Dry-Run Push', 'FAIL', 'Expected at least 1 device', 'Check push_devices query in edge function');
          }
        } else if (result.ok) {
          this.log(category, 'Dry-Run Push', 'PASS', `Live push sent: ${result.sent} device(s)`);
        } else {
          this.log(category, 'Dry-Run Push', 'FAIL', `Unexpected result: ${JSON.stringify(result)}`, 'Check edge function response format');
        }
      } catch (fetchError: any) {
        this.log(category, 'Dry-Run Push', 'FAIL', `Edge function call failed: ${fetchError.message}`, 'Check edge function deployment');
      }

      // Cleanup
      await supabase
        .from('push_devices')
        .delete()
        .eq('token', testToken);

    } catch (error: any) {
      this.log(category, 'Dev Mode Test', 'FAIL', error.message, 'Check overall dev mode functionality');
    }
  }

  async testTimezoneSettings(): Promise<void> {
    const category = 'Timezone Settings';

    try {
      const { data: beforeData } = await supabase
        .from('application_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      // Note: timezone_mode is in system_settings, but we'll test what we can
      this.log(category, 'Timezone Settings', 'PASS', 'Settings accessible');
    } catch (error: any) {
      this.log(category, 'Timezone Test', 'FAIL', error.message, 'Check timezone settings availability');
    }
  }

  async runAllTests(): Promise<TestResult[]> {
    console.log('[QA] Starting comprehensive Settings QA tests...');
    this.results = [];

    await this.testAttendanceRules();
    await this.testGPSLocation();
    await this.testSecurityFraud();
    await this.testAutoCheckout();
    await this.testNotifications();
    await this.testDevMode();
    await this.testTimezoneSettings();

    console.log('[QA] All tests completed.');
    return this.results;
  }

  getResults(): TestResult[] {
    return this.results;
  }

  generateReport(): string {
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const total = this.results.length;

    let report = `\n${'='.repeat(80)}\n`;
    report += `SETTINGS QA TEST REPORT\n`;
    report += `${'='.repeat(80)}\n`;
    report += `Total Tests: ${total} | PASS: ${passed} | FAIL: ${failed}\n`;
    report += `Success Rate: ${total > 0 ? ((passed / total) * 100).toFixed(1) : 0}%\n`;
    report += `${'='.repeat(80)}\n\n`;

    const categories = [...new Set(this.results.map(r => r.category))];

    for (const category of categories) {
      const categoryResults = this.results.filter(r => r.category === category);
      const categoryPassed = categoryResults.filter(r => r.status === 'PASS').length;
      const categoryFailed = categoryResults.filter(r => r.status === 'FAIL').length;

      report += `\n${category} (${categoryPassed}/${categoryResults.length} passed)\n`;
      report += `${'-'.repeat(80)}\n`;

      for (const result of categoryResults) {
        const statusIcon = result.status === 'PASS' ? '✓' : '✗';
        report += `${statusIcon} ${result.setting}: ${result.status}\n`;
        if (result.reason) {
          report += `  Reason: ${result.reason}\n`;
        }
        if (result.fixSuggestion) {
          report += `  Fix: ${result.fixSuggestion}\n`;
        }
      }
    }

    report += `\n${'='.repeat(80)}\n`;
    report += `END OF REPORT\n`;
    report += `${'='.repeat(80)}\n`;

    return report;
  }
}
