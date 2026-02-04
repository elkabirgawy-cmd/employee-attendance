import { useEffect, useState } from 'react';
import { Calendar, CheckCircle, XCircle, Clock, User, MapPin, FileText, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatDateRange, type LeaveType } from '../utils/leaveCalculations';
import { useAuth } from '../contexts/AuthContext';
import DelayPermissionModal from '../components/DelayPermissionModal';

interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  requested_days: number;
  reason: string | null;
  status: string;
  rejection_reason: string | null;
  created_at: string;
  decided_at: string | null;
  employees?: {
    full_name: string;
    employee_code: string;
    branch_id: string;
  };
  leave_types?: LeaveType;
  branches?: {
    name: string;
  };
}

interface LeaveRequestsProps {
  currentPage?: string;
}

interface DelayPermission {
  id: string;
  employee_id: string;
  date: string;
  start_time: string;
  end_time: string;
  minutes: number;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  employees?: {
    full_name: string;
    employee_code: string;
  };
}

export default function LeaveRequests({ currentPage }: LeaveRequestsProps) {
  const { companyId, user } = useAuth();
  const [viewMode, setViewMode] = useState<'leave' | 'delay'>('leave');
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [delayPermissions, setDelayPermissions] = useState<DelayPermission[]>([]);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [loading, setLoading] = useState(true);
  const [rejectionReason, setRejectionReason] = useState('');
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [isDelayPermissionModalOpen, setIsDelayPermissionModalOpen] = useState(false);

  useEffect(() => {
    if (currentPage === 'leave-requests') {
      if (viewMode === 'leave') {
        fetchRequests();
      } else {
        fetchDelayPermissions();
      }
    }
  }, [currentPage, activeTab, viewMode]);

  async function fetchRequests() {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('leave_requests')
        .select(`
          *,
          employees(full_name, employee_code, branch_id),
          leave_types(*)
        `)
        .eq('company_id', companyId)
        .eq('status', activeTab)
        .order('created_at', { ascending: false });

      if (data) {
        const requestsWithBranches = await Promise.all(
          data.map(async (request) => {
            if (request.employees?.branch_id) {
              const { data: branchData } = await supabase
                .from('branches')
                .select('name')
                .eq('id', request.employees.branch_id)
                .maybeSingle();

              return { ...request, branches: branchData };
            }
            return request;
          })
        );

        setRequests(requestsWithBranches);
      }
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchDelayPermissions() {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('delay_permissions')
        .select(`
          *,
          employees(full_name, employee_code)
        `)
        .eq('company_id', companyId)
        .eq('status', activeTab)
        .order('created_at', { ascending: false });

      if (data) setDelayPermissions(data);
    } catch (error) {
      console.error('Error fetching delay permissions:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleApproveDelayPermission(permissionId: string) {
    try {
      await supabase
        .from('delay_permissions')
        .update({
          status: 'approved',
          decided_by: user?.id,
          decided_at: new Date().toISOString()
        })
        .eq('id', permissionId)
        .eq('company_id', companyId);

      alert('تم قبول إذن التأخير');
      fetchDelayPermissions();
    } catch (error: any) {
      alert('خطأ في قبول إذن التأخير: ' + error.message);
    }
  }

  async function handleRejectDelayPermission(permissionId: string) {
    try {
      await supabase
        .from('delay_permissions')
        .update({
          status: 'rejected',
          decided_by: user?.id,
          decided_at: new Date().toISOString()
        })
        .eq('id', permissionId)
        .eq('company_id', companyId);

      alert('تم رفض إذن التأخير');
      fetchDelayPermissions();
    } catch (error: any) {
      alert('خطأ في رفض إذن التأخير: ' + error.message);
    }
  }

  async function handleApprove(requestId: string, requestedDays: number, leaveTypeId: string, employeeId: string) {
    try {
      const { data: userData } = await supabase.auth.getUser();

      const currentYear = new Date().getFullYear();
      const { data: balance } = await supabase
        .from('leave_balances')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('leave_type_id', leaveTypeId)
        .eq('company_id', companyId)
        .eq('year', currentYear)
        .maybeSingle();

      if (balance) {
        await supabase
          .from('leave_balances')
          .update({
            used_days: balance.used_days + requestedDays,
            updated_at: new Date().toISOString()
          })
          .eq('id', balance.id)
          .eq('company_id', companyId);
      }

      await supabase
        .from('leave_requests')
        .update({
          status: 'approved',
          decided_by: userData?.user?.id,
          decided_at: new Date().toISOString()
        })
        .eq('id', requestId)
        .eq('company_id', companyId);

      alert('تم قبول الطلب بنجاح');
      fetchRequests();
    } catch (error: any) {
      alert('خطأ في قبول الطلب: ' + error.message);
    }
  }

  async function handleReject(requestId: string) {
    if (!rejectionReason.trim()) {
      alert('الرجاء إدخال سبب الرفض');
      return;
    }

    try {
      const { data: userData } = await supabase.auth.getUser();

      await supabase
        .from('leave_requests')
        .update({
          status: 'rejected',
          rejection_reason: rejectionReason,
          decided_by: userData?.user?.id,
          decided_at: new Date().toISOString()
        })
        .eq('id', requestId)
        .eq('company_id', companyId);

      alert('تم رفض الطلب');
      setSelectedRequestId(null);
      setRejectionReason('');
      fetchRequests();
    } catch (error: any) {
      alert('خطأ في رفض الطلب: ' + error.message);
    }
  }

  const filteredRequests = requests.filter(req => req.status === activeTab);

  if (currentPage !== 'leave-requests') return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50" dir="rtl">
      <div className="max-w-7xl mx-auto p-6">
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl">
                {viewMode === 'leave' ? <Calendar className="w-8 h-8 text-white" /> : <Clock className="w-8 h-8 text-white" />}
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-800">
                  {viewMode === 'leave' ? 'طلبات الإجازات' : 'أذونات التأخير'}
                </h1>
                <p className="text-gray-600">
                  {viewMode === 'leave' ? 'مراجعة واعتماد طلبات الإجازات' : 'مراجعة واعتماد أذونات التأخير'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsDelayPermissionModalOpen(true)}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white font-semibold rounded-lg hover:from-orange-600 hover:to-red-700 transition-all shadow-md"
            >
              <Clock className="w-5 h-5" />
              <span>إذن تأخير</span>
            </button>
          </div>

          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setViewMode('leave')}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                viewMode === 'leave'
                  ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>طلبات الإجازات</span>
              </div>
            </button>
            <button
              onClick={() => setViewMode('delay')}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                viewMode === 'delay'
                  ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Clock className="w-4 h-4" />
                <span>أذونات التأخير</span>
              </div>
            </button>
          </div>

          <div className="flex gap-2 mb-6 border-b">
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-6 py-3 font-semibold transition-all ${
                activeTab === 'pending'
                  ? 'border-b-2 border-yellow-600 text-yellow-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Clock className="w-5 h-5 inline ml-2" />
              قيد المراجعة ({viewMode === 'leave' ? requests.filter(r => r.status === 'pending').length : delayPermissions.filter(d => d.status === 'pending').length})
            </button>
            <button
              onClick={() => setActiveTab('approved')}
              className={`px-6 py-3 font-semibold transition-all ${
                activeTab === 'approved'
                  ? 'border-b-2 border-green-600 text-green-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <CheckCircle className="w-5 h-5 inline ml-2" />
              معتمد ({viewMode === 'leave' ? requests.filter(r => r.status === 'approved').length : delayPermissions.filter(d => d.status === 'approved').length})
            </button>
            <button
              onClick={() => setActiveTab('rejected')}
              className={`px-6 py-3 font-semibold transition-all ${
                activeTab === 'rejected'
                  ? 'border-b-2 border-red-600 text-red-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <XCircle className="w-5 h-5 inline ml-2" />
              مرفوض ({viewMode === 'leave' ? requests.filter(r => r.status === 'rejected').length : delayPermissions.filter(d => d.status === 'rejected').length})
            </button>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-600">جاري التحميل...</p>
            </div>
          ) : viewMode === 'leave' ? (
            filteredRequests.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>لا توجد طلبات في هذا القسم</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredRequests.map(request => (
                <div key={request.id} className="bg-white border-2 rounded-xl p-6 hover:shadow-lg transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                          <User className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-gray-800">
                            {request.employees?.full_name}
                          </h3>
                          <p className="text-sm text-gray-500">
                            {request.employees?.employee_code}
                            {request.branches?.name && (
                              <span className="mx-2">•</span>
                            )}
                            {request.branches?.name}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="flex items-center gap-2">
                          <div
                            className="px-3 py-1 rounded-full text-sm font-bold"
                            style={{
                              backgroundColor: request.leave_types?.color + '20',
                              color: request.leave_types?.color
                            }}
                          >
                            {request.leave_types?.name_ar}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-sm text-gray-600">عدد الأيام:</span>
                          <span className="font-bold text-lg text-gray-800 mr-2">
                            {request.requested_days} يوم
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-gray-700 mb-3">
                        <Calendar className="w-5 h-5 text-blue-600" />
                        <span className="font-medium">
                          {formatDateRange(request.start_date, request.end_date)}
                        </span>
                      </div>

                      {request.reason && (
                        <div className="bg-gray-50 rounded-lg p-3 mb-3">
                          <p className="text-sm text-gray-700">
                            <strong>السبب:</strong> {request.reason}
                          </p>
                        </div>
                      )}

                      {request.rejection_reason && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                          <div className="flex items-start gap-2">
                            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="font-bold text-red-800 text-sm">سبب الرفض:</p>
                              <p className="text-sm text-red-700">{request.rejection_reason}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="text-xs text-gray-500 mt-3">
                        تاريخ الطلب: {new Date(request.created_at).toLocaleString('ar-SA')}
                      </div>
                    </div>

                    {activeTab === 'pending' && (
                      <div className="flex flex-col gap-2 mr-4">
                        <button
                          onClick={() => handleApprove(
                            request.id,
                            request.requested_days,
                            request.leave_type_id,
                            request.employee_id
                          )}
                          className="px-6 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center gap-2"
                        >
                          <CheckCircle className="w-5 h-5" />
                          قبول
                        </button>
                        <button
                          onClick={() => {
                            if (selectedRequestId === request.id) {
                              setSelectedRequestId(null);
                              setRejectionReason('');
                            } else {
                              setSelectedRequestId(request.id);
                              setRejectionReason('');
                            }
                          }}
                          className="px-6 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors flex items-center gap-2"
                        >
                          <XCircle className="w-5 h-5" />
                          رفض
                        </button>
                      </div>
                    )}
                  </div>

                  {selectedRequestId === request.id && (
                    <div className="mt-4 pt-4 border-t">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        سبب الرفض
                      </label>
                      <textarea
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                        rows={3}
                        placeholder="اكتب سبب الرفض..."
                      />
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => handleReject(request.id)}
                          className="px-6 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700"
                        >
                          تأكيد الرفض
                        </button>
                        <button
                          onClick={() => {
                            setSelectedRequestId(null);
                            setRejectionReason('');
                          }}
                          className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-400"
                        >
                          إلغاء
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              </div>
            )
          ) : (
            delayPermissions.filter(d => d.status === activeTab).length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Clock className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>لا توجد أذونات تأخير في هذا القسم</p>
              </div>
            ) : (
              <div className="space-y-4">
                {delayPermissions.filter(d => d.status === activeTab).map(permission => (
                  <div key={permission.id} className="bg-white border-2 rounded-xl p-6 hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                            <Clock className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-gray-800">
                              {permission.employees?.full_name}
                            </h3>
                            <p className="text-sm text-gray-500">
                              {permission.employees?.employee_code}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-blue-600" />
                            <span className="font-medium text-gray-700">
                              {new Date(permission.date).toLocaleDateString('ar-SA')}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="w-5 h-5 text-orange-600" />
                            <span className="font-medium text-gray-700">
                              {permission.start_time} - {permission.end_time}
                            </span>
                          </div>
                        </div>

                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700">المدة الإجمالية:</span>
                            <span className="text-lg font-bold text-blue-700">
                              {Math.floor(permission.minutes / 60) > 0 && `${Math.floor(permission.minutes / 60)} ساعة `}
                              {permission.minutes % 60 > 0 && `${permission.minutes % 60} دقيقة`}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            ({permission.minutes} دقيقة)
                          </div>
                        </div>

                        {permission.reason && (
                          <div className="bg-gray-50 rounded-lg p-3 mb-3">
                            <p className="text-sm text-gray-700">
                              <strong>السبب:</strong> {permission.reason}
                            </p>
                          </div>
                        )}

                        <div className="text-xs text-gray-500 mt-3">
                          تاريخ الطلب: {new Date(permission.created_at).toLocaleString('ar-SA')}
                        </div>
                      </div>

                      {activeTab === 'pending' && (
                        <div className="flex flex-col gap-2 mr-4">
                          <button
                            onClick={() => handleApproveDelayPermission(permission.id)}
                            className="px-6 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 flex items-center gap-2"
                          >
                            <CheckCircle className="w-5 h-5" />
                            موافقة
                          </button>
                          <button
                            onClick={() => handleRejectDelayPermission(permission.id)}
                            className="px-6 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 flex items-center gap-2"
                          >
                            <XCircle className="w-5 h-5" />
                            رفض
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>

      {companyId && (
        <DelayPermissionModal
          isOpen={isDelayPermissionModalOpen}
          onClose={() => setIsDelayPermissionModalOpen(false)}
          companyId={companyId}
        />
      )}
    </div>
  );
}
