import { supabase } from '../lib/supabase';

export interface PayrollSettings {
  id: string;
  company_id: string;
  workdays_per_month: number;
  grace_minutes: number;
  currency: string;
  salary_type: string;
  overtime_multiplier?: number;
  shift_hours_per_day?: number;
  late_penalty_mode?: string;
  early_leave_penalty_mode?: string;
  absence_deduction_mode?: string;
  overtime_mode?: string;
  insurance_type?: 'percentage' | 'fixed';
  insurance_value?: number;
  tax_type?: 'percentage' | 'fixed';
  tax_value?: number;
  created_at: string;
  updated_at: string;
}

/**
 * Ensures payroll settings exist for the given company.
 * If not found, creates default settings automatically.
 * Returns the settings (existing or newly created).
 */
export async function ensurePayrollSettings(
  companyId: string
): Promise<PayrollSettings | null> {
  if (!companyId) {
    console.error('ensurePayrollSettings: No companyId provided');
    return null;
  }

  // Try to fetch existing settings
  const { data: existingSettings, error: fetchError } = await supabase
    .from('payroll_settings')
    .select('*')
    .eq('company_id', companyId)
    .maybeSingle();

  if (fetchError) {
    console.error('ensurePayrollSettings: Error fetching settings', fetchError);
    return null;
  }

  // If settings exist, return them
  if (existingSettings) {
    return existingSettings;
  }

  // No settings found - create default settings
  console.log('ensurePayrollSettings: Creating default settings for company', companyId);

  const defaultSettings = {
    company_id: companyId,
    currency: 'جنيه',
    salary_type: 'monthly',
    workdays_per_month: 26,
    grace_minutes: 15,
    overtime_multiplier: 1.5,
    shift_hours_per_day: 8,
    insurance_type: 'percentage',
    insurance_value: 0,
    tax_type: 'percentage',
    tax_value: 0
  };

  const { data: newSettings, error: insertError } = await supabase
    .from('payroll_settings')
    .insert(defaultSettings)
    .select()
    .single();

  if (insertError) {
    console.error('ensurePayrollSettings: Error creating default settings', insertError);
    return null;
  }

  return newSettings;
}
