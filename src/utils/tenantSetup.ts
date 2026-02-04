import { supabase } from '../lib/supabase';

interface TenantSetupResult {
  success: boolean;
  companyId?: string;
  error?: string;
}

export async function ensureTenantSetup(): Promise<TenantSetupResult> {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user) {
      return { success: false, error: 'No active session' };
    }

    const userId = session.user.id;
    const email = session.user.email || '';

    console.log('TENANT_SETUP: Checking for user', userId);

    const { data: adminCheck, error: checkError } = await supabase
      .from('admin_users')
      .select('id, company_id, full_name')
      .eq('id', userId)
      .maybeSingle();

    if (checkError) {
      console.error('TENANT_SETUP: Error checking admin_users', checkError);
    }

    if (adminCheck?.company_id) {
      console.log('TENANT_SETUP: ✓ Admin already exists with company', adminCheck.company_id);
      return { success: true, companyId: adminCheck.company_id };
    }

    console.log('TENANT_SETUP: Creating NEW company and admin for user', userId);

    let companyName = session.user.user_metadata?.company_name;
    let fullName = session.user.user_metadata?.full_name;

    const fallbackData = localStorage.getItem('geoshift_registration_fallback');
    if (fallbackData) {
      try {
        const parsed = JSON.parse(fallbackData);
        companyName = companyName || parsed.companyName;
        fullName = fullName || parsed.fullName;
        console.log('TENANT_SETUP: Using fallback data from localStorage');
      } catch (e) {
        console.error('TENANT_SETUP: Failed to parse fallback data:', e);
      }
    }

    companyName = companyName || `${fullName || email.split('@')[0]}'s Company`;
    fullName = fullName || email.split('@')[0] || 'Admin User';

    console.log('TENANT_SETUP: Creating company:', companyName);

    const { data: result, error: rpcError } = await supabase.rpc(
      'create_company_and_admin',
      {
        p_company_name: companyName,
        p_full_name: fullName,
        p_email: email,
      }
    );

    if (rpcError) {
      console.error('TENANT_SETUP: RPC error', rpcError);
      return { success: false, error: rpcError.message };
    }

    if (result?.success) {
      console.log('TENANT_SETUP: ✓ Successfully created', result.message || 'company and admin');
      console.log('TENANT_SETUP: Company ID:', result.company_id);
      localStorage.removeItem('geoshift_registration_fallback');
      return { success: true, companyId: result.company_id };
    }

    return { success: false, error: 'Failed to create company' };

  } catch (error: any) {
    console.error('TENANT_SETUP: Unexpected error', error);
    return { success: false, error: error.message };
  }
}
