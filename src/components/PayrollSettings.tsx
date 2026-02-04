import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2, Save, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';

interface DeductionSettings {
  id?: string;
  company_id?: string;
  salary_type: 'monthly' | 'daily';
  late_deduction_enabled: boolean;
  early_checkout_deduction_enabled: boolean;
  absence_deduction_enabled: boolean;
  absence_deduction_type: 'full_day' | 'fixed_amount';
  absence_fixed_amount: number;
  count_absence_without_checkin: boolean;
}

interface DeductionRule {
  id?: string;
  from_minutes: number;
  to_minutes: number;
  deduction_type: 'fixed' | 'percent';
  value: number;
}

interface OvertimeSettings {
  id?: string;
  company_id?: string;
  overtime_enabled: boolean;
  calculation_basis: 'shift_based' | 'employee_based';
  rate_type: 'same_rate' | 'multiplier' | 'fixed_amount';
  rate_value: number;
  max_overtime_hours_per_day: number | null;
  ignore_overtime_less_than_minutes: number;
}

interface PayrollSettingsProps {
  currency: string;
  workdaysPerMonth: number;
  insuranceType: 'percentage' | 'fixed';
  insuranceValue: number;
  taxType: 'percentage' | 'fixed';
  taxValue: number;
  onCurrencyChange: (value: string) => void;
  onWorkdaysChange: (value: number) => void;
  onInsuranceTypeChange: (value: 'percentage' | 'fixed') => void;
  onInsuranceValueChange: (value: number) => void;
  onTaxTypeChange: (value: 'percentage' | 'fixed') => void;
  onTaxValueChange: (value: number) => void;
}

