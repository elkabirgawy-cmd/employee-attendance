import { useEffect, useState } from 'react';
import { UserCheck, Clock, MapPin } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import AdminDetailsPanel from './admin-ui/AdminDetailsPanel';
import AdminEmptyState from './admin-ui/AdminEmptyState';
import AdminSkeleton from './admin-ui/AdminSkeleton';

interface AttendanceRecord {
    employee_id: string;
    employee_name: string;
    employee_code: string;
    branch_name: string;
    shift_name: string;
    check_in_time: string;
    check_out_time?: string;
    status?: string;
}

interface AttendanceListPanelProps {
    isOpen: boolean;
    onClose: () => void;
    filter: 'present_now' | 'today_attendance' | 'late';
}

export default function AttendanceListPanel({ isOpen, onClose, filter }: AttendanceListPanelProps) {
    const { language } = useLanguage();
    const { companyId } = useAuth();
    const [records, setRecords] = useState<AttendanceRecord[]>([]);
    const [loading, setLoading] = useState(true);

    const getTitle = () => {
        switch (filter) {
            case 'present_now': return language === 'ar' ? 'الحاضرون الآن' : 'Present Now';
            case 'late': return language === 'ar' ? 'المتأخرون' : 'Late Arrivals';
            default: return language === 'ar' ? 'سجل حضور اليوم' : 'Attendance Today';
        }
    };

    const getSubtitle = () => {
        switch (filter) {
            case 'present_now': return language === 'ar' ? 'الموظفون المتواجدون حالياً في العمل' : 'Employees currently inside work location';
            case 'late': return language === 'ar' ? 'موظفون سجلوا حضور بعد وقت البدء' : 'Employees who checked in late';
            default: return language === 'ar' ? 'جميع عمليات الحضور المسجلة اليوم' : 'All check-ins recorded today';
        }
    };

    useEffect(() => {
        if (isOpen && companyId) {
            fetchAttendance();
        }
    }, [isOpen, companyId, filter]);

    async function fetchAttendance() {
        if (!companyId) return;

        setLoading(true);
        try {
            const today = new Date().toISOString().split('T')[0];
            const startOfDay = new Date(today);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(today);
            endOfDay.setHours(23, 59, 59, 999);

            let query = supabase
                .from('attendance_logs')
                .select(`
          employee_id,
          check_in_time,
          check_out_time,
          status,
          employees (id, full_name, employee_code),
          branches (name),
          shifts (name)
        `)
                .eq('company_id', companyId)
                .gte('check_in_time', startOfDay.toISOString())
                .lte('check_in_time', endOfDay.toISOString())
                .order('check_in_time', { ascending: false });

            if (filter === 'present_now') {
                query = query.is('check_out_time', null);
            } else if (filter === 'late') {
                query = query.eq('status', 'late');
            }

            const { data, error } = await query;

            if (error) throw error;

            const formattedData: AttendanceRecord[] = (data || []).map((log: any) => ({
                employee_id: log.employees?.id,
                employee_name: log.employees?.full_name || 'Unknown',
                employee_code: log.employees?.employee_code || '-',
                branch_name: log.branches?.name || '',
                shift_name: log.shifts?.name || '',
                check_in_time: log.check_in_time,
                check_out_time: log.check_out_time,
                status: log.status,
            }));

            setRecords(formattedData);
        } catch (error) {
            console.error('Error fetching attendance:', error);
            setRecords([]);
        } finally {
            setLoading(false);
        }
    }

    function formatTime(timeString?: string): string {
        if (!timeString) return '--:--';
        return new Date(timeString).toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    }

    return (
        <AdminDetailsPanel
            isOpen={isOpen}
            onClose={onClose}
            title={getTitle()}
            subtitle={getSubtitle()}
            icon={Clock}
            footer={
                <div className="flex items-center justify-between w-full">
                    <p className="text-xs text-slate-500">
                        {language === 'ar' ? `آخر تحديث: ${new Date().toLocaleTimeString('ar-EG')}` : `Last updated: ${new Date().toLocaleTimeString()}`}
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
                <div className="space-y-3">
                    <AdminSkeleton type="card" count={5} className="h-24" />
                </div>
            ) : records.length === 0 ? (
                <AdminEmptyState
                    icon={UserCheck}
                    title={language === 'ar' ? 'لا يوجد بيانات' : 'No Data'}
                    description={
                        language === 'ar'
                            ? 'لم يتم العثور على سجلات مطابقة'
                            : 'No matching records found'
                    }
                    className="bg-white border-none shadow-none"
                />
            ) : (
                <div className="space-y-3" dir={language === 'ar' ? 'rtl' : 'ltr'}>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-slate-700 bg-slate-100 px-3 py-1 rounded-full">
                            {language === 'ar' ? `العدد: ${records.length}` : `Count: ${records.length}`}
                        </span>
                    </div>

                    {records.map((record, index) => (
                        <div
                            key={`${record.employee_id}-${index}`}
                            className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-all duration-200"
                        >
                            <div className="flex flex-col gap-3">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 text-slate-500 font-bold text-sm">
                                            {record.employee_name.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-800 text-sm">
                                                {record.employee_name}
                                            </h3>
                                            <p className="text-xs text-slate-500 font-mono mt-0.5">
                                                {record.employee_code}
                                            </p>
                                        </div>
                                    </div>
                                    <div className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${record.status === 'late'
                                        ? 'bg-amber-50 text-amber-700 border-amber-100'
                                        : 'bg-green-50 text-green-700 border-green-100'
                                        }`}>
                                        {formatTime(record.check_in_time)}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 mt-1">
                                    <div className="flex items-center gap-2 text-xs bg-slate-50 p-2 rounded-lg text-slate-600">
                                        <MapPin size={14} className="text-slate-400" />
                                        <span className="truncate max-w-[120px]">{record.branch_name || '--'}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs bg-slate-50 p-2 rounded-lg text-slate-600">
                                        <Clock size={14} className="text-slate-400" />
                                        <span>{record.shift_name}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </AdminDetailsPanel>
    );
}
