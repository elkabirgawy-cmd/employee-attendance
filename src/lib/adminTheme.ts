export const adminTheme = {
    colors: {
        bg: 'bg-slate-200', // Matches Dashboard Update
        surface: 'bg-white',
        text: {
            primary: 'text-slate-800',
            secondary: 'text-slate-500',
            tertiary: 'text-slate-400',
            inverted: 'text-white'
        },
        border: 'border-slate-200',
        accent: {
            primary: 'bg-blue-600',
            hover: 'hover:bg-blue-700',
            light: 'bg-blue-50',
            text: 'text-blue-600'
        },
        success: {
            bg: 'bg-green-50',
            text: 'text-green-700',
            icon: 'text-green-600'
        },
        warning: {
            bg: 'bg-amber-50',
            text: 'text-amber-700',
            icon: 'text-amber-600'
        },
        danger: {
            bg: 'bg-red-50',
            text: 'text-red-700',
            icon: 'text-red-600'
        }
    },
    spacing: {
        pagePadding: 'p-6 md:p-8',
        sectionGap: 'gap-6 md:gap-8',
        cardGap: 'gap-4 md:gap-6',
        controlGap: 'gap-3'
    },
    radii: {
        card: 'rounded-xl',
        input: 'rounded-lg',
        pill: 'rounded-full',
        button: 'rounded-lg'
    },
    shadows: {
        card: 'shadow-sm',
        hover: 'hover:shadow-md transition-shadow duration-200'
    },
    typography: {
        title: 'text-2xl font-bold text-slate-800',
        h1: 'text-xl font-bold text-slate-800',
        h2: 'text-lg font-semibold text-slate-800',
        label: 'text-sm font-medium text-slate-700',
        value: 'text-slate-900 font-semibold',
        meta: 'text-xs text-slate-500'
    },
    motion: {
        duration: 'duration-200',
        easing: 'ease-in-out'
    },
    // Layout Helpers
    layout: {
        page: 'min-h-screen bg-slate-200 pb-12',
        container: 'max-w-7xl mx-auto w-full'
    },
    // Component Helpers for Tailwind
    classes: {
        pageClass: 'min-h-screen bg-slate-200 pb-12',
        containerClass: 'max-w-7xl mx-auto w-full p-4 md:p-8 space-y-6',
        cardClass: 'bg-white rounded-xl shadow-sm border border-slate-200',
        cardHoverClass: 'hover:shadow-md transition-shadow duration-200',
        headerClass: 'flex flex-col md:flex-row md:items-center justify-between gap-4',
        subHeaderClass: 'text-sm text-slate-500 mt-1',
        statTitleClass: 'text-sm font-medium text-slate-500',
        statValueClass: 'text-2xl font-bold text-slate-900 tracking-tight',
        mutedTextClass: 'text-slate-500'
    },
    // Legacy support (to be deprecated)
    card: {
        base: 'bg-white rounded-xl shadow-sm border border-slate-200',
        padding: 'p-4 md:p-6',
        hover: 'hover:shadow-md transition-shadow duration-200',
    },
    header: {
        wrapper: 'flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6',
        title: 'text-2xl font-bold text-slate-800',
        subtitle: 'text-sm text-slate-500 mt-1',
    },
    button: {
        primary: 'bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg px-4 py-2 shadow-sm transition-colors flex items-center gap-2 justify-center',
        secondary: 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium rounded-lg px-4 py-2 transition-colors flex items-center gap-2 justify-center',
        danger: 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 font-medium rounded-lg px-4 py-2 transition-colors flex items-center gap-2 justify-center',
        icon: 'p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors',
    },
    input: {
        base: 'w-full rounded-lg border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-2 px-3',
        label: 'block text-sm font-medium text-slate-700 mb-1',
    },
    table: {
        wrapper: 'overflow-x-auto rounded-xl border border-slate-200 bg-white',
        header: 'bg-slate-50 border-b border-slate-200 px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider',
        row: 'border-b border-slate-100 hover:bg-slate-50/50 transition-colors',
        cell: 'px-6 py-4 whitespace-nowrap text-sm text-slate-700',
    },
    modal: {
        overlay: 'fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 transition-opacity',
        content: 'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-xl w-full max-w-lg z-50 p-6 max-h-[90vh] overflow-y-auto',
        header: 'flex items-center justify-between mb-6',
        title: 'text-xl font-bold text-slate-800',
        close: 'p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors',
    }
};
