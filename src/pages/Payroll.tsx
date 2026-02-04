import { useEffect, useState, useMemo } from 'react';
import { DollarSign, Settings, AlertTriangle, CheckCircle, XCircle, Calendar, Users, Calculator, FileText, Gift } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { calculatePayroll, Penalty } from '../utils/payrollCalculations';
import PayrollSettings from '../components/PayrollSettings';
import EmployeePayrollDetailsModal from '../components/EmployeePayrollDetailsModal';
import { ensurePayrollSettings, PayrollSettings as PayrollSettingsType } from '../utils/ensurePayrollSettings';
import { buildDateRange, formatDateRangeLabel, formatDateRangeShort } from '../utils/dateRangeHelpers';


interface Branch {
  id: string;
  name: string;
}

interface Employee {
  id: string;
  employee_code: string;
  full_name: string;
  salary_mode: 'monthly' | 'daily';
  monthly_salary: number;
  daily_wage: number;
  allowances: number;
  social_insurance_value?: number;
  income_tax_value?: number;
  branch_id?: string;
}

interface PenaltyRecord extends Penalty {
  employees?: { full_name: string; employee_code: string };
  penalty_date: string;
}

interface PayrollProps {
  currentPage?: string;
}

export default function Payroll({ currentPage }: PayrollProps) {
  const { language } = useLanguage();
  const { companyId } = useAuth();
  const [settings, setSettings] = useState<PayrollSettingsType | null>(null);
  const [penalties, setPenalties] = useState<PenaltyRecord[]>([]);
  const [bonuses, setBonuses] = useState<PenaltyRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [processing, setProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'settings' | 'penalties' | 'bonuses' | 'generate' | 'payslips'>('generate');
  const [mobileView, setMobileView] = useState<'generate' | 'payslips' | 'penalties' | 'bonuses' | 'settings'>('generate');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [payrollRuns, setPayrollRuns] = useState<any[]>([]);
  const [payslipMonth, setPayslipMonth] = useState(new Date().getMonth() + 1);
  const [payslipYear, setPayslipYear] = useState(new Date().getFullYear());
  const [selectedEmployeePayroll, setSelectedEmployeePayroll] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('all');
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [fromDay, setFromDay] = useState(1);
  const [toDay, setToDay] = useState(new Date(selectedYear, selectedMonth, 0).getDate());



  const [newPenalty, setNewPenalty] = useState({
    employee_id: '',
    penalty_date: new Date().toISOString().split('T')[0],
    penalty_type: 'fixed_amount' as 'fixed_amount' | 'salary_percent' | 'days' | 'fixed' | 'fraction',
    penalty_value: 0,
    reason: '',
    is_recurring: false,
    apply_to_salary: true
  });

  const employeeDropdownOptions = useMemo(() => {
    return employees.filter(emp => {
      const matchesBranch = selectedBranch === 'all' || emp.branch_id === selectedBranch;
      return matchesBranch;
    });
  }, [employees, selectedBranch]);

  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const matchesEmployee = selectedEmployeeId === 'all' || emp.id === selectedEmployeeId;
      const matchesBranch = selectedBranch === 'all' || emp.branch_id === selectedBranch;

      return matchesEmployee && matchesBranch;
    });
  }, [employees, selectedEmployeeId, selectedBranch]);

  const payrollSummary = useMemo(() => {
    const totalEarnings = payrollRuns.reduce((sum, run) => {
      const earnings =
        parseFloat(run.base_salary || 0) +
        parseFloat(run.allowances || 0) +
        parseFloat(run.overtime_amount || 0) +
        parseFloat(run.bonuses_amount || 0);
      return sum + earnings;
    }, 0);

    const totalDeductions = payrollRuns.reduce((sum, run) => {
      const deductions =
        parseFloat(run.absence_deduction || 0) +
        parseFloat(run.lateness_deduction || 0) +
        parseFloat(run.penalties_deduction || 0) +
        parseFloat(run.social_insurance || 0) +
        parseFloat(run.income_tax || 0);
      return sum + deductions;
    }, 0);

    const totalNet = payrollRuns.reduce((sum, run) => {
      return sum + parseFloat(run.net_salary || 0);
    }, 0);

    return { totalEarnings, totalDeductions, totalNet };
  }, [payrollRuns]);

  useEffect(() => {
    if (currentPage === 'payroll' && companyId) {
      fetchSettings();
      fetchPenalties();
      fetchBonuses();
      fetchEmployees();
      fetchBranches();
    }
  }, [currentPage, companyId]);

  useEffect(() => {
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    setToDay(daysInMonth);
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    if (selectedEmployeeId !== 'all') {
      const selectedEmployee = employees.find(emp => emp.id === selectedEmployeeId);
      if (selectedEmployee && selectedBranch !== 'all' && selectedEmployee.branch_id !== selectedBranch) {
        setSelectedEmployeeId('all');
      }
    }
  }, [selectedBranch, selectedEmployeeId, employees]);

  useEffect(() => {
    if (currentPage === 'payroll' && (activeTab === 'payslips' || mobileView === 'payslips')) {
      fetchPayrollRuns();
    }
  }, [currentPage, activeTab, mobileView, companyId]);



  async function fetchSettings() {
    if (!companyId) {
      console.error('fetchSettings: No companyId available');
      return;
    }

    const result = await ensurePayrollSettings(companyId);

    if (result) {
      // Check if this was newly created (no updated_at different from created_at in first few seconds)
      const wasJustCreated = !settings && result;
      setSettings(result);

      if (wasJustCreated) {
        showSuccess(language === 'ar'
          ? 'تم إنشاء إعدادات افتراضية—راجعها من تبويب الإعدادات'
          : 'Default settings created—review them in Settings tab');
      }
    } else {
      showError(language === 'ar' ? 'خطأ في جلب إعدادات الرواتب' : 'Error fetching payroll settings');
    }
  }

  async function fetchPenalties() {
    const { data } = await supabase
      .from('penalties')
      .select('*, employees(full_name, employee_code)')
      .eq('impact', 'negative')
      .order('created_at', { ascending: false });

    if (data) setPenalties(data);
  }

  async function fetchBonuses() {
    const { data } = await supabase
      .from('penalties')
      .select('*, employees(full_name, employee_code)')
      .eq('impact', 'positive')
      .order('created_at', { ascending: false });

    if (data) setBonuses(data);
  }

  async function fetchEmployees() {
    const { data } = await supabase
      .from('employees')
      .select('id, employee_code, full_name, salary_mode, monthly_salary, daily_wage, allowances, branch_id')
      .order('full_name');

    if (data) setEmployees(data);
  }

  async function fetchBranches() {
    const { data } = await supabase
      .from('branches')
      .select('id, name')
      .order('name');

    if (data) setBranches(data);
  }

  async function fetchPayrollRuns() {
    if (!companyId) return;

    const { data } = await supabase
      .from('payroll_runs')
      .select('*, employees(employee_code, full_name, job_title, department)')
      .order('created_at', { ascending: false })
      .limit(100);

    if (data && data.length > 0) {
      setPayrollRuns(data);
      setPayslipMonth(data[0].period_month);
      setPayslipYear(data[0].period_year);
    } else {
      setPayrollRuns([]);
    }
  }

  async function updateSettings() {
    if (!settings || !companyId) return;

    // Use upsert to handle both insert and update cases
    const { data, error } = await supabase
      .from('payroll_settings')
      .upsert({
        id: settings.id,
        company_id: companyId,
        workdays_per_month: settings.workdays_per_month,
        grace_minutes: settings.grace_minutes,
        currency: settings.currency,
        insurance_type: settings.insurance_type || 'percentage',
        insurance_value: settings.insurance_value || 0,
        tax_type: settings.tax_type || 'percentage',
        tax_value: settings.tax_value || 0,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'company_id'
      })
      .select()
      .single();

    if (error) {
      showError(language === 'ar' ? 'خطأ في حفظ الإعدادات' : 'Error saving settings');
      console.error('updateSettings error:', error);
    } else {
      showSuccess(language === 'ar' ? 'تم حفظ الإعدادات بنجاح' : 'Settings saved successfully');
      if (data) setSettings(data);
    }
  }

  async function addPenalty() {
    if (!newPenalty.employee_id || !newPenalty.reason) {
      showError('الرجاء ملء جميع الحقول المطلوبة');
      return;
    }

    const { data: userData } = await supabase.auth.getUser();

    const { error } = await supabase
      .from('penalties')
      .insert({
        ...newPenalty,
        impact: 'negative',
        created_by: userData?.user?.id
      });

    if (error) {
      showError('خطأ في إضافة الجزاء');
    } else {
      showSuccess('تم إضافة الجزاء بنجاح');
      setNewPenalty({
        employee_id: '',
        penalty_date: new Date().toISOString().split('T')[0],
        penalty_type: 'fixed_amount',
        penalty_value: 0,
        reason: '',
        is_recurring: false,
        apply_to_salary: true
      });
      fetchPenalties();
    }
  }

  async function addBonus() {
    if (!newPenalty.employee_id || !newPenalty.reason) {
      showError('الرجاء ملء جميع الحقول المطلوبة');
      return;
    }

    const { data: userData } = await supabase.auth.getUser();

    const { error } = await supabase
      .from('penalties')
      .insert({
        ...newPenalty,
        impact: 'positive',
        created_by: userData?.user?.id
      });

    if (error) {
      showError('خطأ في إضافة المكافأة');
    } else {
      showSuccess('تم إضافة المكافأة بنجاح');
      setNewPenalty({
        employee_id: '',
        penalty_date: new Date().toISOString().split('T')[0],
        penalty_type: 'fixed_amount',
        penalty_value: 0,
        reason: '',
        is_recurring: false,
        apply_to_salary: true
      });
      fetchBonuses();
    }
  }

  async function updatePenaltyStatus(penaltyId: string, status: 'approved' | 'rejected') {
    const { data: userData } = await supabase.auth.getUser();

    const { error } = await supabase
      .from('penalties')
      .update({
        status,
        approved_by: userData?.user?.id,
        approved_at: new Date().toISOString()
      })
      .eq('id', penaltyId);

    if (error) {
      showError('خطأ في تحديث حالة الجزاء');
    } else {
      fetchPenalties();
    }
  }

  async function generatePayroll() {
    if (!settings) {
      showError('الرجاء تكوين إعدادات الرواتب أولاً');
      return;
    }

    if (filteredEmployees.length === 0) {
      showError('لا يوجد موظفين لحساب الرواتب');
      return;
    }

    setProcessing(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const { data: userData } = await supabase.auth.getUser();
      let successCount = 0;
      let errorCount = 0;

      const dateRange = buildDateRange(selectedYear, selectedMonth, fromDay, toDay);
      const { startDate, endDate, fromDay: actualFromDay, toDay: actualToDay } = dateRange;

      const rangeDays = actualToDay - actualFromDay + 1;
      const workingDaysInRange = Math.min(rangeDays, settings.workdays_per_month);

      const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
      const isPartialRange = actualFromDay !== 1 || actualToDay !== daysInMonth;

      for (const employee of filteredEmployees) {
        try {

          const { data: attendance } = await supabase
            .from('attendance_logs')
            .select('check_in_time, late_minutes, created_at')
            .eq('employee_id', employee.id)
            .gte('check_in_time', startDate.toISOString())
            .lte('check_in_time', endDate.toISOString())
            .not('check_in_time', 'is', null);

          const distinctDays = new Set<string>();
          const attendanceByDay = new Map<string, { check_in_time: string; late_minutes: number }>();

          (attendance || []).forEach(a => {
            const dateKey = a.check_in_time.split('T')[0];
            distinctDays.add(dateKey);

            if (!attendanceByDay.has(dateKey)) {
              attendanceByDay.set(dateKey, {
                check_in_time: a.check_in_time,
                late_minutes: a.late_minutes || 0
              });
            } else {
              const existing = attendanceByDay.get(dateKey)!;
              if (a.late_minutes > existing.late_minutes) {
                attendanceByDay.set(dateKey, {
                  check_in_time: a.check_in_time,
                  late_minutes: a.late_minutes
                });
              }
            }
          });

          const attendanceRecords = Array.from(attendanceByDay.values());


          const { data: approvedPenalties } = await supabase
            .from('penalties')
            .select('*')
            .eq('employee_id', employee.id)
            .eq('status', 'approved')
            .eq('impact', 'negative')
            .gte('penalty_date', startDate.toISOString().split('T')[0])
            .lte('penalty_date', endDate.toISOString().split('T')[0]);

          const { data: approvedBonuses } = await supabase
            .from('penalties')
            .select('*')
            .eq('employee_id', employee.id)
            .eq('status', 'approved')
            .eq('impact', 'positive')
            .gte('penalty_date', startDate.toISOString().split('T')[0])
            .lte('penalty_date', endDate.toISOString().split('T')[0]);

          const { data: approvedLeaves } = await supabase
            .from('leave_requests')
            .select('start_date, end_date, requested_days')
            .eq('employee_id', employee.id)
            .eq('company_id', companyId)
            .eq('status', 'approved')
            .lte('start_date', endDate.toISOString().split('T')[0])
            .gte('end_date', startDate.toISOString().split('T')[0]);

          const approvedLeaveDays = (approvedLeaves || []).reduce((sum, leave) => {
            const leaveStart = new Date(leave.start_date);
            const leaveEnd = new Date(leave.end_date);
            const periodStart = startDate;
            const periodEnd = endDate;

            const overlapStart = leaveStart > periodStart ? leaveStart : periodStart;
            const overlapEnd = leaveEnd < periodEnd ? leaveEnd : periodEnd;

            const daysDiff = Math.floor((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
            const overlapDays = Math.max(0, daysDiff);

            return sum + overlapDays;
          }, 0);

          const { data: delayPermissions } = await supabase
            .from('delay_permissions')
            .select('date, minutes, status')
            .eq('employee_id', employee.id)
            .eq('status', 'approved')
            .gte('date', startDate.toISOString().split('T')[0])
            .lte('date', endDate.toISOString().split('T')[0]);

          const calculation = calculatePayroll(
            employee,
            attendanceRecords,
            approvedPenalties || [],
            [],
            settings.workdays_per_month,
            workingDaysInRange,
            approvedLeaveDays,
            approvedBonuses || [],
            { type: settings.insurance_type || 'percentage', value: settings.insurance_value || 0 },
            { type: settings.tax_type || 'percentage', value: settings.tax_value || 0 },
            isPartialRange,
            delayPermissions || []
          );

          const { error } = await supabase
            .from('payroll_runs')
            .upsert({
              employee_id: employee.id,
              period_month: selectedMonth,
              period_year: selectedYear,
              period_from_day: actualFromDay,
              period_to_day: actualToDay,
              salary_mode: employee.salary_mode,
              base_salary: calculation.baseSalary,
              allowances: calculation.allowancesForRange,
              overtime_hours: calculation.overtimeHours,
              overtime_amount: calculation.overtimeAmount,
              present_days: calculation.presentDays,
              absence_days: calculation.absenceDays,
              absence_deduction: calculation.absenceDeduction,
              late_days: calculation.lateDays,
              lateness_deduction: calculation.latenessDeduction,
              penalties_deduction: calculation.penaltiesDeduction,
              bonuses_amount: calculation.bonusesAmount,
              social_insurance: calculation.socialInsurance,
              income_tax: calculation.incomeTax,
              other_deductions: calculation.otherDeductions,
              gross_salary: calculation.grossSalary,
              total_deductions: calculation.totalDeductions,
              net_salary: calculation.netSalary,
              calculation_metadata: {
                ...calculation.metadata,
                workingDaysInMonth: settings.workdays_per_month,
                workingDaysInRange,
                basePayForRange: calculation.basePayForRange,
                fullMonthlyAllowances: calculation.allowances
              },
              created_by: userData?.user?.id,
              company_id: companyId
            }, {
              onConflict: 'employee_id,period_month,period_year'
            });

          if (error) {
            console.error(`Error processing payroll for ${employee.full_name}:`, error);
            errorCount++;
          } else {
            successCount++;
          }
        } catch (err) {
          console.error(`Exception processing ${employee.full_name}:`, err);
          errorCount++;
        }
      }

      if (errorCount === 0) {
        showSuccess(`تم إنشاء الرواتب بنجاح لـ ${successCount} موظف للفترة ${selectedMonth}/${selectedYear}`);

        // Switch to payslips view after successful generation
        setPayslipMonth(selectedMonth);
        setPayslipYear(selectedYear);
        setMobileView('payslips');
        setActiveTab('payslips');
      } else {
        showError(`تم إنشاء ${successCount} رواتب بنجاح، فشل ${errorCount} موظف`);
      }
    } catch (error: any) {
      showError('خطأ في إنشاء الرواتب: ' + error.message);
    } finally {
      setProcessing(false);
    }
  }



  function showSuccess(message: string) {
    setSuccessMessage(message);
    setErrorMessage('');
    setTimeout(() => setSuccessMessage(''), 5000);
  }

  function showError(message: string) {
    setErrorMessage(message);
    setSuccessMessage('');
    setTimeout(() => setErrorMessage(''), 5000);
  }

  if (currentPage !== 'payroll') return null;

  const currency = settings?.currency || '';

  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
  const dayOptions = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const FiltersBar = () => (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-2">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <select
          value={selectedEmployeeId}
          onChange={(e) => setSelectedEmployeeId(e.target.value)}
          className="w-full px-2 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">{language === 'ar' ? 'كل الموظفين' : 'All Employees'}</option>
          {employeeDropdownOptions.map(emp => (
            <option key={emp.id} value={emp.id}>
              {emp.full_name} — {emp.employee_code}
            </option>
          ))}
        </select>

        <select
          value={selectedBranch}
          onChange={(e) => setSelectedBranch(e.target.value)}
          className="w-full px-2 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">{language === 'ar' ? 'كل الفروع' : 'All Branches'}</option>
          {branches.map(branch => (
            <option key={branch.id} value={branch.id}>{branch.name}</option>
          ))}
        </select>
      </div>
    </div>
  );

  const ActionButtons = () => (
    <div className="tabsRow">
      <button
        onClick={() => {
          setMobileView('penalties');
          setActiveTab('penalties');
        }}
        className={`tabBtn tabBtn--penalty ${mobileView === 'penalties' ? 'tabBtn--active' : ''}`}
      >
        <AlertTriangle />
        <span>{language === 'ar' ? 'جزاءات' : 'Penalties'}</span>
      </button>
      <button
        onClick={() => {
          setMobileView('bonuses');
          setActiveTab('bonuses');
        }}
        className={`tabBtn tabBtn--bonus ${mobileView === 'bonuses' ? 'tabBtn--active' : ''}`}
      >
        <Gift />
        <span>{language === 'ar' ? 'مكافآت' : 'Bonuses'}</span>
      </button>
      <button
        onClick={() => {
          setMobileView('settings');
          setActiveTab('settings');
        }}
        className={`tabBtn tabBtn--payroll ${mobileView === 'settings' ? 'tabBtn--active' : ''}`}
      >
        <Settings />
        <span>{language === 'ar' ? 'إعدادات' : 'Settings'}</span>
      </button>
    </div>
  );

  return (
    <div className="bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div>
        {/* Page Header */}
        <div className="bg-white rounded-2xl shadow-xl p-4 md:p-8 mb-6">
          <div className="flex items-center gap-3 mb-4 md:mb-6">
            <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl">
              <DollarSign className="w-6 h-6 md:w-8 md:h-8 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-xl md:text-3xl font-bold text-gray-800">
                {language === 'ar' ? 'إدارة الرواتب والجزاءات' : 'Payroll & Penalties'}
              </h1>
              <p className="text-xs md:text-base text-gray-600 md:hidden mt-1">
                {mobileView === 'generate' && `${language === 'ar' ? 'الفترة:' : 'Period:'} ${String(selectedMonth).padStart(2, '0')} / ${selectedYear}`}
                {mobileView === 'payslips' && `${language === 'ar' ? 'الفترة:' : 'Period:'} ${String(payslipMonth).padStart(2, '0')} / ${payslipYear}`}
                {mobileView === 'penalties' && (language === 'ar' ? 'إدارة الجزاءات' : 'Manage Penalties')}
                {mobileView === 'bonuses' && (language === 'ar' ? 'إدارة المكافآت' : 'Manage Bonuses')}
                {mobileView === 'settings' && (language === 'ar' ? 'الإعدادات' : 'Settings')}
              </p>
              <p className="hidden md:block text-sm md:text-base text-gray-600">
                {language === 'ar' ? 'حساب الرواتب الشهرية مع الخصومات والجزاءات' : 'Calculate monthly payroll with deductions'}
              </p>
            </div>
          </div>

          {/* Messages */}
          {successMessage && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}
          {errorMessage && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
              <XCircle className="w-5 h-5 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Desktop Tabs - Hidden on mobile */}
          <div className="hidden md:block sticky top-16 bg-white z-10 -mx-4 md:-mx-8 px-4 md:px-8 pb-0">
            <div className="flex gap-2.5 overflow-x-auto pb-4">
              <button
                onClick={() => setActiveTab('generate')}
                className={`tabBtn tabBtn--payroll ${activeTab === 'generate' ? 'tabBtn--active' : ''}`}
              >
                <Calculator />
                <span className="whitespace-nowrap">{language === 'ar' ? 'الرواتب' : 'Payroll'}</span>
              </button>
              <button
                onClick={() => setActiveTab('payslips')}
                className={`tabBtn tabBtn--payroll ${activeTab === 'payslips' ? 'tabBtn--active' : ''}`}
              >
                <FileText />
                <span className="whitespace-nowrap">{language === 'ar' ? 'الكشف' : 'Payslips'}</span>
              </button>
              <button
                onClick={() => setActiveTab('penalties')}
                className={`tabBtn tabBtn--penalty ${activeTab === 'penalties' ? 'tabBtn--active' : ''}`}
              >
                <AlertTriangle />
                <span className="whitespace-nowrap">{language === 'ar' ? 'جزاءات' : 'Penalties'}</span>
              </button>
              <button
                onClick={() => setActiveTab('bonuses')}
                className={`tabBtn tabBtn--bonus ${activeTab === 'bonuses' ? 'tabBtn--active' : ''}`}
              >
                <Gift />
                <span className="whitespace-nowrap">{language === 'ar' ? 'مكافآت' : 'Bonuses'}</span>
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`tabBtn tabBtn--payroll ${activeTab === 'settings' ? 'tabBtn--active' : ''}`}
              >
                <Settings />
                <span className="whitespace-nowrap">{language === 'ar' ? 'الإعدادات' : 'Settings'}</span>
              </button>
            </div>
          </div>

          {/* Action Buttons - Penalties & Settings */}
          <div className="mt-4 mb-4">
            <ActionButtons />
          </div>

          {/* Tab Content */}
          <div className="mt-6 pb-24 md:pb-6">
            {/* Generate Payroll Content */}
            <div className={mobileView === 'generate' ? 'block md:hidden' : 'hidden'}>
              {mobileView === 'generate' && (
                <div className="space-y-3">
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                    <h3 className="text-base font-bold text-gray-800 mb-2 flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-blue-600" />
                      {language === 'ar' ? 'اختر فترة الرواتب' : 'Select Payroll Period'}
                    </h3>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          {language === 'ar' ? 'الشهر' : 'Month'}
                        </label>
                        <select
                          value={selectedMonth}
                          onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                          className="w-full px-2 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                            <option key={month} value={month}>{month}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          {language === 'ar' ? 'السنة' : 'Year'}
                        </label>
                        <select
                          value={selectedYear}
                          onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                          className="w-full px-2 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                            <option key={year} value={year}>{year}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          {language === 'ar' ? 'من يوم' : 'From Day'}
                        </label>
                        <select
                          value={fromDay}
                          onChange={(e) => {
                            const newFromDay = parseInt(e.target.value);
                            setFromDay(newFromDay);
                            if (newFromDay > toDay) {
                              setToDay(newFromDay);
                            }
                          }}
                          className="w-full px-2 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          {dayOptions.map(day => (
                            <option key={day} value={day}>{day}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          {language === 'ar' ? 'إلى يوم' : 'To Day'}
                        </label>
                        <select
                          value={toDay}
                          onChange={(e) => {
                            const newToDay = parseInt(e.target.value);
                            if (newToDay >= fromDay) {
                              setToDay(newToDay);
                            }
                          }}
                          className="w-full px-2 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          {dayOptions.map(day => (
                            <option key={day} value={day}>{day}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <FiltersBar />

                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4 md:p-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                      <h3 className="text-lg md:text-xl font-bold text-gray-800 flex items-center gap-2">
                        <Users className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
                        {language === 'ar' ? `الموظفين (${filteredEmployees.length})` : `Employees (${filteredEmployees.length})`}
                      </h3>
                      <button
                        onClick={generatePayroll}
                        disabled={processing || filteredEmployees.length === 0}
                        className="w-full md:w-auto px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-semibold hover:from-green-700 hover:to-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {processing ? (
                          <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>{language === 'ar' ? 'جاري المعالجة...' : 'Processing...'}</span>
                          </>
                        ) : (
                          <>
                            <Calculator className="w-5 h-5" />
                            <span>{language === 'ar' ? 'إنشاء الرواتب' : 'Generate Payroll'}</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="text-sm text-gray-600">
                      {language === 'ar'
                        ? 'سيتم حساب رواتب جميع الموظفين للفترة المحددة بناءً على سجلات الحضور والجزاءات المعتمدة'
                        : 'All employees will be calculated for the selected period based on attendance and approved penalties'}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className={activeTab === 'generate' ? 'hidden md:block' : 'hidden'}>
              {activeTab === 'generate' && (
                <div className="space-y-3 md:space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 md:p-4">
                    <h3 className="text-base md:text-lg font-bold text-gray-800 mb-2 md:mb-3 flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-blue-600" />
                      {language === 'ar' ? 'اختر فترة الرواتب' : 'Select Payroll Period'}
                    </h3>
                    <div className="grid grid-cols-2 gap-2 md:gap-3 mb-2">
                      <div>
                        <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">
                          {language === 'ar' ? 'الشهر' : 'Month'}
                        </label>
                        <select
                          value={selectedMonth}
                          onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                          className="w-full px-2 md:px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                            <option key={month} value={month}>{month}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">
                          {language === 'ar' ? 'السنة' : 'Year'}
                        </label>
                        <select
                          value={selectedYear}
                          onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                          className="w-full px-2 md:px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                            <option key={year} value={year}>{year}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 md:gap-3">
                      <div>
                        <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">
                          {language === 'ar' ? 'من يوم' : 'From Day'}
                        </label>
                        <select
                          value={fromDay}
                          onChange={(e) => {
                            const newFromDay = parseInt(e.target.value);
                            setFromDay(newFromDay);
                            if (newFromDay > toDay) {
                              setToDay(newFromDay);
                            }
                          }}
                          className="w-full px-2 md:px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          {dayOptions.map(day => (
                            <option key={day} value={day}>{day}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">
                          {language === 'ar' ? 'إلى يوم' : 'To Day'}
                        </label>
                        <select
                          value={toDay}
                          onChange={(e) => {
                            const newToDay = parseInt(e.target.value);
                            if (newToDay >= fromDay) {
                              setToDay(newToDay);
                            }
                          }}
                          className="w-full px-2 md:px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          {dayOptions.map(day => (
                            <option key={day} value={day}>{day}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <FiltersBar />

                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4 md:p-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                      <h3 className="text-lg md:text-xl font-bold text-gray-800 flex items-center gap-2">
                        <Users className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
                        {language === 'ar' ? `الموظفين (${filteredEmployees.length})` : `Employees (${filteredEmployees.length})`}
                      </h3>
                      <button
                        onClick={generatePayroll}
                        disabled={processing || filteredEmployees.length === 0}
                        className="w-full md:w-auto px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-semibold hover:from-green-700 hover:to-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {processing ? (
                          <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>{language === 'ar' ? 'جاري المعالجة...' : 'Processing...'}</span>
                          </>
                        ) : (
                          <>
                            <Calculator className="w-5 h-5" />
                            <span>{language === 'ar' ? 'إنشاء الرواتب' : 'Generate Payroll'}</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="text-sm text-gray-600">
                      {language === 'ar'
                        ? 'سيتم حساب رواتب جميع الموظفين للفترة المحددة بناءً على سجلات الحضور والجزاءات المعتمدة'
                        : 'All employees will be calculated for the selected period based on attendance and approved penalties'}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Payslips Content - Mobile */}
            <div className={mobileView === 'payslips' ? 'block md:hidden' : 'hidden'}>
              {mobileView === 'payslips' && (
                <div className="space-y-4 md:space-y-6">
                  <div className="bg-white border rounded-xl overflow-hidden">
                    <div className="p-4 md:p-6 border-b bg-gradient-to-r from-purple-50 to-pink-50">
                      <h3 className="text-lg md:text-xl font-bold text-gray-800 flex items-center gap-2">
                        <FileText className="w-5 h-5 md:w-6 md:h-6 text-purple-600" />
                        {language === 'ar' ? 'كشف الرواتب' : 'Payroll Report'}
                      </h3>
                      {payrollRuns.length > 0 && payrollRuns[0].period_from_day && payrollRuns[0].period_to_day ? (
                        <>
                          <p className="text-sm text-purple-700 font-medium mt-2">
                            {language === 'ar' ? 'الفترة: ' : 'Period: '}
                            {formatDateRangeLabel(payrollRuns[0].period_from_day, payrollRuns[0].period_to_day, payslipMonth, payslipYear, language)}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            {language === 'ar'
                              ? `عدد الموظفين: ${payrollRuns.length}`
                              : `Total Employees: ${payrollRuns.length}`}
                          </p>
                        </>
                      ) : payrollRuns.length > 0 ? (
                        <p className="text-sm text-gray-600 mt-1">
                          {language === 'ar'
                            ? `عدد الموظفين: ${payrollRuns.length}`
                            : `Total Employees: ${payrollRuns.length}`}
                        </p>
                      ) : null}
                    </div>

                    {payrollRuns.length > 0 && (
                      <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div>
                            <div className="text-xs text-gray-600 mb-1">
                              {language === 'ar' ? 'إجمالي المستحقات' : 'Total Earnings'}
                            </div>
                            <div className="text-sm font-semibold text-green-700">
                              {payrollSummary.totalEarnings.toFixed(2)}
                            </div>
                            <div className="text-xs text-gray-500">{currency}</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-600 mb-1">
                              {language === 'ar' ? 'إجمالي الخصومات' : 'Total Deductions'}
                            </div>
                            <div className="text-sm font-semibold text-red-700">
                              {payrollSummary.totalDeductions.toFixed(2)}
                            </div>
                            <div className="text-xs text-gray-500">{currency}</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-600 mb-1">
                              {language === 'ar' ? 'صافي الرواتب' : 'Net Salaries'}
                            </div>
                            <div className="text-sm font-semibold text-blue-700">
                              {payrollSummary.totalNet.toFixed(2)}
                            </div>
                            <div className="text-xs text-gray-500">{currency}</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {payrollRuns.length > 0 ? (
                      <div className="divide-y">
                        {payrollRuns.map((run) => (
                          <div
                            key={run.id}
                            className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                            onClick={() => {
                              setSelectedEmployeePayroll(run);
                              setIsModalOpen(true);
                            }}
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <div className="font-bold text-gray-800">
                                  {run.employees?.full_name}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {run.employees?.employee_code}
                                </div>
                                {run.period_from_day && run.period_to_day && (
                                  <div className="text-xs text-gray-400 mt-0.5">
                                    {language === 'ar' ? 'النطاق: ' : 'Range: '}
                                    {formatDateRangeShort(run.period_from_day, run.period_to_day, language)}
                                  </div>
                                )}
                              </div>
                              <div className="text-left">
                                <div className="text-lg font-bold text-purple-700">
                                  {parseFloat(run.net_salary || 0).toFixed(2)}
                                </div>
                                <div className="text-xs text-gray-500">{currency}</div>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                              <div className="flex items-center justify-between p-2 bg-blue-50 rounded">
                                <span className="text-gray-600 text-xs">
                                  {language === 'ar' ? 'أيام العمل (شهري):' : 'Work Days (Month):'}
                                </span>
                                <span className="font-semibold text-blue-700">
                                  {run.calculation_metadata?.workingDaysInMonth || 26}
                                </span>
                              </div>
                              <div className="flex items-center justify-between p-2 bg-blue-50 rounded">
                                <span className="text-gray-600 text-xs">
                                  {language === 'ar' ? 'أيام العمل (نطاق):' : 'Work Days (Range):'}
                                </span>
                                <span className="font-semibold text-blue-700">
                                  {run.calculation_metadata?.workingDaysInRange || run.present_days}
                                </span>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                <span className="text-gray-600">
                                  {language === 'ar' ? 'أيام الحضور:' : 'Present:'}
                                </span>
                                <span className="font-semibold text-green-700">
                                  {run.present_days}
                                </span>
                              </div>
                              <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                <span className="text-gray-600">
                                  {language === 'ar' ? 'أيام الغياب:' : 'Absent:'}
                                </span>
                                <span className="font-semibold text-red-700">
                                  {run.absence_days}
                                </span>
                              </div>
                              <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                <span className="text-gray-600">
                                  {language === 'ar' ? 'أيام التأخير:' : 'Late:'}
                                </span>
                                <span className="font-semibold text-orange-700">
                                  {run.late_days}
                                </span>
                              </div>
                              <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                <span className="text-gray-600">
                                  {language === 'ar' ? 'الأساسي:' : 'Base:'}
                                </span>
                                <span className="font-semibold">
                                  {parseFloat(run.base_salary || 0).toFixed(2)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                <span className="text-gray-600">
                                  {language === 'ar' ? 'البدلات:' : 'Allowances:'}
                                </span>
                                <span className="font-semibold">
                                  {parseFloat(run.allowances || 0).toFixed(2)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between p-2 bg-green-50 rounded">
                                <span className="text-gray-600">
                                  {language === 'ar' ? 'الإضافي:' : 'Overtime:'}
                                </span>
                                <span className="font-semibold text-green-600">
                                  +{parseFloat(run.overtime_amount || 0).toFixed(2)}
                                </span>
                              </div>
                              {parseFloat(run.bonuses_amount || 0) > 0 && (
                                <div className="flex items-center justify-between p-2 bg-green-50 rounded">
                                  <span className="text-gray-600">
                                    {language === 'ar' ? 'المكافآت:' : 'Bonuses:'}
                                  </span>
                                  <span className="font-semibold text-green-600">
                                    +{parseFloat(run.bonuses_amount || 0).toFixed(2)}
                                  </span>
                                </div>
                              )}
                              <div className="flex items-center justify-between p-2 bg-red-50 rounded">
                                <span className="text-gray-600">
                                  {language === 'ar' ? 'الغياب:' : 'Absence:'}
                                </span>
                                <span className="font-semibold text-red-600">
                                  -{parseFloat(run.absence_deduction || 0).toFixed(2)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between p-2 bg-red-50 rounded">
                                <span className="text-gray-600">
                                  {language === 'ar' ? 'خصم التأخير:' : 'Late Deduction:'}
                                </span>
                                <span className="font-semibold text-red-600">
                                  -{parseFloat(run.lateness_deduction || 0).toFixed(2)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between p-2 bg-red-50 rounded">
                                <span className="text-gray-600">
                                  {language === 'ar' ? 'الجزاءات:' : 'Penalties:'}
                                </span>
                                <span className="font-semibold text-red-600">
                                  -{parseFloat(run.penalties_deduction || 0).toFixed(2)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between p-2 bg-red-50 rounded">
                                <span className="text-gray-600">
                                  {language === 'ar' ? 'التأمينات:' : 'Insurance:'}
                                </span>
                                <span className="font-semibold text-red-600">
                                  -{parseFloat(run.social_insurance || 0).toFixed(2)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between p-2 bg-red-50 rounded">
                                <span className="text-gray-600">
                                  {language === 'ar' ? 'الضريبة:' : 'Tax:'}
                                </span>
                                <span className="font-semibold text-red-600">
                                  -{parseFloat(run.income_tax || 0).toFixed(2)}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-12 text-center">
                        <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500 text-lg font-medium mb-2">
                          {language === 'ar'
                            ? 'لا يوجد كشف رواتب منشأ'
                            : 'No payroll generated'}
                        </p>
                        <p className="text-gray-400 text-sm mb-6">
                          {language === 'ar'
                            ? 'قم بإنشاء كشف الرواتب أولاً'
                            : 'Generate payroll first'}
                        </p>
                        <button
                          onClick={() => {
                            setMobileView('generate');
                            setActiveTab('generate');
                          }}
                          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all shadow-md"
                        >
                          <Calculator className="w-5 h-5" />
                          {language === 'ar' ? 'اذهب إلى إنشاء الرواتب' : 'Go to Generate Payroll'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Payslips Content - Desktop */}
            <div className={activeTab === 'payslips' ? 'hidden md:block' : 'hidden'}>
              {activeTab === 'payslips' && (
                <div className="space-y-4 md:space-y-6">
                  <div className="bg-white border rounded-xl overflow-hidden">
                    <div className="p-4 md:p-6 border-b bg-gradient-to-r from-purple-50 to-pink-50">
                      <h3 className="text-lg md:text-xl font-bold text-gray-800 flex items-center gap-2">
                        <FileText className="w-5 h-5 md:w-6 md:h-6 text-purple-600" />
                        {language === 'ar' ? 'كشف الرواتب' : 'Payroll Report'}
                      </h3>
                      {payrollRuns.length > 0 && payrollRuns[0].period_from_day && payrollRuns[0].period_to_day ? (
                        <>
                          <p className="text-sm text-purple-700 font-medium mt-2">
                            {language === 'ar' ? 'الفترة: ' : 'Period: '}
                            {formatDateRangeLabel(payrollRuns[0].period_from_day, payrollRuns[0].period_to_day, payslipMonth, payslipYear, language)}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            {language === 'ar'
                              ? `عدد الموظفين: ${payrollRuns.length}`
                              : `Total Employees: ${payrollRuns.length}`}
                          </p>
                        </>
                      ) : payrollRuns.length > 0 ? (
                        <p className="text-sm text-gray-600 mt-1">
                          {language === 'ar'
                            ? `عدد الموظفين: ${payrollRuns.length}`
                            : `Total Employees: ${payrollRuns.length}`}
                        </p>
                      ) : null}
                    </div>

                    {payrollRuns.length > 0 && (
                      <div className="p-3 md:p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
                        <div className="grid grid-cols-3 gap-4 text-center max-w-3xl mx-auto">
                          <div className="p-2 bg-white/60 rounded-lg">
                            <div className="text-xs md:text-sm text-gray-600 mb-1">
                              {language === 'ar' ? 'إجمالي المستحقات' : 'Total Earnings'}
                            </div>
                            <div className="text-base md:text-lg font-semibold text-green-700">
                              {payrollSummary.totalEarnings.toFixed(2)} {currency}
                            </div>
                          </div>
                          <div className="p-2 bg-white/60 rounded-lg">
                            <div className="text-xs md:text-sm text-gray-600 mb-1">
                              {language === 'ar' ? 'إجمالي الخصومات' : 'Total Deductions'}
                            </div>
                            <div className="text-base md:text-lg font-semibold text-red-700">
                              {payrollSummary.totalDeductions.toFixed(2)} {currency}
                            </div>
                          </div>
                          <div className="p-2 bg-white/60 rounded-lg">
                            <div className="text-xs md:text-sm text-gray-600 mb-1">
                              {language === 'ar' ? 'صافي الرواتب' : 'Net Salaries'}
                            </div>
                            <div className="text-base md:text-lg font-semibold text-blue-700">
                              {payrollSummary.totalNet.toFixed(2)} {currency}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {payrollRuns.length > 0 ? (
                      <>
                        {/* Desktop Table */}
                        <div className="hidden md:block overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-gray-50 border-b">
                              <tr>
                                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">
                                  {language === 'ar' ? 'الموظف' : 'Employee'}
                                </th>
                                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                                  {language === 'ar' ? 'أيام الحضور' : 'Present Days'}
                                </th>
                                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                                  {language === 'ar' ? 'أيام التأخير' : 'Late Days'}
                                </th>
                                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                                  {language === 'ar' ? 'الراتب الأساسي' : 'Base Salary'}
                                </th>
                                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                                  {language === 'ar' ? 'البدلات' : 'Allowances'}
                                </th>
                                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 bg-green-50">
                                  {language === 'ar' ? 'الإضافي' : 'Overtime'}
                                </th>
                                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 bg-red-50">
                                  {language === 'ar' ? 'الغياب' : 'Absence'}
                                </th>
                                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                                  {language === 'ar' ? 'خصم التأخير' : 'Late Deduction'}
                                </th>
                                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                                  {language === 'ar' ? 'الجزاءات' : 'Penalties'}
                                </th>
                                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                                  {language === 'ar' ? 'التأمينات' : 'Insurance'}
                                </th>
                                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                                  {language === 'ar' ? 'الضريبة' : 'Tax'}
                                </th>
                                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 bg-purple-50">
                                  {language === 'ar' ? 'الصافي' : 'Net Salary'}
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {payrollRuns.map((run) => (
                                <tr
                                  key={run.id}
                                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                                  onClick={() => {
                                    setSelectedEmployeePayroll(run);
                                    setIsModalOpen(true);
                                  }}
                                >
                                  <td className="px-4 py-3">
                                    <div className="font-semibold text-gray-800">
                                      {run.employees?.full_name}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {run.employees?.employee_code}
                                    </div>
                                    {run.period_from_day && run.period_to_day && (
                                      <div className="text-xs text-gray-400 mt-0.5">
                                        {language === 'ar' ? 'النطاق: ' : 'Range: '}
                                        {formatDateRangeShort(run.period_from_day, run.period_to_day, language)}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-green-100 text-green-800">
                                      {run.present_days}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-orange-100 text-orange-800">
                                      {run.late_days}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-center text-gray-700">
                                    {parseFloat(run.base_salary || 0).toFixed(2)}
                                  </td>
                                  <td className="px-4 py-3 text-center text-gray-700">
                                    {parseFloat(run.allowances || 0).toFixed(2)}
                                  </td>
                                  <td className="px-4 py-3 text-center text-green-600 font-medium bg-green-50">
                                    +{parseFloat(run.overtime_amount || 0).toFixed(2)}
                                  </td>
                                  <td className="px-4 py-3 text-center text-red-600 font-medium bg-red-50">
                                    -{parseFloat(run.absence_deduction || 0).toFixed(2)}
                                  </td>
                                  <td className="px-4 py-3 text-center text-red-600 font-medium">
                                    -{parseFloat(run.lateness_deduction || 0).toFixed(2)}
                                  </td>
                                  <td className="px-4 py-3 text-center text-red-600 font-medium">
                                    -{parseFloat(run.penalties_deduction || 0).toFixed(2)}
                                  </td>
                                  <td className="px-4 py-3 text-center text-red-600 font-medium">
                                    -{parseFloat(run.social_insurance || 0).toFixed(2)}
                                  </td>
                                  <td className="px-4 py-3 text-center text-red-600 font-medium">
                                    -{parseFloat(run.income_tax || 0).toFixed(2)}
                                  </td>
                                  <td className="px-4 py-3 text-center bg-purple-50">
                                    <div className="font-bold text-purple-700 text-lg">
                                      {parseFloat(run.net_salary || 0).toFixed(2)}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {currency}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Mobile Cards */}
                        <div className="md:hidden divide-y">
                          {payrollRuns.map((run) => (
                            <div
                              key={run.id}
                              className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                              onClick={() => {
                                setSelectedEmployeePayroll(run);
                                setIsModalOpen(true);
                              }}
                            >
                              <div className="flex items-start justify-between mb-3">
                                <div>
                                  <div className="font-bold text-gray-800">
                                    {run.employees?.full_name}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {run.employees?.employee_code}
                                  </div>
                                  {run.period_from_day && run.period_to_day && (
                                    <div className="text-xs text-gray-400 mt-0.5">
                                      {language === 'ar' ? 'النطاق: ' : 'Range: '}
                                      {formatDateRangeShort(run.period_from_day, run.period_to_day, language)}
                                    </div>
                                  )}
                                </div>
                                <div className="text-left">
                                  <div className="text-lg font-bold text-purple-700">
                                    {parseFloat(run.net_salary || 0).toFixed(2)}
                                  </div>
                                  <div className="text-xs text-gray-500">{currency}</div>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                                <div className="flex items-center justify-between p-2 bg-blue-50 rounded">
                                  <span className="text-gray-600 text-xs">
                                    {language === 'ar' ? 'أيام العمل (شهري):' : 'Work Days (Month):'}
                                  </span>
                                  <span className="font-semibold text-blue-700">
                                    {run.calculation_metadata?.workingDaysInMonth || 26}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between p-2 bg-blue-50 rounded">
                                  <span className="text-gray-600 text-xs">
                                    {language === 'ar' ? 'أيام العمل (نطاق):' : 'Work Days (Range):'}
                                  </span>
                                  <span className="font-semibold text-blue-700">
                                    {run.calculation_metadata?.workingDaysInRange || run.present_days}
                                  </span>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2 text-sm">
                                <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                  <span className="text-gray-600">
                                    {language === 'ar' ? 'أيام الحضور:' : 'Present:'}
                                  </span>
                                  <span className="font-semibold text-green-700">
                                    {run.present_days}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                  <span className="text-gray-600">
                                    {language === 'ar' ? 'أيام الغياب:' : 'Absent:'}
                                  </span>
                                  <span className="font-semibold text-red-700">
                                    {run.absence_days}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                  <span className="text-gray-600">
                                    {language === 'ar' ? 'أيام التأخير:' : 'Late:'}
                                  </span>
                                  <span className="font-semibold text-orange-700">
                                    {run.late_days}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                  <span className="text-gray-600">
                                    {language === 'ar' ? 'الأساسي:' : 'Base:'}
                                  </span>
                                  <span className="font-semibold">
                                    {parseFloat(run.base_salary || 0).toFixed(2)}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                  <span className="text-gray-600">
                                    {language === 'ar' ? 'البدلات:' : 'Allowances:'}
                                  </span>
                                  <span className="font-semibold">
                                    {parseFloat(run.allowances || 0).toFixed(2)}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between p-2 bg-green-50 rounded">
                                  <span className="text-gray-600">
                                    {language === 'ar' ? 'الإضافي:' : 'Overtime:'}
                                  </span>
                                  <span className="font-semibold text-green-600">
                                    +{parseFloat(run.overtime_amount || 0).toFixed(2)}
                                  </span>
                                </div>
                                {parseFloat(run.bonuses_amount || 0) > 0 && (
                                  <div className="flex items-center justify-between p-2 bg-green-50 rounded">
                                    <span className="text-gray-600">
                                      {language === 'ar' ? 'المكافآت:' : 'Bonuses:'}
                                    </span>
                                    <span className="font-semibold text-green-600">
                                      +{parseFloat(run.bonuses_amount || 0).toFixed(2)}
                                    </span>
                                  </div>
                                )}
                                <div className="flex items-center justify-between p-2 bg-red-50 rounded">
                                  <span className="text-gray-600">
                                    {language === 'ar' ? 'الغياب:' : 'Absence:'}
                                  </span>
                                  <span className="font-semibold text-red-600">
                                    -{parseFloat(run.absence_deduction || 0).toFixed(2)}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between p-2 bg-red-50 rounded">
                                  <span className="text-gray-600">
                                    {language === 'ar' ? 'خصم التأخير:' : 'Late Deduction:'}
                                  </span>
                                  <span className="font-semibold text-red-600">
                                    -{parseFloat(run.lateness_deduction || 0).toFixed(2)}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between p-2 bg-red-50 rounded">
                                  <span className="text-gray-600">
                                    {language === 'ar' ? 'الجزاءات:' : 'Penalties:'}
                                  </span>
                                  <span className="font-semibold text-red-600">
                                    -{parseFloat(run.penalties_deduction || 0).toFixed(2)}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between p-2 bg-red-50 rounded">
                                  <span className="text-gray-600">
                                    {language === 'ar' ? 'التأمينات:' : 'Insurance:'}
                                  </span>
                                  <span className="font-semibold text-red-600">
                                    -{parseFloat(run.social_insurance || 0).toFixed(2)}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between p-2 bg-red-50 rounded">
                                  <span className="text-gray-600">
                                    {language === 'ar' ? 'الضريبة:' : 'Tax:'}
                                  </span>
                                  <span className="font-semibold text-red-600">
                                    -{parseFloat(run.income_tax || 0).toFixed(2)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="p-12 text-center">
                        <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500 text-lg font-medium mb-2">
                          {language === 'ar'
                            ? 'لا يوجد كشف رواتب منشأ'
                            : 'No payroll generated'}
                        </p>
                        <p className="text-gray-400 text-sm mb-6">
                          {language === 'ar'
                            ? 'قم بإنشاء كشف الرواتب أولاً'
                            : 'Generate payroll first'}
                        </p>
                        <button
                          onClick={() => {
                            setMobileView('generate');
                            setActiveTab('generate');
                          }}
                          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all shadow-md"
                        >
                          <Calculator className="w-5 h-5" />
                          {language === 'ar' ? 'اذهب إلى إنشاء الرواتب' : 'Go to Generate Payroll'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Penalties Content - Mobile */}
            <div className={mobileView === 'penalties' ? 'block md:hidden' : 'hidden'}>
              {mobileView === 'penalties' && (
                <div className="space-y-3">
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                    <h3 className="text-lg font-bold text-gray-800 mb-3">
                      {language === 'ar' ? 'إضافة جزاء جديد' : 'Add New Penalty'}
                    </h3>
                    <div className="compactStack">
                      <div>
                        <label className="compactLabel">
                          {language === 'ar' ? 'الموظف' : 'Employee'}
                        </label>
                        <select
                          value={newPenalty.employee_id}
                          onChange={(e) => setNewPenalty({ ...newPenalty, employee_id: e.target.value })}
                          className="compactField focus:ring-orange-500"
                        >
                          <option value="">{language === 'ar' ? 'اختر موظف' : 'Select Employee'}</option>
                          {employees.map(emp => (
                            <option key={emp.id} value={emp.id}>{emp.full_name} ({emp.employee_code})</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="compactLabel">
                          {language === 'ar' ? 'التاريخ' : 'Date'}
                        </label>
                        <input
                          type="date"
                          value={newPenalty.penalty_date}
                          onChange={(e) => setNewPenalty({ ...newPenalty, penalty_date: e.target.value })}
                          className="compactField focus:ring-orange-500"
                        />
                      </div>
                      <div>
                        <label className="compactLabel">
                          {language === 'ar' ? 'نوع الجزاء' : 'Penalty Type'}
                        </label>
                        <select
                          value={newPenalty.penalty_type}
                          onChange={(e) => setNewPenalty({ ...newPenalty, penalty_type: e.target.value as any })}
                          className="compactField focus:ring-orange-500"
                        >
                          <option value="fixed_amount">{language === 'ar' ? 'مبلغ ثابت' : 'Fixed Amount'}</option>
                          <option value="salary_percent">{language === 'ar' ? 'نسبة من الراتب' : 'Salary Percent'}</option>
                        </select>
                      </div>
                      <div>
                        <label className="compactLabel">
                          {language === 'ar' ? 'القيمة' : 'Value'}
                        </label>
                        <input
                          type="number"
                          value={newPenalty.penalty_value}
                          onChange={(e) => setNewPenalty({ ...newPenalty, penalty_value: parseFloat(e.target.value) })}
                          className="compactField focus:ring-orange-500"
                          step="0.01"
                        />
                      </div>
                      <div>
                        <label className="compactLabel">
                          {language === 'ar' ? 'السبب' : 'Reason'}
                        </label>
                        <textarea
                          value={newPenalty.reason}
                          onChange={(e) => setNewPenalty({ ...newPenalty, reason: e.target.value })}
                          className="compactTextarea focus:ring-orange-500"
                          rows={2}
                        />
                      </div>
                    </div>
                    <button
                      onClick={addPenalty}
                      className="compactSubmitBtn w-full mt-3 bg-orange-600 text-white hover:bg-orange-700"
                    >
                      {language === 'ar' ? 'إضافة جزاء' : 'Add Penalty'}
                    </button>
                  </div>

                  <div className="bg-white border rounded-xl overflow-hidden">
                    <h3 className="text-lg font-bold text-gray-800 p-4 border-b">
                      {language === 'ar' ? 'قائمة الجزاءات' : 'Penalties List'}
                    </h3>
                    <div className="divide-y">
                      {penalties.map(penalty => (
                        <div key={penalty.id} className="p-4 hover:bg-gray-50 transition-colors">
                          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                            <div className="flex-1">
                              <div className="font-bold text-gray-800">
                                {penalty.employees?.full_name} ({penalty.employees?.employee_code})
                              </div>
                              <div className="text-sm text-gray-600 mt-1">{penalty.reason}</div>
                              <div className="flex flex-wrap gap-3 mt-2 text-sm">
                                <span className="text-gray-500">
                                  {language === 'ar' ? 'التاريخ:' : 'Date:'} {penalty.penalty_date}
                                </span>
                                <span className="text-gray-500">
                                  {language === 'ar' ? 'النوع:' : 'Type:'} {
                                    (penalty.penalty_type === 'fixed' || penalty.penalty_type === 'fixed_amount') ? (language === 'ar' ? 'مبلغ ثابت' : 'Fixed') :
                                      (penalty.penalty_type === 'salary_percent' || penalty.penalty_type === 'fraction') ? (language === 'ar' ? 'نسبة من الراتب' : 'Salary %') :
                                        (language === 'ar' ? 'أيام' : 'Days')
                                  }
                                </span>
                                <span className="text-gray-500">
                                  {language === 'ar' ? 'القيمة:' : 'Value:'} {penalty.penalty_value}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {penalty.status === 'pending' && (
                                <>
                                  <button
                                    onClick={() => updatePenaltyStatus(penalty.id, 'approved')}
                                    className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200"
                                    title={language === 'ar' ? 'اعتماد' : 'Approve'}
                                  >
                                    <CheckCircle className="w-5 h-5" />
                                  </button>
                                  <button
                                    onClick={() => updatePenaltyStatus(penalty.id, 'rejected')}
                                    className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                                    title={language === 'ar' ? 'رفض' : 'Reject'}
                                  >
                                    <XCircle className="w-5 h-5" />
                                  </button>
                                </>
                              )}
                              {penalty.status === 'approved' && (
                                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
                                  {language === 'ar' ? 'معتمد' : 'Approved'}
                                </span>
                              )}
                              {penalty.status === 'rejected' && (
                                <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-semibold">
                                  {language === 'ar' ? 'مرفوض' : 'Rejected'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      {penalties.length === 0 && (
                        <div className="p-8 text-center text-gray-500">
                          {language === 'ar' ? 'لا توجد جزاءات مسجلة' : 'No penalties recorded'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bonuses Content - Mobile */}
            <div className={mobileView === 'bonuses' ? 'block md:hidden' : 'hidden'}>
              {mobileView === 'bonuses' && (
                <div className="space-y-3">
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <h3 className="text-lg font-bold text-gray-800 mb-3">
                      {language === 'ar' ? 'إضافة مكافأة جديدة' : 'Add New Bonus'}
                    </h3>
                    <div className="compactStack">
                      <div>
                        <label className="compactLabel">
                          {language === 'ar' ? 'الموظف' : 'Employee'}
                        </label>
                        <select
                          value={newPenalty.employee_id}
                          onChange={(e) => setNewPenalty({ ...newPenalty, employee_id: e.target.value })}
                          className="compactField focus:ring-green-500"
                        >
                          <option value="">{language === 'ar' ? 'اختر موظف' : 'Select Employee'}</option>
                          {employees.map(emp => (
                            <option key={emp.id} value={emp.id}>{emp.full_name} ({emp.employee_code})</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="compactLabel">
                          {language === 'ar' ? 'التاريخ' : 'Date'}
                        </label>
                        <input
                          type="date"
                          value={newPenalty.penalty_date}
                          onChange={(e) => setNewPenalty({ ...newPenalty, penalty_date: e.target.value })}
                          className="compactField focus:ring-green-500"
                        />
                      </div>
                      <div>
                        <label className="compactLabel">
                          {language === 'ar' ? 'نوع المكافأة' : 'Bonus Type'}
                        </label>
                        <select
                          value={newPenalty.penalty_type}
                          onChange={(e) => setNewPenalty({ ...newPenalty, penalty_type: e.target.value as any })}
                          className="compactField focus:ring-green-500"
                        >
                          <option value="fixed_amount">{language === 'ar' ? 'مبلغ ثابت' : 'Fixed Amount'}</option>
                          <option value="salary_percent">{language === 'ar' ? 'نسبة من الراتب' : 'Salary Percent'}</option>
                        </select>
                      </div>
                      <div>
                        <label className="compactLabel">
                          {language === 'ar' ? 'القيمة' : 'Value'}
                        </label>
                        <input
                          type="number"
                          value={newPenalty.penalty_value}
                          onChange={(e) => setNewPenalty({ ...newPenalty, penalty_value: parseFloat(e.target.value) })}
                          className="compactField focus:ring-green-500"
                          step="0.01"
                        />
                      </div>
                      <div>
                        <label className="compactLabel">
                          {language === 'ar' ? 'السبب' : 'Reason'}
                        </label>
                        <textarea
                          value={newPenalty.reason}
                          onChange={(e) => setNewPenalty({ ...newPenalty, reason: e.target.value })}
                          className="compactTextarea focus:ring-green-500"
                          rows={2}
                        />
                      </div>
                    </div>
                    <button
                      onClick={addBonus}
                      className="compactSubmitBtn w-full mt-3 bg-green-600 text-white hover:bg-green-700"
                    >
                      {language === 'ar' ? 'إضافة مكافأة' : 'Add Bonus'}
                    </button>
                  </div>

                  <div className="bg-white border rounded-xl overflow-hidden">
                    <h3 className="text-lg font-bold text-gray-800 p-4 border-b">
                      {language === 'ar' ? 'قائمة المكافآت' : 'Bonuses List'}
                    </h3>
                    <div className="divide-y">
                      {bonuses.map(bonus => (
                        <div key={bonus.id} className="p-4 hover:bg-gray-50 transition-colors">
                          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                            <div className="flex-1">
                              <div className="font-bold text-gray-800">
                                {bonus.employees?.full_name} ({bonus.employees?.employee_code})
                              </div>
                              <div className="text-sm text-gray-600 mt-1">{bonus.reason}</div>
                              <div className="flex flex-wrap gap-3 mt-2 text-sm">
                                <span className="text-gray-500">
                                  {language === 'ar' ? 'التاريخ:' : 'Date:'} {bonus.penalty_date}
                                </span>
                                <span className="text-gray-500">
                                  {language === 'ar' ? 'النوع:' : 'Type:'} {
                                    (bonus.penalty_type === 'fixed' || bonus.penalty_type === 'fixed_amount') ? (language === 'ar' ? 'مبلغ ثابت' : 'Fixed') :
                                      (bonus.penalty_type === 'salary_percent' || bonus.penalty_type === 'fraction') ? (language === 'ar' ? 'نسبة من الراتب' : 'Salary %') :
                                        (language === 'ar' ? 'أيام' : 'Days')
                                  }
                                </span>
                                <span className="font-semibold text-green-600">
                                  {language === 'ar' ? 'القيمة:' : 'Value:'} {bonus.penalty_value}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {bonus.status === 'pending' && (
                                <>
                                  <button
                                    onClick={() => updatePenaltyStatus(bonus.id, 'approved')}
                                    className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200"
                                    title={language === 'ar' ? 'اعتماد' : 'Approve'}
                                  >
                                    <CheckCircle className="w-5 h-5" />
                                  </button>
                                  <button
                                    onClick={() => updatePenaltyStatus(bonus.id, 'rejected')}
                                    className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                                    title={language === 'ar' ? 'رفض' : 'Reject'}
                                  >
                                    <XCircle className="w-5 h-5" />
                                  </button>
                                </>
                              )}
                              {bonus.status === 'approved' && (
                                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
                                  {language === 'ar' ? 'معتمد' : 'Approved'}
                                </span>
                              )}
                              {bonus.status === 'rejected' && (
                                <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-semibold">
                                  {language === 'ar' ? 'مرفوض' : 'Rejected'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      {bonuses.length === 0 && (
                        <div className="p-8 text-center text-gray-500">
                          {language === 'ar' ? 'لا توجد مكافآت مسجلة' : 'No bonuses recorded'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Settings Content - Mobile */}
            <div className={mobileView === 'settings' ? 'block md:hidden' : 'hidden'}>
              {mobileView === 'settings' && settings && (
                <div className="space-y-4 md:space-y-6">
                  <PayrollSettings
                    currency={settings.currency}
                    workdaysPerMonth={settings.workdays_per_month}
                    insuranceType={settings.insurance_type || 'percentage'}
                    insuranceValue={settings.insurance_value || 0}
                    taxType={settings.tax_type || 'percentage'}
                    taxValue={settings.tax_value || 0}
                    onCurrencyChange={(value) => setSettings({ ...settings, currency: value })}
                    onWorkdaysChange={(value) => setSettings({ ...settings, workdays_per_month: value })}
                    onInsuranceTypeChange={(value) => setSettings({ ...settings, insurance_type: value })}
                    onInsuranceValueChange={(value) => setSettings({ ...settings, insurance_value: value })}
                    onTaxTypeChange={(value) => setSettings({ ...settings, tax_type: value })}
                    onTaxValueChange={(value) => setSettings({ ...settings, tax_value: value })}
                  />

                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 md:p-6">
                    <h3 className="text-lg md:text-xl font-bold text-gray-800 mb-4">
                      {language === 'ar' ? 'إعدادات إضافية' : 'Additional Settings'}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {language === 'ar' ? 'فترة السماح (دقائق)' : 'Grace Period (minutes)'}
                        </label>
                        <input
                          type="number"
                          value={settings.grace_minutes}
                          onChange={(e) => setSettings({ ...settings, grace_minutes: parseInt(e.target.value) })}
                          className="w-full px-3 md:px-4 py-2.5 md:py-3 border border-gray-300 rounded-lg"
                        />
                      </div>
                    </div>
                    <button
                      onClick={updateSettings}
                      className="w-full md:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
                    >
                      {language === 'ar' ? 'حفظ الإعدادات' : 'Save Settings'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Penalties & Settings - Desktop Only */}
            <div className={activeTab === 'penalties' ? 'hidden md:block' : 'hidden'}>
              {activeTab === 'penalties' && (
                <div className="space-y-3">
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-6">
                    <h3 className="text-xl font-bold text-gray-800 mb-3">
                      {language === 'ar' ? 'إضافة جزاء جديد' : 'Add New Penalty'}
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="compactLabel">
                          {language === 'ar' ? 'الموظف' : 'Employee'}
                        </label>
                        <select
                          value={newPenalty.employee_id}
                          onChange={(e) => setNewPenalty({ ...newPenalty, employee_id: e.target.value })}
                          className="compactField focus:ring-orange-500"
                        >
                          <option value="">{language === 'ar' ? 'اختر موظف' : 'Select Employee'}</option>
                          {employees.map(emp => (
                            <option key={emp.id} value={emp.id}>{emp.full_name} ({emp.employee_code})</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="compactLabel">
                          {language === 'ar' ? 'التاريخ' : 'Date'}
                        </label>
                        <input
                          type="date"
                          value={newPenalty.penalty_date}
                          onChange={(e) => setNewPenalty({ ...newPenalty, penalty_date: e.target.value })}
                          className="compactField focus:ring-orange-500"
                        />
                      </div>
                      <div>
                        <label className="compactLabel">
                          {language === 'ar' ? 'نوع الجزاء' : 'Penalty Type'}
                        </label>
                        <select
                          value={newPenalty.penalty_type}
                          onChange={(e) => setNewPenalty({ ...newPenalty, penalty_type: e.target.value as any })}
                          className="compactField focus:ring-orange-500"
                        >
                          <option value="fixed_amount">{language === 'ar' ? 'مبلغ ثابت' : 'Fixed Amount'}</option>
                          <option value="salary_percent">{language === 'ar' ? 'نسبة من الراتب' : 'Salary Percent'}</option>
                        </select>
                      </div>
                      <div>
                        <label className="compactLabel">
                          {language === 'ar' ? 'القيمة' : 'Value'}
                        </label>
                        <input
                          type="number"
                          value={newPenalty.penalty_value}
                          onChange={(e) => setNewPenalty({ ...newPenalty, penalty_value: parseFloat(e.target.value) })}
                          className="compactField focus:ring-orange-500"
                          step="0.01"
                        />
                      </div>
                    </div>
                    <div className="mt-2">
                      <label className="compactLabel">
                        {language === 'ar' ? 'السبب' : 'Reason'}
                      </label>
                      <textarea
                        value={newPenalty.reason}
                        onChange={(e) => setNewPenalty({ ...newPenalty, reason: e.target.value })}
                        className="compactTextarea focus:ring-orange-500"
                        rows={2}
                      />
                    </div>
                    <button
                      onClick={addPenalty}
                      className="compactSubmitBtn mt-3 bg-orange-600 text-white hover:bg-orange-700"
                    >
                      {language === 'ar' ? 'إضافة جزاء' : 'Add Penalty'}
                    </button>
                  </div>

                  <div className="bg-white border rounded-xl overflow-hidden">
                    <h3 className="text-xl font-bold text-gray-800 p-4 border-b">
                      {language === 'ar' ? 'قائمة الجزاءات' : 'Penalties List'}
                    </h3>
                    <div className="divide-y">
                      {penalties.map(penalty => (
                        <div key={penalty.id} className="p-4 hover:bg-gray-50 transition-colors">
                          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                            <div className="flex-1">
                              <div className="font-bold text-gray-800">
                                {penalty.employees?.full_name} ({penalty.employees?.employee_code})
                              </div>
                              <div className="text-sm text-gray-600 mt-1">{penalty.reason}</div>
                              <div className="flex flex-wrap gap-3 mt-2 text-sm">
                                <span className="text-gray-500">
                                  {language === 'ar' ? 'التاريخ:' : 'Date:'} {penalty.penalty_date}
                                </span>
                                <span className="text-gray-500">
                                  {language === 'ar' ? 'النوع:' : 'Type:'} {
                                    penalty.penalty_type === 'fixed' ? (language === 'ar' ? 'مبلغ ثابت' : 'Fixed') :
                                      penalty.penalty_type === 'days' ? (language === 'ar' ? 'أيام' : 'Days') : (language === 'ar' ? 'نسبة' : 'Fraction')
                                  }
                                </span>
                                <span className="text-gray-500">
                                  {language === 'ar' ? 'القيمة:' : 'Value:'} {penalty.penalty_value}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {penalty.status === 'pending' && (
                                <>
                                  <button
                                    onClick={() => updatePenaltyStatus(penalty.id, 'approved')}
                                    className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200"
                                    title={language === 'ar' ? 'اعتماد' : 'Approve'}
                                  >
                                    <CheckCircle className="w-5 h-5" />
                                  </button>
                                  <button
                                    onClick={() => updatePenaltyStatus(penalty.id, 'rejected')}
                                    className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                                    title={language === 'ar' ? 'رفض' : 'Reject'}
                                  >
                                    <XCircle className="w-5 h-5" />
                                  </button>
                                </>
                              )}
                              {penalty.status === 'approved' && (
                                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
                                  {language === 'ar' ? 'معتمد' : 'Approved'}
                                </span>
                              )}
                              {penalty.status === 'rejected' && (
                                <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-semibold">
                                  {language === 'ar' ? 'مرفوض' : 'Rejected'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      {penalties.length === 0 && (
                        <div className="p-8 text-center text-gray-500">
                          {language === 'ar' ? 'لا توجد جزاءات مسجلة' : 'No penalties recorded'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bonuses - Desktop Only */}
            <div className={activeTab === 'bonuses' ? 'hidden md:block' : 'hidden'}>
              {activeTab === 'bonuses' && (
                <div className="space-y-3">
                  <div className="bg-green-50 border border-green-200 rounded-xl p-6">
                    <h3 className="text-xl font-bold text-gray-800 mb-3">
                      {language === 'ar' ? 'إضافة مكافأة جديدة' : 'Add New Bonus'}
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="compactLabel">
                          {language === 'ar' ? 'الموظف' : 'Employee'}
                        </label>
                        <select
                          value={newPenalty.employee_id}
                          onChange={(e) => setNewPenalty({ ...newPenalty, employee_id: e.target.value })}
                          className="compactField focus:ring-green-500"
                        >
                          <option value="">{language === 'ar' ? 'اختر موظف' : 'Select Employee'}</option>
                          {employees.map(emp => (
                            <option key={emp.id} value={emp.id}>{emp.full_name} ({emp.employee_code})</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="compactLabel">
                          {language === 'ar' ? 'التاريخ' : 'Date'}
                        </label>
                        <input
                          type="date"
                          value={newPenalty.penalty_date}
                          onChange={(e) => setNewPenalty({ ...newPenalty, penalty_date: e.target.value })}
                          className="compactField focus:ring-green-500"
                        />
                      </div>
                      <div>
                        <label className="compactLabel">
                          {language === 'ar' ? 'نوع المكافأة' : 'Bonus Type'}
                        </label>
                        <select
                          value={newPenalty.penalty_type}
                          onChange={(e) => setNewPenalty({ ...newPenalty, penalty_type: e.target.value as any })}
                          className="compactField focus:ring-green-500"
                        >
                          <option value="fixed_amount">{language === 'ar' ? 'مبلغ ثابت' : 'Fixed Amount'}</option>
                          <option value="salary_percent">{language === 'ar' ? 'نسبة من الراتب' : 'Salary Percent'}</option>
                        </select>
                      </div>
                      <div>
                        <label className="compactLabel">
                          {language === 'ar' ? 'القيمة' : 'Value'}
                        </label>
                        <input
                          type="number"
                          value={newPenalty.penalty_value}
                          onChange={(e) => setNewPenalty({ ...newPenalty, penalty_value: parseFloat(e.target.value) })}
                          className="compactField focus:ring-green-500"
                          step="0.01"
                        />
                      </div>
                    </div>
                    <div className="mt-2">
                      <label className="compactLabel">
                        {language === 'ar' ? 'السبب' : 'Reason'}
                      </label>
                      <textarea
                        value={newPenalty.reason}
                        onChange={(e) => setNewPenalty({ ...newPenalty, reason: e.target.value })}
                        className="compactTextarea focus:ring-green-500"
                        rows={2}
                      />
                    </div>
                    <button
                      onClick={addBonus}
                      className="compactSubmitBtn mt-3 bg-green-600 text-white hover:bg-green-700"
                    >
                      {language === 'ar' ? 'إضافة مكافأة' : 'Add Bonus'}
                    </button>
                  </div>

                  <div className="bg-white border rounded-xl overflow-hidden">
                    <h3 className="text-xl font-bold text-gray-800 p-4 border-b">
                      {language === 'ar' ? 'قائمة المكافآت' : 'Bonuses List'}
                    </h3>
                    <div className="divide-y">
                      {bonuses.map(bonus => (
                        <div key={bonus.id} className="p-4 hover:bg-gray-50 transition-colors">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="font-bold text-gray-800">
                                {bonus.employees?.full_name} ({bonus.employees?.employee_code})
                              </div>
                              <div className="text-sm text-gray-600 mt-1">{bonus.reason}</div>
                              <div className="flex gap-4 mt-2 text-sm">
                                <span className="text-gray-500">
                                  {language === 'ar' ? 'التاريخ:' : 'Date:'} {bonus.penalty_date}
                                </span>
                                <span className="text-gray-500">
                                  {language === 'ar' ? 'النوع:' : 'Type:'} {
                                    bonus.penalty_type === 'fixed' ? (language === 'ar' ? 'مبلغ ثابت' : 'Fixed') :
                                      bonus.penalty_type === 'days' ? (language === 'ar' ? 'أيام' : 'Days') :
                                        (language === 'ar' ? 'نسبة' : 'Fraction')
                                  }
                                </span>
                                <span className="font-semibold text-green-600">
                                  {language === 'ar' ? 'القيمة:' : 'Value:'} {bonus.penalty_value}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {bonus.status === 'pending' && (
                                <>
                                  <button
                                    onClick={() => updatePenaltyStatus(bonus.id, 'approved')}
                                    className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200"
                                    title={language === 'ar' ? 'اعتماد' : 'Approve'}
                                  >
                                    <CheckCircle className="w-5 h-5" />
                                  </button>
                                  <button
                                    onClick={() => updatePenaltyStatus(bonus.id, 'rejected')}
                                    className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                                    title={language === 'ar' ? 'رفض' : 'Reject'}
                                  >
                                    <XCircle className="w-5 h-5" />
                                  </button>
                                </>
                              )}
                              {bonus.status === 'approved' && (
                                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
                                  {language === 'ar' ? 'معتمد' : 'Approved'}
                                </span>
                              )}
                              {bonus.status === 'rejected' && (
                                <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-semibold">
                                  {language === 'ar' ? 'مرفوض' : 'Rejected'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      {bonuses.length === 0 && (
                        <div className="p-8 text-center text-gray-500">
                          {language === 'ar' ? 'لا توجد مكافآت مسجلة' : 'No bonuses recorded'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className={activeTab === 'settings' ? 'hidden md:block' : 'hidden'}>
              {activeTab === 'settings' && settings && (
                <div className="space-y-4 md:space-y-6">
                  <PayrollSettings
                    currency={settings.currency}
                    workdaysPerMonth={settings.workdays_per_month}
                    insuranceType={settings.insurance_type || 'percentage'}
                    insuranceValue={settings.insurance_value || 0}
                    taxType={settings.tax_type || 'percentage'}
                    taxValue={settings.tax_value || 0}
                    onCurrencyChange={(value) => setSettings({ ...settings, currency: value })}
                    onWorkdaysChange={(value) => setSettings({ ...settings, workdays_per_month: value })}
                    onInsuranceTypeChange={(value) => setSettings({ ...settings, insurance_type: value })}
                    onInsuranceValueChange={(value) => setSettings({ ...settings, insurance_value: value })}
                    onTaxTypeChange={(value) => setSettings({ ...settings, tax_type: value })}
                    onTaxValueChange={(value) => setSettings({ ...settings, tax_value: value })}
                  />

                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 md:p-6">
                    <h3 className="text-lg md:text-xl font-bold text-gray-800 mb-4">
                      {language === 'ar' ? 'إعدادات إضافية' : 'Additional Settings'}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {language === 'ar' ? 'فترة السماح (دقائق)' : 'Grace Period (minutes)'}
                        </label>
                        <input
                          type="number"
                          value={settings.grace_minutes}
                          onChange={(e) => setSettings({ ...settings, grace_minutes: parseInt(e.target.value) })}
                          className="w-full px-3 md:px-4 py-2.5 md:py-3 border border-gray-300 rounded-lg"
                        />
                      </div>
                    </div>
                    <button
                      onClick={updateSettings}
                      className="w-full md:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
                    >
                      {language === 'ar' ? 'حفظ الإعدادات' : 'Save Settings'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Bottom Navigation */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-50">
          <div className="grid grid-cols-4 gap-2 p-3">
            <button
              onClick={() => setMobileView('generate')}
              className={`flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-lg font-semibold transition-all ${mobileView === 'generate'
                ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
            >
              <Calculator className="w-5 h-5" />
              <span className="text-xs">{language === 'ar' ? 'إنشاء' : 'Generate'}</span>
            </button>
            <button
              onClick={() => setMobileView('payslips')}
              className={`flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-lg font-semibold transition-all ${mobileView === 'payslips'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
            >
              <FileText className="w-5 h-5" />
              <span className="text-xs">{language === 'ar' ? 'الكشف' : 'Payslips'}</span>
            </button>
            <button
              onClick={() => setMobileView('penalties')}
              className={`flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-lg font-semibold transition-all ${mobileView === 'penalties'
                ? 'bg-gradient-to-r from-orange-600 to-red-600 text-white shadow-lg'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
            >
              <AlertTriangle className="w-5 h-5" />
              <span className="text-xs">{language === 'ar' ? 'جزاءات' : 'Penalties'}</span>
            </button>
            <button
              onClick={() => setMobileView('settings')}
              className={`flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-lg font-semibold transition-all ${mobileView === 'settings'
                ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
            >
              <Settings className="w-5 h-5" />
              <span className="text-xs">{language === 'ar' ? 'إعدادات' : 'Settings'}</span>
            </button>
          </div>
        </div>

      </div>

      <EmployeePayrollDetailsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        payrollData={selectedEmployeePayroll}
        currency={currency}
        language={language}
        companyName=""
      />
    </div>
  );
}
