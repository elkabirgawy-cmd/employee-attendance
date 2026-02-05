import React from 'react';
import { X } from 'lucide-react';
import { useAdminTheme } from '../../contexts/AdminThemeContext';

interface AdminModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl';
}

export default function AdminModal({ isOpen, onClose, title, children, footer, size = 'md' }: AdminModalProps) {
    const theme = useAdminTheme();

    if (!isOpen) return null;

    const maxWidth = {
        sm: 'max-w-md',
        md: 'max-w-lg',
        lg: 'max-w-2xl',
        xl: 'max-w-4xl',
    }[size];

    return (
        <>
            <div className={theme.modal.overlay} onClick={onClose} />
            <div className={`${theme.modal.content} ${maxWidth}`}>
                <div className={theme.modal.header}>
                    <h2 className={theme.modal.title}>{title}</h2>
                    <button onClick={onClose} className={theme.modal.close}>
                        <X size={20} />
                    </button>
                </div>

                <div className="mb-6">
                    {children}
                </div>

                {footer && (
                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                        {footer}
                    </div>
                )}
            </div>
        </>
    );
}
