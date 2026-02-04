import { useState, useEffect } from 'react';
import { X, Clock, Calendar, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface EmployeeDelayPermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeId: string;
  companyId: string;
  onViewHistory?: () => void;
}

interface DelayPermission {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  minutes: number;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export default function EmployeeDelayPermissionModal({
  isOpen,
  onClose,
  employeeId,
  companyId,
  onViewHistory
}: EmployeeDelayPermissionModalProps) {
  const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');
  const [permissions, setPermissions] = useState<DelayPermission[]>([]);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    start_time: '09:00',
    end_time: '09:30',
    reason: ''
  });

  const [calculatedMinutes, setCalculatedMinutes] = useState(0);
  const [maxHoursPerDay, setMaxHoursPerDay] = useState(2);

  useEffect(() => {
    if (isOpen) {
      fetchSettings();
      fetchPermissions();
    }
  }, [isOpen, employeeId]);

  useEffect(() => {
    if (formData.start_time && formData.end_time) {
      const minutes = calculateMinutes(formData.start_time, formData.end_time);
      setCalculatedMinutes(minutes);
    }
  }, [formData.start_time, formData.end_time]);

  function calculateMinutes(startTime: string, endTime: string): number {
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);

    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;

    return endMinutes - startMinutes;
  }

  function formatMinutesToHours(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours === 0) {
      return `${mins} دقيقة`;
    } else if (mins === 0) {
      return `${hours} ساعة`;
    } else {
      return `${hours} ساعة و ${mins} دقيقة`;
    }
  }

  async function fetchSettings() {
    const { data } = await supabase
      .from('payroll_settings')
      .select('max_delay_hours_per_day')
      .eq('company_id', companyId)
      .maybeSingle();

    if (data) {
      setMaxHoursPerDay(data.max_delay_hours_per_day || 2);
    }
  }

  async function fetchPermissions() {
    const { data } = await supabase
      .from('delay_permissions')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (data) setPermissions(data);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validation 1: Check required fields
    if (!formData.date || !formData.start_time || !formData.end_time) {
      setErrorMessage('الرجاء ملء جميع الحقول المطلوبة');
      return;
    }

    // Validation 2: Check reason field
    if (!formData.reason || formData.reason.trim() === '') {
      setErrorMessage('الرجاء إدخال سبب طلب الإذن');
      return;
    }

    // Validation 3: Check time range
    if (calculatedMinutes <= 0) {
      setErrorMessage('وقت النهاية يجب أن يكون أكبر من وقت البداية');
      return;
    }

    // Validation 4: Check maximum allowed
    const maxMinutes = maxHoursPerDay * 60;
    if (calculatedMinutes > maxMinutes) {
      setErrorMessage(`الحد الأقصى ${maxHoursPerDay} ساعة (${maxMinutes} دقيقة)`);
      return;
    }

    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      await submitDelayPermission();
    } catch (error: any) {
      console.error('[SUBMIT-ERROR] Error creating delay permission:', error);
      setErrorMessage(error.message || 'حدث خطأ أثناء إرسال الطلب. الرجاء المحاولة مرة أخرى');
      setLoading(false);
    }
  }

  async function submitDelayPermission() {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('الرجاء تسجيل الدخول مرة أخرى');
      }

      const payload = {
        date: formData.date,
        start_time: formData.start_time,
        end_time: formData.end_time,
        minutes: calculatedMinutes,
        reason: formData.reason.trim(),
      };

      console.log('[EDGE-FUNCTION] Submitting delay permission via edge function');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/employee-submit-delay-permission`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(payload),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        console.error('[EDGE-FUNCTION] Error:', result);
        throw new Error(result.error || 'فشل إرسال الطلب');
      }

      console.log('[EDGE-FUNCTION] Success:', result);

      setSuccessMessage('تم إرسال طلب إذن التأخير بنجاح');

      // Reset form
      setFormData({
        date: new Date().toISOString().split('T')[0],
        start_time: '09:00',
        end_time: '09:30',
        reason: ''
      });

      // Refresh permissions list
      await fetchPermissions();
      setActiveTab('history');
      setLoading(false);

      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (error: any) {
      throw error;
    }
  }

  if (!isOpen) return null;

  return (
    <div className="modal-container" dir="rtl">
      <div className="modal-content shadow-2xl">
        <div className="bg-gradient-to-r from-orange-500 to-red-600 px-4 py-3 text-white flex items-center justify-between flex-shrink-0">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold">إذن التأخير</h2>
            <p className="text-orange-100 text-xs mt-0.5 truncate">طلب إذن للتأخير عن موعد الحضور</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 border-b flex-shrink-0">
          <button
            onClick={() => setActiveTab('new')}
            className={`w-full min-w-0 px-4 py-3 text-sm font-semibold transition-all ${
              activeTab === 'new'
                ? 'border-b-2 border-orange-600 text-orange-600 bg-orange-50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Clock className="w-4 h-4 inline ml-2" />
            طلب جديد
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`w-full min-w-0 px-4 py-3 text-sm font-semibold transition-all ${
              activeTab === 'history'
                ? 'border-b-2 border-orange-600 text-orange-600 bg-orange-50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Calendar className="w-4 h-4 inline ml-2" />
            السجل
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-3 box-border">
          {successMessage && (
            <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2 text-green-700 text-sm">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {activeTab === 'new' && (
            <form id="delay-permission-form" onSubmit={handleSubmit} className="space-y-2 w-full box-border">
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 w-full box-border">
                <p className="text-xs text-orange-700">
                  يمكنك طلب إذن للتأخير عن موعد الحضور. سيتم مراجعة الطلب من قبل الإدارة.
                </p>
              </div>

              <div className="input-wrapper">
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  التاريخ <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="compactField rounded-xl focus:ring-orange-500 focus:border-transparent"
                  required
                />
              </div>

              <div className="date-time-grid">
                <div className="input-wrapper">
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    من الساعة <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    className="compactField rounded-xl focus:ring-orange-500 focus:border-transparent"
                    required
                  />
                </div>

                <div className="input-wrapper">
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    إلى الساعة <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    className="compactField rounded-xl focus:ring-orange-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              {calculatedMinutes > 0 && (
                <div className="p-3 rounded-xl border bg-orange-50 border-orange-200 w-full box-border">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-orange-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-gray-800">
                        المدة: {formatMinutesToHours(calculatedMinutes)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="input-wrapper">
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  السبب <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  className="compactTextarea rounded-xl focus:ring-orange-500 focus:border-transparent"
                  rows={3}
                  placeholder="سبب طلب إذن التأخير..."
                  required
                />
              </div>
            </form>
          )}

          {activeTab === 'history' && (
            <div className="space-y-3">
              {permissions.length === 0 ? (
                <div className="text-center py-12">
                  <Clock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 text-sm">لا توجد طلبات إذن تأخير</p>
                </div>
              ) : (
                permissions.map((permission) => (
                  <div
                    key={permission.id}
                    className="border border-gray-200 rounded-xl p-3 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-800 text-sm">
                          {new Date(permission.date).toLocaleDateString('ar-SA')}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {permission.start_time} - {permission.end_time}
                          <span className="font-bold mr-2">({formatMinutesToHours(permission.minutes)})</span>
                        </div>
                      </div>
                      <div>
                        {permission.status === 'pending' && (
                          <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-semibold flex items-center gap-1 whitespace-nowrap">
                            <Clock className="w-4 h-4" />
                            قيد المراجعة
                          </span>
                        )}
                        {permission.status === 'approved' && (
                          <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold flex items-center gap-1 whitespace-nowrap">
                            <CheckCircle2 className="w-4 h-4" />
                            معتمد
                          </span>
                        )}
                        {permission.status === 'rejected' && (
                          <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-semibold flex items-center gap-1 whitespace-nowrap">
                            <XCircle className="w-4 h-4" />
                            مرفوض
                          </span>
                        )}
                      </div>
                    </div>

                    {permission.reason && (
                      <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded mt-2">
                        {permission.reason}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {activeTab === 'new' && (
          <div className="sticky bottom-0 bg-white border-t px-4 py-3 rounded-b-2xl flex-shrink-0 w-full box-border">
            <div className="grid grid-cols-[1fr_auto] gap-2 w-full box-border">
              <button
                type="submit"
                form="delay-permission-form"
                disabled={loading || calculatedMinutes <= 0}
                className="w-full min-w-0 h-11 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-xl text-sm font-semibold hover:from-orange-600 hover:to-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md box-border"
              >
                {loading ? 'جاري الإرسال...' : 'إرسال الطلب'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="h-11 px-5 border border-gray-300 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors box-border flex-shrink-0"
              >
                إلغاء
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
