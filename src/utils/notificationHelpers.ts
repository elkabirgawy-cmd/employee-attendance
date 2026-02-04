import { supabase } from '../lib/supabase';

interface SendNotificationParams {
  userId?: string;
  role?: 'admin' | 'employee';
  type: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  priority?: 'normal' | 'high';
}

export async function sendNotification(params: SendNotificationParams) {
  try {
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new Error('Failed to send notification');
    }

    return await response.json();
  } catch (error) {
    console.error('Error sending notification:', error);
    throw error;
  }
}

export async function notifyLeaveRequest(employeeName: string, leaveType: string, startDate: string, endDate: string) {
  await sendNotification({
    role: 'admin',
    type: 'leave_request',
    title: 'طلب إجازة جديد',
    body: `${employeeName} طلب إجازة ${leaveType} من ${startDate} إلى ${endDate}`,
    data: {
      employeeName,
      leaveType,
      startDate,
      endDate,
    },
    priority: 'normal',
  });
}

export async function notifyLeaveApproved(userId: string, leaveType: string, startDate: string, endDate: string) {
  await sendNotification({
    userId,
    type: 'leave_approved',
    title: 'تمت الموافقة على إجازتك',
    body: `تمت الموافقة على طلب إجازة ${leaveType} من ${startDate} إلى ${endDate}`,
    data: {
      leaveType,
      startDate,
      endDate,
    },
    priority: 'normal',
  });
}

export async function notifyLeaveRejected(userId: string, leaveType: string, startDate: string, endDate: string, reason?: string) {
  await sendNotification({
    userId,
    type: 'leave_rejected',
    title: 'تم رفض طلب الإجازة',
    body: `تم رفض طلب إجازة ${leaveType} من ${startDate} إلى ${endDate}${reason ? `. السبب: ${reason}` : ''}`,
    data: {
      leaveType,
      startDate,
      endDate,
      reason,
    },
    priority: 'normal',
  });
}

export async function notifyLateArrival(employeeName: string, scheduledTime: string, actualTime: string, minutesLate: number) {
  await sendNotification({
    role: 'admin',
    type: 'late_arrival',
    title: 'تأخير في الحضور',
    body: `${employeeName} تأخر ${minutesLate} دقيقة. موعد الحضور: ${scheduledTime}، وقت الوصول: ${actualTime}`,
    data: {
      employeeName,
      scheduledTime,
      actualTime,
      minutesLate,
    },
    priority: 'normal',
  });
}

export async function notifyAbsence(employeeName: string, date: string) {
  await sendNotification({
    role: 'admin',
    type: 'absence',
    title: 'غياب موظف',
    body: `${employeeName} غائب في ${date}`,
    data: {
      employeeName,
      date,
    },
    priority: 'normal',
  });
}

export async function notifyFraudAlert(employeeName: string, alertType: string, details: string) {
  await sendNotification({
    role: 'admin',
    type: 'fraud_alert',
    title: 'تنبيه احتيال',
    body: `${employeeName}: ${alertType} - ${details}`,
    data: {
      employeeName,
      alertType,
      details,
    },
    priority: 'high',
  });
}

export async function notifyDeviceChange(employeeName: string, oldDevice: string, newDevice: string) {
  await sendNotification({
    role: 'admin',
    type: 'device_change',
    title: 'تغيير جهاز الموظف',
    body: `${employeeName} قام بتغيير الجهاز من ${oldDevice} إلى ${newDevice}`,
    data: {
      employeeName,
      oldDevice,
      newDevice,
    },
    priority: 'high',
  });
}

export async function notifyFakeGPS(employeeName: string, location: string) {
  await sendNotification({
    role: 'admin',
    type: 'fake_gps',
    title: 'تنبيه موقع وهمي',
    body: `تم اكتشاف موقع GPS وهمي لـ ${employeeName} في ${location}`,
    data: {
      employeeName,
      location,
    },
    priority: 'high',
  });
}

export async function notifyPayrollDeduction(userId: string, amount: number, reason: string, month: string) {
  await sendNotification({
    userId,
    type: 'payroll_deduction',
    title: 'خصم من الراتب',
    body: `تم خصم ${amount} ريال من راتب ${month}. السبب: ${reason}`,
    data: {
      amount,
      reason,
      month,
    },
    priority: 'normal',
  });
}
