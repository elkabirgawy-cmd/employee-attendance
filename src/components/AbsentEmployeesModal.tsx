import { useEffect, useState } from 'react';
import { X, UserX, Clock, MapPin, AlertCircle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import AdminDetailsPanel from './admin-ui/AdminDetailsPanel';
import AdminEmptyState from './admin-ui/AdminEmptyState';

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

      if (expectedCount && expectedCount > 0 && employees.length === 0) {
        console.error('[AbsentEmployeesModal] MISMATCH DETECTED: expected > 0 but got 0');
      }

      if (error) {
        console.error('[AbsentEmployeesModal] Supabase error:', error);
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
      if (hours > 0) return `${hours} ساعة و ${mins} دقيقة`;
      return `${mins} دقيقة`;
    } else {
      if (hours > 0) return `${hours}h ${mins}m`;
      return `${mins}m`;
    }
  }

  return (
    <AdminDetailsPanel
      isOpen={isOpen}
      onClose={onClose}
      title={language === 'ar' ? 'الموظفون الغائبون اليوم' : 'Absent Employees Today'}
      subtitle={language === 'ar' ? 'الموظفون الذين لم يسجلوا الحضور' : 'Employees who have not checked in'}
      icon={UserX}
      footer={
        <div className="flex items-center justify-between w-full">
          <p className="text-xs text-slate-500">
            {language === 'ar'
              ? 'تستثني هذه القائمة الموظفين في إجازة'
              : 'Excludes employees on leave'}
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition-colors shadow-sm"
          >
            {language === 'ar' ? 'إغلاق' : 'Close'}
          </button>
        </div>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
        </div>
      ) : absentEmployees.length === 0 ? (
        <AdminEmptyState
          icon={UserX}
          title={language === 'ar' ? 'لا يوجد موظفون غائبون' : 'No Absent Employees'}
          description={
            language === 'ar'
              ? 'جميع الموظفين المتوقعون قد سجلوا الحضور اليوم'
              : 'All expected employees have checked in today'
          }
          className="bg-white border-none shadow-none"
        />
      ) : (
        <div className="space-y-3" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700 bg-slate-100 px-3 py-1 rounded-full">
              {language === 'ar'
                ? `العدد: ${absentEmployees.length}`
                : `Count: ${absentEmployees.length}`}
            </span>
          </div>

          {absentEmployees.map((employee) => (
            <div
              key={employee.employee_id}
              className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-all duration-200"
            >
              <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 text-slate-500 font-bold text-sm">
                      {employee.employee_name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm">
                        {employee.employee_name}
                      </h3>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">
                        {employee.employee_code}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-1">
                  <div className="flex items-center gap-2 text-xs bg-slate-50 p-2 rounded-lg text-slate-600">
                    <MapPin size={14} className="text-slate-400" />
                    <span className="truncate max-w-[120px]">{employee.branch_name || '--'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs bg-slate-50 p-2 rounded-lg text-slate-600">
                    <Clock size={14} className="text-slate-400" />
                    <span>{employee.shift_name} ({formatTime(employee.shift_start_time)})</span>
                  </div>
                </div>

                {employee.minutes_late > 0 && (
                  <div className="flex items-center gap-2 text-xs bg-amber-50 p-2 rounded-lg text-amber-700 border border-amber-100">
                    <AlertCircle size={14} />
                    <span className="font-medium">
                      {language === 'ar' ? 'تأخر: ' : 'Late: '}
                      {formatMinutesLate(employee.minutes_late)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminDetailsPanel>
  );
}
