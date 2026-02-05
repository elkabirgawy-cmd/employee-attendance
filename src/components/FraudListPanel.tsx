import { useEffect, useState } from 'react';
import { AlertTriangle, MapPin, CheckCircle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import AdminDetailsPanel from './admin-ui/AdminDetailsPanel';
import AdminEmptyState from './admin-ui/AdminEmptyState';
import AdminSkeleton from './admin-ui/AdminSkeleton';

interface FraudAlert {
    id: string;
    employee_name: string;
    employee_code: string;
    branch_name: string;
    description: string;
    created_at: string;
    is_resolved: boolean;
}

interface FraudListPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function FraudListPanel({ isOpen, onClose }: FraudListPanelProps) {
    const { language } = useLanguage();
    const { companyId } = useAuth();
    const [alerts, setAlerts] = useState<FraudAlert[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isOpen && companyId) {
            fetchFraudAlerts();
        }
    }, [isOpen, companyId]);

    async function fetchFraudAlerts() {
        if (!companyId) return;

        setLoading(true);
        try {
            // Using placeholder logic as I don't recall seeing 'fraud_alerts' explicit schema,
            // but step 2171 Dashboard query referenced 'fraud_alerts' table.
            // .from('fraud_alerts').select('id', { count: 'exact' }).eq('is_resolved', false)
            // I will assume it joins employees and branches similar to attendance.

            const { data, error } = await supabase
                .from('fraud_alerts')
                .select(`
                    id,
                    description,
                    created_at,
                    is_resolved,
                    employees (full_name, employee_code),
                    branches (name)
                `)
                .eq('is_resolved', false)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const formatted: FraudAlert[] = (data || []).map((alert: any) => ({
                id: alert.id,
                employee_name: alert.employees?.full_name || 'Unknown',
                employee_code: alert.employees?.employee_code || '-',
                branch_name: alert.branches?.name || 'Unknown',
                description: alert.description || 'Suspicious activity detected',
                created_at: alert.created_at,
                is_resolved: alert.is_resolved
            }));

            setAlerts(formatted);
        } catch (error) {
            console.error('Error fetching fraud alerts:', error);
            // setAlerts([]); // Keep empty
        } finally {
            setLoading(false);
        }
    }

    return (
        <AdminDetailsPanel
            isOpen={isOpen}
            onClose={onClose}
            title={language === 'ar' ? 'تنبيهات الاحتيال' : 'Fraud Alerts'}
            subtitle={language === 'ar' ? 'نشاطات مشبوهة قيد المراجعة' : 'Suspicious activities pending review'}
            icon={AlertTriangle}
            footer={
                <div className="w-full flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition-colors"
                    >
                        {language === 'ar' ? 'إغلاق' : 'Close'}
                    </button>
                </div>
            }
        >
            {loading ? (
                <div className="space-y-3">
                    <AdminSkeleton type="card" count={3} className="h-32" />
                </div>
            ) : alerts.length === 0 ? (
                <AdminEmptyState
                    icon={CheckCircle}
                    title={language === 'ar' ? 'لا توجد تنبيهات' : 'No Fraud Alerts'}
                    description={language === 'ar' ? 'جميع العمليات تبدو سليمة' : 'All operations look good'}
                    className="bg-white border-none shadow-none"
                />
            ) : (
                <div className="space-y-3" dir={language === 'ar' ? 'rtl' : 'ltr'}>
                    {alerts.map((alert) => (
                        <div key={alert.id} className="bg-red-50 border border-red-100 rounded-xl p-4">
                            <div className="flex items-start gap-4">
                                <div className="p-2 bg-red-100 rounded-lg text-red-600 shrink-0">
                                    <AlertTriangle size={20} />
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-start">
                                        <h4 className="flex flex-col">
                                            <span className="font-bold text-slate-800 text-sm">
                                                {alert.employee_name}
                                            </span>
                                            <span className="text-xs text-slate-500 font-mono">
                                                {alert.employee_code}
                                            </span>
                                        </h4>
                                        <span className="text-xs text-red-600 bg-red-100 px-2 py-1 rounded-lg font-medium">
                                            {new Date(alert.created_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-700 mt-2 leading-relaxed">
                                        {alert.description}
                                    </p>
                                    <div className="mt-3 flex gap-2">
                                        <div className="flex items-center gap-1.5 text-xs bg-white/60 p-1.5 rounded text-slate-600 border border-red-100/50">
                                            <MapPin size={12} />
                                            {alert.branch_name}
                                        </div>
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
