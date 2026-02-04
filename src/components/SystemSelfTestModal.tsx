import { useState } from 'react';
import { X, Wrench, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface SystemSelfTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
}

interface TestStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  error?: string;
  details?: any;
}

export default function SystemSelfTestModal({
  isOpen,
  onClose,
  companyId
}: SystemSelfTestModalProps) {
  const [running, setRunning] = useState(false);
  const [autoFixing, setAutoFixing] = useState(false);
  const [steps, setSteps] = useState<TestStep[]>([]);

  if (!isOpen) return null;

  async function updateStep(id: string, updates: Partial<TestStep>) {
    setSteps(prev => prev.map(step =>
      step.id === id ? { ...step, ...updates } : step
    ));
  }

  async function runSystemTest() {
    setRunning(true);
    setSteps([
      { id: 'bootstrap', name: 'التحقق من إعدادات الشركة الافتراضية', status: 'pending' },
      { id: 'user_link', name: 'التحقق من ربط الموظف بالحساب', status: 'pending' },
      { id: 'insert_test', name: 'اختبار إضافة إذن تأخير', status: 'pending' },
      { id: 'select_test', name: 'اختبار قراءة إذن التأخير', status: 'pending' },
      { id: 'cleanup', name: 'تنظيف بيانات الاختبار', status: 'pending' }
    ]);

    try {
      // Step 1: Bootstrap company defaults
      await updateStep('bootstrap', { status: 'running' });

      const { data: bootstrapResult, error: bootstrapError } = await supabase
        .rpc('bootstrap_company_defaults', { p_company_id: companyId });

      if (bootstrapError) {
        await updateStep('bootstrap', {
          status: 'failed',
          error: bootstrapError.message,
          details: bootstrapError
        });
      } else {
        await updateStep('bootstrap', {
          status: 'success',
          details: bootstrapResult
        });
      }

      // Step 2: Auto-link user to employee
      await updateStep('user_link', { status: 'running' });

      const { data: linkResult, error: linkError } = await supabase
        .rpc('auto_link_employee_user');

      if (linkError) {
        await updateStep('user_link', {
          status: 'failed',
          error: linkError.message,
          details: linkError
        });
        setRunning(false);
        return;
      }

      if (!linkResult.success) {
        await updateStep('user_link', {
          status: 'failed',
          error: linkResult.reason,
          details: linkResult
        });
        setRunning(false);
        return;
      }

      await updateStep('user_link', {
        status: 'success',
        details: linkResult
      });

      const employeeId = linkResult.employee_id;

      // Step 3: Test INSERT delay_permission
      await updateStep('insert_test', { status: 'running' });

      const testDate = new Date().toISOString().split('T')[0];
      const insertPayload = {
        company_id: companyId,
        employee_id: employeeId,
        date: testDate,
        start_time: '09:00',
        end_time: '09:30',
        minutes: 30,
        reason: 'System Self-Test - ' + new Date().toISOString(),
        status: 'pending',
        is_test: true
      };

      const { data: inserted, error: insertError } = await supabase
        .from('delay_permissions')
        .insert(insertPayload)
        .select()
        .single();

      if (insertError) {
        await updateStep('insert_test', {
          status: 'failed',
          error: insertError.message,
          details: {
            code: insertError.code,
            hint: insertError.hint,
            payload: insertPayload
          }
        });

        // Log to debug table
        await supabase.from('delay_permission_debug_logs').insert({
          step: 'self_test_insert',
          ok: false,
          error_message: insertError.message,
          user_id: (await supabase.auth.getUser()).data.user?.id,
          company_id: companyId,
          employee_id: employeeId,
          details: { error: insertError, payload: insertPayload }
        });

        setRunning(false);
        return;
      }

      await updateStep('insert_test', {
        status: 'success',
        details: { id: inserted.id }
      });

      // Step 4: Test SELECT
      await updateStep('select_test', { status: 'running' });

      const { data: selected, error: selectError } = await supabase
        .from('delay_permissions')
        .select('*')
        .eq('id', inserted.id)
        .single();

      if (selectError) {
        await updateStep('select_test', {
          status: 'failed',
          error: selectError.message
        });
      } else {
        await updateStep('select_test', {
          status: 'success',
          details: { found: true }
        });
      }

      // Step 5: Cleanup
      await updateStep('cleanup', { status: 'running' });

      const { error: deleteError } = await supabase
        .from('delay_permissions')
        .delete()
        .eq('id', inserted.id);

      if (deleteError) {
        await updateStep('cleanup', {
          status: 'failed',
          error: deleteError.message
        });
      } else {
        await updateStep('cleanup', { status: 'success' });
      }

      // Log success
      await supabase.from('delay_permission_debug_logs').insert({
        step: 'self_test_complete',
        ok: true,
        user_id: (await supabase.auth.getUser()).data.user?.id,
        company_id: companyId,
        employee_id: employeeId,
        details: { all_steps_passed: true }
      });

    } catch (error: any) {
      console.error('[SELF-TEST] Unexpected error:', error);
    }

    setRunning(false);
  }

  async function runAutoFix() {
    setAutoFixing(true);

    try {
      // Run bootstrap
      await supabase.rpc('bootstrap_company_defaults', { p_company_id: companyId });

      // Run auto-link
      await supabase.rpc('auto_link_employee_user');

      alert('تم تشغيل الإصلاح التلقائي. الرجاء إعادة الاختبار.');
    } catch (error: any) {
      alert('فشل الإصلاح التلقائي: ' + error.message);
    }

    setAutoFixing(false);
  }

  const allSuccess = steps.length > 0 && steps.every(s => s.status === 'success');
  const anyFailed = steps.some(s => s.status === 'failed');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <Wrench className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold">اختبار النظام وإصلاح تلقائي</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[70vh]">
          <div className="mb-6 flex gap-3">
            <button
              onClick={runSystemTest}
              disabled={running || autoFixing}
              className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {running ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  جارٍ الاختبار...
                </>
              ) : (
                <>
                  <Wrench className="w-5 h-5" />
                  تشغيل الاختبار
                </>
              )}
            </button>

            {anyFailed && (
              <button
                onClick={runAutoFix}
                disabled={running || autoFixing}
                className="flex-1 bg-orange-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-orange-700 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {autoFixing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    جارٍ الإصلاح...
                  </>
                ) : (
                  <>
                    <Wrench className="w-5 h-5" />
                    إصلاح تلقائي
                  </>
                )}
              </button>
            )}
          </div>

          {steps.length > 0 && (
            <>
              {allSuccess && (
                <div className="mb-4 p-4 bg-green-50 border-2 border-green-500 rounded-lg flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                  <span className="text-green-800 font-bold">جميع الاختبارات نجحت ✓</span>
                </div>
              )}

              {anyFailed && (
                <div className="mb-4 p-4 bg-red-50 border-2 border-red-500 rounded-lg flex items-center gap-3">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                  <span className="text-red-800 font-bold">بعض الاختبارات فشلت ✗</span>
                </div>
              )}

              <div className="space-y-3">
                {steps.map((step) => (
                  <div
                    key={step.id}
                    className={`p-4 rounded-lg border-2 ${
                      step.status === 'success' ? 'bg-green-50 border-green-300' :
                      step.status === 'failed' ? 'bg-red-50 border-red-300' :
                      step.status === 'running' ? 'bg-blue-50 border-blue-300' :
                      'bg-slate-50 border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      {step.status === 'running' && <Loader2 className="w-5 h-5 animate-spin text-blue-600" />}
                      {step.status === 'success' && <CheckCircle2 className="w-5 h-5 text-green-600" />}
                      {step.status === 'failed' && <AlertCircle className="w-5 h-5 text-red-600" />}
                      {step.status === 'pending' && <div className="w-5 h-5 rounded-full border-2 border-slate-300" />}
                      <span className="font-medium text-slate-900">{step.name}</span>
                    </div>

                    {step.error && (
                      <div className="mt-2 p-3 bg-red-100 rounded text-sm text-red-800 font-mono">
                        {step.error}
                      </div>
                    )}

                    {step.details && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-sm text-slate-600 hover:text-slate-900">
                          عرض التفاصيل
                        </summary>
                        <pre className="mt-2 p-3 bg-slate-100 rounded text-xs overflow-auto">
                          {JSON.stringify(step.details, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {steps.length === 0 && !running && (
            <div className="text-center py-12 text-slate-500">
              <Wrench className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <p>اضغط "تشغيل الاختبار" للبدء</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-6 border-t bg-slate-50">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-slate-300 rounded-lg hover:bg-slate-100"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
