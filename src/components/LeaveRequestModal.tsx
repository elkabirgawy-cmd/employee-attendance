import { useState, useEffect } from 'react';
import { X, Calendar, FileText, Upload, AlertCircle, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { calculateRequestedDays, validateLeaveRequest, type LeaveType, type LeaveBalance } from '../utils/leaveCalculations';

interface LeaveRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeId: string;
  employeeName: string;
  companyId: string;
}

interface LeaveRequest {
  id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  requested_days: number;
  reason: string | null;
  status: string;
  created_at: string;
  leave_types?: LeaveType;
  rejection_reason?: string | null;
}

export default function LeaveRequestModal({ isOpen, onClose, employeeId, employeeName, companyId }: LeaveRequestModalProps) {
  const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    leave_type_id: '',
    start_date: '',
    end_date: '',
    reason: '',
    attachment_url: ''
  });

  const [requestedDays, setRequestedDays] = useState(0);
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    if (isOpen && companyId) {
      fetchLeaveTypes();
      fetchLeaveBalances();
      fetchLeaveRequests();
    }
  }, [isOpen, employeeId, companyId]);

  useEffect(() => {
    if (formData.start_date && formData.end_date) {
      const days = calculateRequestedDays(new Date(formData.start_date), new Date(formData.end_date), false);
      setRequestedDays(days);

      if (formData.leave_type_id) {
        const leaveType = leaveTypes.find(lt => lt.id === formData.leave_type_id);
        const balance = leaveBalances.find(lb => lb.leave_type_id === formData.leave_type_id && lb.year === new Date().getFullYear());

        if (leaveType) {
          const validation = validateLeaveRequest(
            new Date(formData.start_date),
            new Date(formData.end_date),
            leaveType,
            balance || null
          );

          setValidationError(validation.valid ? '' : validation.error || '');
        }
      }
    } else {
      setRequestedDays(0);
      setValidationError('');
    }
  }, [formData.start_date, formData.end_date, formData.leave_type_id, leaveTypes, leaveBalances]);

  async function fetchLeaveTypes() {
    console.log('[LeaveRequestModal] Fetching leave types for company:', companyId);

    const { data, error } = await supabase
      .from('leave_types')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('sort_order');

    console.log('[LeaveRequestModal] Leave types fetched:', {
      count: data?.length || 0,
      companyId,
      error: error?.message
    });

    if (data) setLeaveTypes(data);
  }

  async function fetchLeaveBalances() {
    const currentYear = new Date().getFullYear();
    const { data } = await supabase
      .from('leave_balances')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('company_id', companyId)
      .eq('year', currentYear);

    if (data) setLeaveBalances(data);
  }

  async function fetchLeaveRequests() {
    const { data } = await supabase
      .from('leave_requests')
      .select('*, leave_types(*)')
      .eq('employee_id', employeeId)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (data) setLeaveRequests(data);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (validationError) {
      alert(validationError);
      return;
    }

    if (!formData.leave_type_id || !formData.start_date || !formData.end_date) {
      alert('الرجاء ملء جميع الحقول المطلوبة');
      return;
    }

    setLoading(true);

    console.log('[LeaveRequestModal] Submitting leave request via Edge Function:', {
      leave_type_id: formData.leave_type_id,
      start_date: formData.start_date,
      end_date: formData.end_date
    });

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('No active session');
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/employee-submit-leave-request`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          leave_type_id: formData.leave_type_id,
          start_date: formData.start_date,
          end_date: formData.end_date,
          reason: formData.reason || null
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit leave request');
      }

      console.log('[LeaveRequestModal] Leave request submitted successfully:', result);

      alert('تم إرسال طلب الإجازة بنجاح');
      setFormData({
        leave_type_id: '',
        start_date: '',
        end_date: '',
        reason: '',
        attachment_url: ''
      });
      setActiveTab('history');
      fetchLeaveRequests();
      fetchLeaveBalances();
    } catch (error: any) {
      console.error('[LeaveRequestModal] Submit error:', error);
      alert('خطأ في إرسال الطلب: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  const selectedLeaveType = leaveTypes.find(lt => lt.id === formData.leave_type_id);
  const selectedBalance = leaveBalances.find(lb => lb.leave_type_id === formData.leave_type_id && lb.year === new Date().getFullYear());

  if (!isOpen) return null;

  return (
    <div className="modal-container" dir="rtl">
      <div className="modal-content shadow-2xl">
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-4 py-3 text-white flex items-center justify-between flex-shrink-0">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold">طلبات الإجازات</h2>
            <p className="text-blue-100 text-xs mt-0.5 truncate">{employeeName}</p>
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
                ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Calendar className="w-4 h-4 inline ml-2" />
            طلب جديد
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`w-full min-w-0 px-4 py-3 text-sm font-semibold transition-all ${
              activeTab === 'history'
                ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Clock className="w-4 h-4 inline ml-2" />
            السجل
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-3 box-border">
          {activeTab === 'new' ? (
            <form id="leave-request-form" onSubmit={handleSubmit} className="space-y-2 w-full box-border">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 w-full box-border">
                <h3 className="text-sm font-bold text-gray-800 mb-2">أرصدة الإجازات</h3>
                <div className="grid grid-cols-1 gap-1.5">
                  {leaveTypes.filter(lt => lt.is_paid).map(leaveType => {
                    const balance = leaveBalances.find(lb => lb.leave_type_id === leaveType.id && lb.year === new Date().getFullYear());
                    return (
                      <div key={leaveType.id} className="flex justify-between items-center bg-white p-2 rounded-lg text-xs">
                        <span className="font-medium text-gray-700">{leaveType.name_ar}</span>
                        <span className="font-bold" style={{ color: leaveType.color }}>
                          {balance ? `${balance.remaining_days} / ${balance.total_days}` : '0 / 0'} يوم
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="input-wrapper">
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  نوع الإجازة <span className="text-red-500">*</span>
                </label>
                {leaveTypes.length === 0 ? (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-xl text-xs">
                    <AlertCircle className="w-4 h-4 text-yellow-600 inline ml-2" />
                    <span className="text-yellow-700">لا توجد أنواع إجازات متاحة حالياً</span>
                  </div>
                ) : (
                  <select
                    value={formData.leave_type_id}
                    onChange={(e) => setFormData({ ...formData, leave_type_id: e.target.value })}
                    className="compactField rounded-xl focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">اختر نوع الإجازة</option>
                    {leaveTypes.map(lt => (
                      <option key={lt.id} value={lt.id}>{lt.name_ar}</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="date-time-grid">
                <div className="input-wrapper">
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    تاريخ البداية <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="compactField rounded-xl focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div className="input-wrapper">
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    تاريخ النهاية <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className="compactField rounded-xl focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              {requestedDays > 0 && (
                <div className={`p-3 rounded-xl border w-full box-border ${validationError ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                  <div className="flex items-center gap-2">
                    {validationError ? (
                      <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-gray-800">
                        عدد الأيام: {requestedDays} يوم
                      </div>
                      {validationError && (
                        <div className="text-xs text-red-600 mt-0.5">{validationError}</div>
                      )}
                      {!validationError && selectedLeaveType && selectedBalance && (
                        <div className="text-xs text-gray-600 mt-0.5">
                          المتبقي: {selectedBalance.remaining_days - requestedDays} يوم
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="input-wrapper">
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  السبب (اختياري)
                </label>
                <textarea
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  className="compactTextarea rounded-xl focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="اكتب السبب هنا..."
                />
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              {leaveRequests.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>لا توجد طلبات سابقة</p>
                </div>
              ) : (
                leaveRequests.map(request => (
                  <div key={request.id} className="bg-white border rounded-xl p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className="px-3 py-1 rounded-full text-sm font-bold"
                            style={{
                              backgroundColor: request.leave_types?.color + '20',
                              color: request.leave_types?.color
                            }}
                          >
                            {request.leave_types?.name_ar}
                          </span>
                          <span className="text-sm text-gray-500">
                            {new Date(request.created_at).toLocaleDateString('ar-SA')}
                          </span>
                        </div>
                        <div className="text-gray-700 mb-2">
                          <Calendar className="w-4 h-4 inline ml-1" />
                          {new Date(request.start_date).toLocaleDateString('ar-SA')} - {new Date(request.end_date).toLocaleDateString('ar-SA')}
                          <span className="font-bold mr-2">({request.requested_days} يوم)</span>
                        </div>
                        {request.reason && (
                          <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                            {request.reason}
                          </div>
                        )}
                        {request.rejection_reason && (
                          <div className="text-sm text-red-600 bg-red-50 p-2 rounded mt-2">
                            <strong>سبب الرفض:</strong> {request.rejection_reason}
                          </div>
                        )}
                      </div>
                      <div>
                        {request.status === 'pending' && (
                          <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-semibold flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            قيد المراجعة
                          </span>
                        )}
                        {request.status === 'approved' && (
                          <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4" />
                            معتمد
                          </span>
                        )}
                        {request.status === 'rejected' && (
                          <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-semibold flex items-center gap-1">
                            <XCircle className="w-4 h-4" />
                            مرفوض
                          </span>
                        )}
                      </div>
                    </div>
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
                form="leave-request-form"
                disabled={loading || !!validationError}
                className="w-full min-w-0 h-11 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl text-sm font-semibold hover:from-purple-700 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md box-border"
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
