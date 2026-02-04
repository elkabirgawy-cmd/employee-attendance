import { useState } from 'react';
import { Fingerprint, Mail, Lock, User, Globe, Eye, EyeOff, Building2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';

export default function Register() {
  const { t, language, setLanguage, isRTL } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [emailConfirmationRequired, setEmailConfirmationRequired] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 1. Create auth user
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            company_name: companyName,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      // معالجة أخطاء التسجيل
      if (signUpError) {
        // التعامل مع خطأ "المستخدم موجود بالفعل"
        if (
          signUpError.message.includes('User already registered') ||
          signUpError.message.includes('already been registered') ||
          signUpError.message.includes('already registered')
        ) {
          setError(language === 'ar'
            ? 'هذا البريد الإلكتروني مسجل مسبقاً. يمكنك تسجيل الدخول مباشرة.'
            : 'This email is already registered. You can sign in directly.'
          );
          setLoading(false);
          return;
        }
        throw signUpError;
      }

      if (authData.user) {
        // التحقق من حالة Email Confirmation
        if (!authData.session) {
          // Email confirmation مطلوب - لا نستدعي RPC الآن
          // حفظ البيانات في localStorage كـ fallback
          localStorage.setItem('geoshift_registration_fallback', JSON.stringify({
            email,
            fullName,
            companyName,
          }));
          setEmailConfirmationRequired(true);
          setLoading(false);
          return;
        }

        // 2. الجلسة موجودة - استدعاء Function آمنة لإنشاء الشركة والأدمن
        const { data: result, error: rpcError } = await supabase.rpc(
          'create_company_and_admin',
          {
            p_company_name: companyName,
            p_full_name: fullName,
            p_email: email,
          }
        );

        if (rpcError) {
          // معالجة أخطاء RPC بشكل ودي
          console.error('Error creating company and admin:', rpcError);

          if (rpcError.message.includes('already exists')) {
            setError(language === 'ar'
              ? 'حسابك موجود بالفعل. يمكنك تسجيل الدخول مباشرة.'
              : 'Your account already exists. You can sign in directly.'
            );
          } else {
            setError(language === 'ar'
              ? 'حدث خطأ أثناء إعداد الحساب. يرجى المحاولة مرة أخرى.'
              : 'An error occurred while setting up your account. Please try again.'
            );
          }
          setLoading(false);
          return;
        }

        if (result && result.success) {
          setSuccess(true);
        } else {
          setError(language === 'ar'
            ? 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.'
            : 'An unexpected error occurred. Please try again.'
          );
        }
      }
    } catch (err: any) {
      console.error('Registration error:', err);
      setError(language === 'ar'
        ? 'حدث خطأ أثناء إنشاء الحساب. يرجى التحقق من البيانات والمحاولة مرة أخرى.'
        : 'An error occurred during registration. Please check your details and try again.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleResendEmail() {
    setResendingEmail(true);
    setError('');

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
      });

      if (error) throw error;

      // عرض رسالة نجاح مؤقتة
      const successMsg = language === 'ar'
        ? 'تم إعادة إرسال رابط التفعيل بنجاح!'
        : 'Activation link resent successfully!';
      alert(successMsg);
    } catch (err: any) {
      setError(language === 'ar'
        ? 'فشل في إعادة إرسال البريد. يرجى المحاولة لاحقاً.'
        : 'Failed to resend email. Please try again later.'
      );
    } finally {
      setResendingEmail(false);
    }
  }

  // عرض واجهة Email Confirmation
  if (emailConfirmationRequired) {
    return (
      <div
        className="h-screen w-screen bg-[#F5F6FA] flex flex-col items-center justify-center overflow-hidden relative"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Hero gradient background - outside card */}
        <div className="absolute top-[15vh] left-1/2 -translate-x-1/2 pointer-events-none z-0">
          <div
            className="rounded-full"
            style={{
              width: '360px',
              height: '240px',
              background: 'radial-gradient(ellipse at center, rgba(250, 204, 21, 0.8) 0%, rgba(253, 224, 71, 0.5) 40%, rgba(253, 224, 71, 0.2) 70%, transparent 100%)',
              filter: 'blur(40px)',
            }}
          ></div>
        </div>

        {/* Language switch - absolute positioned */}
        <div className="absolute top-8 right-8 z-20">
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

        {/* Container for logo and card */}
        <div className="w-full max-w-[420px] flex flex-col items-center relative z-10 px-5">
          {/* Brand block - outside card, on gradient */}
          <div className="text-center mb-6">
            <div
              className="inline-flex items-center justify-center w-[72px] h-[72px] bg-gradient-to-br from-yellow-500 to-yellow-300 rounded-[20px] mb-3 shadow-lg"
              style={{
                boxShadow: '0 10px 25px -5px rgba(234, 179, 8, 0.3), 0 8px 10px -6px rgba(234, 179, 8, 0.3), 0 0 40px rgba(250, 204, 21, 0.4)'
              }}
            >
              <Mail size={36} className="text-white" strokeWidth={2.5} />
            </div>
            <h1 className="text-[32px] font-bold text-slate-800 mb-2 leading-tight">
              {language === 'ar' ? 'تأكيد البريد الإلكتروني' : 'Email Confirmation'}
            </h1>
            <p className="text-[15px] text-slate-600 leading-tight px-4">
              {language === 'ar' ? 'خطوة واحدة أخيرة' : 'One more step'}
            </p>
          </div>

          {/* White card - content only */}
          <div className="w-full bg-white rounded-[24px] shadow-2xl px-8 py-8">
            <div className="bg-blue-50 border border-blue-200 px-4 py-3.5 rounded-xl mb-5">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-[14px] text-blue-800 leading-relaxed">
                    {language === 'ar'
                      ? 'تم إرسال رابط التفعيل إلى بريدك الإلكتروني.'
                      : 'An activation link has been sent to your email.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg mb-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">{language === 'ar' ? 'البريد' : 'Email'}:</span>
                <span className="text-sm font-medium text-slate-800">{email}</span>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2.5 rounded-lg text-sm mb-4">
                {error}
              </div>
            )}

            <div className="space-y-2.5">
              <a
                href="/"
                className="w-full h-[52px] bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-bold rounded-[14px] transition shadow-md text-[16px] flex items-center justify-center"
              >
                {language === 'ar' ? 'تسجيل الدخول' : 'Sign In'}
              </a>

              <button
                onClick={handleResendEmail}
                disabled={resendingEmail}
                className="w-full h-[48px] bg-white hover:bg-slate-50 text-slate-700 font-medium rounded-[14px] transition border border-slate-200 shadow-sm text-[15px] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resendingEmail
                  ? (language === 'ar' ? 'جاري الإرسال...' : 'Sending...')
                  : (language === 'ar' ? 'إعادة إرسال رابط التفعيل' : 'Resend Activation Link')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // عرض واجهة النجاح (بعد إنشاء الحساب مباشرة)
  if (success) {
    return (
      <div
        className="h-screen w-screen bg-[#F5F6FA] flex flex-col items-center justify-center overflow-hidden relative"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Hero gradient background - outside card */}
        <div className="absolute top-[15vh] left-1/2 -translate-x-1/2 pointer-events-none z-0">
          <div
            className="rounded-full"
            style={{
              width: '360px',
              height: '240px',
              background: 'radial-gradient(ellipse at center, rgba(74, 222, 128, 0.8) 0%, rgba(134, 239, 172, 0.5) 40%, rgba(134, 239, 172, 0.2) 70%, transparent 100%)',
              filter: 'blur(40px)',
            }}
          ></div>
        </div>

        {/* Language switch - absolute positioned */}
        <div className="absolute top-8 right-8 z-20">
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

        {/* Container for logo and card */}
        <div className="w-full max-w-[402px] flex flex-col items-center relative z-10">
          {/* Brand block - outside card, on gradient */}
          <div className="text-center mb-6">
            <div
              className="inline-flex items-center justify-center w-[72px] h-[72px] bg-gradient-to-br from-green-500 to-green-300 rounded-[20px] mb-3 shadow-lg"
              style={{
                boxShadow: '0 10px 25px -5px rgba(34, 197, 94, 0.3), 0 8px 10px -6px rgba(34, 197, 94, 0.3), 0 0 40px rgba(74, 222, 128, 0.4)'
              }}
            >
              <Fingerprint size={40} className="text-white" strokeWidth={2.5} />
            </div>
            <h1 className="text-[32px] font-bold text-slate-800 mb-2 leading-tight">
              {language === 'ar' ? 'تم بنجاح!' : 'Success!'}
            </h1>
            <p className="text-[15px] text-slate-600 leading-tight">
              {language === 'ar' ? 'تم إنشاء حسابك بنجاح' : 'Your account has been created'}
            </p>
          </div>

          {/* White card - content only */}
          <div className="w-full bg-white rounded-[24px] shadow-2xl px-8 py-8">
            <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2.5 rounded-lg text-sm mb-4">
              {language === 'ar' ? 'تم إنشاء حساب المدير بنجاح!' : 'Admin account created successfully!'}
            </div>

            <div className="space-y-2 mb-6">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <span className="text-sm text-slate-600">{isRTL ? 'الشركة' : 'Company'}:</span>
                <span className="text-sm font-medium text-slate-800">{companyName}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <span className="text-sm text-slate-600">{t('auth.fullName')}:</span>
                <span className="text-sm font-medium text-slate-800">{fullName}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <span className="text-sm text-slate-600">{t('auth.email')}:</span>
                <span className="text-sm font-medium text-slate-800">{email}</span>
              </div>
            </div>

            <a
              href="/"
              className="w-full h-[54px] bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-bold rounded-[16px] transition shadow-md text-[17px] flex items-center justify-center"
            >
              {language === 'ar' ? 'تسجيل الدخول الآن' : 'Sign In Now'}
            </a>
          </div>
        </div>
      </div>
    );
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
            {isRTL ? 'أنشئ حساب مدير جديد' : 'Create a new admin account'}
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
          <form onSubmit={handleSubmit} className="space-y-2.5 mb-3">
            {/* Full Name input */}
            <div className="relative">
              <User
                className={`absolute top-1/2 -translate-y-1/2 text-slate-400 ${isRTL ? 'right-3' : 'left-3'}`}
                size={18}
              />
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={`w-full h-[50px] ${isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'} border border-slate-200 rounded-[12px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-slate-800 bg-white text-[15px]`}
                placeholder={isRTL ? 'الاسم الكامل' : 'Full Name'}
                required
              />
            </div>

            {/* Company Name input */}
            <div className="relative">
              <Building2
                className={`absolute top-1/2 -translate-y-1/2 text-slate-400 ${isRTL ? 'right-3' : 'left-3'}`}
                size={18}
              />
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className={`w-full h-[50px] ${isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'} border border-slate-200 rounded-[12px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-slate-800 bg-white text-[15px]`}
                placeholder={isRTL ? 'اسم الشركة' : 'Company Name'}
                required
              />
            </div>

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
                placeholder={isRTL ? 'كلمة المرور (6 أحرف على الأقل)' : 'Password (min 6 characters)'}
                required
                minLength={6}
                dir="ltr"
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
              <div className={`px-3 py-2.5 rounded-lg text-sm ${
                error.includes('مسجل مسبقاً') || error.includes('already registered')
                  ? 'bg-amber-50 border border-amber-200 text-amber-800'
                  : 'bg-red-50 border border-red-200 text-red-700'
              }`}>
                {error}
              </div>
            )}

            {/* Primary button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-[52px] bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-bold rounded-[12px] transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg text-[16px] mt-4"
            >
              {loading ? (isRTL ? 'جاري الإنشاء...' : 'Creating...') : (isRTL ? 'إنشاء حساب' : 'Create Account')}
            </button>
          </form>

          {/* Sign in link - MUST REMAIN VISIBLE */}
          <div className="text-center text-[14px] text-slate-600 mt-2">
            <p className="leading-tight">
              {isRTL ? 'لديك حساب بالفعل؟ ' : 'Already have an account? '}
              <a href="/" className="text-blue-600 hover:text-blue-700 font-semibold">
                {isRTL ? 'تسجيل الدخول' : 'Sign In'}
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
