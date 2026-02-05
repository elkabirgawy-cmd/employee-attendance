import { X, FilterX } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export interface FilterChip {
    id: string;
    label: string;
    value?: string; // Optional value for display "Label: Value"
    onRemove?: () => void;
}

interface AdminFilterChipsProps {
    chips: FilterChip[];
    onReset?: () => void;
    className?: string;
}

export default function AdminFilterChips({
    chips,
    onReset,
    className = '',
}: AdminFilterChipsProps) {
    const { language } = useLanguage();

    if (chips.length === 0) return null;

    return (
        <div className={`flex flex-wrap items-center gap-2 mb-4 ${className}`}>
            {chips.map((chip) => (
                <div
                    key={chip.id}
                    className="
            flex items-center gap-2 px-3 py-1.5 
            bg-slate-100 border border-slate-200 
            text-slate-700 text-sm font-medium rounded-lg
            transition-colors hover:bg-slate-200
          "
                >
                    <span>{chip.label}{chip.value ? `: ${chip.value}` : ''}</span>
                    {chip.onRemove && (
                        <button
                            onClick={chip.onRemove}
                            className="p-0.5 hover:bg-white rounded-full transition-colors text-slate-500 hover:text-red-500"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>
            ))}

            {onReset && (
                <button
                    onClick={onReset}
                    className="
            flex items-center gap-1.5 px-3 py-1.5 
            text-red-600 text-sm font-medium hover:bg-red-50 
            rounded-lg transition-colors
          "
                >
                    <FilterX size={14} />
                    {language === 'ar' ? 'مسح الكل' : 'Clear All'}
                </button>
            )}
        </div>
    );
}
