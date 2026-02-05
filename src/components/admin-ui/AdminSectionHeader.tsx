import { adminTheme } from '../../lib/adminTheme';

interface AdminSectionHeaderProps {
    title: string;
    description?: string;
    className?: string;
}

export default function AdminSectionHeader({ title, description, className = '' }: AdminSectionHeaderProps) {
    return (
        <div className={`mb-4 ${className}`}>
            <h2 className={adminTheme.typography.h2}>{title}</h2>
            {description && <p className={adminTheme.classes.mutedTextClass + ' text-sm mt-1'}>{description}</p>}
        </div>
    );
}
