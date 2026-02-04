export interface LeaveType {
  id: string;
  name: string;
  name_ar: string;
  is_paid: boolean;
  default_days_per_year: number;
  color: string;
}

export interface LeaveBalance {
  id: string;
  employee_id: string;
  leave_type_id: string;
  year: number;
  total_days: number;
  used_days: number;
  remaining_days: number;
}

export function calculateRequestedDays(startDate: Date, endDate: Date, excludeWeekends: boolean = false): number {
  if (endDate < startDate) {
    return 0;
  }

  let days = 0;
  const current = new Date(startDate);

  while (current <= endDate) {
    if (excludeWeekends) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 5 && dayOfWeek !== 6) {
        days++;
      }
    } else {
      days++;
    }
    current.setDate(current.getDate() + 1);
  }

  return days;
}

export function validateLeaveRequest(
  startDate: Date,
  endDate: Date,
  leaveType: LeaveType,
  balance: LeaveBalance | null
): { valid: boolean; error?: string } {
  if (endDate < startDate) {
    return { valid: false, error: 'تاريخ النهاية يجب أن يكون بعد أو يساوي تاريخ البداية' };
  }

  const requestedDays = calculateRequestedDays(startDate, endDate, false);

  if (leaveType.is_paid && balance) {
    if (requestedDays > balance.remaining_days) {
      return {
        valid: false,
        error: `الرصيد المتبقي غير كافٍ. المتاح: ${balance.remaining_days} يوم، المطلوب: ${requestedDays} يوم`
      };
    }
  }

  return { valid: true };
}

export function getLeaveTypeColor(leaveTypeName: string): string {
  const colors: Record<string, string> = {
    'إجازة سنوية': '#10b981',
    'إجازة مرضية': '#f59e0b',
    'إجازة بدون أجر': '#6b7280'
  };

  return colors[leaveTypeName] || '#3b82f6';
}

export function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (start.toDateString() === end.toDateString()) {
    return formatDate(start);
  }

  return `${formatDate(start)} - ${formatDate(end)}`;
}
