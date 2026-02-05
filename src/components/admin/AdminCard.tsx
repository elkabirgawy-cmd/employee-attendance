import React from 'react';
import { useAdminTheme } from '../../contexts/AdminThemeContext';

interface AdminCardProps {
    children: React.ReactNode;
    className?: string;
    title?: string;
    action?: React.ReactNode;
}

export default function AdminCard({ children, className = '', title, action }: AdminCardProps) {
    const theme = useAdminTheme();
    return (
        <div className={`${theme.card.base} ${className}`}>
            {(title || action) && (
                <div className="flex items-center justify-between p-4 md:p-6 border-b border-slate-100">
                    {title && <h3 className="text-lg font-bold text-slate-800">{title}</h3>}
                    {action && <div>{action}</div>}
                </div>
            )}
            <div className={title ? 'p-4 md:p-6' : 'p-4 md:p-6'}>
                {children}
            </div>
        </div>
    );
}
