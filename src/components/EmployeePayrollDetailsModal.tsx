import { X, Download } from 'lucide-react';
import { useEffect } from 'react';
import PayrollCardCompact from './PayrollCardCompact';
import { printPayrollCardToPDF } from '../utils/printPayrollCardToPDF';
import { formatDateRangeLabel } from '../utils/dateRangeHelpers';

interface PayrollRun {
  id: string;
  employee_id: string;
  period_month: number;
  period_year: number;
  period_from_day?: number;
  period_to_day?: number;
  base_salary: number;
  allowances: number;
  overtime_hours: number;
  overtime_amount: number;
  present_days: number;
  absence_days: number;
  absence_deduction: number;
  late_days: number;
  lateness_deduction: number;
  penalties_deduction: number;
  bonuses_amount: number;
  social_insurance: number;
  income_tax: number;
  gross_salary: number;
  total_deductions: number;
  net_salary: number;
  calculation_metadata?: {
    workingDaysInMonth?: number;
    workingDaysInRange?: number;
  };
  employees?: {
    full_name: string;
    employee_code: string;
    job_title?: string;
    department?: string;
  };
}

interface EmployeePayrollDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  payrollData: PayrollRun | null;
  currency: string;
  language: 'ar' | 'en';
  companyName?: string;
}

export default function EmployeePayrollDetailsModal({
  isOpen,
  onClose,
  payrollData,
  currency,
  language
}: EmployeePayrollDetailsModalProps) {

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const exportToPDF = () => {
    if (!payrollData) return;

    const periodLabel = payrollData.period_from_day && payrollData.period_to_day
      ? formatDateRangeLabel(payrollData.period_from_day, payrollData.period_to_day, payrollData.period_month, payrollData.period_year, language)
      : `${payrollData.period_month}/${payrollData.period_year}`;
    const employeeName = payrollData.employees?.full_name || 'N/A';
    const employeeCode = payrollData.employees?.employee_code || 'N/A';

    printPayrollCardToPDF({
      employeeName,
      employeeCode,
      periodLabel,
      jobTitle: payrollData.employees?.job_title,
      department: payrollData.employees?.department,
      netSalary: payrollData.net_salary,
      currencyLabel: currency,
      earnings: {
        baseSalary: payrollData.base_salary,
        allowances: payrollData.allowances,
        overtimeAmount: payrollData.overtime_amount,
        bonusesAmount: payrollData.bonuses_amount || 0
      },
      deductions: {
        absence: payrollData.absence_deduction,
        late: payrollData.lateness_deduction,
        penalties: payrollData.penalties_deduction,
        socialInsurance: payrollData.social_insurance,
        incomeTax: payrollData.income_tax
      },
      attendance: {
        attendanceDays: payrollData.present_days,
        absenceDays: payrollData.absence_days,
        lateDays: payrollData.late_days
      },
      overtimeHours: payrollData.overtime_hours
    });
  };

  if (!isOpen || !payrollData) return null;

  const periodLabel = payrollData.period_from_day && payrollData.period_to_day
    ? formatDateRangeLabel(payrollData.period_from_day, payrollData.period_to_day, payrollData.period_month, payrollData.period_year, language)
    : `${payrollData.period_month}/${payrollData.period_year}`;
  const employeeName = payrollData.employees?.full_name || 'N/A';
  const employeeCode = payrollData.employees?.employee_code || 'N/A';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-white w-full md:max-w-3xl md:rounded-2xl rounded-t-3xl shadow-2xl transform transition-all duration-300 ease-out max-h-[90vh] md:max-h-[85vh] overflow-y-auto animate-slide-up md:animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        dir={language === 'ar' ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-br from-slate-50 to-gray-100 border-b border-gray-200 p-4 rounded-t-3xl md:rounded-t-2xl shadow-sm z-10">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h2 className="text-lg md:text-xl font-bold text-gray-900">
                {language === 'ar' ? 'تفاصيل المرتب' : 'Payroll Details'}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {employeeName} • {periodLabel}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={exportToPDF}
                className="p-2.5 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                title={language === 'ar' ? 'تصدير PDF' : 'Export PDF'}
              >
                <Download className="w-5 h-5" />
              </button>
              <button
                onClick={onClose}
                className="p-2.5 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                title={language === 'ar' ? 'إغلاق' : 'Close'}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Payroll Card Content */}
        <div className="p-4 md:p-6">
          <PayrollCardCompact
            employeeName={employeeName}
            employeeCode={employeeCode}
            periodLabel={periodLabel}
            jobTitle={payrollData.employees?.job_title}
            department={payrollData.employees?.department}
            netSalary={payrollData.net_salary}
            currencyLabel={currency}
            earnings={{
              baseSalary: payrollData.base_salary,
              allowances: payrollData.allowances,
              overtimeAmount: payrollData.overtime_amount,
              bonusesAmount: payrollData.bonuses_amount || 0
            }}
            deductions={{
              absence: payrollData.absence_deduction,
              late: payrollData.lateness_deduction,
              penalties: payrollData.penalties_deduction,
              socialInsurance: payrollData.social_insurance,
              incomeTax: payrollData.income_tax
            }}
            attendance={{
              attendanceDays: payrollData.present_days,
              absenceDays: payrollData.absence_days,
              lateDays: payrollData.late_days
            }}
            metadata={{
              workingDaysInMonth: payrollData.calculation_metadata?.workingDaysInMonth,
              workingDaysInRange: payrollData.calculation_metadata?.workingDaysInRange
            }}
            overtimeHours={payrollData.overtime_hours}
            onExport={exportToPDF}
          />
        </div>
      </div>

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes scale-in {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
        .animate-scale-in {
          animation: scale-in 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}
