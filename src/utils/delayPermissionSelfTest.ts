import { supabase } from '../lib/supabase';

/**
 * Delay Permission Self-Test Utility
 *
 * CRITICAL UPDATE: Delay permissions do NOT require ANY session!
 * Employees can submit delay permission requests:
 * - Before starting work (pre-emptive)
 * - During work
 * - After work ends
 * - Even if session expired (auto-refresh handles it)
 *
 * Requirements for delay permission (RLS):
 * 1. Employee exists
 * 2. Employee is active
 * 3. Company ID matches
 *
 * NO session check required in RLS!
 * Session management is handled at frontend level with auto-refresh.
 */

interface SelfTestResult {
  success: boolean;
  employeeId: string | null;
  companyId: string | null;
  errorMessage: string | null;
  actionTaken: 'none' | 'employee_exists' | 'failed';
  shouldRetry: boolean;
}

export async function runDelayPermissionSelfTest(
  providedEmployeeId: string | null,
  providedCompanyId: string | null,
  originalError: string
): Promise<SelfTestResult> {
  console.log('[SELF-TEST] Starting delay permission self-test...');
  console.log('[SELF-TEST] Original error:', originalError);

  const result: SelfTestResult = {
    success: false,
    employeeId: providedEmployeeId,
    companyId: providedCompanyId,
    errorMessage: null,
    actionTaken: 'none',
    shouldRetry: false
  };

  try {
    // Step 1: Get employee session from localStorage
    const sessionData = localStorage.getItem('geoshift_employee');
    if (!sessionData) {
      console.log('[SELF-TEST] ✗ No employee session in localStorage');
      result.errorMessage = 'لا توجد جلسة موظف نشطة. الرجاء تسجيل الدخول مرة أخرى';
      result.actionTaken = 'failed';
      await logDebugResult(null, null, null, originalError, 'no_local_session', false, {});
      return result;
    }

    const employee = JSON.parse(sessionData);
    console.log('[SELF-TEST] ✓ Found employee session:', {
      id: employee.id,
      company_id: employee.company_id
    });

    result.employeeId = employee.id;
    result.companyId = employee.company_id;

    // Step 2: Verify employee exists in database
    const { data: employeeData, error: employeeError } = await supabase
      .from('employees')
      .select('id, company_id, is_active, full_name')
      .eq('id', employee.id)
      .maybeSingle();

    if (employeeError) {
      console.error('[SELF-TEST] ✗ Error querying employees:', employeeError);
      result.errorMessage = 'فشل التحقق من بيانات الموظف';
      result.actionTaken = 'failed';
      await logDebugResult(
        null,
        employee.company_id,
        employee.id,
        originalError,
        'query_failed',
        false,
        { error: employeeError }
      );
      return result;
    }

    if (!employeeData) {
      console.log('[SELF-TEST] ✗ Employee record not found in database');
      result.errorMessage = 'لا يوجد ملف موظف مربوط بهذا الحساب داخل الشركة الحالية';
      result.actionTaken = 'failed';
      await logDebugResult(
        null,
        employee.company_id,
        employee.id,
        originalError,
        'employee_not_found',
        false,
        {}
      );
      return result;
    }

    console.log('[SELF-TEST] ✓ Employee found:', employeeData.full_name);

    // Step 3: Check if employee is active
    if (!employeeData.is_active) {
      console.log('[SELF-TEST] ✗ Employee is not active');
      result.errorMessage = 'حساب الموظف غير نشط. الرجاء التواصل مع الإدارة';
      result.actionTaken = 'failed';
      await logDebugResult(
        null,
        employeeData.company_id,
        employeeData.id,
        originalError,
        'employee_inactive',
        false,
        { is_active: false }
      );
      return result;
    }

    console.log('[SELF-TEST] ✓ Employee is active');

    // Step 4: Verify company_id matches
    if (employeeData.company_id !== employee.company_id) {
      console.log('[SELF-TEST] ✗ Company ID mismatch:', {
        sessionCompanyId: employee.company_id,
        dbCompanyId: employeeData.company_id
      });
      result.errorMessage = 'عدم تطابق معرف الشركة. الرجاء تسجيل الدخول مرة أخرى';
      result.actionTaken = 'failed';
      await logDebugResult(
        null,
        employee.company_id,
        employee.id,
        originalError,
        'company_id_mismatch',
        false,
        {
          session_company_id: employee.company_id,
          db_company_id: employeeData.company_id
        }
      );
      return result;
    }

    console.log('[SELF-TEST] ✓ Company ID matches');

    // Step 5: All checks passed - ready to retry
    // NOTE: We do NOT check for active session anymore!
    // RLS policies only require employee to exist, be active, and company_id to match
    // Session management is handled at frontend level with auto-refresh
    console.log('[SELF-TEST] ℹ️ Session check skipped (not required by RLS)');
    console.log('[SELF-TEST] ✅ All checks passed! Ready to retry insert.');

    result.success = true;
    result.shouldRetry = true;
    result.actionTaken = 'employee_exists';
    result.employeeId = employeeData.id;
    result.companyId = employeeData.company_id;

    await logDebugResult(
      null,
      employeeData.company_id,
      employeeData.id,
      originalError,
      'validation_passed',
      true,
      {
        employee_name: employeeData.full_name,
        note: 'Session check skipped - not required by RLS'
      }
    );

    return result;
  } catch (error: any) {
    console.error('[SELF-TEST] ✗ Unexpected error during self-test:', error);
    result.errorMessage = 'حدث خطأ غير متوقع أثناء التشخيص';
    result.actionTaken = 'failed';
    await logDebugResult(
      null,
      result.companyId,
      result.employeeId,
      originalError,
      'unexpected_error',
      false,
      { error: error.message }
    );
    return result;
  }
}

