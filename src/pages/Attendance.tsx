import { useEffect, useState } from 'react';
import { Clock, Calendar, MapPin, CheckCircle, XCircle, AlertCircle, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';

interface AttendanceProps {
  currentPage?: string;
  onNavigate?: (page: string, params?: Record<string, any>) => void;
  pageParams?: Record<string, any>;
}

interface AttendanceRecord {
  id: string;
  check_in_time: string | null;
  check_out_time: string | null;
  check_in_latitude: number | null;
  check_in_longitude: number | null;
  check_in_accuracy: number | null;
  total_working_hours: number | null;
  status: string | null;
  late_minutes: number;
  early_leave_minutes: number;
  employees?: {
    full_name: string;
    employee_code: string;
  };
  branches?: {
    name: string;
  } | null;
  employee_full_name?: string;
  employee_code?: string;
  branch_name?: string;
}

interface Branch {
  id: string;
  name: string;
}

export default function Attendance({ currentPage, onNavigate, pageParams }: AttendanceProps) {
  const { t, language } = useLanguage();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const filterMode = pageParams?.mode;

  useEffect(() => {
    if (currentPage === 'attendance') {
      fetchBranches();
      fetchAttendance();
    }
  }, [currentPage, selectedDate, selectedBranch, filterMode]);

  async function fetchBranches() {
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setBranches(data || []);
    } catch (error) {
      console.error('Error fetching branches:', error);
    }
  }

  async function fetchAttendance() {
    try {
      setLoading(true);

      if (filterMode === 'present_now' || filterMode === 'present_today') {
        const branchId = selectedBranch === 'all' ? null : selectedBranch;
        const rpcFunction = filterMode === 'present_now' ? 'get_present_now' : 'get_present_today';

        const { data, error } = await supabase.rpc(rpcFunction, {
          p_day: selectedDate,
          p_branch_id: branchId
        });

        if (error) throw error;

        const transformedData = (data || []).map((record: any) => ({
          id: record.id,
          check_in_time: record.check_in_time,
          check_out_time: record.check_out_time,
          check_in_latitude: record.check_in_latitude,
          check_in_longitude: record.check_in_longitude,
          check_in_accuracy: record.check_in_accuracy,
          total_working_hours: record.total_working_hours,
          status: record.status,
          late_minutes: record.late_minutes || 0,
          early_leave_minutes: record.early_leave_minutes || 0,
          employees: {
            full_name: record.employee_full_name,
            employee_code: record.employee_code
          },
          branches: record.branch_name ? { name: record.branch_name } : null
        }));

        setRecords(transformedData);
      } else {
        let query = supabase
          .from('attendance_logs')
          .select(`
            *,
            employees (full_name, employee_code),
            branches (name)
          `)
          .gte('check_in_time', selectedDate)
          .lt('check_in_time', new Date(new Date(selectedDate).getTime() + 86400000).toISOString());

        if (selectedBranch !== 'all') {
          query = query.eq('branch_id', selectedBranch);
        }

        query = query.order('check_in_time', { ascending: false });

        const { data, error } = await query;

        if (error) throw error;
        setRecords(data || []);
      }
    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      setLoading(false);
    }
  }

  function getStatusBadge(status: string | null) {
    switch (status) {
      case 'on_time':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
            <CheckCircle size={14} />
            {t('attendance.onTime')}
          </span>
        );
      case 'late':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded">
            <AlertCircle size={14} />
            {t('attendance.late')}
          </span>
        );
      case 'early_leave':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded">
            <AlertCircle size={14} />
            {t('attendance.earlyLeave')}
          </span>
        );
      case 'absent':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-100 text-red-700 text-xs font-medium rounded">
            <XCircle size={14} />
            {t('attendance.absent')}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded">
            <Clock size={14} />
            {t('attendance.pending')}
          </span>
        );
    }
  }

  function formatTime(timestamp: string | null) {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function clearFilter() {
    if (onNavigate) {
      onNavigate('attendance', {});
    }
  }

  const isPresentNowMode = filterMode === 'present_now';
  const isPresentTodayMode = filterMode === 'present_today';
  const isFilterActive = isPresentNowMode || isPresentTodayMode;

  const pageTitle = isPresentNowMode
    ? (language === 'ar' ? 'الحاضرون الآن' : 'Present Now')
    : isPresentTodayMode
    ? (language === 'ar' ? 'الحاضرون اليوم' : 'Present Today')
    : t('attendance.title');

  const pageSubtitle = isPresentNowMode
    ? (language === 'ar' ? 'الموظفون الذين سجلوا حضور ولم يسجلوا انصراف' : 'Employees who checked in but have not checked out yet')
    : isPresentTodayMode
    ? (language === 'ar' ? 'جميع الموظفين الذين سجلوا حضور اليوم' : 'All employees who checked in today')
    : t('attendance.monitorCheckIns');

  const filterLabel = isPresentNowMode
    ? (language === 'ar' ? 'فلتر: الحاضرون الآن' : 'Filter: Present Now')
    : isPresentTodayMode
    ? (language === 'ar' ? 'فلتر: الحاضرون اليوم' : 'Filter: Present Today')
    : '';

  if (currentPage !== 'attendance') return null;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h1 className="text-3xl font-bold text-slate-800">{pageTitle}</h1>
            {isFilterActive && (
              <button
                onClick={clearFilter}
                className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
                  isPresentNowMode
                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                }`}
                dir={language === 'ar' ? 'rtl' : 'ltr'}
              >
                <span>{filterLabel}</span>
                <X size={16} />
              </button>
            )}
          </div>
          <p className="text-slate-600">{pageSubtitle}</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
          >
            <option value="all">{t('attendance.allBranches')}</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <Calendar className="text-slate-400" size={20} />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <p className="text-sm text-slate-600 mb-1">{t('attendance.totalRecords')}</p>
          <p className="text-2xl font-bold text-slate-800">{records.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <p className="text-sm text-green-600 mb-1">{t('attendance.onTime')}</p>
          <p className="text-2xl font-bold text-green-700">
            {records.filter((r) => r.status === 'on_time').length}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <p className="text-sm text-orange-600 mb-1">{t('attendance.lateArrivals')}</p>
          <p className="text-2xl font-bold text-orange-700">
            {records.filter((r) => r.status === 'late').length}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <p className="text-sm text-slate-600 mb-1">{t('attendance.pending')}</p>
          <p className="text-2xl font-bold text-slate-700">
            {records.filter((r) => !r.check_out_time).length}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse bg-slate-100 h-20 rounded-lg" />
            ))}
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="mx-auto text-slate-400 mb-3" size={48} />
            <p className="text-slate-600 font-medium mb-1">
              {isPresentTodayMode
                ? (language === 'ar' ? 'لا يوجد حضور اليوم' : 'No attendance today')
                : t('attendance.noRecords')}
            </p>
            <p className="text-sm text-slate-500">
              {isPresentTodayMode
                ? (language === 'ar' ? 'لم يقم أي موظف بتسجيل حضور اليوم' : 'No employee has checked in today')
                : t('attendance.noRecordsDesc')}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">{t('attendance.employee')}</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">{t('attendance.branch')}</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">{t('attendance.checkIn')}</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">{t('attendance.checkOut')}</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">{t('attendance.hours')}</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">{t('attendance.location')}</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">{t('attendance.status')}</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-4 px-4">
                      <div>
                        <p className="font-medium text-slate-800">{record.employees?.full_name || 'N/A'}</p>
                        <p className="text-xs text-slate-500">{record.employees?.employee_code || 'N/A'}</p>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-sm text-slate-600">
                      {record.branches?.name || 'N/A'}
                    </td>
                    <td className="py-4 px-4">
                      <div>
                        <p className="text-sm font-medium text-slate-700">
                          {formatTime(record.check_in_time)}
                        </p>
                        {record.check_in_accuracy && (
                          <p className="text-xs text-slate-500">±{record.check_in_accuracy.toFixed(0)}m</p>
                        )}
                        {record.late_minutes > 0 && (
                          <p className="text-xs text-orange-600 font-medium">
                            {language === 'ar' ? `تأخير: ${record.late_minutes} دقيقة` : `Late: ${record.late_minutes} min`}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div>
                        <p className="text-sm font-medium text-slate-700">
                          {formatTime(record.check_out_time)}
                        </p>
                        {record.early_leave_minutes > 0 && (
                          <p className="text-xs text-yellow-600 font-medium">
                            {language === 'ar' ? `انصراف مبكر: ${record.early_leave_minutes} دقيقة` : `Early: ${record.early_leave_minutes} min`}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-sm font-medium text-slate-700">
                        {record.total_working_hours ? `${record.total_working_hours.toFixed(1)}h` : '-'}
                      </p>
                    </td>
                    <td className="py-4 px-4">
                      {record.check_in_latitude && record.check_in_longitude ? (
                        <button className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700">
                          <MapPin size={14} />
                          <span>{t('attendance.viewMap')}</span>
                        </button>
                      ) : (
                        <span className="text-sm text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-4 px-4">{getStatusBadge(record.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
