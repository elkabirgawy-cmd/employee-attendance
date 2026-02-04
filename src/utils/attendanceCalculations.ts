export interface AttendanceRecord {
  check_in_time: string;
  check_out_time: string | null;
}

export interface AttendanceSettings {
  weekly_off_days?: number[];
  default_working_days_monthly?: number;
  workdays_mode?: string;
}

export interface EmployeeWorkdaysConfig {
  custom_working_days?: number;
  custom_working_days_enabled?: boolean;
  weekly_off_days?: number[];
}

export interface MonthlyStats {
  totalHours: number;
  effectiveDays: number;
  averageHoursPerDay: number;
  monthKey: string;
}

export function getMonthRange(now: Date): { monthStart: Date; monthEnd: Date; year: number; month: number } {
  const year = now.getFullYear();
  const month = now.getMonth();
  const monthStart = new Date(year, month, 1, 0, 0, 0, 0);
  const monthEnd = new Date(year, month + 1, 1, 0, 0, 0, 0);

  return { monthStart, monthEnd, year, month };
}

export function clipInterval(
  intervalStart: Date,
  intervalEnd: Date,
  windowStart: Date,
  windowEnd: Date
): { start: Date; end: Date; isOverlap: boolean } {
  const start = intervalStart < windowStart ? windowStart : intervalStart;
  const end = intervalEnd > windowEnd ? windowEnd : intervalEnd;

  const isOverlap = start < end && intervalStart < windowEnd && intervalEnd > windowStart;

  return { start, end, isOverlap };
}

export function sumWorkedMsInMonth(
  records: AttendanceRecord[],
  monthStart: Date,
  monthEnd: Date
): number {
  let totalMs = 0;

  for (const record of records) {
    // Only count completed sessions (ignore incomplete sessions without check_out)
    if (!record.check_out_time) {
      continue;
    }

    const checkIn = new Date(record.check_in_time);
    const checkOut = new Date(record.check_out_time);

    const { start, end, isOverlap } = clipInterval(checkIn, checkOut, monthStart, monthEnd);

    if (isOverlap) {
      totalMs += end.getTime() - start.getTime();
    }
  }

  return totalMs;
}

export function countWeekdayOccurrences(year: number, month: number, weekday: number): number {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let count = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    if (date.getDay() === weekday) {
      count++;
    }
  }

  return count;
}

export function computeEffectiveWorkdays(
  settings: AttendanceSettings | null,
  employee: EmployeeWorkdaysConfig | null,
  year: number,
  month: number,
  approvedVacationDays: number
): number {
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  if (employee?.custom_working_days_enabled && employee?.custom_working_days) {
    return Math.max(1, employee.custom_working_days - approvedVacationDays);
  }

  let baseDays = daysInMonth;

  if (settings?.workdays_mode === 'fixed' && settings?.default_working_days_monthly) {
    baseDays = settings.default_working_days_monthly;
  }

  const weeklyOffDays = employee?.weekly_off_days || settings?.weekly_off_days || [];
  let weeklyOffCount = 0;

  for (const weekday of weeklyOffDays) {
    weeklyOffCount += countWeekdayOccurrences(year, month, weekday);
  }

  const effectiveDays = baseDays - weeklyOffCount - approvedVacationDays;

  return Math.max(1, effectiveDays);
}

export function calculateMonthlyStats(
  attendanceRecords: AttendanceRecord[],
  settings: AttendanceSettings | null,
  employeeConfig: EmployeeWorkdaysConfig | null,
  approvedVacationDays: number,
  now: Date = new Date()
): MonthlyStats {
  const { monthStart, monthEnd, year, month } = getMonthRange(now);
  const monthKey = `${year}-${month}`;

  const totalMs = sumWorkedMsInMonth(attendanceRecords, monthStart, monthEnd);
  const totalHours = Math.max(0, totalMs / (1000 * 60 * 60));

  const effectiveDays = computeEffectiveWorkdays(
    settings,
    employeeConfig,
    year,
    month,
    approvedVacationDays
  );

  const averageHoursPerDay = totalHours / effectiveDays;

  return {
    totalHours,
    effectiveDays,
    averageHoursPerDay,
    monthKey
  };
}
