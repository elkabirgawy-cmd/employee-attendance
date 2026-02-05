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
            className={`${theme.classes.cardClass} p-6 flex items-start justify-between ${isClickable ? theme.classes.cardHoverClass + ' cursor-pointer' : ''} ${className}`}
        >
            <div>
                <h3 className={theme.classes.statTitleClass}>{title}</h3>
                <div className={`mt-2 ${theme.classes.statValueClass}`}>
                    {value}
                </div>

                {(trend || status) && (
                    <div className="mt-3 flex items-center gap-2">
                        {status && (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium 
                ${status.color === 'success' ? 'bg-green-100 text-green-700' :
                                    status.color === 'warning' ? 'bg-amber-100 text-amber-700' :
                                        status.color === 'danger' ? 'bg-red-100 text-red-700' :
                                            'bg-slate-100 text-slate-600'}`}>
                                {status.label}
                            </span>
                        )}
                        {trend && (
                            <span className={`text-xs font-medium ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                                {trend.isPositive ? '+' : ''}{trend.value}% {trend.label}
                            </span>
                        )}
                    </div>
                )}
            </div>

            {Icon && (
                <div className={`p-3 rounded-lg ${iconClassName || 'bg-slate-50 text-slate-400'}`}>
                    <Icon size={24} />
                </div>
            )}
        </div>
    );
}
