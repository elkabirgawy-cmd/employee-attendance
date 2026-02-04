import { useEffect, useState } from 'react';
import { UserCheck, ArrowLeft, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';

interface PresentNowProps {
  currentPage?: string;
  onNavigate?: (page: string) => void;
}

interface EmployeeAttendance {
  employee_id: string;
  employee_name: string;
  employee_number: string;
  check_in_time: string;
  status: string;
  shift_start?: string;
  shift_end?: string;
}

export default function PresentNow({ currentPage, onNavigate }: PresentNowProps) {
  const { language } = useLanguage();
  const [employees, setEmployees] = useState<EmployeeAttendance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentPage === 'present-now') {
      fetchPresentNow();
    }
  }, [currentPage]);

  async function fetchPresentNow() {
    setLoading(true);
    try {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();

      const { data: attendanceData, error } = await supabase
        .from('attendance_logs')
        .select(`
          employee_id,
          check_in_time,
          status,
          employees!inner(
            full_name,
            employee_number,
            is_active,
            shift_id
          ),
          shifts(
            start_time,
            end_time
          )
        `)
        .gte('check_in_time', startOfDay)
        .lte('check_in_time', endOfDay)
        .not('check_in_time', 'is', null)
        .is('check_out_time', null)
        .eq('employees.is_active', true)
        .order('check_in_time', { ascending: false });

      if (error) throw error;

      const employeeMap = new Map<string, EmployeeAttendance>();

      attendanceData?.forEach((log: any) => {
        if (!employeeMap.has(log.employee_id)) {
          employeeMap.set(log.employee_id, {
            employee_id: log.employee_id,
            employee_name: log.employees.full_name,
            employee_number: log.employees.employee_number,
            check_in_time: log.check_in_time,
            status: log.status || 'on_time',
            shift_start: log.shifts?.start_time,
            shift_end: log.shifts?.end_time,
          });
        }
      });

      setEmployees(Array.from(employeeMap.values()));
    } catch (error) {
      console.error('Error fetching present now:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleBack() {
    if (onNavigate) {
      onNavigate('dashboard');
    }
  }

  function getInitials(name: string) {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  function formatTime(timeString: string) {
    const date = new Date(timeString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }

  function calculateDuration(checkInTime: string) {
    const checkIn = new Date(checkInTime);
    const now = new Date();
    const diff = Math.floor((now.getTime() - checkIn.getTime()) / 1000 / 60);

    if (diff < 60) {
      return language === 'ar' ? `${diff} دقيقة` : `${diff} min`;
    }

    const hours = Math.floor(diff / 60);
    const minutes = diff % 60;

    if (language === 'ar') {
      return `${hours} ساعة${minutes > 0 ? ` ${minutes} دقيقة` : ''}`;
    }
    return `${hours}h${minutes > 0 ? ` ${minutes}m` : ''}`;
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'on_time':
        return 'bg-green-100 text-green-700';
      case 'late':
        return 'bg-red-100 text-red-700';
      case 'early':
        return 'bg-blue-100 text-blue-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  }

  function getStatusLabel(status: string) {
    if (language === 'ar') {
      switch (status) {
        case 'on_time':
          return 'في الموعد';
        case 'late':
          return 'متأخر';
        case 'early':
          return 'مبكر';
        default:
          return 'غير محدد';
      }
    } else {
      switch (status) {
        case 'on_time':
          return 'On Time';
        case 'late':
          return 'Late';
        case 'early':
          return 'Early';
        default:
          return 'Unknown';
      }
    }
  }

  if (currentPage !== 'present-now') return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="px-4 py-4">
          <div className="flex items-center gap-3" dir={language === 'ar' ? 'rtl' : 'ltr'}>
            <button
              onClick={handleBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft size={24} className={language === 'ar' ? 'rotate-180' : ''} />
            </button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">
                {language === 'ar' ? 'الحاضرون الآن' : 'Present Now'}
              </h1>
              <p className="text-sm text-gray-500">
                {language === 'ar'
                  ? `${employees.length} موظف حاليًا في العمل`
                  : `${employees.length} employees currently at work`}
              </p>
            </div>
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
              <UserCheck className="text-emerald-600" size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-4 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-200 rounded-full" />
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-32 mb-2" />
                    <div className="h-3 bg-gray-200 rounded w-24" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : employees.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="text-gray-400" size={32} />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {language === 'ar' ? 'لا يوجد موظفين حاليًا' : 'No Employees Currently'}
            </h3>
            <p className="text-gray-500">
              {language === 'ar'
                ? 'لا يوجد موظفين في العمل حاليًا'
                : 'No employees are currently at work'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {employees.map((emp) => (
              <div
                key={emp.employee_id}
                className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div
                  className="flex items-center gap-3"
                  dir={language === 'ar' ? 'rtl' : 'ltr'}
                >
                  {/* Avatar with pulse animation */}
                  <div className="relative flex-shrink-0">
                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full flex items-center justify-center text-white font-semibold">
                      {getInitials(emp.employee_name)}
                    </div>
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white animate-pulse" />
                  </div>

                  {/* Employee Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {emp.employee_name}
                      </h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(emp.status)}`}>
                        {getStatusLabel(emp.status)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-500 flex-wrap">
                      <span className="flex items-center gap-1">
                        <UserCheck size={14} />
                        {formatTime(emp.check_in_time)}
                      </span>
                      <span className="text-xs font-medium text-emerald-600">
                        {calculateDuration(emp.check_in_time)}
                      </span>
                      {emp.shift_start && (
                        <span className="text-xs">
                          {language === 'ar' ? 'وردية:' : 'Shift:'} {emp.shift_start} - {emp.shift_end}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Active Indicator */}
                  <div className="w-3 h-3 rounded-full bg-green-500 flex-shrink-0 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
