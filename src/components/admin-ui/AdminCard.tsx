import { ReactNode } from 'react';
import { useAdminTheme } from '../../contexts/AdminThemeContext';

interface AdminCardProps {
    children: ReactNode;
    header?: ReactNode;
    footer?: ReactNode;
    className?: string;
    noPadding?: boolean;
    interactive?: boolean;
    onClick?: () => void;
}

export default function AdminCard({ children, header, footer, className = '', noPadding = false, interactive = false, onClick }: AdminCardProps) {
    const theme = useAdminTheme();

    return (
        <div
            onClick={onClick}
            className={`${theme.classes.cardClass} ${interactive ? theme.shadows.hover + ' cursor-pointer' : ''} ${className}`}
        >
            {header && (
                <div className={`px-6 py-4 border-b ${theme.colors.border}`}>
                    {header}
                </div>
            )}

            <div className={noPadding ? '' : 'p-6'}>
                {children}
            </div>

            {footer && (
                <div className={`px-6 py-4 border-t ${theme.colors.border} bg-slate-50 rounded-b-xl`}>
                    {footer}
                </div>
            )}
        </div>
    );
}
