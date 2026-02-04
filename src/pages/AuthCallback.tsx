import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { ensureTenantSetup } from '../utils/tenantSetup';

export default function AuthCallback() {
  const { language } = useLanguage();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    handleEmailConfirmation();
  }, []);

  async function handleEmailConfirmation() {
    try {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const code = hashParams.get('code');

      if (!code) {
        setStatus('error');
        setMessage(language === 'ar'
          ? 'رابط التأكيد غير صالح أو منتهي الصلاحية'
          : 'Invalid or expired confirmation link'
        );
        return;
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(code);

      if (sessionError || !sessionData.user) {
        throw sessionError || new Error('No user data');
      }

      console.log('CALLBACK: Session exchanged, calling ensureTenantSetup');
      const setupResult = await ensureTenantSetup();

      if (!setupResult.success) {
        throw new Error(setupResult.error || 'Failed to setup tenant');
      }

      setStatus('success');
      setMessage(language === 'ar'
        ? 'تم تأكيد بريدك الإلكتروني بنجاح!'
        : 'Email confirmed successfully!'
      );

      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 1500);

    } catch (error: any) {
      console.error('Confirmation error:', error);
      setStatus('error');
      setMessage(language === 'ar'
        ? 'حدث خطأ أثناء تأكيد بريدك الإلكتروني'
        : 'An error occurred while confirming your email'
      );
    }
  }

  return (
    <div className="h-screen w-screen bg-[#F5F6FA] flex flex-col items-center justify-center overflow-hidden relative">
      <div className="w-full max-w-[400px] flex flex-col items-center px-5">
        <div className="w-full bg-white rounded-[24px] shadow-2xl px-8 py-10">
          <div className="flex flex-col items-center text-center">
            {status === 'loading' && (
              <>
                <Loader2 className="w-16 h-16 text-blue-600 animate-spin mb-4" />
                <h2 className="text-xl font-bold text-slate-800 mb-2">
                  {language === 'ar' ? 'جاري التأكيد...' : 'Confirming...'}
                </h2>
                <p className="text-sm text-slate-600">
                  {language === 'ar'
                    ? 'يرجى الانتظار بينما نؤكد بريدك الإلكتروني'
                    : 'Please wait while we confirm your email'}
                </p>
              </>
            )}

            {status === 'success' && (
              <>
                <CheckCircle className="w-16 h-16 text-green-600 mb-4" />
                <h2 className="text-xl font-bold text-slate-800 mb-2">
                  {language === 'ar' ? 'تم بنجاح!' : 'Success!'}
                </h2>
                <p className="text-sm text-slate-600">{message}</p>
                <p className="text-xs text-slate-500 mt-2">
                  {language === 'ar'
                    ? 'جاري التوجيه إلى لوحة التحكم...'
                    : 'Redirecting to dashboard...'}
                </p>
              </>
            )}

            {status === 'error' && (
              <>
                <XCircle className="w-16 h-16 text-red-600 mb-4" />
                <h2 className="text-xl font-bold text-slate-800 mb-2">
                  {language === 'ar' ? 'خطأ' : 'Error'}
                </h2>
                <p className="text-sm text-slate-600 mb-6">{message}</p>
                <a
                  href="/"
                  className="w-full h-[48px] bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-bold rounded-[14px] transition shadow-md text-[15px] flex items-center justify-center"
                >
                  {language === 'ar' ? 'العودة لتسجيل الدخول' : 'Back to Sign In'}
                </a>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
