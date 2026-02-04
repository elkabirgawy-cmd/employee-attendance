export interface LateDeductionRule {
  id?: string;
  from_minutes: number;
  to_minutes: number;
  deduction_type: 'fixed' | 'percent';
  value: number;
}

export interface Penalty {
  id: string;
  penalty_type: 'fixed' | 'days' | 'fraction' | 'fixed_amount' | 'salary_percent';
  penalty_value: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  is_recurring?: boolean;
  apply_to_salary?: boolean;
}

export interface AttendanceRecord {
  check_in_time: string;
  late_minutes: number;
}

export interface DelayPermission {
  date: string;
  minutes: number;
  status: 'approved';
}

export interface Employee {
  id: string;
  salary_mode: 'monthly' | 'daily';
  monthly_salary: number;
  daily_wage: number;
  allowances: number;
  social_insurance_value?: number;
  income_tax_value?: number;
}

export interface PayrollCalculation {
  baseSalary: number;
  basePayForRange: number;
  allowances: number;
  allowancesForRange: number;
  overtimeHours: number;
  overtimeAmount: number;
  presentDays: number;
  absenceDays: number;
  absenceDeduction: number;
  lateDays: number;
  latenessDeduction: number;
  penaltiesDeduction: number;
  bonusesAmount: number;
  socialInsurance: number;
  incomeTax: number;
  otherDeductions: number;
  grossSalary: number;
  totalDeductions: number;
  netSalary: number;
  metadata: {
    workingDaysInMonth: number;
    workingDaysInRange: number;
    dailyRate: number;
    latenessBreakdown: Array<{
      date: string;
      lateMinutes: number;
      permissionMinutes?: number;
      netLateMinutes?: number;
      deduction: number;
      ruleApplied: string;
    }>;
    penaltiesBreakdown: Array<{
      reason: string;
      type: string;
      value: number;
      deduction: number;
    }>;
    bonusesBreakdown: Array<{
      reason: string;
      type: string;
      value: number;
      amount: number;
    }>;
    totalPermissionMinutes?: number;
  };
}

export function calculateDailyRate(
  employee: Employee,
  workdaysPerMonth: number
): number {
  if (employee.salary_mode === 'monthly') {
    return employee.monthly_salary / workdaysPerMonth;
  }
  return employee.daily_wage;
}

export function findBestLateDeductionRule(
  lateMinutes: number,
  rules: LateDeductionRule[],
  dailyRate: number
): { rule: LateDeductionRule | null; deduction: number } {
  const matchingRules = rules.filter(
    rule => lateMinutes >= rule.from_minutes && lateMinutes < rule.to_minutes
  );

  if (matchingRules.length === 0) {
    return { rule: null, deduction: 0 };
  }

  let bestRule = matchingRules[0];
  let maxDeduction = 0;

  for (const rule of matchingRules) {
    let deduction = 0;
    if (rule.deduction_type === 'fixed') {
      deduction = rule.value;
    } else {
      deduction = dailyRate * (rule.value / 100);
    }

    if (deduction > maxDeduction) {
      maxDeduction = deduction;
      bestRule = rule;
    }
  }

  return { rule: bestRule, deduction: maxDeduction };
}

export function calculateLatenessDeduction(
  lateMinutes: number,
  dailyRate: number,
  rules: LateDeductionRule[]
): { deduction: number; ruleApplied: string } {
  const { rule, deduction } = findBestLateDeductionRule(lateMinutes, rules, dailyRate);

  if (!rule) {
    return { deduction: 0, ruleApplied: 'No rule' };
  }

  if (rule.deduction_type === 'fixed') {
    return {
      deduction,
      ruleApplied: `Fixed ${rule.value} (${rule.from_minutes}-${rule.to_minutes} min)`
    };
  }

  return {
    deduction,
    ruleApplied: `${rule.value}% of daily rate (${rule.from_minutes}-${rule.to_minutes} min)`
  };
}

export function calculatePenaltyDeduction(
  penalty: Penalty,
  dailyRate: number,
  baseSalary?: number
): number {
  // Support both old and new type names
  if (penalty.penalty_type === 'fixed' || penalty.penalty_type === 'fixed_amount') {
    return penalty.penalty_value;
  }

  if (penalty.penalty_type === 'days') {
    return penalty.penalty_value * dailyRate;
  }

  if (penalty.penalty_type === 'fraction') {
    return penalty.penalty_value * dailyRate;
  }

  // New: salary_percent calculates from base salary
  if (penalty.penalty_type === 'salary_percent' && baseSalary) {
    return (penalty.penalty_value / 100) * baseSalary;
  }

  return 0;
}