async function logDebugResult(
  userId: string | null,
  companyId: string | null,
  employeeId: string | null,
  errorMessageBefore: string | null,
  actionTaken: string,
  success: boolean,
  metadata: any
): Promise<void> {
  try {
    console.log('[DEBUG-LOG]', {
      user_id: userId,
      company_id: companyId,
      employee_id: employeeId,
      error_message_before: errorMessageBefore,
      fixed_action_taken: actionTaken,
      success,
      metadata
    });

    // Try to insert into debug table if it exists
    await supabase.from('delay_permission_debug_logs').insert({
      user_id: userId,
      company_id: companyId,
      employee_id: employeeId,
      error_message_before: errorMessageBefore,
      fixed_action_taken: actionTaken,
      success,
      metadata
    });
  } catch (error) {
    // Silent fail - debug logging is optional
    console.log('[DEBUG-LOG] Failed to write to debug table (table may not exist yet):', error);
  }
}

export async function validateDelayPermissionPayload(
  employeeId: string,
  companyId: string
): Promise<{ valid: boolean; message: string }> {
  try {
    // Verify employee exists and belongs to company
    const { data: employee, error } = await supabase
      .from('employees')
      .select('id, company_id, is_active')
      .eq('id', employeeId)
      .eq('company_id', companyId)
      .maybeSingle();

    if (error) {
      return { valid: false, message: 'فشل التحقق من بيانات الموظف' };
    }

    if (!employee) {
      return { valid: false, message: 'الموظف غير موجود أو لا ينتمي لهذه الشركة' };
    }

    if (!employee.is_active) {
      return { valid: false, message: 'حساب الموظف غير نشط' };
    }

    // NOTE: Session check removed!
    // RLS policies only require employee to exist, be active, and company_id to match
    // Frontend handles session management with auto-refresh

    return { valid: true, message: 'التحقق نجح' };
  } catch (error: any) {
    return { valid: false, message: error.message || 'حدث خطأ أثناء التحقق' };
  }
}
