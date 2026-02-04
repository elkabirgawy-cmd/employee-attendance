import { useState, useEffect } from 'react';
import { X, Calendar, Clock, FileText, CheckCircle, XCircle, Loader2, Timer } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface LeaveRequest {
  id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  requested_days: number;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
  created_at: string;
  leave_type?: {
    name_ar: string;
    color: string;
  };
}

interface DelayPermission {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  minutes: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
  created_at: string;
  approved_by?: string;
  approved_at?: string;
}

type FilterTab = 'all' | 'leaves' | 'delays';

interface LeaveHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeId: string;
  companyId: string;
  onNewRequest: () => void;
  initialFilter?: FilterTab;
}

export default function LeaveHistoryModal({
  isOpen,
  onClose,
  employeeId,
  companyId,
  onNewRequest,
  initialFilter = 'all'
}: LeaveHistoryModalProps) {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [delayPermissions, setDelayPermissions] = useState<DelayPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [selectedDelay, setSelectedDelay] = useState<DelayPermission | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>(initialFilter);

  useEffect(() => {
    if (isOpen && employeeId) {
      fetchLeaveRequests();
      fetchDelayPermissions();
    }
  }, [isOpen, employeeId]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const fetchLeaveRequests = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('leave_requests')
        .select(`
          id,
          leave_type_id,
          start_date,
          end_date,
          requested_days,
          reason,
          status,
          rejection_reason,
          created_at,
          leave_types:leave_type_id (
            name_ar,
            color
          )
        `)
        .eq('employee_id', employeeId)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching leave requests:', error);
        return;
      }

      const formattedData = data.map(req => ({
        ...req,
        leave_type: Array.isArray(req.leave_types) ? req.leave_types[0] : req.leave_types
      }));

      setRequests(formattedData);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDelayPermissions = async () => {
    try {
      const { data, error } = await supabase
        .from('delay_permissions')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching delay permissions:', error);
        return;
      }

      setDelayPermissions(data || []);
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-50 rounded-full border border-yellow-200">
            <Clock className="w-3.5 h-3.5 text-yellow-600" />
            <span className="text-xs font-medium text-yellow-700">قيد الانتظار</span>
          </div>
        );
      case 'approved':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 rounded-full border border-green-200">
            <CheckCircle className="w-3.5 h-3.5 text-green-600" />
            <span className="text-xs font-medium text-green-700">موافق عليها</span>
          </div>
        );
      case 'rejected':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 rounded-full border border-red-200">
            <XCircle className="w-3.5 h-3.5 text-red-600" />
            <span className="text-xs font-medium text-red-700">مرفوضة</span>
          </div>
        );
      default:
        return null;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0 && mins > 0) {
      return `${hours} ساعة و ${mins} دقيقة`;
    } else if (hours > 0) {
      return `${hours} ساعة`;
    } else {
      return `${mins} دقيقة`;
    }
  };

  const filteredRequests = activeTab === 'all' || activeTab === 'leaves' ? requests : [];
  const filteredDelays = activeTab === 'all' || activeTab === 'delays' ? delayPermissions : [];
  const hasAnyRequests = requests.length > 0 || delayPermissions.length > 0;

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-50 transition-opacity duration-300"
        onClick={() => {
          if (!selectedRequest) {
            onClose();
          }
        }}
      />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
          style={{ maxWidth: '500px' }}
        >
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <h2 className="text-xl font-bold text-gray-900" dir="rtl">سجل الطلبات</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <div className="border-b border-gray-100 px-4 pt-3">
            <div className="flex gap-2" dir="rtl">
              <button
                onClick={() => setActiveTab('all')}
                className={`flex-1 py-2.5 px-4 rounded-t-lg font-medium text-sm transition-all ${
                  activeTab === 'all'
                    ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                الكل ({requests.length + delayPermissions.length})
              </button>
              <button
                onClick={() => setActiveTab('leaves')}
                className={`flex-1 py-2.5 px-4 rounded-t-lg font-medium text-sm transition-all ${
                  activeTab === 'leaves'
                    ? 'bg-purple-50 text-purple-700 border-b-2 border-purple-600'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                الإجازات ({requests.length})
              </button>
              <button
                onClick={() => setActiveTab('delays')}
                className={`flex-1 py-2.5 px-4 rounded-t-lg font-medium text-sm transition-all ${
                  activeTab === 'delays'
                    ? 'bg-orange-50 text-orange-700 border-b-2 border-orange-600'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                أذونات التأخير ({delayPermissions.length})
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-3" />
                <p className="text-sm text-gray-500">جاري التحميل...</p>
              </div>
            ) : !hasAnyRequests ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                  <FileText className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2" dir="rtl">
                  لا توجد طلبات حتى الآن
                </h3>
                <p className="text-sm text-gray-500 mb-6 text-center" dir="rtl">
                  لم تقم بتقديم أي طلبات بعد
                </p>
                <button
                  onClick={() => {
                    onClose();
                    onNewRequest();
                  }}
                  className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-medium shadow-md hover:shadow-lg transition-all"
                >
                  طلب إجازة جديد
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredRequests.map((request) => (
                  <div
                    key={request.id}
                    onClick={() => setSelectedRequest(request)}
                    className="bg-white border-2 border-gray-100 rounded-xl p-4 hover:border-blue-200 hover:shadow-md transition-all cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-3" dir="rtl">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: request.leave_type?.color || '#6b7280' }}
                        />
                        <h3 className="font-semibold text-gray-900">
                          {request.leave_type?.name_ar || 'إجازة'}
                        </h3>
                      </div>
                      {getStatusBadge(request.status)}
                    </div>

                    <div className="space-y-2 text-sm" dir="rtl">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Calendar className="w-4 h-4 flex-shrink-0" />
                        <span>
                          {formatDate(request.start_date)} - {formatDate(request.end_date)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-gray-600">
                        <Clock className="w-4 h-4 flex-shrink-0" />
                        <span>{request.requested_days} يوم</span>
                      </div>

                      {request.reason && (
                        <div className="flex items-start gap-2 text-gray-600">
                          <FileText className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          <span className="line-clamp-1">{request.reason}</span>
                        </div>
                      )}

                      <div className="text-xs text-gray-400 mt-2">
                        تم الإنشاء: {formatDateTime(request.created_at)}
                      </div>
                    </div>
                  </div>
                ))}

                {filteredDelays.map((delay) => (
                  <div
                    key={delay.id}
                    onClick={() => setSelectedDelay(delay)}
                    className="bg-white border-2 border-gray-100 rounded-xl p-4 hover:border-orange-200 hover:shadow-md transition-all cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-3" dir="rtl">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                          <Timer className="w-4 h-4 text-orange-600" />
                        </div>
                        <h3 className="font-semibold text-gray-900">إذن تأخير</h3>
                      </div>
                      {getStatusBadge(delay.status)}
                    </div>

                    <div className="space-y-2 text-sm" dir="rtl">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Calendar className="w-4 h-4 flex-shrink-0" />
                        <span>{formatDate(delay.date)}</span>
                      </div>

                      <div className="flex items-center gap-2 text-gray-600">
                        <Clock className="w-4 h-4 flex-shrink-0" />
                        <span>من {delay.start_time} إلى {delay.end_time}</span>
                      </div>

                      <div className="flex items-center gap-2 text-gray-600">
                        <Timer className="w-4 h-4 flex-shrink-0" />
                        <span className="font-medium">{formatDuration(delay.minutes)}</span>
                      </div>

                      {delay.reason && (
                        <div className="flex items-start gap-2 text-gray-600">
                          <FileText className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          <span className="line-clamp-2">{delay.reason}</span>
                        </div>
                      )}

                      <div className="text-xs text-gray-400 mt-2">
                        تم الإنشاء: {formatDateTime(delay.created_at)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedRequest && (
        <>
          <div
            className="fixed inset-0 bg-black/70 z-[60]"
            onClick={() => setSelectedRequest(null)}
          />
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900" dir="rtl">تفاصيل الطلب</h3>
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="space-y-4" dir="rtl">
                <div>
                  <label className="text-sm font-medium text-gray-500">نوع الإجازة</label>
                  <div className="flex items-center gap-2 mt-1">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: selectedRequest.leave_type?.color || '#6b7280' }}
                    />
                    <p className="text-base font-semibold text-gray-900">
                      {selectedRequest.leave_type?.name_ar || 'إجازة'}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">الحالة</label>
                  <div className="mt-1">
                    {getStatusBadge(selectedRequest.status)}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">المدة</label>
                  <p className="text-base text-gray-900 mt-1">
                    من {formatDate(selectedRequest.start_date)} إلى {formatDate(selectedRequest.end_date)}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    ({selectedRequest.requested_days} يوم)
                  </p>
                </div>

                {selectedRequest.reason && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">السبب</label>
                    <p className="text-base text-gray-900 mt-1">{selectedRequest.reason}</p>
                  </div>
                )}

                {selectedRequest.status === 'rejected' && selectedRequest.rejection_reason && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <label className="text-sm font-medium text-red-700">سبب الرفض</label>
                    <p className="text-sm text-red-900 mt-1">{selectedRequest.rejection_reason}</p>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-gray-500">تاريخ الإنشاء</label>
                  <p className="text-sm text-gray-600 mt-1">
                    {formatDateTime(selectedRequest.created_at)}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedRequest(null)}
                className="w-full px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
              >
                إغلاق
              </button>
            </div>
          </div>
        </>
      )}

      {selectedDelay && (
        <>
          <div
            className="fixed inset-0 bg-black/70 z-[60]"
            onClick={() => setSelectedDelay(null)}
          />
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900" dir="rtl">تفاصيل إذن التأخير</h3>
                <button
                  onClick={() => setSelectedDelay(null)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="space-y-4" dir="rtl">
                <div>
                  <label className="text-sm font-medium text-gray-500">النوع</label>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                      <Timer className="w-4 h-4 text-orange-600" />
                    </div>
                    <p className="text-base font-semibold text-gray-900">إذن تأخير</p>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">الحالة</label>
                  <div className="mt-1">
                    {getStatusBadge(selectedDelay.status)}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">التاريخ</label>
                  <p className="text-base text-gray-900 mt-1">{formatDate(selectedDelay.date)}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">الوقت</label>
                  <p className="text-base text-gray-900 mt-1">
                    من {selectedDelay.start_time} إلى {selectedDelay.end_time}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">المدة الإجمالية</label>
                  <p className="text-base font-semibold text-orange-700 mt-1">
                    {formatDuration(selectedDelay.minutes)}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">السبب</label>
                  <p className="text-base text-gray-900 mt-1">{selectedDelay.reason}</p>
                </div>

                {selectedDelay.status === 'rejected' && selectedDelay.rejection_reason && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <label className="text-sm font-medium text-red-700">سبب الرفض</label>
                    <p className="text-sm text-red-900 mt-1">{selectedDelay.rejection_reason}</p>
                  </div>
                )}

                {selectedDelay.approved_by && selectedDelay.approved_at && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <label className="text-sm font-medium text-green-700">تفاصيل الاعتماد</label>
                    <p className="text-sm text-green-900 mt-1">
                      {formatDateTime(selectedDelay.approved_at)}
                    </p>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-gray-500">تاريخ الإنشاء</label>
                  <p className="text-sm text-gray-600 mt-1">
                    {formatDateTime(selectedDelay.created_at)}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedDelay(null)}
                className="w-full px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
              >
                إغلاق
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
