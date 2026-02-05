import { useAdminTheme } from '../../contexts/AdminThemeContext';

interface AdminSectionHeaderProps {
    title: string;
    description?: string;
    className?: string;
}

export default function AdminSectionHeader({ title, description, className = '' }: AdminSectionHeaderProps) {
    const theme = useAdminTheme();
    return (
        <div className={`mb-4 ${className}`}>
            <h2 className={theme.typography.h2}>{title}</h2>
            {description && <p className={theme.classes.mutedTextClass + ' text-sm mt-1'}>{description}</p>}
        </div>
    );
}
