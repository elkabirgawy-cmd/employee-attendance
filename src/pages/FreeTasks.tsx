import { useState, useEffect } from 'react';
import { Briefcase, Clock, Plus, X, FileText } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface FreeTasksProps {
  currentPage?: string;
}

interface FreeTask {
  id: string;
  company_id: string;
  employee_id: string;
  start_at: string;
  end_at: string;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  employee?: {
    full_name: string;
    employee_code: string;
  };
}

interface Employee {
  id: string;
  full_name: string;
  employee_code: string;
}

export default function FreeTasks({ currentPage }: FreeTasksProps) {
  const { companyId } = useAuth();

  const [freeTasks, setFreeTasks] = useState<FreeTask[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [newFreeTask, setNewFreeTask] = useState({
    employee_id: '',
    start_at: '',
    end_at: '',
    notes: ''
  });
  const [savingFreeTask, setSavingFreeTask] = useState(false);
  const [loadingFreeTasks, setLoadingFreeTasks] = useState(false);

  useEffect(() => {
    if (currentPage === 'free-tasks' && companyId) {
      fetchFreeTasks();
      fetchEmployees();
    }
  }, [currentPage, companyId]);

  async function fetchFreeTasks() {
    if (!companyId) return;

    try {
      setLoadingFreeTasks(true);
      const { data, error } = await supabase
        .from('free_tasks')
        .select(`
          *,
          employee:employees(full_name, employee_code)
        `)
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFreeTasks(data || []);
    } catch (error: any) {
      console.error('Error fetching free tasks:', error);
    } finally {
      setLoadingFreeTasks(false);
    }
  }

  async function fetchEmployees() {
    if (!companyId) return;

    try {
      const { data, error } = await supabase
        .from('employees')
        .select('id, full_name, employee_code')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('full_name');

      if (error) throw error;
      setEmployees(data || []);
    } catch (error: any) {
      console.error('Error fetching employees:', error);
    }
  }

  async function handleCreateFreeTask() {
    if (!companyId || !user?.id) {
      alert('خطأ: لا يمكن تحديد معرف الشركة أو المستخدم');
      return;
    }

    if (!newFreeTask.employee_id || !newFreeTask.start_at || !newFreeTask.end_at) {
      alert('خطأ: يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    const startDate = new Date(newFreeTask.start_at);
    const endDate = new Date(newFreeTask.end_at);

    if (endDate <= startDate) {
      alert('خطأ: تاريخ الانتهاء يجب أن يكون بعد تاريخ البداية');
      return;
    }

    try {
      setSavingFreeTask(true);

      const { error } = await supabase
        .from('free_tasks')
        .insert({
          company_id: companyId,
          employee_id: newFreeTask.employee_id,
          start_at: newFreeTask.start_at,
          end_at: newFreeTask.end_at,
          notes: newFreeTask.notes || null,
          is_active: true,
          created_by: user.id
        });

      if (error) throw error;

      alert('✓ تم إنشاء مهمة حرة بنجاح');

      setNewFreeTask({
        employee_id: '',
        start_at: '',
        end_at: '',
        notes: ''
      });

      await fetchFreeTasks();
    } catch (error: any) {
      console.error('Error creating free task:', error);
      alert('خطأ: ' + error.message);
    } finally {
      setSavingFreeTask(false);
    }
  }

  async function handleDeactivateFreeTask(taskId: string) {
    if (!confirm('هل أنت متأكد من تعطيل هذه المهمة الحرة؟')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('free_tasks')
        .update({ is_active: false })
        .eq('id', taskId)
        .eq('company_id', companyId);

      if (error) throw error;

      alert('✓ تم تعطيل المهمة الحرة بنجاح');
      await fetchFreeTasks();
    } catch (error: any) {
      console.error('Error deactivating free task:', error);
      alert('خطأ: ' + error.message);
    }
  }

  if (currentPage !== 'free-tasks') return null;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">المهام الحرة</h1>
        <p className="text-slate-600">إدارة المهام الحرة للموظفين</p>
      </div>

      <div className="space-y-6">
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Briefcase className="text-orange-600 mt-0.5 flex-shrink-0" size={18} />
            <div className="text-xs text-orange-700">
              <p className="font-semibold mb-1">ما هي المهمة الحرة؟</p>
              <p className="mb-2">المهمة الحرة تسمح للموظف بتسجيل الحضور والانصراف <strong>بدون التقيد بموقع الفرع</strong></p>
              <ul className="list-disc mr-4 space-y-0.5">
                <li>يتم تسجيل الموقع (GPS) لكل تسجيل</li>
                <li>جميع فحوصات الأمان تبقى فعالة (GPS وهمي، التلاعب بالوقت، إلخ)</li>
                <li><strong>لا يتم تطبيق الانصراف التلقائي</strong> على المهام الحرة</li>
                <li>مناسبة للمهام الخارجية أو الزيارات الميدانية</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Plus size={18} />
            إنشاء مهمة حرة جديدة
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                الموظف <span className="text-red-500">*</span>
              </label>
              <select
                value={newFreeTask.employee_id}
                onChange={(e) => setNewFreeTask({ ...newFreeTask, employee_id: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
              >
                <option value="">اختر موظف...</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name} ({emp.employee_code})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  تاريخ ووقت البداية <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={newFreeTask.start_at}
                  onChange={(e) => setNewFreeTask({ ...newFreeTask, start_at: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  تاريخ ووقت الانتهاء <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={newFreeTask.end_at}
                  onChange={(e) => setNewFreeTask({ ...newFreeTask, end_at: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                ملاحظات
              </label>
              <textarea
                value={newFreeTask.notes}
                onChange={(e) => setNewFreeTask({ ...newFreeTask, notes: e.target.value })}
                placeholder="مثال: زيارة عميل، مهمة ميدانية، إلخ..."
                rows={3}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none resize-none"
              />
            </div>

            <button
              onClick={handleCreateFreeTask}
              disabled={savingFreeTask}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus size={18} />
              <span>{savingFreeTask ? 'جاري الحفظ...' : 'إنشاء مهمة حرة'}</span>
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <FileText size={18} />
            المهام الحرة النشطة
          </h3>

          {loadingFreeTasks ? (
            <div className="text-center py-8 text-slate-500">جاري التحميل...</div>
          ) : freeTasks.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              لا توجد مهام حرة نشطة حالياً
            </div>
          ) : (
            <div className="space-y-3">
              {freeTasks.map(task => (
                <div
                  key={task.id}
                  className="flex items-start justify-between p-4 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold text-slate-800">
                        {task.employee?.full_name || 'موظف'}
                      </span>
                      <span className="text-sm text-slate-500">
                        ({task.employee?.employee_code})
                      </span>
                    </div>
                    <div className="text-sm text-slate-600 space-y-1">
                      <div className="flex items-center gap-2">
                        <Clock size={14} />
                        <span>
                          من: {new Date(task.start_at).toLocaleString('ar-SA')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock size={14} />
                        <span>
                          إلى: {new Date(task.end_at).toLocaleString('ar-SA')}
                        </span>
                      </div>
                      {task.notes && (
                        <div className="mt-2 text-xs text-slate-500 bg-white p-2 rounded border border-slate-200">
                          {task.notes}
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeactivateFreeTask(task.id)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 text-sm font-medium rounded-lg transition"
                    title="تعطيل المهمة"
                  >
                    <X size={16} />
                    تعطيل
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
