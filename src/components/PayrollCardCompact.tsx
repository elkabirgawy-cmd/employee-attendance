import { Download } from 'lucide-react';

interface PayrollCardCompactProps {
  employeeName: string;
  employeeCode: string;
  periodLabel: string;
  jobTitle?: string;
  department?: string;
  netSalary: number;
  currencyLabel?: string;
  earnings: {
    baseSalary: number;
    allowances: number;
    overtimeAmount: number;
    bonusesAmount: number;
  };
  deductions: {
    absence: number;
    late: number;
    penalties: number;
    socialInsurance: number;
    incomeTax: number;
  };
  attendance: {
    attendanceDays: number;
    absenceDays: number;
    lateDays: number;
  };
  metadata?: {
    workingDaysInMonth?: number;
    workingDaysInRange?: number;
  };
  overtimeHours?: number;
  onDownload?: () => void;
}

export default function PayrollCardCompact({
  employeeName,
  employeeCode,
  periodLabel,
  jobTitle,
  department,
  netSalary,
  currencyLabel = 'جنيه',
  earnings,
  deductions,
  attendance,
  metadata,
  overtimeHours,
  onDownload
}: PayrollCardCompactProps) {
  const formatNumber = (num: number): string => {
    return num.toFixed(2);
  };

  const grossSalary = earnings.baseSalary + earnings.allowances + earnings.overtimeAmount + earnings.bonusesAmount;
  const totalDeductions = deductions.absence + deductions.late + deductions.penalties + deductions.socialInsurance + deductions.incomeTax;

  return (
    <div className="w-full max-w-4xl mx-auto" dir="rtl">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Header Section */}
        <div className="bg-gradient-to-l from-blue-50 to-white px-6 py-4 border-b border-gray-100">
          <div className="flex items-start justify-between gap-4">
            {/* Right: Employee Info */}
            <div className="flex-1">
              <h2 className="text-lg font-bold text-gray-900 mb-1">{employeeName}</h2>
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <span className="font-medium">كود: {employeeCode}</span>
                <span className="text-gray-400">•</span>
                <span>الفترة: {periodLabel}</span>
              </div>
              {(jobTitle || department) && (
                <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                  {jobTitle && <span>{jobTitle}</span>}
                  {jobTitle && department && <span className="text-gray-400">•</span>}
                  {department && <span>{department}</span>}
                </div>
              )}
            </div>

            {/* Left: Net Salary Circle + Download */}
            <div className="flex items-center gap-3">
              <div className="relative flex items-center justify-center">
                {/* Circular Progress Ring */}
                <svg className="w-24 h-24 transform -rotate-90">
                  <circle
                    cx="48"
                    cy="48"
                    r="42"
                    stroke="#e5e7eb"
                    strokeWidth="6"
                    fill="none"
                  />
                  <circle
                    cx="48"
                    cy="48"
                    r="42"
                    stroke="url(#gradient)"
                    strokeWidth="6"
                    fill="none"
                    strokeDasharray={`${(netSalary / grossSalary) * 264} 264`}
                    strokeLinecap="round"
                  />
                  <defs>
                    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#10b981" />
                      <stop offset="100%" stopColor="#3b82f6" />
                    </linearGradient>
                  </defs>
                </svg>

                {/* Center Content */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="text-xs text-gray-500 mb-0.5">الصافي</div>
                  <div className="text-base font-bold text-gray-900 leading-tight">
                    {formatNumber(netSalary)}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">{currencyLabel}</div>
                </div>
              </div>

              {/* Download Button */}
              {onDownload && (
                <button
                  onClick={onDownload}
                  className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors"
                  title="تحميل PDF"
                >
                  <Download className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Main Content: Earnings and Deductions */}
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Earnings Box */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border border-green-100">
              <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                <div className="w-1 h-4 bg-green-500 rounded-full"></div>
                المستحقات
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between py-2 px-3 bg-white rounded-md">
                  <span className="text-xs text-gray-600">الراتب الأساسي</span>
                  <span className="text-sm font-bold text-green-700">
                    {formatNumber(earnings.baseSalary)} {currencyLabel}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 px-3 bg-white rounded-md">
                  <span className="text-xs text-gray-600">البدلات</span>
                  <span className="text-sm font-bold text-green-700">
                    {formatNumber(earnings.allowances)} {currencyLabel}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 px-3 bg-white rounded-md">
                  <span className="text-xs text-gray-600">
                    الإضافي {overtimeHours ? `(${overtimeHours} ساعة)` : ''}
                  </span>
                  <span className="text-sm font-bold text-green-700">
                    {formatNumber(earnings.overtimeAmount)} {currencyLabel}
                  </span>
                </div>
                {earnings.bonusesAmount > 0 && (
                  <div className="flex items-center justify-between py-2 px-3 bg-white rounded-md">
                    <span className="text-xs text-gray-600">المكافآت</span>
                    <span className="text-sm font-bold text-green-700">
                      {formatNumber(earnings.bonusesAmount)} {currencyLabel}
                    </span>
                  </div>
                )}
              </div>
              <div className="mt-3 pt-3 border-t border-green-200 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-700">الإجمالي</span>
                <span className="text-base font-bold text-green-800">
                  {formatNumber(grossSalary)} {currencyLabel}
                </span>
              </div>
            </div>

            {/* Deductions Box */}
            <div className="bg-gradient-to-br from-red-50 to-rose-50 rounded-lg p-4 border border-red-100">
              <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                <div className="w-1 h-4 bg-red-500 rounded-full"></div>
                الخصومات
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between py-2 px-3 bg-white rounded-md">
                  <span className="text-xs text-gray-600">خصم الغياب ({attendance.absenceDays} يوم)</span>
                  <span className="text-sm font-bold text-red-700">
                    -{formatNumber(deductions.absence)} {currencyLabel}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 px-3 bg-white rounded-md">
                  <span className="text-xs text-gray-600">خصم التأخير ({attendance.lateDays} يوم)</span>
                  <span className="text-sm font-bold text-red-700">
                    -{formatNumber(deductions.late)} {currencyLabel}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 px-3 bg-white rounded-md">
                  <span className="text-xs text-gray-600">الجزاءات</span>
                  <span className="text-sm font-bold text-red-700">
                    -{formatNumber(deductions.penalties)} {currencyLabel}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 px-3 bg-white rounded-md">
                  <span className="text-xs text-gray-600">التأمينات</span>
                  <span className="text-sm font-bold text-red-700">
                    -{formatNumber(deductions.socialInsurance)} {currencyLabel}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 px-3 bg-white rounded-md">
                  <span className="text-xs text-gray-600">الضريبة</span>
                  <span className="text-sm font-bold text-red-700">
                    -{formatNumber(deductions.incomeTax)} {currencyLabel}
                  </span>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-red-200 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-700">الإجمالي</span>
                <span className="text-base font-bold text-red-800">
                  -{formatNumber(totalDeductions)} {currencyLabel}
                </span>
              </div>
            </div>
          </div>

          {/* Working Days Info */}
          <div className="bg-blue-50 rounded-lg p-3 mb-3">
            <div className="grid grid-cols-2 gap-3 text-center">
              <div>
                <div className="text-xs text-gray-500 mb-1">أيام العمل (شهري)</div>
                <div className="text-base font-bold text-blue-700">{metadata?.workingDaysInMonth || 26}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">أيام العمل (نطاق)</div>
                <div className="text-base font-bold text-blue-700">{metadata?.workingDaysInRange || attendance.attendanceDays}</div>
              </div>
            </div>
            {metadata?.workingDaysInRange && metadata.workingDaysInRange < (metadata.workingDaysInMonth || 26) && (
              <div className="mt-2 text-xs text-center text-blue-700 font-medium">
                📌 فترة جزئية: الراتب محسوب على الحضور فقط
              </div>
            )}
          </div>

          {/* Attendance Summary */}
          <div className="bg-gray-50 rounded-lg p-3 mb-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-xs text-gray-500 mb-1">أيام الحضور</div>
                <div className="text-lg font-bold text-green-600">{attendance.attendanceDays}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">أيام الغياب</div>
                <div className="text-lg font-bold text-red-600">{attendance.absenceDays}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">أيام التأخير</div>
                <div className="text-lg font-bold text-orange-600">{attendance.lateDays}</div>
              </div>
            </div>
          </div>

          {/* Net Salary Bottom Line */}
          <div className="bg-gradient-to-l from-blue-600 to-blue-700 rounded-lg p-4 text-white">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">صافي المرتب المستحق</span>
              <span className="text-2xl font-bold">
                {formatNumber(netSalary)} {currencyLabel}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
