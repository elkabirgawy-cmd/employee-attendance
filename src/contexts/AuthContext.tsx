import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { initializePushNotifications } from '../utils/pushNotifications';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  companyId: string | null;
  currencyLabel: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [currencyLabel, setCurrencyLabel] = useState('ریال');

  useEffect(() => {
    console.log('AUTH_CONTEXT: initializing');

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      console.log('AUTH_CONTEXT: getSession result', session ? 'has session' : 'no session');
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        console.log('AUTH_CONTEXT: calling checkAdminStatus for initial session');
        await checkAdminStatus(session.user.id);
      }
      setLoading(false);
      console.log('AUTH_CONTEXT: initial loading complete');
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('AUTH_CONTEXT: onAuthStateChange event:', event);

      (async () => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          console.log('AUTH_CONTEXT: user logged in, checking admin status');
          await checkAdminStatus(session.user.id);

          // Check if user is admin for push notifications
          const { data: adminData } = await supabase
            .from('admin_users')
            .select('id, is_active')
            .maybeSingle();

          const userRole = (adminData?.is_active) ? 'admin' : 'employee';

          await initializePushNotifications(session.user.id, userRole);
        } else {
          console.log('AUTH_CONTEXT: user logged out');
          setIsAdmin(false);
          setCompanyId(null);
          setCurrencyLabel('ریال');
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  async function checkAdminStatus(userId: string) {
    console.log('AUTH_CONTEXT: admin_users check start');

    // Check admin_users with RLS filtering (no need for .eq('id', userId))
    const { data, error } = await supabase
      .from('admin_users')
      .select('id, is_active, company_id, is_owner, roles(name)')
      .maybeSingle();

    if (error) {
      console.error('AUTH_CONTEXT: admin_users check error', error);
      setIsAdmin(false);
      setCompanyId(null);
      setCurrencyLabel('ریال');
      return;
    }

    if (!data) {
      console.log('AUTH_CONTEXT: No admin_users record found');
      setIsAdmin(false);
      setCompanyId(null);
      setCurrencyLabel('ریال');
      return;
    }

    if (!data.is_active) {
      console.log('AUTH_CONTEXT: Admin account is inactive');
      setIsAdmin(false);
      setCompanyId(null);
      setCurrencyLabel('ریال');
      return;
    }

    // Allow access if user is active (don't check role, use is_owner or allow all active admin_users)
    console.log('AUTH_CONTEXT: admin_users fetched', {
      id: data.id,
      company_id: data.company_id,
      is_owner: data.is_owner,
      is_active: data.is_active
    });

    setIsAdmin(true);

    if (data.company_id) {
      setCompanyId(data.company_id);

      // Fetch company currency
      const { data: companyData } = await supabase
        .from('companies')
        .select('currency_label')
        .eq('id', data.company_id)
        .maybeSingle();

      if (companyData) {
        setCurrencyLabel(companyData.currency_label || 'ریال');
      }
    } else {
      setCompanyId(null);
      setCurrencyLabel('ریال');
    }
  }

  async function signIn(email: string, password: string) {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setIsAdmin(false);
    setCompanyId(null);
    setCurrencyLabel('ریال');
  }

  const value = {
    user,
    session,
    loading,
    signIn,
    signOut,
    isAdmin,
    companyId,
    currencyLabel,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
