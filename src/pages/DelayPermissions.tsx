import { useState, useEffect } from 'react';
import { Clock, CheckCircle2, XCircle, Calendar, User, AlertCircle, Search, Filter } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

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
  decided_by?: string;
  decided_at?: string;
  employees: {
    full_name: string;
    employee_code: string;
  };
}

interface DelayPermissionsProps {
  currentPage?: string;
}

export default function DelayPermissions({ currentPage }: DelayPermissionsProps) {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<DelayPermission[]>([]);
  const [filteredPermissions, setFilteredPermissions] = useState<DelayPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    fetchPermissions();
  }, [user]);

  useEffect(() => {
    filterPermissions();
  }, [permissions, searchTerm, statusFilter]);

  async function fetchPermissions() {
    if (!user) return;

    setLoading(true);
    try {
      const { data: adminData } = await supabase
        .from('admin_users')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (!adminData) {
        setErrorMessage('لم يتم العثور على بيانات الشركة');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('delay_permissions')
        .select(`
          *,
          employees!inner(full_name, employee_code)
        `)
        .eq('company_id', adminData.company_id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching permissions:', error);
        setErrorMessage('فشل جلب طلبات التأخير');
      } else {
        setPermissions(data || []);
      }
    } catch (error) {
      console.error('Error:', error);
      setErrorMessage('حدث خطأ أثناء جلب البيانات');
    } finally {
      setLoading(false);
    }
  }

  function filterPermissions() {
    let filtered = [...permissions];

    if (statusFilter !== 'all') {
      filtered = filtered.filter(p => p.status === statusFilter);
    }

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(p =>
        p.employees.full_name.toLowerCase().includes(search) ||
        p.employees.employee_code.toLowerCase().includes(search)
      );
    }

    setFilteredPermissions(filtered);
  }

  async function handleDecision(permissionId: string, decision: 'approved' | 'rejected') {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('delay_permissions')
        .update({
          status: decision,
          decided_by: user.id,
          decided_at: new Date().toISOString()
        })
        .eq('id', permissionId);

      if (error) {
        console.error('Error updating permission:', error);
        setErrorMessage('فشل تحديث حالة الطلب');
        return;
      }

      setSuccessMessage(decision === 'approved' ? 'تم اعتماد الطلب بنجاح' : 'تم رفض الطلب');
      await fetchPermissions();

      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (error) {
      console.error('Error:', error);
      setErrorMessage('حدث خطأ أثناء تحديث الطلب');
    }
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

  const pendingCount = permissions.filter(p => p.status === 'pending').length;
  const approvedCount = permissions.filter(p => p.status === 'approved').length;
  const rejectedCount = permissions.filter(p => p.status === 'rejected').length;

  if (currentPage !== 'delay-permissions') return null;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
            <Clock className="w-8 h-8 text-blue-600" />
            إدارة طلبات إذن التأخير
          </h1>
          <p className="text-gray-600 mt-2">
            اعتماد أو رفض طلبات إذن التأخير المقدمة من الموظفين
          </p>
        </div>
      </div>

      {successMessage && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-6 border border-yellow-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-yellow-700 text-sm font-medium">قيد المراجعة</p>
              <p className="text-3xl font-bold text-yellow-900 mt-2">{pendingCount}</p>
            </div>
            <Clock className="w-12 h-12 text-yellow-600 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-700 text-sm font-medium">معتمد</p>
              <p className="text-3xl font-bold text-green-900 mt-2">{approvedCount}</p>
            </div>
            <CheckCircle2 className="w-12 h-12 text-green-600 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-6 border border-red-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-700 text-sm font-medium">مرفوض</p>
              <p className="text-3xl font-bold text-red-900 mt-2">{rejectedCount}</p>
            </div>
            <XCircle className="w-12 h-12 text-red-600 opacity-50" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="بحث بالاسم أو كود الموظف..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="text-gray-400 w-5 h-5" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">جميع الحالات</option>
                <option value="pending">قيد المراجعة</option>
                <option value="approved">معتمد</option>
                <option value="rejected">مرفوض</option>
              </select>
            </div>
          </div>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <p className="text-gray-500 mt-4">جاري التحميل...</p>
            </div>
          ) : filteredPermissions.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">لا توجد طلبات إذن تأخير</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPermissions.map((permission) => (
                <div
                  key={permission.id}
                  className="border rounded-lg p-6 hover:shadow-md transition-shadow bg-gray-50"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <User className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-800 text-lg">
                            {permission.employees.full_name}
                          </h3>
                          <p className="text-sm text-gray-500">
                            {permission.employees.employee_code}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-600">التاريخ:</span>
                          <span className="font-semibold text-gray-800">
                            {new Date(permission.date).toLocaleDateString('ar-SA', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-600">الوقت:</span>
                          <span className="font-semibold text-gray-800">
                            {permission.start_time} - {permission.end_time}
                          </span>
                        </div>
                      </div>

                      <div className="bg-white rounded-lg p-3 mb-4 border border-gray-200">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">المدة الإجمالية:</span>
                          <span className="text-lg font-bold text-blue-600">
                            {formatMinutesToHours(permission.minutes)}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1 text-left">
                          ({permission.minutes} دقيقة)
                        </div>
                      </div>

                      {permission.reason && (
                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-4">
                          <p className="text-sm font-medium text-gray-700 mb-1">السبب:</p>
                          <p className="text-sm text-gray-600">{permission.reason}</p>
                        </div>
                      )}

                      <div className="text-xs text-gray-500">
                        تاريخ الطلب: {new Date(permission.created_at).toLocaleString('ar-SA')}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-3">
                      <div
                        className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap ${
                          permission.status === 'approved'
                            ? 'bg-green-100 text-green-700'
                            : permission.status === 'rejected'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {permission.status === 'approved'
                          ? 'معتمد'
                          : permission.status === 'rejected'
                          ? 'مرفوض'
                          : 'قيد المراجعة'}
                      </div>

                      {permission.status === 'pending' && (
                        <div className="flex flex-col gap-2 w-full">
                          <button
                            onClick={() => handleDecision(permission.id, 'approved')}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 text-sm font-medium whitespace-nowrap"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            اعتماد
                          </button>
                          <button
                            onClick={() => handleDecision(permission.id, 'rejected')}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2 text-sm font-medium whitespace-nowrap"
                          >
                            <XCircle className="w-4 h-4" />
                            رفض
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
