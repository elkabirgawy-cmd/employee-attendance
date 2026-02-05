import React, { createContext, useContext, ReactNode } from 'react';
import { adminTheme } from '../lib/adminTheme';

type AdminTheme = typeof adminTheme;

const AdminThemeContext = createContext<AdminTheme>(adminTheme);

export function useAdminTheme() {
    return useContext(AdminThemeContext);
}

export function AdminThemeProvider({ children }: { children: ReactNode }) {
    return (
        <AdminThemeContext.Provider value={adminTheme}>
            {children}
        </AdminThemeContext.Provider>
    );
}
