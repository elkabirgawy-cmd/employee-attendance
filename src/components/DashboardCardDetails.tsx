import React from 'react';
import { X, Clock, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface DashboardCardDetailsProps {
    isOpen: boolean;
    onClose: () => void;
    cardId: string;
    title: string;
    value: number;
    subtitle?: string;
}

export default function DashboardCardDetails({
    isOpen,
    onClose,
    cardId,
    title,
    value,
    subtitle,
}: DashboardCardDetailsProps) {
    const { language } = useLanguage();
    const isRTL = language === 'ar';

    if (!isOpen) return null;

    // Mock data for "Recent Records" based on card type
    const getRecentRecords = () => {
        // In a real app, fetch based on cardId
        return [
            { id: 1, label: language === 'ar' ? 'أحمد محمد' : 'Ahmed Mohamed', time: '08:30 AM', status: 'present' },
            { id: 2, label: language === 'ar' ? 'سارة علي' : 'Sara Ali', time: '08:45 AM', status: 'present' },
            { id: 3, label: language === 'ar' ? 'محمد حسن' : 'Mohamed Hassan', time: '09:15 AM', status: 'late' },
        ];
    };

    const records = getRecentRecords();

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 transition-opacity duration-300"
                onClick={onClose}
            />

            {/* Sheet / Panel */}
            <div className={`
        fixed bottom-0 left-0 right-0 z-50
        bg-white rounded-t-2xl shadow-2xl
        transform transition-transform duration-300 ease-out
        max-h-[80vh] overflow-y-auto
        md:relative md:inset-auto md:max-w-md md:rounded-2xl md:mx-auto md:mt-24
        ${isOpen ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}
      `}
                dir={isRTL ? 'rtl' : 'ltr'}
            >
                <div className="p-1 flex justify-center">
                    <div className="w-12 h-1.5 bg-slate-200 rounded-full my-2 md:hidden" />
                </div>

                <div className="px-6 pb-8 pt-2">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-6">
                        <div>
                            <h3 className="text-lg font-bold text-slate-800">{title}</h3>
                            <p className="text-sm text-slate-400 font-medium">{subtitle}</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 bg-slate-50 rounded-full hover:bg-slate-100 transition-colors"
                        >
                            <X size={20} className="text-slate-500" />
                        </button>
                    </div>

                    {/* Main Stat */}
                    <div className="flex items-baseline gap-2 mb-8">
                        <span className="text-5xl font-black text-slate-900 tracking-tight tabular-nums">
                            {value}
                        </span>
                        <span className="text-sm font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                            +12%
                        </span>
                    </div>

                    {/* Recent Activity */}
                    <div className="mb-6">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
                            {language === 'ar' ? 'آخر النشاطات' : 'Recent Activity'}
                        </h4>

                        <div className="space-y-3">
                            {records.map((record) => (
                                <div key={record.id} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${record.status === 'present' ? 'bg-blue-100 text-blue-600' : 'bg-amber-100 text-amber-600'
                                            }`}>
                                            {record.status === 'present' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-700">{record.label}</p>
                                            <p className="text-xs text-slate-400">Employee #{record.id + 100}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-bold text-slate-800 tabular-nums">{record.time}</p>
                                        <p className="text-[10px] text-slate-400 font-medium uppercase">
                                            {language === 'ar' ? 'اليوم' : 'Today'}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Footer Info */}
                    <div className="flex items-center gap-2 text-xs text-slate-400 justify-center pt-4 border-t border-slate-100">
                        <Clock size={12} />
                        <span>Updated: {new Date().toLocaleTimeString()}</span>
                    </div>
                </div>
            </div>
        </>
    );
}