export default function PayrollSettings({
  currency,
  workdaysPerMonth,
  insuranceType,
  insuranceValue,
  taxType,
  taxValue,
  onCurrencyChange,
  onWorkdaysChange,
  onInsuranceTypeChange,
  onInsuranceValueChange,
  onTaxTypeChange,
  onTaxValueChange
}: PayrollSettingsProps) {
  const { language } = useLanguage();
  const { companyId } = useAuth();

  const [expandedSections, setExpandedSections] = useState({
    general: true,
    insurance: false,
    late: false,
    earlyCheckout: false,
    absence: false,
    overtime: false,
    delayPermission: false
  });

  const [settings, setSettings] = useState<DeductionSettings>({
    salary_type: 'monthly',
    late_deduction_enabled: false,
    early_checkout_deduction_enabled: false,
    absence_deduction_enabled: false,
    absence_deduction_type: 'full_day',
    absence_fixed_amount: 0,
    count_absence_without_checkin: true
  });

  const [lateRules, setLateRules] = useState<DeductionRule[]>([]);
  const [earlyCheckoutRules, setEarlyCheckoutRules] = useState<DeductionRule[]>([]);

  const [overtimeSettings, setOvertimeSettings] = useState<OvertimeSettings>({
    overtime_enabled: false,
    calculation_basis: 'shift_based',
    rate_type: 'multiplier',
    rate_value: 1.5,
    max_overtime_hours_per_day: null,
    ignore_overtime_less_than_minutes: 0
  });

  const [delayPermissionSettings, setDelayPermissionSettings] = useState({
    enabled: true,
    maxHoursPerDay: 2.0,
    allowMinutes: true
  });

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadSettings();
    loadLateRules();
    loadEarlyCheckoutRules();
    loadOvertimeSettings();
    loadDelayPermissionSettings();
  }, [companyId]);

  async function loadSettings() {
    const { data } = await supabase
      .from('payroll_deduction_settings')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle();

    if (data) {
      setSettings(data);
    }
  }

  async function loadLateRules() {
    const { data } = await supabase
      .from('late_deduction_rules')
      .select('*')
      .eq('company_id', companyId)
      .order('from_minutes');

    if (data) {
      setLateRules(data);
    }
  }

  async function loadEarlyCheckoutRules() {
    const { data } = await supabase
      .from('early_checkout_deduction_rules')
      .select('*')
      .eq('company_id', companyId)
      .order('from_minutes');

    if (data) {
      setEarlyCheckoutRules(data);
    }
  }

  async function loadOvertimeSettings() {
    const { data } = await supabase
      .from('overtime_settings')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle();

    if (data) {
      setOvertimeSettings(data);
    }
  }

  async function loadDelayPermissionSettings() {
    const { data } = await supabase
      .from('payroll_settings')
      .select('delay_permission_enabled, max_delay_hours_per_day, allow_delay_minutes')
      .eq('company_id', companyId)
      .maybeSingle();

    if (data) {
      setDelayPermissionSettings({
        enabled: data.delay_permission_enabled ?? true,
        maxHoursPerDay: data.max_delay_hours_per_day ?? 2.0,
        allowMinutes: data.allow_delay_minutes ?? true
      });
    }
  }

  function toggleSection(section: keyof typeof expandedSections) {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  }

  function addLateRule() {
    setLateRules([...lateRules, { from_minutes: 0, to_minutes: 0, deduction_type: 'fixed', value: 0 }]);
  }

  function removeLateRule(index: number) {
    setLateRules(lateRules.filter((_, i) => i !== index));
  }

  function updateLateRule(index: number, field: keyof DeductionRule, value: any) {
    const updated = [...lateRules];
    updated[index] = { ...updated[index], [field]: value };
    setLateRules(updated);
  }

  function addEarlyCheckoutRule() {
    setEarlyCheckoutRules([...earlyCheckoutRules, { from_minutes: 0, to_minutes: 0, deduction_type: 'fixed', value: 0 }]);
  }

  function removeEarlyCheckoutRule(index: number) {
    setEarlyCheckoutRules(earlyCheckoutRules.filter((_, i) => i !== index));
  }

  function updateEarlyCheckoutRule(index: number, field: keyof DeductionRule, value: any) {
    const updated = [...earlyCheckoutRules];
    updated[index] = { ...updated[index], [field]: value };
    setEarlyCheckoutRules(updated);
  }

  function checkOverlappingRanges(rules: DeductionRule[]): string | null {
    for (let i = 0; i < rules.length; i++) {
      const rule1 = rules[i];

      if (rule1.from_minutes < 0) {
        return language === 'ar'
          ? `القاعدة ${i + 1}: يجب أن تكون "من" أكبر من أو تساوي 0`
          : `Rule ${i + 1}: "From" must be >= 0`;
      }

      if (rule1.to_minutes <= rule1.from_minutes) {
        return language === 'ar'
          ? `القاعدة ${i + 1}: يجب أن تكون "إلى" أكبر من "من"`
          : `Rule ${i + 1}: "To" must be greater than "From"`;
      }

      for (let j = i + 1; j < rules.length; j++) {
        const rule2 = rules[j];

        if (rule1.from_minutes < rule2.to_minutes && rule1.to_minutes > rule2.from_minutes) {
          return language === 'ar'
            ? `تعارض: القاعدتان ${i + 1} و ${j + 1} تتداخلان في النطاق الزمني`
            : `Overlap: Rules ${i + 1} and ${j + 1} have overlapping ranges`;
        }
      }
    }
    return null;
  }

  async function saveSettings() {
    setSaving(true);
    setMessage(null);

    try {
      if (settings.late_deduction_enabled && lateRules.length > 0) {
        const overlapError = checkOverlappingRanges(lateRules);
        if (overlapError) {
          setMessage({
            type: 'error',
            text: language === 'ar' ? `خصم التأخير: ${overlapError}` : `Late Deduction: ${overlapError}`
          });
          setSaving(false);
          return;
        }
      }

      if (settings.early_checkout_deduction_enabled && earlyCheckoutRules.length > 0) {
        const overlapError = checkOverlappingRanges(earlyCheckoutRules);
        if (overlapError) {
          setMessage({
            type: 'error',
            text: language === 'ar' ? `خصم الخروج المبكر: ${overlapError}` : `Early Checkout Deduction: ${overlapError}`
          });
          setSaving(false);
          return;
        }
      }

      const { error: settingsError } = await supabase
        .from('payroll_deduction_settings')
        .upsert({
          company_id: companyId,
          ...settings
        }, { onConflict: 'company_id' });

      if (settingsError) throw settingsError;

      await supabase
        .from('late_deduction_rules')
        .delete()
        .eq('company_id', companyId);

      if (settings.late_deduction_enabled && lateRules.length > 0) {
        const { error: lateError } = await supabase
          .from('late_deduction_rules')
          .insert(lateRules.map(rule => ({
            company_id: companyId,
            from_minutes: rule.from_minutes,
            to_minutes: rule.to_minutes,
            deduction_type: rule.deduction_type,
            value: rule.value
          })));

        if (lateError) throw lateError;
      }

      await supabase
        .from('early_checkout_deduction_rules')
        .delete()
        .eq('company_id', companyId);

      if (settings.early_checkout_deduction_enabled && earlyCheckoutRules.length > 0) {
        const { error: earlyError } = await supabase
          .from('early_checkout_deduction_rules')
          .insert(earlyCheckoutRules.map(rule => ({
            company_id: companyId,
            from_minutes: rule.from_minutes,
            to_minutes: rule.to_minutes,
            deduction_type: rule.deduction_type,
            value: rule.value
          })));

        if (earlyError) throw earlyError;
      }

      // Save overtime settings
      const { error: overtimeError } = await supabase
        .from('overtime_settings')
        .upsert({
          company_id: companyId,
          ...overtimeSettings
        }, { onConflict: 'company_id' });

      if (overtimeError) throw overtimeError;

      const { error: delayPermissionError } = await supabase
        .from('payroll_settings')
        .update({
          delay_permission_enabled: delayPermissionSettings.enabled,
          max_delay_hours_per_day: delayPermissionSettings.maxHoursPerDay,
          allow_delay_minutes: delayPermissionSettings.allowMinutes
        })
        .eq('company_id', companyId);

      if (delayPermissionError) throw delayPermissionError;

      setMessage({
        type: 'success',
        text: language === 'ar' ? 'تم حفظ الإعدادات بنجاح' : 'Settings saved successfully'
      });

      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage({
        type: 'error',
        text: language === 'ar' ? 'فشل حفظ الإعدادات' : 'Failed to save settings'
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {message && (
        <div className={`p-4 rounded-lg flex items-center gap-2 ${
          message.type === 'success'
            ? 'bg-green-50 border border-green-200 text-green-700'
            : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
          ) : (
            <XCircle className="w-5 h-5 flex-shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* General Settings */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection('general')}
          className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <h3 className="font-semibold text-gray-800">
            {language === 'ar' ? 'الإعدادات العامة' : 'General Settings'}
          </h3>
          {expandedSections.general ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>

        {expandedSections.general && (
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {language === 'ar' ? 'العملة' : 'Currency'}
                </label>
                <input
                  type="text"
                  value={currency}
                  onChange={(e) => onCurrencyChange(e.target.value)}
                  placeholder={language === 'ar' ? 'مثال: ريال سعودي' : 'e.g. EGP / SAR / USD'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {language === 'ar' ? 'نوع الراتب' : 'Salary Type'}
                </label>
                <select
                  value={settings.salary_type}
                  onChange={(e) => setSettings({ ...settings, salary_type: e.target.value as 'monthly' | 'daily' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="monthly">{language === 'ar' ? 'شهري' : 'Monthly'}</option>
                  <option value="daily">{language === 'ar' ? 'يومي' : 'Daily'}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {language === 'ar' ? 'أيام العمل في الشهر' : 'Working Days per Month'}
                </label>
                <input
                  type="number"
                  value={workdaysPerMonth}
                  onChange={(e) => onWorkdaysChange(parseInt(e.target.value))}
                  min="1"
                  max="31"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Insurance and Tax Settings */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection('insurance')}
          className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <h3 className="font-semibold text-gray-800">
            {language === 'ar' ? 'الضرائب والتأمينات' : 'Tax and Insurance'}
          </h3>
          {expandedSections.insurance ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>

        {expandedSections.insurance && (
          <div className="p-4 space-y-6">
            {/* Insurance Settings */}
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <h4 className="font-medium text-gray-800 mb-4">
                {language === 'ar' ? 'التأمينات' : 'Insurance'}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {language === 'ar' ? 'نوع التأمينات' : 'Insurance Type'}
                  </label>
                  <select
                    value={insuranceType}
                    onChange={(e) => onInsuranceTypeChange(e.target.value as 'percentage' | 'fixed')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="percentage">{language === 'ar' ? 'نسبة %' : 'Percentage %'}</option>
                    <option value="fixed">{language === 'ar' ? 'مبلغ ثابت' : 'Fixed Amount'}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {insuranceType === 'percentage'
                      ? (language === 'ar' ? 'نسبة التأمينات (%)' : 'Insurance Percentage (%)')
                      : (language === 'ar' ? `مبلغ التأمينات (${currency})` : `Insurance Amount (${currency})`)}
                  </label>
                  <input
                    type="number"
                    value={insuranceValue}
                    onChange={(e) => onInsuranceValueChange(parseFloat(e.target.value) || 0)}
                    min="0"
                    max={insuranceType === 'percentage' ? 100 : undefined}
                    step="0.01"
                    placeholder="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {insuranceType === 'percentage' && (
                    <p className="text-xs text-gray-500 mt-1">
                      {language === 'ar' ? 'أدخل رقم من 0 إلى 100' : 'Enter a number from 0 to 100'}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Tax Settings */}
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <h4 className="font-medium text-gray-800 mb-4">
                {language === 'ar' ? 'الضريبة' : 'Tax'}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {language === 'ar' ? 'نوع الضريبة' : 'Tax Type'}
                  </label>
                  <select
                    value={taxType}
                    onChange={(e) => onTaxTypeChange(e.target.value as 'percentage' | 'fixed')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="percentage">{language === 'ar' ? 'نسبة %' : 'Percentage %'}</option>
                    <option value="fixed">{language === 'ar' ? 'مبلغ ثابت' : 'Fixed Amount'}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {taxType === 'percentage'
                      ? (language === 'ar' ? 'نسبة الضريبة (%)' : 'Tax Percentage (%)')
                      : (language === 'ar' ? `مبلغ الضريبة (${currency})` : `Tax Amount (${currency})`)}
                  </label>
                  <input
                    type="number"
                    value={taxValue}
                    onChange={(e) => onTaxValueChange(parseFloat(e.target.value) || 0)}
                    min="0"
                    max={taxType === 'percentage' ? 100 : undefined}
                    step="0.01"
                    placeholder="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {taxType === 'percentage' && (
                    <p className="text-xs text-gray-500 mt-1">
                      {language === 'ar' ? 'أدخل رقم من 0 إلى 100' : 'Enter a number from 0 to 100'}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                {language === 'ar'
                  ? 'ملاحظة: هذه الإعدادات ستُطبق على جميع الموظفين في الشركة. سيتم حساب التأمينات والضرائب تلقائيًا بناءً على الراتب الأساسي لكل موظف.'
                  : 'Note: These settings will apply to all employees in the company. Insurance and tax will be calculated automatically based on each employee\'s base salary.'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Late Deduction */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection('late')}
          className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <h3 className="font-semibold text-gray-800">
            {language === 'ar' ? 'خصم التأخير' : 'Late Deduction'}
          </h3>
          {expandedSections.late ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>

        {expandedSections.late && (
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="late-enabled"
                checked={settings.late_deduction_enabled}
                onChange={(e) => setSettings({ ...settings, late_deduction_enabled: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="late-enabled" className="text-sm font-medium text-gray-700">
                {language === 'ar' ? 'تفعيل خصم التأخير' : 'Enable Late Deduction'}
              </label>
            </div>

            {settings.late_deduction_enabled && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">
                    {language === 'ar' ? 'قواعد الخصم' : 'Deduction Rules'}
                  </label>
                  <button
                    onClick={addLateRule}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    {language === 'ar' ? 'إضافة قاعدة' : 'Add Rule'}
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border border-gray-200 rounded-lg">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">
                          {language === 'ar' ? 'من (دقيقة)' : 'From (min)'}
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">
                          {language === 'ar' ? 'إلى (دقيقة)' : 'To (min)'}
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">
                          {language === 'ar' ? 'نوع الخصم' : 'Deduction Type'}
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">
                          {language === 'ar' ? 'القيمة' : 'Value'}
                        </th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-gray-700">
                          {language === 'ar' ? 'إجراء' : 'Action'}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {lateRules.map((rule, index) => (
                        <tr key={index}>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              value={rule.from_minutes}
                              onChange={(e) => updateLateRule(index, 'from_minutes', parseInt(e.target.value))}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                              min="0"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              value={rule.to_minutes}
                              onChange={(e) => updateLateRule(index, 'to_minutes', parseInt(e.target.value))}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                              min="0"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={rule.deduction_type}
                              onChange={(e) => updateLateRule(index, 'deduction_type', e.target.value)}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            >
                              <option value="fixed">{language === 'ar' ? 'مبلغ ثابت' : 'Fixed'}</option>
                              <option value="percent">{language === 'ar' ? 'نسبة مئوية' : 'Percent'}</option>
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              value={rule.value}
                              onChange={(e) => updateLateRule(index, 'value', parseFloat(e.target.value))}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                              min="0"
                              step="0.01"
                            />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button
                              onClick={() => removeLateRule(index)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="text-xs text-gray-600 bg-blue-50 px-3 py-2 rounded-lg border border-blue-200">
                  {language === 'ar'
                    ? 'ملاحظة: يتم تطبيق قاعدة واحدة فقط حسب عدد دقائق التأخير. في حالة التطابق المتعدد، يتم تطبيق القاعدة ذات الخصم الأعلى.'
                    : 'Note: Only one rule is applied per late occurrence based on minutes. If multiple rules match, the rule with the highest deduction is applied.'}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Early Checkout Deduction */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection('earlyCheckout')}
          className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <h3 className="font-semibold text-gray-800">
            {language === 'ar' ? 'خصم الخروج المبكر' : 'Early Checkout Deduction'}
          </h3>
          {expandedSections.earlyCheckout ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>

        {expandedSections.earlyCheckout && (
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="early-enabled"
                checked={settings.early_checkout_deduction_enabled}
                onChange={(e) => setSettings({ ...settings, early_checkout_deduction_enabled: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="early-enabled" className="text-sm font-medium text-gray-700">
                {language === 'ar' ? 'تفعيل خصم الخروج المبكر' : 'Enable Early Checkout Deduction'}
              </label>
            </div>

            {settings.early_checkout_deduction_enabled && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">
                    {language === 'ar' ? 'قواعد الخصم' : 'Deduction Rules'}
                  </label>
                  <button
                    onClick={addEarlyCheckoutRule}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    {language === 'ar' ? 'إضافة قاعدة' : 'Add Rule'}
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border border-gray-200 rounded-lg">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">
                          {language === 'ar' ? 'من (دقيقة)' : 'From (min)'}
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">
                          {language === 'ar' ? 'إلى (دقيقة)' : 'To (min)'}
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">
                          {language === 'ar' ? 'نوع الخصم' : 'Deduction Type'}
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">
                          {language === 'ar' ? 'القيمة' : 'Value'}
                        </th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-gray-700">
                          {language === 'ar' ? 'إجراء' : 'Action'}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {earlyCheckoutRules.map((rule, index) => (
                        <tr key={index}>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              value={rule.from_minutes}
                              onChange={(e) => updateEarlyCheckoutRule(index, 'from_minutes', parseInt(e.target.value))}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                              min="0"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              value={rule.to_minutes}
                              onChange={(e) => updateEarlyCheckoutRule(index, 'to_minutes', parseInt(e.target.value))}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                              min="0"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={rule.deduction_type}
                              onChange={(e) => updateEarlyCheckoutRule(index, 'deduction_type', e.target.value)}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            >
                              <option value="fixed">{language === 'ar' ? 'مبلغ ثابت' : 'Fixed'}</option>
                              <option value="percent">{language === 'ar' ? 'نسبة مئوية' : 'Percent'}</option>
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              value={rule.value}
                              onChange={(e) => updateEarlyCheckoutRule(index, 'value', parseFloat(e.target.value))}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                              min="0"
                              step="0.01"
                            />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button
                              onClick={() => removeEarlyCheckoutRule(index)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="text-xs text-gray-600 bg-blue-50 px-3 py-2 rounded-lg border border-blue-200">
                  {language === 'ar'
                    ? 'ملاحظة: يتم تطبيق قاعدة واحدة فقط حسب عدد دقائق الخروج المبكر. في حالة التطابق المتعدد، يتم تطبيق القاعدة ذات الخصم الأعلى.'
                    : 'Note: Only one rule is applied per early checkout based on minutes. If multiple rules match, the rule with the highest deduction is applied.'}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Absence Deduction */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection('absence')}
          className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <h3 className="font-semibold text-gray-800">
            {language === 'ar' ? 'خصم الغياب' : 'Absence Deduction'}
          </h3>
          {expandedSections.absence ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>

        {expandedSections.absence && (
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="absence-enabled"
                checked={settings.absence_deduction_enabled}
                onChange={(e) => setSettings({ ...settings, absence_deduction_enabled: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="absence-enabled" className="text-sm font-medium text-gray-700">
                {language === 'ar' ? 'تفعيل خصم الغياب' : 'Enable Absence Deduction'}
              </label>
            </div>

            {settings.absence_deduction_enabled && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {language === 'ar' ? 'نوع الخصم' : 'Deduction Type'}
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="absence-type"
                        checked={settings.absence_deduction_type === 'full_day'}
                        onChange={() => setSettings({ ...settings, absence_deduction_type: 'full_day' })}
                        className="text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">
                        {language === 'ar' ? 'خصم يوم كامل' : 'Full Day Deduction'}
                      </span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="absence-type"
                        checked={settings.absence_deduction_type === 'fixed_amount'}
                        onChange={() => setSettings({ ...settings, absence_deduction_type: 'fixed_amount' })}
                        className="text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">
                        {language === 'ar' ? 'مبلغ ثابت' : 'Fixed Amount'}
                      </span>
                    </label>
                  </div>
                </div>

                {settings.absence_deduction_type === 'fixed_amount' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {language === 'ar' ? 'المبلغ الثابت' : 'Fixed Amount'}
                    </label>
                    <input
                      type="number"
                      value={settings.absence_fixed_amount}
                      onChange={(e) => setSettings({ ...settings, absence_fixed_amount: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min="0"
                      step="0.01"
                    />
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="count-absence"
                    checked={settings.count_absence_without_checkin}
                    onChange={(e) => setSettings({ ...settings, count_absence_without_checkin: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="count-absence" className="text-sm text-gray-700">
                    {language === 'ar' ? 'احتساب الغياب بدون تسجيل حضور' : 'Count absence without check-in'}
                  </label>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Overtime */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection('overtime')}
          className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <h3 className="font-semibold text-gray-800">
            {language === 'ar' ? 'الوقت الإضافي' : 'Overtime'}
          </h3>
          {expandedSections.overtime ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>

        {expandedSections.overtime && (
          <div className="p-4 space-y-4">
            {/* Enable Overtime Toggle */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="overtime-enabled"
                checked={overtimeSettings.overtime_enabled}
                onChange={(e) => setOvertimeSettings({ ...overtimeSettings, overtime_enabled: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="overtime-enabled" className="text-sm font-medium text-gray-700">
                {language === 'ar' ? 'تفعيل الوقت الإضافي' : 'Enable Overtime'}
              </label>
            </div>

            {overtimeSettings.overtime_enabled && (
              <div className="space-y-4">
                {/* Overtime Calculation Basis */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {language === 'ar' ? 'أساس حساب الوقت الإضافي' : 'Overtime Calculation Basis'}
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="calculation-basis"
                        checked={overtimeSettings.calculation_basis === 'shift_based'}
                        onChange={() => setOvertimeSettings({ ...overtimeSettings, calculation_basis: 'shift_based' })}
                        className="text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">
                        {language === 'ar' ? 'بناءً على ساعات الوردية (الوقت الإضافي يبدأ بعد انتهاء الوردية المجدولة)' : 'Based on Shift Hours (overtime starts after scheduled shift end)'}
                      </span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="calculation-basis"
                        checked={overtimeSettings.calculation_basis === 'employee_based'}
                        onChange={() => setOvertimeSettings({ ...overtimeSettings, calculation_basis: 'employee_based' })}
                        className="text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">
                        {language === 'ar' ? 'بناءً على ساعات العمل اليومية للموظف (الوقت الإضافي يبدأ بعد الساعات المحددة في كارت الموظف)' : 'Based on Employee Daily Working Hours (overtime starts after employee-defined hours in employee card)'}
                      </span>
                    </label>
                  </div>
                  <div className="text-xs text-gray-600 bg-blue-50 px-3 py-2 rounded-lg border border-blue-200 mt-2">
                    {language === 'ar'
                      ? 'إذا تم اختيار "بناءً على الموظف"، سيتم حساب الوقت الإضافي باستخدام ساعات العمل اليومية المحددة في ملف الموظف.'
                      : 'If employee-based is selected, overtime will be calculated using the daily working hours defined in the employee profile.'}
                  </div>
                </div>

                {/* Overtime Rate Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {language === 'ar' ? 'نوع معدل الوقت الإضافي' : 'Overtime Rate Type'}
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="rate-type"
                        checked={overtimeSettings.rate_type === 'same_rate'}
                        onChange={() => setOvertimeSettings({ ...overtimeSettings, rate_type: 'same_rate', rate_value: 1 })}
                        className="text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">
                        {language === 'ar' ? 'نفس المعدل الساعي للعمل العادي' : 'Same hourly rate as normal work'}
                      </span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="rate-type"
                        checked={overtimeSettings.rate_type === 'multiplier'}
                        onChange={() => setOvertimeSettings({ ...overtimeSettings, rate_type: 'multiplier', rate_value: 1.5 })}
                        className="text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">
                        {language === 'ar' ? 'معامل ضرب (مثال: 1.25x، 1.5x)' : 'Multiplier (e.g. 1.25x, 1.5x)'}
                      </span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="rate-type"
                        checked={overtimeSettings.rate_type === 'fixed_amount'}
                        onChange={() => setOvertimeSettings({ ...overtimeSettings, rate_type: 'fixed_amount', rate_value: 0 })}
                        className="text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">
                        {language === 'ar' ? 'مبلغ ثابت لكل ساعة' : 'Fixed amount per hour'}
                      </span>
                    </label>
                  </div>
                </div>

                {/* Rate Value */}
                {(overtimeSettings.rate_type === 'multiplier' || overtimeSettings.rate_type === 'fixed_amount') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {overtimeSettings.rate_type === 'multiplier'
                        ? (language === 'ar' ? 'قيمة المعامل' : 'Multiplier Value')
                        : (language === 'ar' ? 'المبلغ الثابت لكل ساعة' : 'Fixed Amount per Hour')}
                    </label>
                    <input
                      type="number"
                      value={overtimeSettings.rate_value}
                      onChange={(e) => setOvertimeSettings({ ...overtimeSettings, rate_value: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min="0"
                      step="0.01"
                      placeholder={overtimeSettings.rate_type === 'multiplier' ? '1.5' : '0'}
                    />
                  </div>
                )}

                {/* Optional Limits */}
                <div className="border-t border-gray-200 pt-4 mt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">
                    {language === 'ar' ? 'حدود اختيارية' : 'Optional Limits'}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-700 mb-2">
                        {language === 'ar' ? 'الحد الأقصى لساعات الوقت الإضافي يوميًا' : 'Maximum overtime hours per day'}
                      </label>
                      <input
                        type="number"
                        value={overtimeSettings.max_overtime_hours_per_day || ''}
                        onChange={(e) => setOvertimeSettings({ ...overtimeSettings, max_overtime_hours_per_day: e.target.value ? parseFloat(e.target.value) : null })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        min="0"
                        step="0.5"
                        placeholder={language === 'ar' ? 'اتركه فارغًا لعدم التحديد' : 'Leave empty for no limit'}
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-2">
                        {language === 'ar' ? 'تجاهل الوقت الإضافي أقل من (دقائق)' : 'Ignore overtime less than (minutes)'}
                      </label>
                      <input
                        type="number"
                        value={overtimeSettings.ignore_overtime_less_than_minutes}
                        onChange={(e) => setOvertimeSettings({ ...overtimeSettings, ignore_overtime_less_than_minutes: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        min="0"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delay Permission Settings */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection('delayPermission')}
          className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <h3 className="font-semibold text-gray-800">
            {language === 'ar' ? 'إعدادات إذن التأخير' : 'Delay Permission Settings'}
          </h3>
          {expandedSections.delayPermission ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>

        {expandedSections.delayPermission && (
          <div className="p-4 space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-700">
                {language === 'ar'
                  ? 'إذن التأخير يسمح للموظفين بتقديم طلبات لتبرير التأخير، مما يقلل من خصم التأخير عند الموافقة.'
                  : 'Delay permission allows employees to submit requests to justify lateness, reducing late deductions when approved.'}
              </p>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="font-medium text-gray-700">
                {language === 'ar' ? 'تفعيل إذن التأخير' : 'Enable Delay Permission'}
              </span>
              <button
                type="button"
                onClick={() => setDelayPermissionSettings({ ...delayPermissionSettings, enabled: !delayPermissionSettings.enabled })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  delayPermissionSettings.enabled ? 'bg-green-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    delayPermissionSettings.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {delayPermissionSettings.enabled && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {language === 'ar' ? 'الحد الأقصى لساعات الإذن في اليوم' : 'Maximum Permission Hours Per Day'}
                  </label>
                  <input
                    type="number"
                    value={delayPermissionSettings.maxHoursPerDay}
                    onChange={(e) => setDelayPermissionSettings({ ...delayPermissionSettings, maxHoursPerDay: parseFloat(e.target.value) || 0 })}
                    min="0"
                    max="24"
                    step="0.5"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {language === 'ar'
                      ? 'الحد الأقصى لساعات التأخير المسموح بها يومياً (افتراضي: 2 ساعة)'
                      : 'Maximum delay hours allowed per day (default: 2 hours)'}
                  </p>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <span className="font-medium text-gray-700">
                      {language === 'ar' ? 'السماح بالدقائق' : 'Allow Minutes'}
                    </span>
                    <p className="text-xs text-gray-500 mt-1">
                      {language === 'ar'
                        ? 'السماح بدقة الدقائق في إذن التأخير'
                        : 'Allow minute-level precision in delay permission'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDelayPermissionSettings({ ...delayPermissionSettings, allowMinutes: !delayPermissionSettings.allowMinutes })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      delayPermissionSettings.allowMinutes ? 'bg-green-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        delayPermissionSettings.allowMinutes ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-4">
        <button
          onClick={saveSettings}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          <Save className="w-5 h-5" />
          {saving ? (language === 'ar' ? 'جارٍ الحفظ...' : 'Saving...') : (language === 'ar' ? 'حفظ الإعدادات' : 'Save Settings')}
        </button>
      </div>
    </div>
  );
}
