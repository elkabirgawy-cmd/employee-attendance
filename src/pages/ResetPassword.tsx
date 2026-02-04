import { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff, CheckCircle, Fingerprint } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';

export default function ResetPassword() {
  const { language } = useLanguage();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [validSession, setValidSession] = useState(false);

  const isRTL = language === 'ar';

  useEffect(() => {
    // Check if user has a recovery session
    checkRecoverySession();
  }, []);

  async function checkRecoverySession() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setValidSession(true);
      } else {
        setError(isRTL ? 'رابط إعادة التعيين غير صالح أو منتهي الصلاحية' : 'Invalid or expired reset link');
      }
    } catch (err) {
      setError(isRTL ? 'رابط إعادة التعيين غير صالح أو منتهي الصلاحية' : 'Invalid or expired reset link');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError(isRTL ? 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' : 'Password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(isRTL ? 'كلمات المرور غير متطابقة' : 'Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) {
        throw updateError;
      }

      setSuccess(true);

      // Redirect to login after 2 seconds
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    } catch (err: any) {
      setError(
        isRTL
          ? err.message || 'حدث خطأ أثناء تغيير كلمة المرور'
          : err.message || 'An error occurred while resetting password'
      );
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div
        className="h-screen w-screen bg-[#F5F6FA] flex flex-col items-center justify-center"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <div className="bg-white rounded-[22px] p-8 max-w-[400px] w-full mx-4 text-center shadow-lg">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <CheckCircle size={32} className="text-green-600" />
          </div>
          <h2 className="text-[22px] font-bold text-slate-800 mb-2">
            {isRTL ? 'تم تغيير كلمة المرور بنجاح' : 'Password Reset Successful'}
          </h2>
          <p className="text-[14px] text-slate-600">
            {isRTL
              ? 'سيتم توجيهك إلى صفحة تسجيل الدخول...'
              : 'Redirecting to login page...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="h-screen w-screen bg-[#F5F6FA] flex flex-col overflow-hidden relative"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* HERO AREA - Top Section */}
      <div className="relative w-full flex flex-col items-center justify-center pt-16 pb-8" style={{ height: '240px' }}>
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
            {isRTL ? 'إعادة تعيين كلمة المرور' : 'Reset Your Password'}
          </p>
        </div>
      </div>

      {/* FORM CARD */}
      <div className="flex-1 flex items-start justify-center px-5 pb-8">
        <div
          className="w-full max-w-[400px] bg-white rounded-[22px] px-6 py-7"
          style={{
            boxShadow: '0 8px 32px -8px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.05)'
          }}
        >
          {!validSession ? (
            <div className="text-center py-4">
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-[13px]">
                {error || (isRTL ? 'رابط غير صالح' : 'Invalid link')}
              </div>
              <a
                href="/"
                className="inline-block mt-4 text-blue-600 hover:text-blue-700 font-semibold text-[14px]"
              >
                {isRTL ? 'العودة لتسجيل الدخول' : 'Back to Login'}
              </a>
            </div>
          ) : (
            <>
              <h2 className="text-[20px] font-bold text-slate-800 mb-2">
                {isRTL ? 'إنشاء كلمة مرور جديدة' : 'Create New Password'}
              </h2>
              <p className="text-[13px] text-slate-600 mb-5">
                {isRTL
                  ? 'اختر كلمة مرور قوية لحماية حسابك'
                  : 'Choose a strong password to protect your account'}
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* New Password */}
                <div className="relative">
                  <Lock
                    className={`absolute top-1/2 -translate-y-1/2 text-slate-400 ${isRTL ? 'right-3' : 'left-3'}`}
                    size={18}
                  />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={`w-full h-[50px] ${isRTL ? 'pr-10 pl-10' : 'pl-10 pr-10'} border border-slate-200 rounded-[12px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-slate-800 bg-white text-[15px]`}
                    placeholder={isRTL ? 'كلمة المرور الجديدة' : 'New Password'}
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

                {/* Confirm Password */}
                <div className="relative">
                  <Lock
                    className={`absolute top-1/2 -translate-y-1/2 text-slate-400 ${isRTL ? 'right-3' : 'left-3'}`}
                    size={18}
                  />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`w-full h-[50px] ${isRTL ? 'pr-10 pl-10' : 'pl-10 pr-10'} border border-slate-200 rounded-[12px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-slate-800 bg-white text-[15px]`}
                    placeholder={isRTL ? 'تأكيد كلمة المرور' : 'Confirm Password'}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className={`absolute top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 ${isRTL ? 'left-3' : 'right-3'}`}
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-[11px]">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-[52px] bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-bold rounded-[12px] transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg text-[16px]"
                >
                  {loading
                    ? (isRTL ? 'جاري التغيير...' : 'Resetting...')
                    : (isRTL ? 'تغيير كلمة المرور' : 'Reset Password')}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
