import React from 'react';
import { useAdminTheme } from '../../contexts/AdminThemeContext';

interface AdminPageHeaderProps {
    title: string;
    subtitle?: string;
    actions?: React.ReactNode;
}

export default function AdminPageHeader({ title, subtitle, actions }: AdminPageHeaderProps) {
    const theme = useAdminTheme();
    return (
        <div className={theme.header.wrapper}>
            <div>
                <h1 className={theme.header.title}>{title}</h1>
                {subtitle && <p className={theme.header.subtitle}>{subtitle}</p>}
            </div>
            {actions && (
                <div className="flex flex-wrap items-center gap-3">
                    {actions}
                </div>
            )}
        </div>
    );
}
