import { ReactNode } from 'react';
import { useAdminTheme } from '../../contexts/AdminThemeContext';

interface AdminToolbarProps {
    children: ReactNode;
    className?: string;
    hasSearch?: boolean;
}

export default function AdminToolbar({ children, className = '', hasSearch = false }: AdminToolbarProps) {
    const theme = useAdminTheme();
    return (
        <div className={`flex flex-col md:flex-row md:items-center justify-between ${theme.spacing.controlGap} mb-6 ${className}`}>
            {children}
        </div>
    );
}
