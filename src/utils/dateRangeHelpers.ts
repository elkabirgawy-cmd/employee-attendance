export interface DateRange {
  startDate: Date;
  endDate: Date;
  fromDay: number;
  toDay: number;
}

export function buildDateRange(
  year: number,
  month: number,
  fromDay: number,
  toDay: number
): DateRange {
  const actualFromDay = Math.min(fromDay, toDay);
  const actualToDay = Math.max(fromDay, toDay);

  const daysInMonth = new Date(year, month, 0).getDate();
  const validFromDay = Math.max(1, Math.min(actualFromDay, daysInMonth));
  const validToDay = Math.max(1, Math.min(actualToDay, daysInMonth));

  const startDate = new Date(year, month - 1, validFromDay, 0, 0, 0);
  const endDate = new Date(year, month - 1, validToDay, 23, 59, 59);

  return {
    startDate,
    endDate,
    fromDay: validFromDay,
    toDay: validToDay
  };
}

export function filterByRange<T extends { check_in_time?: string; penalty_date?: string; start_date?: string; end_date?: string }>(
  records: T[],
  rangeStart: Date,
  rangeEnd: Date
): T[] {
  return records.filter(record => {
    const recordDate = record.check_in_time
      ? new Date(record.check_in_time)
      : record.penalty_date
      ? new Date(record.penalty_date)
      : record.start_date
      ? new Date(record.start_date)
      : null;

    if (!recordDate) return false;

    return recordDate >= rangeStart && recordDate <= rangeEnd;
  });
}

export function calculateWorkDaysInRange(
  rangeStart: Date,
  rangeEnd: Date,
  workdaysPerMonth: number
): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysDiff = Math.floor((rangeEnd.getTime() - rangeStart.getTime()) / msPerDay) + 1;

  const totalDaysInMonth = new Date(rangeStart.getFullYear(), rangeStart.getMonth() + 1, 0).getDate();

  const workDaysRatio = workdaysPerMonth / totalDaysInMonth;
  const expectedWorkDays = Math.round(daysDiff * workDaysRatio);

  return Math.max(0, expectedWorkDays);
}

export function formatDateRangeLabel(
  fromDay: number,
  toDay: number,
  month: number,
  year: number,
  language: 'ar' | 'en'
): string {
  const daysInMonth = new Date(year, month, 0).getDate();

  if (fromDay === 1 && toDay === daysInMonth) {
    return language === 'ar'
      ? `كشف الرواتب - ${month}/${year}`
      : `Payslips - ${month}/${year}`;
  }

  return language === 'ar'
    ? `كشف الرواتب - ${month}/${year} (من ${fromDay} إلى ${toDay})`
    : `Payslips - ${month}/${year} (from ${fromDay} to ${toDay})`;
}

export function formatDateRangeShort(
  fromDay: number,
  toDay: number,
  language: 'ar' | 'en'
): string {
  return language === 'ar'
    ? `من ${fromDay} إلى ${toDay}`
    : `from ${fromDay} to ${toDay}`;
}