export function calculatePayroll(
  employee: Employee,
  attendanceRecords: AttendanceRecord[],
  approvedPenalties: Penalty[],
  lateDeductionRules: LateDeductionRule[],
  workingDaysInMonth: number,
  workingDaysInRange: number,
  approvedLeaveDays: number = 0,
  approvedBonuses: Penalty[] = [],
  insuranceSettings?: { type: 'percentage' | 'fixed'; value: number },
  taxSettings?: { type: 'percentage' | 'fixed'; value: number },
  isPartialRange: boolean = false,
  delayPermissions: DelayPermission[] = []
): PayrollCalculation {
  const dailyRate = calculateDailyRate(employee, workingDaysInMonth);

  const presentDays = attendanceRecords.length;

  const baseSalary = employee.salary_mode === 'monthly' ? employee.monthly_salary : employee.daily_wage * workingDaysInMonth;

  const basePayForRange = dailyRate * presentDays;

  const allowancesForRange = employee.salary_mode === 'monthly'
    ? (employee.allowances / workingDaysInMonth) * presentDays
    : employee.allowances;

  const latenessBreakdown = attendanceRecords
    .filter(record => record.late_minutes > 0)
    .map(record => {
      const recordDate = record.check_in_time.split('T')[0];

      const permissionForDate = delayPermissions.find(
        permission => permission.date === recordDate && permission.status === 'approved'
      );

      const permissionMinutes = permissionForDate ? permissionForDate.minutes : 0;

      const netLateMinutes = Math.max(0, record.late_minutes - permissionMinutes);

      const { deduction, ruleApplied } = calculateLatenessDeduction(
        netLateMinutes,
        dailyRate,
        lateDeductionRules
      );

      return {
        date: recordDate,
        lateMinutes: record.late_minutes,
        permissionMinutes: permissionMinutes > 0 ? permissionMinutes : undefined,
        netLateMinutes: permissionMinutes > 0 ? netLateMinutes : undefined,
        deduction,
        ruleApplied
      };
    });

  const lateDays = latenessBreakdown.length;
  const latenessDeduction = latenessBreakdown.reduce((sum, item) => sum + item.deduction, 0);

  const penaltiesBreakdown = approvedPenalties.map(penalty => {
    const deduction = calculatePenaltyDeduction(penalty, dailyRate, baseSalary);
    return {
      reason: penalty.reason,
      type: penalty.penalty_type,
      value: penalty.penalty_value,
      deduction
    };
  });

  const penaltiesDeduction = penaltiesBreakdown.reduce((sum, item) => sum + item.deduction, 0);

  const bonusesBreakdown = approvedBonuses.map(bonus => {
    const amount = calculatePenaltyDeduction(bonus, dailyRate, baseSalary);
    return {
      reason: bonus.reason,
      type: bonus.penalty_type,
      value: bonus.penalty_value,
      amount
    };
  });

  const bonusesAmount = bonusesBreakdown.reduce((sum, item) => sum + item.amount, 0);

  let grossSalary = 0;
  let absenceDays = 0;
  let absenceDeduction = 0;

  if (isPartialRange) {
    grossSalary = basePayForRange + allowancesForRange;
    absenceDays = 0;
    absenceDeduction = 0;
  } else {
    if (employee.salary_mode === 'monthly') {
      grossSalary = baseSalary + employee.allowances;
    } else {
      grossSalary = basePayForRange + allowancesForRange;
    }
    absenceDays = Math.max(0, workingDaysInRange - presentDays - approvedLeaveDays);
    absenceDeduction = employee.salary_mode === 'monthly' ? absenceDays * dailyRate : 0;
  }

  let socialInsurance = 0;
  if (insuranceSettings) {
    if (insuranceSettings.type === 'percentage') {
      socialInsurance = (baseSalary * insuranceSettings.value) / 100;
    } else {
      socialInsurance = insuranceSettings.value;
    }
    if (employee.salary_mode === 'monthly') {
      if (isPartialRange) {
        socialInsurance = (socialInsurance / workingDaysInMonth) * presentDays;
      }
    }
  } else {
    socialInsurance = employee.social_insurance_value || 0;
  }

  let incomeTax = 0;
  if (taxSettings) {
    if (taxSettings.type === 'percentage') {
      incomeTax = (baseSalary * taxSettings.value) / 100;
    } else {
      incomeTax = taxSettings.value;
    }
    if (employee.salary_mode === 'monthly') {
      if (isPartialRange) {
        incomeTax = (incomeTax / workingDaysInMonth) * presentDays;
      }
    }
  } else {
    incomeTax = employee.income_tax_value || 0;
  }

  const otherDeductions = 0;
  const overtimeHours = 0;
  const overtimeAmount = 0;

  const totalDeductions = absenceDeduction + latenessDeduction + penaltiesDeduction + socialInsurance + incomeTax + otherDeductions;
  const netSalary = grossSalary + overtimeAmount + bonusesAmount - totalDeductions;

  return {
    baseSalary,
    basePayForRange,
    allowances: employee.allowances,
    allowancesForRange,
    overtimeHours,
    overtimeAmount,
    presentDays,
    absenceDays,
    absenceDeduction,
    lateDays,
    latenessDeduction,
    penaltiesDeduction,
    bonusesAmount,
    socialInsurance,
    incomeTax,
    otherDeductions,
    grossSalary,
    totalDeductions,
    netSalary,
    metadata: {
      workingDaysInMonth,
      workingDaysInRange,
      dailyRate,
      latenessBreakdown,
      penaltiesBreakdown,
      bonusesBreakdown,
      totalPermissionMinutes: delayPermissions.reduce((sum, p) => sum + p.minutes, 0)
    }
  };
}
