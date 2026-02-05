import { ReactNode } from 'react';
import { adminTheme } from '../../lib/adminTheme';
import { useLanguage } from '../../contexts/LanguageContext';

interface AdminPageShellProps {
    title: string;
    subtitle?: string;
    actions?: ReactNode;
    children: ReactNode;
}

export default function AdminPageShell({ title, subtitle, actions, children }: AdminPageShellProps) {
    const { language } = useLanguage();

    return (
        <div className={`${adminTheme.layout.page}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
            <div className={adminTheme.classes.containerClass}>
                {/* Header Section */}
                <div className={adminTheme.classes.headerClass}>
                    <div>
                        <h1 className={adminTheme.typography.title}>{title}</h1>
                        {subtitle && <p className={adminTheme.classes.subHeaderClass}>{subtitle}</p>}
                    </div>
                    {actions && <div className="flex items-center gap-3">{actions}</div>}
                </div>

                {/* Main Content */}
                <main className="space-y-6">
                    {children}
                </main>
            </div>
        </div>
    );
}
