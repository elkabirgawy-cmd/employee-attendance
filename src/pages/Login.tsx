import { useState, useEffect } from 'react';
import { Fingerprint, Lock, Mail, Globe, CircleUser as UserCircle, Eye, EyeOff, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';

export default function Login() {
  const { signIn, user, isAdmin } = useAuth();
  const { language, setLanguage } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showResendButton, setShowResendButton] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);

  const isRTL = language === 'ar';

  // Redirect when isAdmin becomes true after login
  useEffect(() => {
    if (user && isAdmin && loading) {
      console.log('LOGIN_EFFECT: user && isAdmin detected, App.tsx will show Dashboard');
      setLoading(false);
    }
  }, [user, isAdmin, loading]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    // 10-second timeout guard
    const timeoutId = setTimeout(() => {
      console.error('LOGIN_TIMEOUT: Login process exceeded 10 seconds');
      setError(isRTL
        ? 'تعذر تسجيل الدخول الآن، تحقق من الإنترنت أو حاول مرة أخرى'
        : 'Unable to sign in now. Check your internet connection or try again'
      );
      setLoading(false);
    }, 10000);

    try {
      // Step 1: Sign in with password
      const { error: signInError } = await signIn(email, password);

      if (signInError) {
        clearTimeout(timeoutId);
        console.error('LOGIN_STEP: signIn failed', signInError);

        if (signInError.message.includes('Email not confirmed')) {
          setShowResendButton(true);
          setError(isRTL
            ? 'يرجى تأكيد البريد الإلكتروني أولاً.'
            : 'Please confirm your email first.'
          );
        } else if (signInError.message.includes('Invalid login credentials')) {
          setError(isRTL
            ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة'
            : 'Invalid email or password'
          );
        } else {
          setError(isRTL
            ? 'حدث خطأ أثناء تسجيل الدخول. يرجى المحاولة مرة أخرى.'
            : 'An error occurred during sign in. Please try again.'
          );
        }
        return;
      }

      console.log('LOGIN_STEP: signIn success');

      // Step 2: Get current session to access user.id
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) {
        clearTimeout(timeoutId);
        console.error('ADMIN_CHECK_ERROR: No session after signIn');
        await supabase.auth.signOut();
        setError('Session not found after sign-in. Please try again.');
        return;
      }

      console.log('LOGIN_STEP: admin_users check start for user_id:', session.user.id);

      // Step 3: Check admin_users by id (admin_users.id === auth.users.id)
      const { data: adminData, error: adminError } = await supabase
        .from('admin_users')
        .select('id, company_id, is_active, is_owner')
        .eq('id', session.user.id)
        .maybeSingle();

      if (adminError) {
        clearTimeout(timeoutId);
        console.error('ADMIN_CHECK_ERROR:', {
          code: adminError.code,
          message: adminError.message,
          details: adminError.details,
          hint: adminError.hint
        });

        await supabase.auth.signOut();

        // Show detailed error in UI
        const errorDetails = `Code: ${adminError.code}\nMessage: ${adminError.message}\n${adminError.hint ? 'Hint: ' + adminError.hint : ''}`;

        if (adminError.code === '42P17') {
          setError(`Database Error - Infinite Recursion:\n\n${errorDetails}\n\nThis error occurs when RLS policies on admin_users or related tables reference admin_users in their conditions, creating a circular dependency.\n\nRequired fix: Use SECURITY DEFINER functions instead of direct queries in RLS policies.`);
        } else if (adminError.code === 'PGRST301' || adminError.message.includes('permission denied')) {
          setError(`RLS Policy Issue:\n\nMissing SELECT policy on admin_users.\n\n${errorDetails}\n\nRequired SQL:\nCREATE POLICY "admin_users_select_self" ON admin_users FOR SELECT USING (id = auth.uid());`);
        } else {
          setError(`Database Error:\n\n${errorDetails}`);
        }
        return;
      }

      if (!adminData) {
        clearTimeout(timeoutId);
        console.error('ADMIN_CHECK_ERROR: Admin record not found in admin_users for user_id:', session.user.id);
        await supabase.auth.signOut();
        setError(`Admin record not found in admin_users for this user_id: ${session.user.id}\n\nThis user exists in auth.users but not in admin_users table.`);
        return;
      }

      if (!adminData.is_active) {
        clearTimeout(timeoutId);
        console.log('LOGIN_STEP: admin inactive -> deny');
        await supabase.auth.signOut();
        setError(isRTL
          ? 'الحساب غير نشط. يرجى التواصل مع المسؤول.'
          : 'Account is inactive. Please contact administrator.'
        );
        return;
      }

      console.log('LOGIN_STEP: admin_users found', {
        id: adminData.id,
        company_id: adminData.company_id,
        is_active: adminData.is_active,
        is_owner: adminData.is_owner
      });

      // Step 4: Only proceed if session exists and admin is active
      if (!session || !adminData.is_active) {
        clearTimeout(timeoutId);
        console.error('ADMIN_CHECK_ERROR: Session or active status invalid', {
          hasSession: !!session,
          isActive: adminData.is_active
        });
        await supabase.auth.signOut();
        setError(isRTL
          ? 'الحساب غير نشط. يرجى التواصل مع المسؤول.'
          : 'Account is inactive. Please contact administrator.'
        );
        return;
      }

      console.log('LOGIN_STEP: admin verified - active and has session');

      // Step 5: Wait for AuthContext to update isAdmin state
      console.log('LOGIN_STEP: waiting for AuthContext update');

      // Give AuthContext time to process the auth state change
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 6: Debug logging for multi-tenant isolation
      try {
        const { count } = await supabase
          .from('employees')
          .select('*', { count: 'exact', head: true });

        console.log('═══════════════════════════════════════════════════');
        console.log('🔐 MULTI-TENANT DEBUG INFO:');
        console.log('Email:', session.user.email);
        console.log('User ID:', adminData.id);
        console.log('Company ID:', adminData.company_id);
        console.log('Employees Count:', count);
        console.log('LOGIN_STEP: session ready');
        console.log('LOGIN_STEP: route allow');
        console.log('═══════════════════════════════════════════════════');
      } catch (debugError) {
        console.error('Debug logging failed:', debugError);
      }

      // Step 7: Success - let AuthContext handle the redirect via App.tsx
      clearTimeout(timeoutId);
      console.log('LOGIN_STEP: redirect dashboard');
      setLoading(false);
      // Don't use window.location.href - let React routing handle it
      // The App.tsx will automatically show Dashboard when user && isAdmin are true

    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error('LOGIN_STEP: unexpected error', err);
      setError(isRTL
        ? 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.'
        : 'An unexpected error occurred. Please try again.'
      );
    } finally {
      // Ensure loading always stops (except when redirecting successfully)
      // If we reached redirect, the page will reload anyway
      setTimeout(() => setLoading(false), 100);
    }
  }

  async function handleResendEmail() {
    if (!email) {
      setError(isRTL
        ? 'يرجى إدخال البريد الإلكتروني أولاً'
        : 'Please enter your email first'
      );
      return;
    }

    setResendingEmail(true);
    setError('');

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
      });

      if (error) throw error;

      setError(isRTL
        ? '✓ تم إعادة إرسال رابط التفعيل بنجاح! تحقق من بريدك الإلكتروني.'
        : '✓ Activation link resent successfully! Check your email.'
      );
      setShowResendButton(false);
    } catch (err: any) {
      setError(isRTL
        ? 'فشل في إعادة إرسال البريد. يرجى المحاولة لاحقاً.'
        : 'Failed to resend email. Please try again later.'
      );
    } finally {
      setResendingEmail(false);
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setForgotError('');
    setForgotLoading(true);

    try {
      const emailLower = forgotEmail.trim().toLowerCase();

      // Check if email exists in admin_users first (for logging purposes only)
      const { data: adminUser } = await supabase
        .from('admin_users')
        .select('id')
        .eq('email', emailLower)
        .maybeSingle();

      // Always send the request regardless of whether admin exists (security)
      const { error } = await supabase.auth.resetPasswordForEmail(emailLower, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      // Log the attempt if admin exists
      if (adminUser) {
        await supabase
          .from('password_recovery_requests')
          .insert({
            admin_email: emailLower,
            admin_name: emailLower,
            requested_at: new Date().toISOString(),
            status: 'pending'
          });
      }

      // Always show success message for security (don't reveal if email exists)
      setForgotSuccess(true);
      setTimeout(() => {
        setShowForgotPasswordModal(false);
        setForgotEmail('');
        setForgotSuccess(false);
      }, 4000);
    } catch (err: any) {
      // Even on error, show generic success message for security
      setForgotSuccess(true);
      setTimeout(() => {
        setShowForgotPasswordModal(false);
        setForgotEmail('');
        setForgotSuccess(false);
      }, 4000);
    } finally {
      setForgotLoading(false);
    }
  }

  return (
    <div
      className="h-screen w-screen bg-[#F5F6FA] flex flex-col overflow-hidden relative"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Language switch - absolute positioned */}
      <div className="absolute top-6 right-6 z-20">
        <button
          onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/80 backdrop-blur-sm hover:bg-white rounded-full transition border border-slate-200 shadow-sm"
        >
          <Globe size={14} className="text-blue-600" />
          <span className="text-xs font-medium text-slate-700">
            {language === 'ar' ? 'English' : 'العربية'}
          </span>
        </button>
      </div>

      {/* HERO AREA - Top Section (Fixed height ~240px) */}
      <div className="relative w-full flex flex-col items-center justify-center pt-16 pb-8" style={{ height: '240px' }}>
        {/* Hero gradient background - curved blob */}
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2"
            style={{
              width: '500px',
              height: '300px',
              background: 'radial-gradient(ellipse at center, rgba(93, 169, 255, 0.8) 0%, rgba(156, 199, 255, 0.5) 40%, rgba(156, 199, 255, 0.2) 70%, transparent 100%)',
              filter: 'blur(50px)',
              transform: 'translateX(-50%) translateY(-20%)',
            }}
          ></div>
        </div>

        {/* Hero content */}
        <div className="relative z-10 text-center">
          <div
            className="inline-flex items-center justify-center w-[72px] h-[72px] bg-gradient-to-br from-blue-500 to-blue-400 rounded-[20px] mb-4 shadow-xl"
            style={{
              boxShadow: '0 10px 30px -5px rgba(59, 130, 246, 0.4), 0 8px 15px -6px rgba(59, 130, 246, 0.4), 0 0 50px rgba(93, 169, 255, 0.5)'
            }}
          >
            <Fingerprint size={40} className="text-white" strokeWidth={2.5} />
          </div>
          <h1 className="text-[32px] font-bold text-slate-800 mb-2 leading-none">
            GeoShift
          </h1>
          <p className="text-[15px] text-slate-700 leading-tight px-4">
            {isRTL ? 'سجّل دخولك للوصول إلى لوحة التحكم' : 'Sign in to access your dashboard'}
          </p>
        </div>
      </div>

      {/* FORM CARD - Bottom Section (Floating card) */}
      <div className="flex-1 flex items-start justify-center px-5 pb-8">
        <div
          className="w-full max-w-[400px] bg-white rounded-[22px] px-6 py-7"
          style={{
            boxShadow: '0 8px 32px -8px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.05)'
          }}
        >
          {/* Form section */}
          <form onSubmit={handleSubmit} className="space-y-2.5 mb-4">
            {/* Email input */}
            <div className="relative">
              <Mail
                className={`absolute top-1/2 -translate-y-1/2 text-slate-400 ${isRTL ? 'right-3' : 'left-3'}`}
                size={18}
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full h-[50px] ${isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'} border border-slate-200 rounded-[12px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-slate-800 bg-white text-[15px]`}
                placeholder={isRTL ? 'البريد الإلكتروني' : 'Email address'}
                required
              />
            </div>

            {/* Password input */}
            <div className="relative">
              <Lock
                className={`absolute top-1/2 -translate-y-1/2 text-slate-400 ${isRTL ? 'right-3' : 'left-3'}`}
                size={18}
              />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full h-[50px] ${isRTL ? 'pr-10 pl-10' : 'pl-10 pr-10'} border border-slate-200 rounded-[12px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-slate-800 bg-white text-[15px]`}
                placeholder={isRTL ? 'كلمة المرور' : 'Password'}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={`absolute top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 ${isRTL ? 'left-3' : 'right-3'}`}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* Error message */}
            {error && (
              <div className={`px-3 py-2 rounded-lg text-[11px] max-h-96 overflow-y-auto ${
                error.includes('✓')
                  ? 'bg-green-50 border border-green-200 text-green-700'
                  : 'bg-red-50 border border-red-200 text-red-700'
              }`}>
                <pre className="whitespace-pre-wrap font-sans">{error}</pre>
              </div>
            )}

            {/* Resend email button */}
            {showResendButton && (
              <button
                type="button"
                onClick={handleResendEmail}
                disabled={resendingEmail}
                className="w-full h-[44px] bg-white hover:bg-slate-50 text-slate-700 font-medium rounded-[12px] transition border border-slate-200 shadow-sm text-[14px] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resendingEmail
                  ? (isRTL ? 'جاري الإرسال...' : 'Sending...')
                  : (isRTL ? 'إعادة إرسال رابط التفعيل' : 'Resend Activation Link')}
              </button>
            )}

            {/* Primary button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-[52px] bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-bold rounded-[12px] transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg text-[16px] mt-4"
            >
              {loading ? (isRTL ? 'جاري الدخول...' : 'Signing in...') : (isRTL ? 'دخول' : 'Sign In')}
            </button>
          </form>

          {/* Divider */}
          <div className="relative h-[16px] flex items-center justify-center my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="px-3 bg-white text-slate-400 text-[12px]">
                {isRTL ? 'أو' : 'or'}
              </span>
            </div>
          </div>

          {/* Secondary button - Employee Login with soft blue background */}
          <button
            type="button"
            onClick={() => window.location.href = '/employee-app'}
            className="w-full h-[50px] bg-[#EEF3FF] hover:bg-[#E0EBFF] text-blue-600 font-semibold rounded-[12px] transition flex items-center justify-center gap-2 text-[15px] mb-3"
          >
            <UserCircle size={19} />
            <span>{isRTL ? 'دخول موظف' : 'Employee Login'}</span>
          </button>

          {/* Create account link - MUST REMAIN VISIBLE */}
          <div className="text-center text-[14px] text-slate-600">
            <p className="leading-tight">
              {isRTL ? 'ليس لديك حساب؟ ' : "Don't have an account? "}
              <a href="/register" className="text-blue-600 hover:text-blue-700 font-semibold">
                {isRTL ? 'إنشاء حساب' : 'Create Account'}
              </a>
            </p>
            <button
              type="button"
              onClick={() => setShowForgotPasswordModal(true)}
              className="mt-2 text-blue-600 hover:text-blue-700 text-[13px] font-medium"
            >
              {isRTL ? 'نسيت كلمة السر؟' : 'Forgot Password?'}
            </button>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotPasswordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" dir={isRTL ? 'rtl' : 'ltr'}>
          <div className="bg-white rounded-[22px] w-full max-w-[400px] p-6 relative">
            <button
              onClick={() => {
                setShowForgotPasswordModal(false);
                setForgotEmail('');
                setForgotError('');
                setForgotSuccess(false);
              }}
              className={`absolute top-4 ${isRTL ? 'left-4' : 'right-4'} text-slate-400 hover:text-slate-600`}
            >
              <X size={20} />
            </button>

            <h2 className="text-[20px] font-bold text-slate-800 mb-2">
              {isRTL ? 'نسيت كلمة السر؟' : 'Forgot Password?'}
            </h2>
            <p className="text-[13px] text-slate-600 mb-5">
              {isRTL
                ? 'أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة تعيين كلمة المرور'
                : 'Enter your email and we will send you a password reset link'}
            </p>

            {forgotSuccess ? (
              <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg text-[13px]">
                {isRTL
                  ? 'إذا كان هذا البريد مسجلاً، ستتلقى رابط إعادة تعيين كلمة المرور خلال دقائق.'
                  : 'If this email is registered, you will receive a password reset link within minutes.'}
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="relative">
                  <Mail
                    className={`absolute top-1/2 -translate-y-1/2 text-slate-400 ${isRTL ? 'right-3' : 'left-3'}`}
                    size={18}
                  />
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className={`w-full h-[50px] ${isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'} border border-slate-200 rounded-[12px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-slate-800 bg-white text-[15px]`}
                    placeholder={isRTL ? 'البريد الإلكتروني' : 'Email address'}
                    required
                  />
                </div>

                {forgotError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-[11px]">
                    {forgotError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full h-[50px] bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-semibold rounded-[12px] transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg text-[15px]"
                >
                  {forgotLoading
                    ? (isRTL ? 'جاري الإرسال...' : 'Sending...')
                    : (isRTL ? 'إرسال طلب الاستعادة' : 'Send Recovery Request')}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
