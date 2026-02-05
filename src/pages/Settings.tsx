import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Shield, MapPin, Clock, Bell, Globe, Calculator, Save, Power, Wifi, Send, Wrench, ChevronDown, ChevronRight, Smartphone, CheckCircle, XCircle, AlertCircle, HelpCircle, Play, FileText } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import AdminPageLayout from '../components/admin/AdminPageLayout';
import AdminPageHeader from '../components/admin/AdminPageHeader';
import { adminTheme } from '@/lib/adminTheme';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { sendTestPushNotification, requestNativePushPermission, checkNativePushPermission } from '../utils/pushNotifications';
import SystemSelfTestModal from '../components/SystemSelfTestModal';
import { SettingsQA, TestResult } from '../utils/settingsQA';

interface SettingsProps {
  currentPage?: string;
}

interface AttendanceCalculationSettings {
  id: string;
  weekly_off_days: number[];
}

interface AutoCheckoutSettings {
  id: number;
  auto_checkout_enabled: boolean;
  auto_checkout_after_seconds: number;
  verify_outside_with_n_readings: number;
  watch_interval_seconds: number;
  max_location_accuracy_meters: number;
}

interface SystemSettings {
  timezone_mode: 'auto_gps' | 'fixed';
  fixed_timezone: string;
}

interface ApplicationSettings {
  id: string;
  max_gps_accuracy_meters: number;
  gps_warning_threshold_meters: number;
  require_high_accuracy: boolean;
  enable_fake_gps_detection: boolean;
  grace_period_minutes: number;
  early_check_in_allowed_minutes: number;
  require_checkout: boolean;
  block_duplicate_check_ins: boolean;
  detect_rooted_devices: boolean;
  detect_fake_gps: boolean;
  detect_time_manipulation: boolean;
  block_suspicious_devices: boolean;
  max_distance_jump_meters: number;
  default_language: string;
  date_format: string;
  currency: string;
}


interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function CollapsibleSection({ title, icon, iconBg, iconColor, isOpen, onToggle, children }: CollapsibleSectionProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-6 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 ${iconBg} rounded-lg flex items-center justify-center`}>
            <div className={iconColor}>{icon}</div>
          </div>
          <h2 className="text-xl font-bold text-slate-800">{title}</h2>
        </div>
        {isOpen ? (
          <ChevronDown className="w-5 h-5 text-slate-400" />
        ) : (
          <ChevronRight className="w-5 h-5 text-slate-400" />
        )}
      </button>
      {isOpen && (
        <div className="px-6 pb-6 border-t border-slate-100">
          {children}
        </div>
      )}
    </div>
  );
}

function PermissionBadge({
  status,
  label,
  onRequest
}: {
  status: 'granted' | 'denied' | 'prompt' | 'unsupported';
  label: string;
  onRequest?: () => void;
}) {
  const getBadgeColor = () => {
    switch (status) {
      case 'granted': return 'bg-green-100 text-green-800 border-green-300';
      case 'denied': return 'bg-red-100 text-red-800 border-red-300';
      case 'prompt': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'unsupported': return 'bg-slate-100 text-slate-600 border-slate-300';
    }
  };

  const getIcon = () => {
    switch (status) {
      case 'granted': return <CheckCircle size={16} />;
      case 'denied': return <XCircle size={16} />;
      case 'prompt': return <AlertCircle size={16} />;
      case 'unsupported': return <HelpCircle size={16} />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'granted': return 'مفعّل';
      case 'denied': return 'مرفوض';
      case 'prompt': return 'لم يُطلب';
      case 'unsupported': return 'غير مدعوم';
    }
  };

  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-slate-700">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium ${getBadgeColor()}`}>
          {getIcon()}
          {getStatusText()}
        </span>
        {status === 'prompt' && onRequest && (
          <button
            onClick={onRequest}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg transition"
          >
            طلب
          </button>
        )}
      </div>
    </div>
  );
}

