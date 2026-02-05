import React from 'react';

interface AdminSkeletonProps {
    className?: string; // Additional classes
    type?: 'card' | 'text' | 'circle' | 'rect';
    count?: number; // Repetition count
}

export default function AdminSkeleton({ className = '', type = 'rect', count = 1 }: AdminSkeletonProps) {
    const getBaseClasses = () => {
        switch (type) {
            case 'card':
                return 'rounded-xl border border-slate-100 bg-slate-50';
            case 'circle':
                return 'rounded-full';
            case 'text':
                return 'rounded h-4 w-3/4';
            case 'rect':
            default:
                return 'rounded-lg';
        }
    };

    const skeletons = Array(count).fill(0);

    return (
        <>
            {skeletons.map((_, index) => (
                <div
                    key={index}
                    className={`
            animate-pulse bg-slate-200 
            ${getBaseClasses()} 
            ${className}
          `}
                />
            ))}
        </>
    );
}
