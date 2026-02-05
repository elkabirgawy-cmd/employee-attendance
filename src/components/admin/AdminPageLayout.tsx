import React from 'react';
import { adminTheme } from '../../lib/adminTheme';

interface AdminPageLayoutProps {
    children: React.ReactNode;
    className?: string;
}

export default function AdminPageLayout({ children, className = '' }: AdminPageLayoutProps) {
    return (
        <div className={`min-h-screen ${adminTheme.colors.bg} p-4 md:p-6 ${className}`}>
            <div className="max-w-7xl mx-auto space-y-6">
                {children}
            </div>
        </div>
    );
}
