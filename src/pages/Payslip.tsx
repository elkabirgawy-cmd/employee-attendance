import { useEffect, useState } from 'react';
import { DollarSign, Calendar, TrendingUp, TrendingDown, FileText, Download } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface PayrollRun {
  id: string;
  period_month: number;
  period_year: number;
  salary_mode: string;
  base_salary: number;
  allowances: number;
  overtime_hours: number;
  overtime_amount: number;
  present_days: number;
  late_days: number;
  absence_days: number;
  absence_deduction: number;
  lateness_deduction: number;
  penalties_deduction: number;
  social_insurance: number;
  income_tax: number;
  other_deductions: number;
  gross_salary: number;
  total_deductions: number;
  net_salary: number;
  calculation_metadata: {
    dailyRate: number;
    latenessBreakdown: Array<{
      date: string;
      lateMinutes: number;
      deduction: number;
      slabApplied: string;
    }>;
    penaltiesBreakdown: Array<{
      reason: string;
      type: string;
      value: number;
      deduction: number;
    }>;
  };
  created_at: string;
}

interface Employee {
  id: string;
  full_name: string;
  employee_code: string;
}

export default function Payslip() {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [payrolls, setPayrolls] = useState<PayrollRun[]>([]);
  const [selectedPayroll, setSelectedPayroll] = useState<PayrollRun | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEmployeeData();
  }, []);

  async function fetchEmployeeData() {
    try {
      const sessionToken = localStorage.getItem('employee_session_token');
      if (!sessionToken) return;

      const { data: sessionData } = await supabase
        .from('employee_sessions')
        .select('employee_id')
        .eq('session_token', sessionToken)
        .eq('is_active', true)
        .single();

      if (!sessionData) return;

      const { data: empData } = await supabase
        .from('employees')
        .select('id, full_name, employee_code')
        .eq('id', sessionData.employee_id)
        .single();

      if (empData) {
        setEmployee(empData);
        fetchPayrolls(empData.id);
      }
    } catch (error) {
      console.error('Error fetching employee:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchPayrolls(employeeId: string) {
    const { data } = await supabase
      .from('payroll_runs')
      .select('*')
      .eq('employee_id', employeeId)
      .order('period_year', { ascending: false })
      .order('period_month', { ascending: false });

    if (data) {
      setPayrolls(data);
      if (data.length > 0) {
        setSelectedPayroll(data[0]);
      }
    }
  }

  const monthNames = [
    'يناير', 'فبراير', 'مارس', 'إبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-xl text-gray-600">جاري التحميل...</div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-xl text-gray-600">الرجاء تسجيل الدخول</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50" dir="rtl">
      <div className="max-w-5xl mx-auto p-6">
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl">
              <DollarSign className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-800">كشف الراتب</h1>
              <p className="text-gray-600">{employee.full_name} ({employee.employee_code})</p>
            </div>
          </div>

          {payrolls.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>لا توجد كشوف رواتب متاحة</p>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">اختر الشهر</label>
                <select
                  value={selectedPayroll?.id || ''}
                  onChange={(e) => {
                    const payroll = payrolls.find(p => p.id === e.target.value);
                    setSelectedPayroll(payroll || null);
                  }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  {payrolls.map(payroll => (
                    <option key={payroll.id} value={payroll.id}>
                      {monthNames[payroll.period_month - 1]} {payroll.period_year}
                    </option>
                  ))}
                </select>
              </div>

              {selectedPayroll && (
                <div className="space-y-6">
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <Calendar className="w-6 h-6 text-green-600" />
                        <h2 className="text-xl font-bold text-gray-800">
                          {monthNames[selectedPayroll.period_month - 1]} {selectedPayroll.period_year}
                        </h2>
                      </div>
                      <div className="text-sm text-gray-600">
                        نظام: {selectedPayroll.salary_mode === 'monthly' ? 'شهري' : 'يومي'}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">أيام الحضور:</span>
                        <span className="font-bold text-gray-800 mr-2">{selectedPayroll.present_days} يوم</span>
                      </div>
                      <div>
                        <span className="text-gray-600">أيام التأخير:</span>
                        <span className="font-bold text-orange-600 mr-2">{selectedPayroll.late_days} يوم</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border rounded-xl p-6">
                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-green-600" />
                      الاستحقاقات
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-700">
                          {selectedPayroll.salary_mode === 'monthly' ? 'الأساسي' : `الأجر اليومي × ${selectedPayroll.present_days} يوم`}
                        </span>
                        <span className="font-bold text-green-600">{selectedPayroll.base_salary.toFixed(2)} ريال</span>
                      </div>
                      {selectedPayroll.allowances > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-700">البدلات</span>
                          <span className="font-bold text-green-600">{selectedPayroll.allowances.toFixed(2)} ريال</span>
                        </div>
                      )}
                      {selectedPayroll.overtime_amount > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-700">العمل الإضافي ({selectedPayroll.overtime_hours} ساعة)</span>
                          <span className="font-bold text-green-600">{selectedPayroll.overtime_amount.toFixed(2)} ريال</span>
                        </div>
                      )}
                      <div className="pt-3 border-t flex justify-between items-center">
                        <span className="font-bold text-gray-800">إجمالي الاستحقاقات</span>
                        <span className="font-bold text-green-600 text-xl">{selectedPayroll.gross_salary.toFixed(2)} ريال</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border rounded-xl p-6">
                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <TrendingDown className="w-5 h-5 text-red-600" />
                      الخصومات
                    </h3>
                    <div className="space-y-3">
                      {selectedPayroll.absence_deduction > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-700">الغياب ({selectedPayroll.absence_days} يوم)</span>
                          <span className="font-bold text-red-600">-{selectedPayroll.absence_deduction.toFixed(2)} ريال</span>
                        </div>
                      )}
                      {selectedPayroll.lateness_deduction > 0 && (
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-gray-700">خصم التأخير</span>
                            <span className="font-bold text-red-600">-{selectedPayroll.lateness_deduction.toFixed(2)} ريال</span>
                          </div>
                          {selectedPayroll.calculation_metadata?.latenessBreakdown && selectedPayroll.calculation_metadata.latenessBreakdown.length > 0 && (
                            <div className="mr-4 space-y-1 text-sm">
                              {selectedPayroll.calculation_metadata.latenessBreakdown.map((item, idx) => (
                                <div key={idx} className="flex justify-between text-gray-600">
                                  <span>{item.date}: {item.lateMinutes} دقيقة</span>
                                  <span>-{item.deduction.toFixed(2)} ريال</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      {selectedPayroll.penalties_deduction > 0 && (
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-gray-700">الجزاءات</span>
                            <span className="font-bold text-red-600">-{selectedPayroll.penalties_deduction.toFixed(2)} ريال</span>
                          </div>
                          {selectedPayroll.calculation_metadata?.penaltiesBreakdown && selectedPayroll.calculation_metadata.penaltiesBreakdown.length > 0 && (
                            <div className="mr-4 space-y-1 text-sm">
                              {selectedPayroll.calculation_metadata.penaltiesBreakdown.map((item, idx) => (
                                <div key={idx} className="text-gray-600">
                                  <div className="font-medium">{item.reason}</div>
                                  <div className="flex justify-between">
                                    <span>
                                      {item.type === 'fixed' ? 'مبلغ ثابت' :
                                       item.type === 'days' ? `${item.value} أيام` :
                                       `${item.value * 100}% من الأجر`}
                                    </span>
                                    <span>-{item.deduction.toFixed(2)} ريال</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      {selectedPayroll.social_insurance > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-700">التأمينات الاجتماعية</span>
                          <span className="font-bold text-red-600">-{selectedPayroll.social_insurance.toFixed(2)} ريال</span>
                        </div>
                      )}
                      {selectedPayroll.income_tax > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-700">ضريبة الدخل</span>
                          <span className="font-bold text-red-600">-{selectedPayroll.income_tax.toFixed(2)} ريال</span>
                        </div>
                      )}
                      {selectedPayroll.other_deductions > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-700">خصومات أخرى</span>
                          <span className="font-bold text-red-600">-{selectedPayroll.other_deductions.toFixed(2)} ريال</span>
                        </div>
                      )}
                      <div className="pt-3 border-t flex justify-between items-center">
                        <span className="font-bold text-gray-800">إجمالي الخصومات</span>
                        <span className="font-bold text-red-600 text-xl">-{selectedPayroll.total_deductions.toFixed(2)} ريال</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-6 text-white">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="text-blue-100 mb-1">صافي الراتب</div>
                        <div className="text-4xl font-bold">{selectedPayroll.net_salary.toFixed(2)} ريال</div>
                      </div>
                      <DollarSign className="w-16 h-16 opacity-50" />
                    </div>
                    {selectedPayroll.calculation_metadata?.dailyRate && (
                      <div className="mt-4 pt-4 border-t border-blue-500 text-sm text-blue-100">
                        الأجر اليومي: {selectedPayroll.calculation_metadata.dailyRate.toFixed(2)} ريال
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
