import { useEffect, useState } from 'react';
import { X, UserX, Clock, MapPin, AlertCircle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface AbsentEmployee {
  employee_id: string;
  employee_name: string;
  employee_code: string;
  branch_name: string;
  shift_name: string;
  shift_start_time: string;
  minutes_late: number;
}

interface AbsentEmployeesModalProps {
  isOpen: boolean;
  onClose: () => void;
  expectedCount?: number;
}

export default function AbsentEmployeesModal({ isOpen, onClose, expectedCount }: AbsentEmployeesModalProps) {
  const { language } = useLanguage();
  const { companyId } = useAuth();
  const [absentEmployees, setAbsentEmployees] = useState<AbsentEmployee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && companyId) {
      fetchAbsentEmployees();
    }
  }, [isOpen, companyId]);

  async function fetchAbsentEmployees() {
    if (!companyId) return;

    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];

      // Admin-only debug logging
      console.log('[AbsentEmployeesModal] Fetching absent employees on click:', {
        companyId,
        date: today,
        startOfDayISO: `${today}T00:00:00Z`,
        endOfDayISO: `${today}T23:59:59Z`,
        expectedCountFromCard: expectedCount
      });

      // Use the SAME RPC call with SAME parameters as the count query
      const { data, error } = await supabase.rpc('get_absent_employees_list', {
        p_day: today,
        p_company_id: companyId
      });

      const employees = data || [];

      // Admin-only debug logging
      console.log('[AbsentEmployeesModal] Fetched result:', {
        returnedCount: employees.length,
        firstThreeIds: employees.slice(0, 3).map((e: AbsentEmployee) => e.employee_id),
        allEmployeeIds: employees.map((e: AbsentEmployee) => e.employee_id),
        supabaseError: error ? error.message : null
      });

      // Detect mismatch: count > 0 but details returns 0
      if (expectedCount && expectedCount > 0 && employees.length === 0) {
        console.error('[AbsentEmployeesModal] MISMATCH DETECTED:', {
          message: 'Count query returned positive count, but details query returned empty list',
          expectedCount,
          actualCount: employees.length,
          countQueryParams: {
            p_day: today,
            p_company_id: companyId,
            rpc: 'get_absent_today_count'
          },
          detailsQueryParams: {
            p_day: today,
            p_company_id: companyId,
            rpc: 'get_absent_employees_list'
          },
          supabaseError: error ? {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code
          } : null
        });
      }

      if (error) {
        console.error('[AbsentEmployeesModal] Supabase error:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        setAbsentEmployees([]);
      } else {
        setAbsentEmployees(employees);
      }
    } catch (error) {
      console.error('[AbsentEmployeesModal] Exception:', error);
      setAbsentEmployees([]);
    } finally {
      setLoading(false);
    }
  }

  function formatTime(timeString: string): string {
    if (!timeString) return '--:--';
    const [hours, minutes] = timeString.split(':');
    return `${hours}:${minutes}`;
  }

  function formatMinutesLate(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (language === 'ar') {
      if (hours > 0) {
        return `${hours} ساعة و ${mins} دقيقة`;
      }
      return `${mins} دقيقة`;
    } else {
      if (hours > 0) {
        return `${hours}h ${mins}m`;
      }
      return `${mins}m`;
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <UserX className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {language === 'ar' ? 'الموظفون الغائبون اليوم' : 'Absent Employees Today'}
              </h2>
              <p className="text-sm text-gray-500">
                {language === 'ar' ? 'الموظفون الذين لم يسجلوا الحضور' : 'Employees who have not checked in'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
            </div>
          ) : absentEmployees.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <UserX className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {language === 'ar' ? 'لا يوجد موظفون غائبون' : 'No Absent Employees'}
              </h3>
              <p className="text-gray-500">
                {language === 'ar'
                  ? 'جميع الموظفين المتوقعون قد سجلوا الحضور اليوم'
                  : 'All expected employees have checked in today'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-600">
                  {language === 'ar'
                    ? `إجمالي الغياب: ${absentEmployees.length}`
                    : `Total Absent: ${absentEmployees.length}`}
                </p>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <AlertCircle className="w-4 h-4" />
                  <span>
                    {language === 'ar'
                      ? 'يتم الحساب بعد فترة السماح + نافذة التأخير'
                      : 'Calculated after grace period + late window'}
                  </span>
                </div>
              </div>

              {absentEmployees.map((employee) => (
                <div
                  key={employee.employee_id}
                  className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                          <UserX className="w-5 h-5 text-gray-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 truncate">
                            {employee.employee_name}
                          </h3>
                          <p className="text-sm text-gray-500">
                            {language === 'ar' ? 'كود:' : 'Code:'} {employee.employee_code}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <span className="text-gray-700 truncate">
                            {employee.branch_name || (language === 'ar' ? 'لا يوجد' : 'N/A')}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <span className="text-gray-700">
                            {employee.shift_name} - {formatTime(employee.shift_start_time)}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-sm">
                          <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                          <span className="text-amber-600 font-medium">
                            {language === 'ar' ? 'تأخر' : 'Late'}: {formatMinutesLate(employee.minutes_late)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 p-6 bg-gray-50">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              {language === 'ar'
                ? 'هذه القائمة لا تشمل الموظفين في إجازة أو مهمة خارجية'
                : 'This list excludes employees on leave or free tasks'}
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              {language === 'ar' ? 'إغلاق' : 'Close'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
