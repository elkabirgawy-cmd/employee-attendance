import { ReactNode } from 'react';
import { adminTheme } from '../../lib/adminTheme';

interface AdminToolbarProps {
    children: ReactNode;
    className?: string;
    hasSearch?: boolean;
}

export default function AdminToolbar({ children, className = '', hasSearch = false }: AdminToolbarProps) {
    return (
        <div className={`flex flex-col md:flex-row md:items-center justify-between ${adminTheme.spacing.controlGap} mb-6 ${className}`}>
            {children}
        </div>
    );
}
