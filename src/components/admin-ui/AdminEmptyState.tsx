import { LucideIcon } from 'lucide-react';


interface AdminEmptyStateProps {
    icon: LucideIcon;
    title: string;
    description: string;
    action?: React.ReactNode;
    className?: string;
}

export default function AdminEmptyState({
    icon: Icon,
    title,
    description,
    action,
    className = '',
}: AdminEmptyStateProps) {
    return (
        <div className={`text-center py-12 px-4 flex flex-col items-center justify-center bg-white rounded-xl border-2 border-dashed border-slate-200 ${className}`}>
            <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4 ring-8 ring-slate-50/50">
                <Icon className="text-slate-400" size={32} />
            </div>

            <h3 className="text-lg font-bold text-slate-800 mb-2">
                {title}
            </h3>

            <p className="text-slate-500 max-w-sm mx-auto mb-6 text-sm leading-relaxed">
                {description}
            </p>

            {action && (
                <div className="flex justify-center">
                    {action}
                </div>
            )}
        </div>
    );
}
