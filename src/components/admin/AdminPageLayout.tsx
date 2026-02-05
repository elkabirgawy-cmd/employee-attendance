import React from 'react';
import { useAdminTheme } from '../../contexts/AdminThemeContext';

interface AdminPageLayoutProps {
    children: React.ReactNode;
    className?: string;
}

export default function AdminPageLayout({ children, className = '' }: AdminPageLayoutProps) {
    const theme = useAdminTheme();
    return (
        <div className={`min-h-screen ${theme.colors.bg} p-4 md:p-6 ${className}`}>
            <div className="max-w-7xl mx-auto space-y-6">
                {children}
            </div>
        </div>
    );
}
