import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useAdminTheme } from '../../contexts/AdminThemeContext';

interface AdminDetailsPanelProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    subtitle?: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
    icon?: React.ElementType;
}

export default function AdminDetailsPanel({
    isOpen,
    onClose,
    title,
    subtitle,
    children,
    footer,
    icon: Icon,
}: AdminDetailsPanelProps) {
    const panelRef = useRef<HTMLDivElement>(null);

    // Close on Escape key
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    // Prevent body scroll when open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex justify-end isolate">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300"
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Panel Container - Mobile Bottom Sheet / Desktop Side Panel */}
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                className={`
          relative w-full bg-white shadow-2xl flex flex-col
          transition-transform duration-300 ease-in-out
          
          /* Mobile: Bottom Sheet */
          fixed bottom-0 left-0 right-0 
          rounded-t-2xl 
          max-h-[85vh] h-auto
          md:static md:h-full md:max-h-full
          
          /* Desktop: Right Side Panel */
          md:w-[480px] md:rounded-none md:border-l md:border-slate-200
        `}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100 flex-shrink-0">
                    <div className="flex items-center gap-4">
                        {Icon && (
                            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                                <Icon size={20} />
                            </div>
                        )}
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">{title}</h2>
                            {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
                        aria-label="Close panel"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content - Scrollable */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {children}
                </div>

                {/* Footer - Fixed at bottom */}
                {footer && (
                    <div className="p-6 border-t border-slate-100 bg-slate-50 flex-shrink-0">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
}