export default function Settings({ currentPage }: SettingsProps) {
  const { t, language, setLanguage } = useLanguage();
  const { user, companyId } = useAuth();
  const [loading, setLoading] = useState(false);
  const [calculationSettings, setCalculationSettings] = useState<AttendanceCalculationSettings | null>(null);
  const [autoCheckoutSettings, setAutoCheckoutSettings] = useState<AutoCheckoutSettings | null>(null);
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
  const [applicationSettings, setApplicationSettings] = useState<ApplicationSettings | null>(null);
  const [sendingTestPush, setSendingTestPush] = useState(false);
  const [testPushResult, setTestPushResult] = useState<string | null>(null);
  const [showSelfTest, setShowSelfTest] = useState(false);
  const [nativePushEnabled, setNativePushEnabled] = useState(false);
  const [enablingNativePush, setEnablingNativePush] = useState(false);
  const [checkingPushStatus, setCheckingPushStatus] = useState(true);
  const [pushPermissionStatus, setPushPermissionStatus] = useState<'granted' | 'denied' | 'prompt' | 'unsupported'>('unsupported');
  const [locationPermissionStatus, setLocationPermissionStatus] = useState<'granted' | 'denied' | 'prompt' | 'unsupported'>('unsupported');
  const [creatingTestDevice, setCreatingTestDevice] = useState(false);
  const [qaMode, setQaMode] = useState(false);
  const [runningTests, setRunningTests] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [showTestReport, setShowTestReport] = useState(false);

  const [openSections, setOpenSections] = useState({
    general: true,
    attendance: false,
    gps: false,
    security: false,
    autoCheckout: false,
    notifications: false,
    qa: false
  });

  const [savingStates, setSavingStates] = useState({
    general: false,
    attendance: false,
    gps: false,
    security: false,
    autoCheckout: false
  });

  useEffect(() => {
    if (currentPage === 'settings' && companyId) {
      fetchCalculationSettings();
      fetchAutoCheckoutSettings();
      fetchSystemSettings();
      fetchApplicationSettings();
      checkNativePushStatus();
      checkLocationPermissionStatus();
    }
  }, [currentPage, companyId]);

  async function checkNativePushStatus() {
    try {
      setCheckingPushStatus(true);
      const status = await checkNativePushPermission();
      setNativePushEnabled(status.status === 'granted');
      setPushPermissionStatus(status.status);
    } catch (error) {
      console.error('Error checking push status:', error);
      setPushPermissionStatus('unsupported');
    } finally {
      setCheckingPushStatus(false);
    }
  }

  async function checkLocationPermissionStatus() {
    if (!Capacitor.isNativePlatform()) {
      if ('geolocation' in navigator && 'permissions' in navigator) {
        try {
          const result = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
          setLocationPermissionStatus(result.state as 'granted' | 'denied' | 'prompt');
          return;
        } catch (error) {
          console.error('Error checking web location permission:', error);
        }
      }
      setLocationPermissionStatus('unsupported');
      return;
    }

    try {
      const permission = await Geolocation.checkPermissions();
      if (permission.location === 'granted') {
        setLocationPermissionStatus('granted');
      } else if (permission.location === 'denied') {
        setLocationPermissionStatus('denied');
      } else {
        setLocationPermissionStatus('prompt');
      }
    } catch (error) {
      console.error('Error checking location permission:', error);
      setLocationPermissionStatus('unsupported');
    }
  }

  async function requestLocationPermission() {
    if (!Capacitor.isNativePlatform()) {
      try {
        await navigator.geolocation.getCurrentPosition(() => { }, () => { });
        await checkLocationPermissionStatus();
      } catch (error) {
        console.error('Error requesting location permission:', error);
      }
      return;
    }

    try {
      const permission = await Geolocation.requestPermissions();
      setLocationPermissionStatus(
        permission.location === 'granted' ? 'granted' :
          permission.location === 'denied' ? 'denied' : 'prompt'
      );
    } catch (error) {
      console.error('Error requesting location permission:', error);
    }
  }

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  async function fetchCalculationSettings() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('attendance_calculation_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setCalculationSettings(data);
      } else {
        setCalculationSettings({
          id: '',
          weekly_off_days: []
        });
      }
    } catch (error: any) {
      console.error('Error fetching calculation settings:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchAutoCheckoutSettings() {
    if (!companyId) {
      console.log('No companyId available, skipping auto checkout settings fetch');
      return;
    }

    try {
      const { data: ensureData, error: ensureError } = await supabase
        .rpc('ensure_auto_checkout_settings', { p_company_id: companyId });

      if (ensureError) {
        console.error('Error ensuring auto-checkout settings:', ensureError);
      } else if (ensureData?.created) {
        console.log('[AUTO_CHECKOUT] Created default settings for company:', companyId);
      }

      const { data, error } = await supabase
        .from('auto_checkout_settings')
        .select('*')
        .eq('company_id', companyId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching auto-checkout settings:', error);
        throw error;
      }

      if (data) {
        setAutoCheckoutSettings(data);
      } else {
        setAutoCheckoutSettings({
          id: 1,
          auto_checkout_enabled: true,
          auto_checkout_after_seconds: 900,
          verify_outside_with_n_readings: 3,
          watch_interval_seconds: 15,
          max_location_accuracy_meters: 80
        });
      }
    } catch (error: any) {
      console.error('Error fetching auto-checkout settings:', error);
    }
  }

  async function fetchSystemSettings() {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', ['timezone_mode', 'fixed_timezone']);

      if (error) throw error;

      const settings: SystemSettings = {
        timezone_mode: 'auto_gps',
        fixed_timezone: 'Asia/Riyadh'
      };

      if (data) {
        data.forEach((setting: any) => {
          if (setting.key === 'timezone_mode') {
            settings.timezone_mode = setting.value as 'auto_gps' | 'fixed';
          } else if (setting.key === 'fixed_timezone') {
            settings.fixed_timezone = setting.value as string;
          }
        });
      }

      setSystemSettings(settings);
    } catch (error: any) {
      console.error('Error fetching system settings:', error);
    }
  }

  async function fetchApplicationSettings() {
    try {
      const { data, error } = await supabase
        .from('application_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setApplicationSettings(data);
      } else {
        setApplicationSettings({
          id: '',
          max_gps_accuracy_meters: 50,
          gps_warning_threshold_meters: 30,
          require_high_accuracy: true,
          enable_fake_gps_detection: true,
          grace_period_minutes: 15,
          early_check_in_allowed_minutes: 30,
          require_checkout: true,
          block_duplicate_check_ins: false,
          detect_rooted_devices: true,
          detect_fake_gps: true,
          detect_time_manipulation: true,
          block_suspicious_devices: false,
          max_distance_jump_meters: 1000,
          default_language: 'ar',
          date_format: 'DD/MM/YYYY',
          currency: 'ريال'
        });
      }
    } catch (error: any) {
      console.error('Error fetching application settings:', error);
    }
  }

  async function handleSaveGeneralSettings() {
    if (!applicationSettings || !systemSettings) return;

    try {
      setSavingStates(prev => ({ ...prev, general: true }));

      if (applicationSettings.id) {
        const { error } = await supabase
          .from('application_settings')
          .update({
            default_language: applicationSettings.default_language,
            date_format: applicationSettings.date_format,
            currency: applicationSettings.currency,
            updated_at: new Date().toISOString()
          })
          .eq('id', applicationSettings.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('application_settings')
          .insert({
            default_language: applicationSettings.default_language,
            date_format: applicationSettings.date_format,
            currency: applicationSettings.currency
          })
          .select()
          .single();

        if (error) throw error;
        if (data) setApplicationSettings({ ...applicationSettings, id: data.id });
      }

      const updates = [
        { key: 'timezone_mode', value: JSON.stringify(systemSettings.timezone_mode) },
        { key: 'fixed_timezone', value: JSON.stringify(systemSettings.fixed_timezone) }
      ];

      for (const update of updates) {
        const { error } = await supabase
          .from('system_settings')
          .update({ value: update.value })
          .eq('key', update.key);

        if (error) throw error;
      }

      if (applicationSettings.default_language !== language) {
        setLanguage(applicationSettings.default_language as 'ar' | 'en');
      }

      alert('✓ تم حفظ الإعدادات العامة بنجاح');
    } catch (error: any) {
      console.error('Error saving general settings:', error);
      alert('خطأ: ' + error.message);
    } finally {
      setSavingStates(prev => ({ ...prev, general: false }));
    }
  }

  async function handleSaveAttendanceSettings() {
    if (!applicationSettings || !calculationSettings) return;

    try {
      setSavingStates(prev => ({ ...prev, attendance: true }));

      if (applicationSettings.id) {
        const { error } = await supabase
          .from('application_settings')
          .update({
            grace_period_minutes: applicationSettings.grace_period_minutes,
            early_check_in_allowed_minutes: applicationSettings.early_check_in_allowed_minutes,
            require_checkout: applicationSettings.require_checkout,
            block_duplicate_check_ins: applicationSettings.block_duplicate_check_ins,
            updated_at: new Date().toISOString()
          })
          .eq('id', applicationSettings.id);

        if (error) throw error;
      }

      if (calculationSettings.id) {
        const { error } = await supabase
          .from('attendance_calculation_settings')
          .update({
            weekly_off_days: calculationSettings.weekly_off_days,
            updated_at: new Date().toISOString()
          })
          .eq('id', calculationSettings.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('attendance_calculation_settings')
          .insert({
            weekly_off_days: calculationSettings.weekly_off_days
          })
          .select()
          .single();

        if (error) throw error;
        if (data) setCalculationSettings(data);
      }

      alert('✓ تم حفظ قواعد الحضور بنجاح');
    } catch (error: any) {
      console.error('Error saving attendance settings:', error);
      alert('خطأ: ' + error.message);
    } finally {
      setSavingStates(prev => ({ ...prev, attendance: false }));
    }
  }

  async function handleSaveGPSSettings() {
    if (!applicationSettings) return;

    try {
      setSavingStates(prev => ({ ...prev, gps: true }));

      if (applicationSettings.id) {
        const { error } = await supabase
          .from('application_settings')
          .update({
            max_gps_accuracy_meters: applicationSettings.max_gps_accuracy_meters,
            gps_warning_threshold_meters: applicationSettings.gps_warning_threshold_meters,
            require_high_accuracy: applicationSettings.require_high_accuracy,
            enable_fake_gps_detection: applicationSettings.enable_fake_gps_detection,
            updated_at: new Date().toISOString()
          })
          .eq('id', applicationSettings.id);

        if (error) throw error;
      }

      alert('✓ تم حفظ إعدادات GPS بنجاح');
    } catch (error: any) {
      console.error('Error saving GPS settings:', error);
      alert('خطأ: ' + error.message);
    } finally {
      setSavingStates(prev => ({ ...prev, gps: false }));
    }
  }

  async function handleSaveSecuritySettings() {
    if (!applicationSettings) return;

    try {
      setSavingStates(prev => ({ ...prev, security: true }));

      if (applicationSettings.id) {
        const { error } = await supabase
          .from('application_settings')
          .update({
            detect_rooted_devices: applicationSettings.detect_rooted_devices,
            detect_fake_gps: applicationSettings.detect_fake_gps,
            detect_time_manipulation: applicationSettings.detect_time_manipulation,
            block_suspicious_devices: applicationSettings.block_suspicious_devices,
            max_distance_jump_meters: applicationSettings.max_distance_jump_meters,
            updated_at: new Date().toISOString()
          })
          .eq('id', applicationSettings.id);

        if (error) throw error;
      }

      alert('✓ تم حفظ إعدادات الأمان بنجاح');
    } catch (error: any) {
      console.error('Error saving security settings:', error);
      alert('خطأ: ' + error.message);
    } finally {
      setSavingStates(prev => ({ ...prev, security: false }));
    }
  }

  async function handleSaveAutoCheckoutSettings() {
    if (!autoCheckoutSettings || !companyId) {
      if (!companyId) {
        alert('خطأ: لا يمكن تحديد معرف الشركة');
      }
      return;
    }

    const validSeconds = Math.max(60, autoCheckoutSettings.auto_checkout_after_seconds);

    try {
      setSavingStates(prev => ({ ...prev, autoCheckout: true }));

      const { data, error } = await supabase
        .from('auto_checkout_settings')
        .upsert({
          company_id: companyId,
          auto_checkout_enabled: autoCheckoutSettings.auto_checkout_enabled,
          auto_checkout_after_seconds: validSeconds,
          verify_outside_with_n_readings: autoCheckoutSettings.verify_outside_with_n_readings,
          watch_interval_seconds: autoCheckoutSettings.watch_interval_seconds,
          max_location_accuracy_meters: autoCheckoutSettings.max_location_accuracy_meters,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'company_id'
        })
        .select()
        .single();

      if (error) throw error;
      if (data) setAutoCheckoutSettings(data);

      alert('✓ تم حفظ إعدادات الانصراف التلقائي بنجاح');
    } catch (error: any) {
      console.error('Error saving auto-checkout settings:', error);
      alert('خطأ: ' + error.message);
    } finally {
      setSavingStates(prev => ({ ...prev, autoCheckout: false }));
    }
  }

  async function handleEnableNativePush() {
    if (!user?.id) return;

    try {
      setEnablingNativePush(true);
      const success = await requestNativePushPermission(user.id, 'admin');

      if (success) {
        setNativePushEnabled(true);
        setTestPushResult('✓ تم تفعيل الإشعارات بنجاح!');
        setTimeout(() => setTestPushResult(null), 3000);
      } else {
        setTestPushResult('✗ تم رفض الإذن أو حدث خطأ');
        setTimeout(() => setTestPushResult(null), 5000);
      }
    } catch (error: any) {
      console.error('Error enabling native push:', error);
      setTestPushResult('✗ خطأ: ' + error.message);
      setTimeout(() => setTestPushResult(null), 5000);
    } finally {
      setEnablingNativePush(false);
    }
  }

  async function handleCreateTestDevice() {
    if (!user?.id || !companyId) return;

    try {
      setCreatingTestDevice(true);
      setTestPushResult(null);

      const { error } = await supabase
        .from('push_devices')
        .upsert({
          user_id: user.id,
          role: 'admin',
          company_id: companyId,
          platform: 'web',
          token: 'DUMMY_TOKEN_' + Date.now(),
          enabled: true
        }, {
          onConflict: 'user_id,role,platform'
        });

      if (error) throw error;

      setTestPushResult('✓ تم إنشاء جهاز اختبار وهمي بنجاح! يمكنك الآن اختبار Dry-Run');
      setTimeout(() => setTestPushResult(null), 5000);
    } catch (error: any) {
      console.error('Error creating test device:', error);
      setTestPushResult('✗ خطأ في إنشاء جهاز الاختبار: ' + error.message);
      setTimeout(() => setTestPushResult(null), 5000);
    } finally {
      setCreatingTestDevice(false);
    }
  }

  async function handleSendTestPush() {
    if (!user?.id || !companyId) return;

    try {
      setSendingTestPush(true);
      setTestPushResult(null);

      const result = await sendTestPushNotification(user.id);

      if (result.success) {
        if (result.dryRun) {
          setTestPushResult(`✓ Dry-Run: وُجد ${result.devicesFound || 0} جهاز في قاعدة البيانات للشركة ${companyId}`);
        } else {
          setTestPushResult('✓ ' + result.message);
        }
      } else {
        setTestPushResult('✗ ' + result.message);
      }

      setTimeout(() => setTestPushResult(null), 8000);
    } catch (error: any) {
      console.error('Error sending test push:', error);
      setTestPushResult('✗ خطأ: ' + error.message);
      setTimeout(() => setTestPushResult(null), 5000);
    } finally {
      setSendingTestPush(false);
    }
  }

  async function handleRunQATests() {
    if (!user?.id || !companyId) return;

    try {
      setRunningTests(true);
      setTestResults([]);
      setShowTestReport(false);

      const qa = new SettingsQA(companyId, user.id);
      const results = await qa.runAllTests();

      setTestResults(results);
      setShowTestReport(true);

      const report = qa.generateReport();
      console.log(report);
    } catch (error: any) {
      console.error('Error running QA tests:', error);
      alert('Error running tests: ' + error.message);
    } finally {
      setRunningTests(false);
    }
  }

  if (currentPage !== 'settings') return null;

  return (
    <AdminPageLayout>
      <AdminPageHeader
        title={t('settings.title')}
        subtitle={t('settings.subtitle')}
        actions={
          <button
            onClick={() => setShowSelfTest(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Wrench className="w-5 h-5" />
            <span>اختبار وإصلاح النظام</span>
          </button>
        }
      />

      <SystemSelfTestModal
        isOpen={showSelfTest}
        onClose={() => setShowSelfTest(false)}
        companyId={companyId || ''}
      />

      <div className="space-y-4">
        <CollapsibleSection
          title="الإعدادات العامة"
          icon={<Globe size={20} />}
          iconBg="bg-slate-100"
          iconColor="text-slate-600"
          isOpen={openSections.general}
          onToggle={() => toggleSection('general')}
        >
          {applicationSettings && systemSettings ? (
            <div className="space-y-6 mt-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    اللغة الافتراضية
                  </label>
                  <select
                    value={applicationSettings.default_language}
                    onChange={(e) => setApplicationSettings({
                      ...applicationSettings,
                      default_language: e.target.value
                    })}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none"
                  >
                    <option value="ar">العربية</option>
                    <option value="en">English</option>
                  </select>
                  <p className="text-xs text-slate-500 mt-1">
                    اللغة الافتراضية لواجهة التطبيق
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    وضع المنطقة الزمنية
                  </label>
                  <select
                    value={systemSettings.timezone_mode}
                    onChange={(e) => setSystemSettings({
                      ...systemSettings,
                      timezone_mode: e.target.value as 'auto_gps' | 'fixed'
                    })}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none"
                  >
                    <option value="auto_gps">تلقائي (GPS) - تحديد حسب الموقع</option>
                    <option value="fixed">ثابت - منطقة زمنية محددة</option>
                  </select>
                  <p className="text-xs text-slate-500 mt-1">
                    {systemSettings.timezone_mode === 'auto_gps'
                      ? 'يتم تحديد المنطقة الزمنية تلقائياً من إحداثيات GPS'
                      : 'استخدام منطقة زمنية ثابتة واحدة للنظام بأكمله'}
                  </p>
                </div>

                {systemSettings.timezone_mode === 'fixed' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      المنطقة الزمنية الثابتة
                    </label>
                    <select
                      value={systemSettings.fixed_timezone}
                      onChange={(e) => setSystemSettings({
                        ...systemSettings,
                        fixed_timezone: e.target.value
                      })}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none"
                    >
                      <option value="Asia/Riyadh">Asia/Riyadh (GMT+3)</option>
                      <option value="Asia/Dubai">Asia/Dubai (GMT+4)</option>
                      <option value="Asia/Kuwait">Asia/Kuwait (GMT+3)</option>
                      <option value="Asia/Bahrain">Asia/Bahrain (GMT+3)</option>
                      <option value="Asia/Qatar">Asia/Qatar (GMT+3)</option>
                      <option value="Asia/Muscat">Asia/Muscat (GMT+4)</option>
                      <option value="Africa/Cairo">Africa/Cairo (GMT+2)</option>
                      <option value="Europe/Istanbul">Europe/Istanbul (GMT+3)</option>
                      <option value="UTC">UTC (GMT+0)</option>
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    صيغة التاريخ والوقت
                  </label>
                  <select
                    value={applicationSettings.date_format}
                    onChange={(e) => setApplicationSettings({
                      ...applicationSettings,
                      date_format: e.target.value
                    })}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none"
                  >
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  </select>
                  <p className="text-xs text-slate-500 mt-1">
                    صيغة عرض التاريخ في جميع أنحاء التطبيق
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    العملة
                  </label>
                  <input
                    type="text"
                    value={applicationSettings.currency}
                    onChange={(e) => setApplicationSettings({
                      ...applicationSettings,
                      currency: e.target.value
                    })}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none"
                    placeholder="مثال: ريال، دولار، جنيه"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    رمز أو اسم العملة المستخدم في كشوف الرواتب
                  </p>
                </div>
              </div>

              <button
                onClick={handleSaveGeneralSettings}
                disabled={savingStates.general}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-slate-600 hover:bg-slate-700 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save size={18} />
                <span>{savingStates.general ? 'جاري الحفظ...' : 'حفظ الإعدادات العامة'}</span>
              </button>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">جاري التحميل...</div>
          )}
        </CollapsibleSection>

        <CollapsibleSection
          title="قواعد الحضور والانصراف"
          icon={<Clock size={20} />}
          iconBg="bg-orange-100"
          iconColor="text-orange-600"
          isOpen={openSections.attendance}
          onToggle={() => toggleSection('attendance')}
        >
          {applicationSettings && calculationSettings ? (
            <div className="space-y-6 mt-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    فترة السماح (Grace Period)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="60"
                    value={applicationSettings.grace_period_minutes}
                    onChange={(e) => setApplicationSettings({
                      ...applicationSettings,
                      grace_period_minutes: Math.min(60, Math.max(0, parseInt(e.target.value) || 15))
                    })}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    فترة السماح قبل احتساب التأخير (بالدقائق) - الافتراضي: 15
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    السماح بالحضور المبكر
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="120"
                    value={applicationSettings.early_check_in_allowed_minutes}
                    onChange={(e) => setApplicationSettings({
                      ...applicationSettings,
                      early_check_in_allowed_minutes: Math.min(120, Math.max(0, parseInt(e.target.value) || 30))
                    })}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    السماح بتسجيل الحضور المبكر قبل الموعد (بالدقائق) - الافتراضي: 30
                  </p>
                </div>

                <label className="flex items-center gap-2 cursor-pointer p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={applicationSettings.require_checkout}
                    onChange={(e) => setApplicationSettings({
                      ...applicationSettings,
                      require_checkout: e.target.checked
                    })}
                    className="w-4 h-4 text-orange-600 rounded"
                  />
                  <span className="text-sm text-slate-700 font-medium">إلزام الموظفين بتسجيل الانصراف</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={applicationSettings.block_duplicate_check_ins}
                    onChange={(e) => setApplicationSettings({
                      ...applicationSettings,
                      block_duplicate_check_ins: e.target.checked
                    })}
                    className="w-4 h-4 text-orange-600 rounded"
                  />
                  <span className="text-sm text-slate-700 font-medium">منع تسجيل الحضور المتعدد في نفس اليوم</span>
                </label>

                <div className="border-t border-slate-200 pt-4">
                  <h3 className="text-sm font-bold text-slate-700 mb-3">الإجازة الأسبوعية الثابتة</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: 5, label: 'الجمعة' },
                      { value: 6, label: 'السبت' },
                      { value: 0, label: 'الأحد' },
                      { value: 1, label: 'الإثنين' },
                      { value: 2, label: 'الثلاثاء' },
                      { value: 3, label: 'الأربعاء' },
                      { value: 4, label: 'الخميس' }
                    ].map((day) => (
                      <label key={day.value} className="flex items-center gap-2 cursor-pointer p-2 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                        <input
                          type="checkbox"
                          checked={calculationSettings.weekly_off_days.includes(day.value)}
                          onChange={(e) => {
                            const newDays = e.target.checked
                              ? [...calculationSettings.weekly_off_days, day.value]
                              : calculationSettings.weekly_off_days.filter(d => d !== day.value);
                            setCalculationSettings({
                              ...calculationSettings,
                              weekly_off_days: newDays
                            });
                          }}
                          className="w-4 h-4 text-orange-600 rounded"
                        />
                        <span className="text-sm text-slate-700">{day.label}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    سيتم خصم عدد مرات حدوث هذه الأيام تلقائياً من كل شهر في حساب الرواتب
                  </p>
                </div>

                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <h3 className="text-sm font-bold text-orange-900 mb-2">صيغة الحساب</h3>
                  <div className="text-xs text-orange-700 space-y-1">
                    <p>أيام العمل = أيام الشهر - أيام الإجازة الأسبوعية - إجازات الموظف</p>
                    <p>متوسط ساعات العمل اليومية = إجمالي ساعات العمل ÷ أيام العمل</p>
                  </div>
                </div>
              </div>

              <button
                onClick={handleSaveAttendanceSettings}
                disabled={savingStates.attendance}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save size={18} />
                <span>{savingStates.attendance ? 'جاري الحفظ...' : 'حفظ قواعد الحضور'}</span>
              </button>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">جاري التحميل...</div>
          )}
        </CollapsibleSection>

        <CollapsibleSection
          title="إعدادات GPS والموقع"
          icon={<MapPin size={20} />}
          iconBg="bg-blue-100"
          iconColor="text-blue-600"
          isOpen={openSections.gps}
          onToggle={() => toggleSection('gps')}
        >
          {applicationSettings ? (
            <div className="space-y-6 mt-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    الحد الأقصى لدقة GPS المقبولة (بالأمتار)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={applicationSettings.max_gps_accuracy_meters}
                    onChange={(e) => setApplicationSettings({
                      ...applicationSettings,
                      max_gps_accuracy_meters: Math.min(500, Math.max(1, parseInt(e.target.value) || 50))
                    })}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    الحد الأقصى لدقة GPS المقبولة - الافتراضي: 50 متر
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    حد التحذير من ضعف الدقة (بالأمتار)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="200"
                    value={applicationSettings.gps_warning_threshold_meters}
                    onChange={(e) => setApplicationSettings({
                      ...applicationSettings,
                      gps_warning_threshold_meters: Math.min(200, Math.max(1, parseInt(e.target.value) || 30))
                    })}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    حد التحذير عند ضعف الدقة - الافتراضي: 30 متر
                  </p>
                </div>

                <label className="flex items-center gap-2 cursor-pointer p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={applicationSettings.require_high_accuracy}
                    onChange={(e) => setApplicationSettings({
                      ...applicationSettings,
                      require_high_accuracy: e.target.checked
                    })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm text-slate-700 font-medium">إلزام بدقة GPS عالية</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={applicationSettings.enable_fake_gps_detection}
                    onChange={(e) => setApplicationSettings({
                      ...applicationSettings,
                      enable_fake_gps_detection: e.target.checked
                    })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm text-slate-700 font-medium">تفعيل كشف GPS الوهمي</span>
                </label>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="text-sm font-bold text-blue-900 mb-2">ملاحظة</h3>
                  <p className="text-xs text-blue-700">
                    يتم التحقق من نطاق الفرع (Branch Range) في صفحة الفروع لكل فرع على حدة.
                    هذه الإعدادات تتحكم في دقة GPS فقط.
                  </p>
                </div>
              </div>

              <button
                onClick={handleSaveGPSSettings}
                disabled={savingStates.gps}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save size={18} />
                <span>{savingStates.gps ? 'جاري الحفظ...' : 'حفظ إعدادات GPS'}</span>
              </button>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">جاري التحميل...</div>
          )}
        </CollapsibleSection>

        <CollapsibleSection
          title="الأمان وكشف الاحتيال"
          icon={<Shield size={20} />}
          iconBg="bg-red-100"
          iconColor="text-red-600"
          isOpen={openSections.security}
          onToggle={() => toggleSection('security')}
        >
          {applicationSettings ? (
            <div className="space-y-6 mt-4">
              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={applicationSettings.detect_fake_gps}
                    onChange={(e) => setApplicationSettings({
                      ...applicationSettings,
                      detect_fake_gps: e.target.checked
                    })}
                    className="w-4 h-4 text-red-600 rounded"
                  />
                  <span className="text-sm text-slate-700 font-medium">كشف GPS الوهمي (Fake GPS)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={applicationSettings.detect_rooted_devices}
                    onChange={(e) => setApplicationSettings({
                      ...applicationSettings,
                      detect_rooted_devices: e.target.checked
                    })}
                    className="w-4 h-4 text-red-600 rounded"
                  />
                  <span className="text-sm text-slate-700 font-medium">كشف الأجهزة المعدلة (Root/Jailbreak)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={applicationSettings.detect_time_manipulation}
                    onChange={(e) => setApplicationSettings({
                      ...applicationSettings,
                      detect_time_manipulation: e.target.checked
                    })}
                    className="w-4 h-4 text-red-600 rounded"
                  />
                  <span className="text-sm text-slate-700 font-medium">كشف التلاعب بالوقت (Time Tampering)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={applicationSettings.block_suspicious_devices}
                    onChange={(e) => setApplicationSettings({
                      ...applicationSettings,
                      block_suspicious_devices: e.target.checked
                    })}
                    className="w-4 h-4 text-red-600 rounded"
                  />
                  <span className="text-sm text-slate-700 font-medium">حظر الأجهزة المشبوهة تلقائياً</span>
                </label>

                <div className="border-t border-slate-200 pt-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    الحد الأقصى للمسافة بين القراءات المتتالية (بالأمتار)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    value={applicationSettings.max_distance_jump_meters}
                    onChange={(e) => setApplicationSettings({
                      ...applicationSettings,
                      max_distance_jump_meters: Math.min(10000, Math.max(1, parseInt(e.target.value) || 1000))
                    })}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    الحد الأقصى للمسافة المقبولة بين موقعين متتاليين - الافتراضي: 1000 متر
                  </p>
                </div>

                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h3 className="text-sm font-bold text-red-900 mb-2">عند اكتشاف احتيال</h3>
                  <p className="text-xs text-red-700">
                    يتم تسجيل التنبيه في صفحة تنبيهات الاحتيال (Fraud Alerts).
                    الإجراء يعتمد على إعداد "حظر الأجهزة المشبوهة" أعلاه.
                  </p>
                </div>
              </div>

              <button
                onClick={handleSaveSecuritySettings}
                disabled={savingStates.security}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save size={18} />
                <span>{savingStates.security ? 'جاري الحفظ...' : 'حفظ إعدادات الأمان'}</span>
              </button>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">جاري التحميل...</div>
          )}
        </CollapsibleSection>

        <CollapsibleSection
          title="الانصراف التلقائي (Auto Checkout)"
          icon={<Power size={20} />}
          iconBg="bg-green-100"
          iconColor="text-green-600"
          isOpen={openSections.autoCheckout}
          onToggle={() => toggleSection('autoCheckout')}
        >
          {autoCheckoutSettings ? (
            <div className="space-y-6 mt-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Wifi className="text-green-600 mt-0.5 flex-shrink-0" size={18} />
                  <div className="text-xs text-green-700">
                    <p className="font-semibold mb-1">آلية الانصراف التلقائي</p>
                    <p className="mb-1">يعمل فقط أثناء CHECKED_IN ويراقب حالتين:</p>
                    <ul className="list-disc mr-4 space-y-0.5">
                      <li><strong>GPS مغلق:</strong> GPS = OFF أو Permission = denied</li>
                      <li><strong>خارج النطاق:</strong> خروج من نطاق الفرع (3 قراءات متتالية)</li>
                    </ul>
                    <p className="mt-2">✓ عند تحقق الحالة: عد تنازلي مرئي (15 دقيقة)</p>
                    <p>✓ عودة الموقع/الدخول للنطاق: إلغاء فوري</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <label className="text-sm font-medium text-slate-700">
                    تفعيل الانصراف التلقائي
                  </label>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoCheckoutSettings.auto_checkout_enabled}
                      onChange={(e) => setAutoCheckoutSettings({
                        ...autoCheckoutSettings,
                        auto_checkout_enabled: e.target.checked
                      })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                  </label>
                </div>

                {autoCheckoutSettings.auto_checkout_enabled && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        مدة العد التنازلي
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          value={Math.floor(autoCheckoutSettings.auto_checkout_after_seconds / 60) || ''}
                          onChange={(e) => {
                            const minutes = e.target.value === '' ? '' : parseInt(e.target.value);
                            const seconds = minutes === '' ? 60 : (minutes * 60);
                            setAutoCheckoutSettings({
                              ...autoCheckoutSettings,
                              auto_checkout_after_seconds: seconds
                            });
                          }}
                          onBlur={(e) => {
                            const minutes = parseInt(e.target.value) || 1;
                            const validMinutes = Math.max(1, minutes);
                            setAutoCheckoutSettings({
                              ...autoCheckoutSettings,
                              auto_checkout_after_seconds: validMinutes * 60
                            });
                          }}
                          className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                          placeholder="15"
                        />
                        <span className="text-sm text-slate-600 min-w-[50px]">
                          دقيقة
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        الافتراضي: 15 دقيقة
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        فترة المراقبة (بالثواني)
                      </label>
                      <input
                        type="number"
                        min="5"
                        max="60"
                        value={autoCheckoutSettings.watch_interval_seconds}
                        onChange={(e) => setAutoCheckoutSettings({
                          ...autoCheckoutSettings,
                          watch_interval_seconds: Math.min(60, Math.max(5, parseInt(e.target.value) || 15))
                        })}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        كم مرة يتحقق النظام من الموقع - الافتراضي: 15 ثانية
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        عدد القراءات للتأكد من الخروج
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={autoCheckoutSettings.verify_outside_with_n_readings}
                        onChange={(e) => setAutoCheckoutSettings({
                          ...autoCheckoutSettings,
                          verify_outside_with_n_readings: Math.min(10, Math.max(1, parseInt(e.target.value) || 3))
                        })}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        الافتراضي: 3 قراءات متتالية خارج النطاق
                      </p>
                    </div>

                    <details className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                      <summary className="text-sm font-bold text-slate-700 cursor-pointer">
                        إعدادات متقدمة
                      </summary>
                      <div className="mt-4">
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          الحد الأقصى لدقة الموقع المقبولة (بالأمتار)
                        </label>
                        <input
                          type="number"
                          min="20"
                          max="200"
                          value={autoCheckoutSettings.max_location_accuracy_meters}
                          onChange={(e) => setAutoCheckoutSettings({
                            ...autoCheckoutSettings,
                            max_location_accuracy_meters: Math.min(200, Math.max(20, parseInt(e.target.value) || 80))
                          })}
                          className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                          الافتراضي: 80 متر - يتم تجاهل القراءات الأسوأ من هذه الدقة
                        </p>
                      </div>
                    </details>
                  </>
                )}
              </div>

              <button
                onClick={handleSaveAutoCheckoutSettings}
                disabled={savingStates.autoCheckout}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save size={18} />
                <span>{savingStates.autoCheckout ? 'جاري الحفظ...' : 'حفظ إعدادات الانصراف التلقائي'}</span>
              </button>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">جاري التحميل...</div>
          )}
        </CollapsibleSection>

        <CollapsibleSection
          title="الإشعارات (Notifications)"
          icon={<Bell size={20} />}
          iconBg="bg-violet-100"
          iconColor="text-violet-600"
          isOpen={openSections.notifications}
          onToggle={() => toggleSection('notifications')}
        >
          <div className="space-y-6 mt-4">
            <div className="bg-violet-50 border border-violet-200 rounded-lg p-4">
              <h3 className="font-medium text-violet-900 mb-2">متى يتم إرسال الإشعارات؟</h3>
              <ul className="text-sm text-violet-800 space-y-1">
                <li>• طلب إجازة جديد من موظف</li>
                <li>• الموافقة أو رفض طلب إجازة</li>
                <li>• تأخير أو غياب موظف</li>
                <li>• تنبيهات الاحتيال (GPS وهمي، تغيير جهاز)</li>
                <li>• خصومات من الراتب</li>
              </ul>
            </div>

            {/* Permission Status Badges */}
            <div className="border-t border-violet-100 pt-6">
              <div className="flex items-center gap-3 mb-4">
                <Shield size={20} className="text-violet-600" />
                <h3 className="font-semibold text-slate-800">حالة الأذونات</h3>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2">
                <PermissionBadge
                  status={pushPermissionStatus}
                  label="إذن الإشعارات"
                  onRequest={pushPermissionStatus === 'prompt' ? handleEnableNativePush : undefined}
                />
                <PermissionBadge
                  status={locationPermissionStatus}
                  label="إذن الموقع"
                  onRequest={locationPermissionStatus === 'prompt' ? requestLocationPermission : undefined}
                />
              </div>

              <p className="text-xs text-slate-500 mt-2">
                {Capacitor.isNativePlatform()
                  ? 'أذونات الهاتف المحمول (Android/iOS)'
                  : 'أذونات المتصفح (Web Platform)'}
              </p>
            </div>

            {/* Native Mobile Push Notifications */}
            <div className="border-t border-violet-100 pt-6">
              <div className="flex items-center gap-3 mb-4">
                <Smartphone size={20} className="text-violet-600" />
                <h3 className="font-semibold text-slate-800">إشعارات الهاتف المحمول</h3>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-blue-800">
                  {nativePushEnabled
                    ? '✓ الإشعارات مفعّلة على هذا الجهاز'
                    : 'قم بتفعيل الإشعارات للحصول على تنبيهات فورية على Android و iOS'}
                </p>
              </div>

              {!nativePushEnabled && !checkingPushStatus && pushPermissionStatus === 'prompt' && (
                <button
                  onClick={handleEnableNativePush}
                  disabled={enablingNativePush}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed mb-4"
                >
                  <Smartphone size={18} />
                  <span>{enablingNativePush ? 'جاري التفعيل...' : 'تفعيل الإشعارات'}</span>
                </button>
              )}
            </div>

            {/* Dev Mode: Create Test Device */}
            {!Capacitor.isNativePlatform() && (
              <div className="border-t border-violet-100 pt-6">
                <div className="flex items-center gap-3 mb-4">
                  <Wrench size={20} className="text-amber-600" />
                  <h3 className="font-semibold text-slate-800">وضع التطوير (Dev Mode)</h3>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-amber-800 mb-2">
                    <strong>Create Test Device:</strong> إنشاء جهاز وهمي في قاعدة البيانات للتحقق من مسار Edge Function
                  </p>
                  <p className="text-xs text-amber-700">
                    ℹ️ سيتم إضافة سجل بـ token وهمي إلى push_devices للشركة الحالية
                  </p>
                </div>

                <button
                  onClick={handleCreateTestDevice}
                  disabled={creatingTestDevice}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Wrench size={18} />
                  <span>{creatingTestDevice ? 'جاري الإنشاء...' : 'إنشاء جهاز اختبار'}</span>
                </button>
              </div>
            )}

            {/* Test Notification */}
            <div className="border-t border-violet-100 pt-6">
              <div className="flex items-center gap-3 mb-4">
                <Send size={20} className="text-violet-600" />
                <h3 className="font-semibold text-slate-800">اختبار الإشعارات</h3>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-slate-700 mb-2">
                  {Capacitor.isNativePlatform() || nativePushEnabled
                    ? 'سيتم إرسال إشعار حقيقي إلى جهازك'
                    : '🌐 Dry-Run Mode: سيتم التحقق من قاعدة البيانات فقط بدون إرسال فعلي'}
                </p>
                <p className="text-xs text-slate-500">
                  Edge Function سيقوم بالاستعلام عن push_devices وإرجاع النتائج
                </p>
              </div>

              <button
                onClick={handleSendTestPush}
                disabled={sendingTestPush}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send size={18} />
                <span>{sendingTestPush ? 'جاري الإرسال...' : 'إرسال إشعار تجريبي'}</span>
              </button>

              {testPushResult && (
                <div className={`mt-4 p-4 rounded-lg ${testPushResult.startsWith('✓')
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
                  }`}>
                  {testPushResult}
                </div>
              )}
            </div>
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          title="QA Mode (Admin Only)"
          icon={<Wrench size={20} />}
          iconBg="bg-amber-100"
          iconColor="text-amber-600"
          isOpen={openSections.qa}
          onToggle={() => toggleSection('qa')}
        >
          <div className="space-y-6 mt-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h3 className="font-medium text-amber-900 mb-2">Automated Settings Quality Assurance</h3>
              <p className="text-sm text-amber-800 mb-2">
                This tool automatically tests ALL settings to verify:
              </p>
              <ul className="text-sm text-amber-800 space-y-1 mb-3">
                <li>• Database write operations (Save buttons)</li>
                <li>• Value persistence after refresh</li>
                <li>• RLS policies are working correctly</li>
                <li>• No silent failures</li>
                <li>• Dev Mode features (Test Device, Dry-Run Push)</li>
              </ul>
              <p className="text-xs text-amber-700 font-medium">
                ⚠️ Tests will temporarily modify settings and restore them. Check console for detailed logs.
              </p>
            </div>

            <button
              onClick={handleRunQATests}
              disabled={runningTests}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play size={18} />
              <span>{runningTests ? 'Running Tests...' : 'Run All Settings Tests'}</span>
            </button>

            {showTestReport && testResults.length > 0 && (
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="bg-slate-100 px-4 py-3 border-b border-slate-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText size={18} className="text-slate-600" />
                      <h3 className="font-semibold text-slate-800">Test Results</h3>
                    </div>
                    <div className="flex gap-3 text-sm">
                      <span className="text-green-700 font-medium">
                        PASS: {testResults.filter(r => r.status === 'PASS').length}
                      </span>
                      <span className="text-red-700 font-medium">
                        FAIL: {testResults.filter(r => r.status === 'FAIL').length}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="max-h-96 overflow-y-auto">
                  {(() => {
                    const categories = [...new Set(testResults.map(r => r.category))];
                    return categories.map((category) => {
                      const categoryResults = testResults.filter(r => r.category === category);
                      const categoryPassed = categoryResults.filter(r => r.status === 'PASS').length;

                      return (
                        <div key={category} className="border-b border-slate-200 last:border-b-0">
                          <div className="bg-slate-50 px-4 py-2 font-medium text-slate-700 text-sm">
                            {category} ({categoryPassed}/{categoryResults.length} passed)
                          </div>
                          <div className="divide-y divide-slate-100">
                            {categoryResults.map((result, idx) => (
                              <div key={idx} className="px-4 py-3">
                                <div className="flex items-start gap-2">
                                  {result.status === 'PASS' ? (
                                    <CheckCircle size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
                                  ) : (
                                    <XCircle size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium text-slate-800 text-sm">
                                      {result.setting}
                                    </div>
                                    {result.reason && (
                                      <div className="text-xs text-slate-600 mt-1">
                                        Reason: {result.reason}
                                      </div>
                                    )}
                                    {result.fixSuggestion && (
                                      <div className="text-xs text-blue-700 mt-1 bg-blue-50 border border-blue-200 rounded px-2 py-1">
                                        💡 Fix: {result.fixSuggestion}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>

                <div className="bg-slate-100 px-4 py-3 border-t border-slate-200 text-xs text-slate-600">
                  Success Rate: {testResults.length > 0 ? ((testResults.filter(r => r.status === 'PASS').length / testResults.length) * 100).toFixed(1) : 0}%
                  | Full report in browser console
                </div>
              </div>
            )}
          </div>
        </CollapsibleSection>
      </div>
    </AdminPageLayout>
  );
}
