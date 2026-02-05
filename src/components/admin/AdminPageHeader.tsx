import React from 'react';
import { adminTheme } from '../../lib/adminTheme';

interface AdminPageHeaderProps {
    title: string;
    subtitle?: string;
    actions?: React.ReactNode;
}

export default function AdminPageHeader({ title, subtitle, actions }: AdminPageHeaderProps) {
    return (
        <div className={adminTheme.header.wrapper}>
            <div>
                <h1 className={adminTheme.header.title}>{title}</h1>
                {subtitle && <p className={adminTheme.header.subtitle}>{subtitle}</p>}
            </div>
            {actions && (
                <div className="flex flex-wrap items-center gap-3">
                    {actions}
                </div>
            )}
        </div>
    );
}
