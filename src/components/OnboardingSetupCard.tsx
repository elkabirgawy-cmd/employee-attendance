import { useEffect, useState } from 'react';
import { CheckCircle2, Building2, Users } from 'lucide-react';
import { useOnboardingProgress } from '../hooks/useOnboardingProgress';

interface OnboardingSetupCardProps {
  companyId: string;
  onNavigateToBranches: () => void;
  onNavigateToEmployees: () => void;
}

export function OnboardingSetupCard({
  companyId,
  onNavigateToBranches,
  onNavigateToEmployees
}: OnboardingSetupCardProps) {
  const { step, progressPct, branchesCount, employeesCount, completed, isLoading } = useOnboardingProgress(companyId);
  const [isAnimating, setIsAnimating] = useState(false);
  const [prevStep, setPrevStep] = useState(step);

  useEffect(() => {
    if (prevStep !== step) {
      setIsAnimating(true);
      const timer = setTimeout(() => {
        setIsAnimating(false);
        setPrevStep(step);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [step, prevStep]);

  if (isLoading || completed) {
    return null;
  }

  if (step === 3 && branchesCount > 0 && employeesCount > 0) {
    return (
      <div className={`bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border-2 border-green-200 p-6 shadow-lg transition-all duration-300 ${isAnimating ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
        <div className="flex items-start gap-4">
          <div className="bg-green-500 rounded-full p-3 flex-shrink-0">
            <CheckCircle2 className="w-8 h-8 text-white" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xl font-bold text-green-900">الخطوة 3 من 3: جاهز للتشغيل</h3>
              <span className="text-sm font-semibold text-green-700 bg-green-100 px-3 py-1 rounded-full">
                100%
              </span>
            </div>
            <div className="w-full bg-green-200 rounded-full h-2 mb-4">
              <div className="bg-green-500 h-2 rounded-full transition-all duration-500 ease-out" style={{ width: '100%' }}></div>
            </div>
            <p className="text-green-800">
              يمكنك الآن ضبط الورديات وبدء تسجيل الحضور
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className={`bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200 p-6 shadow-lg transition-all duration-300 ${isAnimating ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
        <div className="flex items-start gap-4">
          <div className="bg-blue-500 rounded-full p-3 flex-shrink-0">
            <Users className="w-8 h-8 text-white" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xl font-bold text-blue-900">الخطوة 2 من 3: إضافة موظف</h3>
              <span className="text-sm font-semibold text-blue-700 bg-blue-100 px-3 py-1 rounded-full">
                33%
              </span>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-2 mb-4">
              <div className="bg-blue-500 h-2 rounded-full transition-all duration-500 ease-out" style={{ width: '33%' }}></div>
            </div>
            <p className="text-blue-800 mb-4">
              أضف موظف وحدد الفرع الخاص به
            </p>
            <div className="flex gap-3">
              <button
                onClick={onNavigateToEmployees}
                className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 transition-colors shadow-md font-medium"
              >
                <Users className="w-5 h-5" />
                إضافة موظف
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl border-2 border-orange-200 p-6 shadow-lg transition-all duration-300 ${isAnimating ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
      <div className="flex items-start gap-4">
        <div className="bg-orange-500 rounded-full p-3 flex-shrink-0">
          <Building2 className="w-8 h-8 text-white" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xl font-bold text-orange-900">الخطوة 1 من 3: إنشاء أول فرع</h3>
            <span className="text-sm font-semibold text-orange-700 bg-orange-100 px-3 py-1 rounded-full">
              0%
            </span>
          </div>
          <div className="w-full bg-orange-200 rounded-full h-2 mb-4">
            <div className="bg-orange-500 h-2 rounded-full transition-all duration-500 ease-out" style={{ width: '0%' }}></div>
          </div>
          <p className="text-orange-800 mb-4">
            أنشئ أول فرع لتحديد موقع الحضور
          </p>
          <div className="flex gap-3">
            <button
              onClick={onNavigateToBranches}
              className="flex items-center gap-2 bg-orange-600 text-white px-6 py-2.5 rounded-lg hover:bg-orange-700 transition-colors shadow-md font-medium"
            >
              <Building2 className="w-5 h-5" />
              إنشاء فرع
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
