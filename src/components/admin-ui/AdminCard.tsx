import { ReactNode } from 'react';
import { adminTheme } from '../../lib/adminTheme';

interface AdminCardProps {
    children: ReactNode;
    header?: ReactNode;
    footer?: ReactNode;
    className?: string;
    noPadding?: boolean;
}

export default function AdminCard({ children, header, footer, className = '', noPadding = false }: AdminCardProps) {
    return (
        <div className={`${adminTheme.classes.cardClass} ${className}`}>
            {header && (
                <div className={`px-6 py-4 border-b ${adminTheme.colors.border}`}>
                    {header}
                </div>
            )}

            <div className={noPadding ? '' : 'p-6'}>
                {children}
            </div>

            {footer && (
                <div className={`px-6 py-4 border-t ${adminTheme.colors.border} bg-slate-50 rounded-b-xl`}>
                    {footer}
                </div>
            )}
        </div>
    );
}
