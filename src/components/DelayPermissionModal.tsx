import { useState, useEffect } from 'react';
import { X, Clock, FileText, AlertCircle, CheckCircle2, XCircle, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';

interface DelayPermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
}

interface Employee {
  id: string;
  employee_code: string;
  full_name: string;
}

interface DelayPermission {
  id: string;
  employee_id: string;
  date: string;
  start_time: string;
  end_time: string;
  minutes: number;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  employees?: {
    employee_code: string;
    full_name: string;
  };
}

interface PayrollSettings {
  delay_permission_enabled: boolean;
  max_delay_hours_per_day: number;
  allow_delay_minutes: boolean;
}

export default function DelayPermissionModal({ isOpen, onClose, companyId }: DelayPermissionModalProps) {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [permissions, setPermissions] = useState<DelayPermission[]>([]);
  const [settings, setSettings] = useState<PayrollSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [formData, setFormData] = useState({
    employee_id: '',
    date: new Date().toISOString().split('T')[0],
    start_time: '09:00',
    end_time: '09:30',
    reason: ''
  });

  const [calculatedMinutes, setCalculatedMinutes] = useState(0);
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchEmployees();
      fetchSettings();
      fetchPermissions();
    }
  }, [isOpen, companyId]);

  useEffect(() => {
    if (formData.start_time && formData.end_time) {
      const minutes = calculateMinutes(formData.start_time, formData.end_time);
      setCalculatedMinutes(minutes);

      if (settings) {
        const maxMinutes = settings.max_delay_hours_per_day * 60;
        if (minutes > maxMinutes) {
          setValidationError(
            language === 'ar'
              ? `الحد الأقصى ${settings.max_delay_hours_per_day} ساعة (${maxMinutes} دقيقة)`
              : `Maximum ${settings.max_delay_hours_per_day} hours (${maxMinutes} minutes)`
          );
        } else if (minutes <= 0) {
          setValidationError(
            language === 'ar' ? 'وقت النهاية يجب أن يكون أكبر من وقت البداية' : 'End time must be after start time'
          );
        } else {
          setValidationError('');
        }
      }
    }
  }, [formData.start_time, formData.end_time, settings, language]);

  function calculateMinutes(startTime: string, endTime: string): number {
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);

    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;

    return endMinutes - startMinutes;
  }

  function formatMinutesToHours(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours === 0) {
      return language === 'ar' ? `${mins} دقيقة` : `${mins} minutes`;
    } else if (mins === 0) {
      return language === 'ar' ? `${hours} ساعة` : `${hours} hour${hours > 1 ? 's' : ''}`;
    } else {
      return language === 'ar'
        ? `${hours} ساعة و ${mins} دقيقة`
        : `${hours} hour${hours > 1 ? 's' : ''} ${mins} min`;
    }
  }

  async function fetchEmployees() {
    const { data } = await supabase
      .from('employees')
      .select('id, employee_code, full_name')
      .order('full_name');

    if (data) setEmployees(data);
  }

  async function fetchSettings() {
    const { data } = await supabase
      .from('payroll_settings')
      .select('delay_permission_enabled, max_delay_hours_per_day, allow_delay_minutes')
      .eq('company_id', companyId)
      .single();

    if (data) setSettings(data);
  }

  async function fetchPermissions() {
    const { data } = await supabase
      .from('delay_permissions')
      .select('*, employees(employee_code, full_name)')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (data) setPermissions(data);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validation 1: Check required fields
    if (!formData.employee_id || !formData.date || !formData.start_time || !formData.end_time) {
      setErrorMessage(language === 'ar' ? 'الرجاء ملء جميع الحقول المطلوبة' : 'Please fill all required fields');
      return;
    }

    // Validation 2: Check validation error from useEffect
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    // Validation 3: Check time range
    if (calculatedMinutes <= 0) {
      setErrorMessage(language === 'ar' ? 'وقت النهاية يجب أن يكون أكبر من وقت البداية' : 'End time must be after start time');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      // Check for existing permission on same date
      const { data: existingPermissions, error: checkError } = await supabase
        .from('delay_permissions')
        .select('id')
        .eq('company_id', companyId)
        .eq('employee_id', formData.employee_id)
        .eq('date', formData.date)
        .in('status', ['pending', 'approved']);

      if (checkError) {
        console.error('Error checking existing permissions:', checkError);
        throw new Error(language === 'ar' ? 'فشل التحقق من الطلبات السابقة' : 'Failed to check existing permissions');
      }

      if (existingPermissions && existingPermissions.length > 0) {
        setErrorMessage(
          language === 'ar'
            ? 'يوجد إذن تأخير في نفس اليوم لنفس الموظف'
            : 'A delay permission already exists for this employee on this date'
        );
        setLoading(false);
        return;
      }

      // Insert new permission
      const insertData = {
        company_id: companyId,
        employee_id: formData.employee_id,
        date: formData.date,
        start_time: formData.start_time,
        end_time: formData.end_time,
        minutes: calculatedMinutes,
        reason: formData.reason?.trim() || null,
        status: 'pending'
      };

      console.log('Inserting delay permission (admin):', insertData);

      const { data: insertedData, error: insertError } = await supabase
        .from('delay_permissions')
        .insert(insertData)
        .select()
        .single();

      if (insertError) {
        console.error('Insert error:', insertError);
        throw new Error(insertError.message || (language === 'ar' ? 'فشل إضافة الطلب' : 'Failed to insert permission'));
      }

      console.log('Permission inserted successfully (admin):', insertedData);

      setSuccessMessage(language === 'ar' ? 'تم إنشاء إذن التأخير بنجاح' : 'Delay permission created successfully');

      // Reset form
      setFormData({
        employee_id: '',
        date: new Date().toISOString().split('T')[0],
        start_time: '09:00',
        end_time: '09:30',
        reason: ''
      });

      // Refresh permissions list
      await fetchPermissions();
      setActiveTab('history');

      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (error: any) {
      console.error('Error creating delay permission:', error);
      setErrorMessage(error.message || (language === 'ar' ? 'حدث خطأ أثناء إنشاء إذن التأخير' : 'Error creating delay permission'));
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(id: string) {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('delay_permissions')
        .update({
          status: 'approved',
          decided_by: user?.id || null,
          decided_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      setSuccessMessage(language === 'ar' ? 'تم الموافقة على الطلب' : 'Request approved');
      fetchPermissions();

      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (error) {
      console.error('Error approving permission:', error);
      setErrorMessage(language === 'ar' ? 'حدث خطأ أثناء الموافقة' : 'Error approving request');
    } finally {
      setLoading(false);
    }
  }

  async function handleReject(id: string) {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('delay_permissions')
        .update({
          status: 'rejected',
          decided_by: user?.id || null,
          decided_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      setSuccessMessage(language === 'ar' ? 'تم رفض الطلب' : 'Request rejected');
      fetchPermissions();

      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (error) {
      console.error('Error rejecting permission:', error);
      setErrorMessage(language === 'ar' ? 'حدث خطأ أثناء الرفض' : 'Error rejecting request');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm(language === 'ar' ? 'هل أنت متأكد من حذف هذا الإذن؟' : 'Are you sure you want to delete this permission?')) {
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('delay_permissions')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setSuccessMessage(language === 'ar' ? 'تم حذف الإذن بنجاح' : 'Permission deleted successfully');
      fetchPermissions();

      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (error) {
      console.error('Error deleting permission:', error);
      setErrorMessage(language === 'ar' ? 'حدث خطأ أثناء الحذف' : 'Error deleting permission');
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  if (!settings?.delay_permission_enabled) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl max-w-md w-full p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800">
              {language === 'ar' ? 'إذن التأخير' : 'Delay Permission'}
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="text-center py-8">
            <AlertCircle className="w-16 h-16 text-orange-500 mx-auto mb-4" />
            <p className="text-gray-600">
              {language === 'ar'
                ? 'ميزة إذن التأخير غير مفعلة. يرجى تفعيلها من إعدادات الرواتب.'
                : 'Delay permission feature is not enabled. Please enable it in payroll settings.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full my-8">
        <div className="sticky top-0 bg-white border-b p-6 rounded-t-2xl z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">
                {language === 'ar' ? 'إذن التأخير' : 'Delay Permission'}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {language === 'ar'
                  ? 'إدارة أذونات التأخير للموظفين'
                  : 'Manage employee delay permissions'}
              </p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setActiveTab('new')}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                activeTab === 'new'
                  ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Clock className="w-4 h-4" />
                <span>{language === 'ar' ? 'إذن جديد' : 'New Permission'}</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                activeTab === 'history'
                  ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <FileText className="w-4 h-4" />
                <span>{language === 'ar' ? 'السجل' : 'History'}</span>
              </div>
            </button>
          </div>
        </div>

        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {successMessage && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {activeTab === 'new' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {language === 'ar' ? 'الموظف' : 'Employee'} *
                </label>
                <select
                  value={formData.employee_id}
                  onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">
                    {language === 'ar' ? 'اختر موظف' : 'Select Employee'}
                  </option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name} - {emp.employee_code}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {language === 'ar' ? 'التاريخ' : 'Date'} *
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {language === 'ar' ? 'من الساعة' : 'Start Time'} *
                  </label>
                  <input
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {language === 'ar' ? 'إلى الساعة' : 'End Time'} *
                  </label>
                  <input
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              {calculatedMinutes > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">
                      {language === 'ar' ? 'المدة الإجمالية:' : 'Total Duration:'}
                    </span>
                    <span className="text-lg font-bold text-blue-700">
                      {formatMinutesToHours(calculatedMinutes)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    ({calculatedMinutes} {language === 'ar' ? 'دقيقة' : 'minutes'})
                  </div>
                </div>
              )}

              {validationError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-red-700">{validationError}</span>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {language === 'ar' ? 'السبب' : 'Reason'} ({language === 'ar' ? 'اختياري' : 'Optional'})
                </label>
                <textarea
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder={language === 'ar' ? 'سبب التأخير...' : 'Reason for delay...'}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={loading || !!validationError || calculatedMinutes <= 0}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
                >
                  {loading
                    ? (language === 'ar' ? 'جاري الإرسال...' : 'Submitting...')
                    : (language === 'ar' ? 'إرسال الطلب' : 'Submit Request')}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-3 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'history' && (
            <div className="space-y-3">
              {permissions.length === 0 ? (
                <div className="text-center py-12">
                  <Clock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">
                    {language === 'ar' ? 'لا توجد أذونات تأخير' : 'No delay permissions found'}
                  </p>
                </div>
              ) : (
                permissions.map((permission) => (
                  <div
                    key={permission.id}
                    className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="font-semibold text-gray-800">
                          {permission.employees?.full_name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {permission.employees?.employee_code}
                        </div>
                      </div>
                      <div
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          permission.status === 'approved'
                            ? 'bg-green-100 text-green-700'
                            : permission.status === 'rejected'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {permission.status === 'approved'
                          ? (language === 'ar' ? 'معتمد' : 'Approved')
                          : permission.status === 'rejected'
                          ? (language === 'ar' ? 'مرفوض' : 'Rejected')
                          : (language === 'ar' ? 'معلق' : 'Pending')}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-600">
                          {new Date(permission.date).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-600">
                          {permission.start_time} - {permission.end_time}
                        </span>
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-2 text-sm mb-3">
                      <span className="text-gray-600">
                        {language === 'ar' ? 'المدة: ' : 'Duration: '}
                      </span>
                      <span className="font-semibold text-gray-800">
                        {formatMinutesToHours(permission.minutes)}
                      </span>
                      <span className="text-gray-500 text-xs">
                        {' '}({permission.minutes} {language === 'ar' ? 'دقيقة' : 'minutes'})
                      </span>
                    </div>

                    {permission.reason && (
                      <div className="text-sm text-gray-600 mb-3 p-2 bg-gray-50 rounded">
                        <span className="font-medium">{language === 'ar' ? 'السبب: ' : 'Reason: '}</span>
                        {permission.reason}
                      </div>
                    )}

                    {permission.status === 'pending' && (
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => handleApprove(permission.id)}
                          disabled={loading}
                          className="flex-1 bg-green-600 text-white py-2 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors text-sm"
                        >
                          <div className="flex items-center justify-center gap-1">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>{language === 'ar' ? 'موافقة' : 'Approve'}</span>
                          </div>
                        </button>
                        <button
                          onClick={() => handleReject(permission.id)}
                          disabled={loading}
                          className="flex-1 bg-red-600 text-white py-2 rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors text-sm"
                        >
                          <div className="flex items-center justify-center gap-1">
                            <XCircle className="w-4 h-4" />
                            <span>{language === 'ar' ? 'رفض' : 'Reject'}</span>
                          </div>
                        </button>
                        <button
                          onClick={() => handleDelete(permission.id)}
                          disabled={loading}
                          className="px-4 bg-gray-600 text-white py-2 rounded-lg font-semibold hover:bg-gray-700 disabled:opacity-50 transition-colors text-sm"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {permission.status !== 'pending' && (
                      <button
                        onClick={() => handleDelete(permission.id)}
                        disabled={loading}
                        className="w-full bg-gray-100 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-200 disabled:opacity-50 transition-colors text-sm mt-2"
                      >
                        {language === 'ar' ? 'حذف' : 'Delete'}
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
