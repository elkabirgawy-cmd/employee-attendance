import { useEffect, useState } from 'react';
import { Users, Search } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import AdminDetailsPanel from './admin-ui/AdminDetailsPanel';
import AdminEmptyState from './admin-ui/AdminEmptyState';
import AdminSkeleton from './admin-ui/AdminSkeleton';
import AdminSearchInput from './admin-ui/AdminSearchInput';
import AdminFilterChips, { FilterChip } from './admin-ui/AdminFilterChips';

interface Employee {
    id: string;
    full_name: string;
    employee_code: string;
    job_title: string;
    branch_name: string;
    shift_name: string;
    is_active: boolean;
    profile_image_url?: string;
}

interface EmployeeListPanelProps {
    isOpen: boolean;
    onClose: () => void;
    filterType: 'all' | 'active';
}

export default function EmployeeListPanel({ isOpen, onClose, filterType }: EmployeeListPanelProps) {
    const { language } = useLanguage();
    const { companyId } = useAuth();
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);

    // Local Filtering
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (isOpen && companyId) {
            fetchEmployees();
        }
    }, [isOpen, companyId, filterType]);

    async function fetchEmployees() {
        if (!companyId) return;

        setLoading(true);
        try {
            let query = supabase
                .from('employees')
                .select(`
                id,
                full_name,
                employee_code,
                job_title,
                is_active,
                profile_image_url,
                branches (name),
                shifts (name)
            `)
                .eq('company_id', companyId)
                .order('full_name');

            if (filterType === 'active') {
                query = query.eq('is_active', true);
            }

            const { data, error } = await query;

            if (error) throw error;

            const formatted: Employee[] = (data || []).map((emp: any) => ({
                id: emp.id,
                full_name: emp.full_name,
                employee_code: emp.employee_code,
                job_title: emp.job_title || '-',
                branch_name: emp.branches?.name || '-',
                shift_name: emp.shifts?.name || '-',
                is_active: emp.is_active,
                profile_image_url: emp.profile_image_url
            }));

            setEmployees(formatted);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    // Filter Logic
    const filtered = employees.filter(emp => {
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            return emp.full_name.toLowerCase().includes(lower) ||
                emp.employee_code.toLowerCase().includes(lower);
        }
        return true;
    });

    return (
        <AdminDetailsPanel
            isOpen={isOpen}
            onClose={onClose}
            title={filterType === 'active' ? (language === 'ar' ? 'الموظفون النشطون' : 'Active Employees') : (language === 'ar' ? 'كل الموظفين' : 'All Employees')}
            subtitle={language === 'ar' ? 'قائمة سريعة للموظفين' : 'Quick access employee list'}
            icon={Users}
        >
            <div className="mb-4">
                <AdminSearchInput value={searchTerm} onChange={setSearchTerm} />
            </div>

            {loading ? (
                <div className="space-y-3">
                    <AdminSkeleton type="card" count={6} className="h-20" />
                </div>
            ) : filtered.length === 0 ? (
                <AdminEmptyState
                    icon={Users}
                    title={language === 'ar' ? 'لا يوجد موظفون' : 'No Employees'}
                    description={language === 'ar' ? 'لا يوجد نتائج مطابقة للبحث' : 'No employees found matching search'}
                    className="border-none"
                />
            ) : (
                <div className="space-y-3" dir={language === 'ar' ? 'rtl' : 'ltr'}>
                    {filtered.map(emp => (
                        <div key={emp.id} className="p-4 bg-white border border-slate-200 rounded-xl flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 shrink-0">
                                {emp.profile_image_url ? (
                                    <img src={emp.profile_image_url} alt="" className="w-full h-full rounded-full object-cover" />
                                ) : (
                                    emp.full_name.substring(0, 2).toUpperCase()
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between">
                                    <h4 className="font-bold text-slate-800 text-sm truncate">{emp.full_name}</h4>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${emp.is_active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                        {emp.is_active ? (language === 'ar' ? 'نشط' : 'Active') : (language === 'ar' ? 'غير نشط' : 'Inactive')}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 font-mono">{emp.employee_code}</p>
                                <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                                    <span>{emp.job_title}</span>
                                    <span>•</span>
                                    <span>{emp.branch_name}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </AdminDetailsPanel>
    );
}
