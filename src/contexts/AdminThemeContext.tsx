import React, { createContext, useContext, ReactNode } from 'react';
import { adminTheme } from '../lib/adminTheme';

type AdminTheme = typeof adminTheme;

const AdminThemeContext = createContext<AdminTheme>(adminTheme);

export function useAdminTheme() {
    const context = useContext(AdminThemeContext);
    return context || adminTheme;
}

export function AdminThemeProvider({ children }: { children: ReactNode }) {
    return (
        <AdminThemeContext.Provider value={adminTheme}>
            {children}
        </AdminThemeContext.Provider>
    );
}
