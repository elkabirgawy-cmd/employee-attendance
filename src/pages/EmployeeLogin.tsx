import { useState, useEffect } from 'react';
import { Smartphone, Lock, AlertCircle, Loader2 } from 'lucide-react';

interface Employee {
  id: string;
  full_name: string;
  employee_code: string;
  phone: string;
  branch_id: string;
  company_id: string;
}

export default function EmployeeLogin() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [activationCode, setActivationCode] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [step, setStep] = useState<'phone' | 'activation'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    generateDeviceId();
    checkExistingSession();
  }, []);

  const generateDeviceId = () => {
    let storedDeviceId = localStorage.getItem('geoshift_device_id');
    if (!storedDeviceId) {
      storedDeviceId = `device_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      localStorage.setItem('geoshift_device_id', storedDeviceId);
    }
    setDeviceId(storedDeviceId);
  };

  const checkExistingSession = () => {
    const sessionToken = localStorage.getItem('geoshift_session_token');
    if (sessionToken) {
      window.location.href = '/employee-app';
    }
  };

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber.trim() || !deviceId) {
      setError('الرجاء إدخال رقم الهاتف');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/employee-login`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            phone_number: phoneNumber,
            device_id: deviceId,
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('geoshift_session_token', data.session_token);
        localStorage.setItem('geoshift_employee', JSON.stringify(data.employee));
        window.location.href = '/employee-app';
      } else {
        if (data.error === 'device_not_trusted') {
          setStep('activation');
        } else if (response.status === 404) {
          setError('رقم الهاتف غير مسجل لدى الإدارة');
        } else {
          setError(data.error || 'حدث خطأ، حاول مرة أخرى');
        }
      }
    } catch (err) {
      setError('خطأ في الاتصال بالشبكة. تحقق من اتصالك وحاول مرة أخرى.');
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleActivationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activationCode.trim()) {
      setError('الرجاء إدخال كود التفعيل');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/employee-activate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            phone_number: phoneNumber,
            activation_code: activationCode,
            device_id: deviceId,
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        setSuccessMessage(data.message_ar || 'تم تفعيل جهازك بنجاح');
        localStorage.setItem('geoshift_session_token', data.session_token);
        localStorage.setItem('geoshift_employee', JSON.stringify(data.employee));

        setTimeout(() => {
          window.location.href = '/employee-app';
        }, 1500);
      } else {
        setError(data.error || 'كود التفعيل غير صحيح');
      }
    } catch (err) {
      setError('خطأ في الاتصال بالشبكة. حاول مرة أخرى.');
      console.error('Activation error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
              <Smartphone className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">تسجيل الحضور</h1>
            <p className="text-gray-600 text-sm">نظام تسجيل حضور الموظفين</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {successMessage && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-800">{successMessage}</p>
            </div>
          )}

          {step === 'phone' ? (
            <form onSubmit={handlePhoneSubmit}>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  رقم الهاتف
                </label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="أدخل رقم هاتفك"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-right"
                  dir="rtl"
                  disabled={loading}
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={loading || !phoneNumber.trim()}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>جاري التحقق...</span>
                  </>
                ) : (
                  <>
                    <span>متابعة</span>
                  </>
                )}
              </button>

              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-800 leading-relaxed text-right" dir="rtl">
                  <strong>للمستخدمين الجدد:</strong> ستحتاج إلى كود تفعيل. بعد التفعيل الأول، ستبقى مسجل الدخول على هذا الجهاز دائماً.
                </p>
              </div>
            </form>
          ) : (
            <form onSubmit={handleActivationSubmit}>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  كود التفعيل
                </label>
                <input
                  type="text"
                  value={activationCode}
                  onChange={(e) => setActivationCode(e.target.value.toUpperCase())}
                  placeholder="أدخل كود التفعيل"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-lg tracking-widest font-mono"
                  disabled={loading}
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={loading || !activationCode.trim()}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>جاري التحقق...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-5 h-5" />
                    <span>تفعيل الجهاز</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep('phone');
                  setActivationCode('');
                  setError('');
                  setSuccessMessage('');
                }}
                className="w-full mt-3 text-gray-600 py-2 text-sm hover:text-gray-900"
                disabled={loading}
              >
                العودة لإدخال رقم الهاتف
              </button>

              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-900 font-medium text-right" dir="rtl">
                  هذا جهاز جديد ويحتاج كود تفعيل من الإدارة. اطلب كودًا من المسؤول.
                </p>
              </div>
            </form>
          )}
        </div>

        <div className="text-center mt-6">
          <a
            href="/"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            تسجيل دخول الإدارة
          </a>
        </div>
      </div>
    </div>
  );
}
