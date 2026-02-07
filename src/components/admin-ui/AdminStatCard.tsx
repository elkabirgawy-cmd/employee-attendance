import { ReactNode } from 'react';
import { useAdminTheme } from '../../contexts/AdminThemeContext';
import { LucideIcon } from 'lucide-react';

interface AdminStatCardProps {
    title: string;
    value: string | number | ReactNode;
    icon?: LucideIcon;
    trend?: {
        value: number;
        isPositive: boolean;
        label?: string;
    };
    status?: {
        label: string;
        color: 'success' | 'warning' | 'danger' | 'neutral';
    };
    onClick?: () => void;
    className?: string; // Add className prop
    iconClassName?: string;
}

export default function AdminStatCard({ title, value, icon: Icon, trend, status, onClick, className = '', iconClassName }: AdminStatCardProps) {
    const isClickable = !!onClick;
    const theme = useAdminTheme();

    return (
        <div
            onClick={onClick}
            className={`${theme.classes.cardClass} p-3 flex items-start justify-between min-h-[75px] !rounded-xl !shadow-sm border-0 ${isClickable ? theme.classes.cardHoverClass + ' cursor-pointer' : ''} ${className}`}
        >
            <div>
                <h3 className={`${theme.classes.statTitleClass} !text-sm text-slate-600`}>{title}</h3>
                <div className={`mt-0.5 ${theme.classes.statValueClass} !text-xl font-bold text-slate-800`}>
                    {value}
                </div>

                {(trend || status) && (
                    <div className="mt-1 flex items-center gap-2">
                        {status && (
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium 
                ${status.color === 'success' ? 'bg-green-100 text-green-700' :
                                    status.color === 'warning' ? 'bg-amber-100 text-amber-700' :
                                        status.color === 'danger' ? 'bg-red-100 text-red-700' :
                                            'bg-slate-100 text-slate-600'}`}>
                                {status.label}
                            </span>
                        )}
                        {trend && (
                            <span className={`text-[10px] font-medium ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                                {trend.isPositive ? '+' : ''}{trend.value}% {trend.label}
                            </span>
                        )}
                    </div>
                )}
            </div>

            {Icon && (
                <div className={`p-2.5 rounded-lg ${iconClassName || 'bg-slate-100 text-slate-500'}`}>
                    <Icon size={18} />
                </div>
            )}
        </div>
    );
}
