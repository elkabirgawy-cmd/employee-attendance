import { ReactNode } from 'react';
import { useAdminTheme } from '../../contexts/AdminThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';

interface AdminPageShellProps {
    title: string;
    subtitle?: string;
    actions?: ReactNode;
    children: ReactNode;
}

export default function AdminPageShell({ title, subtitle, actions, children }: AdminPageShellProps) {
    const { language } = useLanguage();
    const theme = useAdminTheme();

    return (
        <div className={`${theme.layout.page}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
            <div className={theme.classes.containerClass}>
                {/* Header Section */}
                <div className={theme.classes.headerClass}>
                    <div>
                        <h1 className={theme.typography.title}>{title}</h1>
                        {subtitle && <p className={theme.classes.subHeaderClass}>{subtitle}</p>}
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
