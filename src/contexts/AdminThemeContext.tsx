import React, { createContext, useContext, ReactNode, useMemo } from 'react';
import { adminTheme } from '../lib/adminTheme';

type AdminTheme = typeof adminTheme;

// Create a safe default theme (deep clone to avoid reference issues)
const createSafeTheme = (): AdminTheme => {
    try {
        return JSON.parse(JSON.stringify(adminTheme));
    } catch (e) {
        console.error('[AdminThemeContext] Failed to clone adminTheme:', e);
        return adminTheme;
    }
};

const defaultTheme = createSafeTheme();
const AdminThemeContext = createContext<AdminTheme>(defaultTheme);

export function useAdminTheme(): AdminTheme {
    try {
        const context = useContext(AdminThemeContext);

        if (!context) {
            console.warn('[AdminThemeContext] Context is null, returning safe default theme');
            return defaultTheme;
        }

        return context;
    } catch (error) {
        console.error('[AdminThemeContext] Error in useAdminTheme:', error);
        return defaultTheme;
    }
}

export function AdminThemeProvider({ children }: { children: ReactNode }) {
    // Memoize theme to prevent unnecessary re-renders
    const theme = useMemo(() => createSafeTheme(), []);

    return (
        <AdminThemeContext.Provider value={theme}>
            {children}
        </AdminThemeContext.Provider>
    );
}
