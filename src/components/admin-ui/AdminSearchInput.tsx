import { Search } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface AdminSearchInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}

export default function AdminSearchInput({
    value,
    onChange,
    placeholder,
    className = '',
}: AdminSearchInputProps) {
    const { language } = useLanguage();
    const defaultPlaceholder = language === 'ar' ? 'بحث...' : 'Search...';

    return (
        <div className={`relative ${className}`}>
            <Search
                className={`absolute top-1/2 -translate-y-1/2 text-slate-400 ${language === 'ar' ? 'right-3' : 'left-3'
                    }`}
                size={18}
            />
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder || defaultPlaceholder}
                className={`
          w-full pl-10 pr-4 py-2 bg-white border border-slate-200 
          rounded-xl text-slate-800 placeholder-slate-400
          focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400
          transition-all duration-200
          ${language === 'ar' ? 'pr-10 pl-4' : 'pl-10 pr-4'}
        `}
            />
        </div>
    );
}
