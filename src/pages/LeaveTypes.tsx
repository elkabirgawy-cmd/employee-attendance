import { useEffect, useState } from 'react';
import { Plus, Edit2, Save, X, Trash2, AlertCircle, CheckCircle, GripVertical } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface LeaveType {
  id: string;
  name: string;
  name_ar: string;
  name_en: string | null;
  is_paid: boolean;
  default_days_per_year: number;
  color: string;
  is_active: boolean;
  sort_order: number;
}

interface LeaveTypesProps {
  currentPage?: string;
}

export default function LeaveTypes({ currentPage }: LeaveTypesProps) {
  const { companyId } = useAuth();
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    name_ar: '',
    name_en: '',
    is_paid: true,
    default_days_per_year: 21,
    color: '#3b82f6',
    is_active: true
  });

  useEffect(() => {
    fetchLeaveTypes();
  }, []);

  async function fetchLeaveTypes() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('leave_types')
        .select('*')
        .order('sort_order');

      if (error) throw error;
      setLeaveTypes(data || []);
    } catch (err: any) {
      setError('خطأ في تحميل أنواع الإجازات: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    if (!formData.name_ar.trim()) {
      setError('يرجى إدخال الاسم بالعربية');
      return;
    }

    if (!companyId) {
      setError('خطأ: لم يتم العثور على معرف الشركة');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const maxSortOrder = Math.max(...leaveTypes.map(lt => lt.sort_order), 0);

      console.log('[LeaveTypes] Adding new leave type:', {
        name_ar: formData.name_ar,
        company_id: companyId
      });

      const { error, data } = await supabase
        .from('leave_types')
        .insert({
          company_id: companyId,
          name: formData.name_en || formData.name_ar,
          name_ar: formData.name_ar,
          name_en: formData.name_en || formData.name_ar,
          is_paid: formData.is_paid,
          default_days_per_year: formData.default_days_per_year,
          color: formData.color,
          is_active: formData.is_active,
          sort_order: maxSortOrder + 1
        })
        .select();

      if (error) {
        console.error('[LeaveTypes] Insert error:', error);
        throw error;
      }

      console.log('[LeaveTypes] Leave type added successfully:', data);

      setSuccess('تم إضافة نوع الإجازة بنجاح');
      setShowAddForm(false);
      setFormData({
        name_ar: '',
        name_en: '',
        is_paid: true,
        default_days_per_year: 21,
        color: '#3b82f6',
        is_active: true
      });
      fetchLeaveTypes();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError('خطأ في الإضافة: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(id: string, updates: Partial<LeaveType>) {
    setSaving(true);
    setError('');
    try {
      const updateData: any = {};

      if (updates.name_ar) updateData.name_ar = updates.name_ar;
      if (updates.name_en !== undefined) updateData.name_en = updates.name_en;
      if (updates.name_en !== undefined || updates.name_ar) {
        updateData.name = updates.name_en || updates.name_ar;
      }
      if (updates.is_paid !== undefined) updateData.is_paid = updates.is_paid;
      if (updates.default_days_per_year !== undefined) updateData.default_days_per_year = updates.default_days_per_year;
      if (updates.color) updateData.color = updates.color;
      if (updates.is_active !== undefined) updateData.is_active = updates.is_active;

      const { error } = await supabase
        .from('leave_types')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      setSuccess('تم التحديث بنجاح');
      setEditingId(null);
      fetchLeaveTypes();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError('خطأ في التحديث: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('هل أنت متأكد من حذف هذا النوع؟ سيتم حذف جميع الطلبات المرتبطة به.')) {
      return;
    }

    setSaving(true);
    setError('');
    try {
      const { error } = await supabase
        .from('leave_types')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setSuccess('تم الحذف بنجاح');
      fetchLeaveTypes();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError('خطأ في الحذف: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleReorder(id: string, direction: 'up' | 'down') {
    const currentIndex = leaveTypes.findIndex(lt => lt.id === id);
    if (
      (direction === 'up' && currentIndex === 0) ||
      (direction === 'down' && currentIndex === leaveTypes.length - 1)
    ) {
      return;
    }

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    const current = leaveTypes[currentIndex];
    const other = leaveTypes[newIndex];

    setSaving(true);
    try {
      await supabase
        .from('leave_types')
        .update({ sort_order: other.sort_order })
        .eq('id', current.id);

      await supabase
        .from('leave_types')
        .update({ sort_order: current.sort_order })
        .eq('id', other.id);

      fetchLeaveTypes();
    } catch (err: any) {
      setError('خطأ في إعادة الترتيب: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  if (currentPage !== 'leave-types') return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">أنواع الإجازات</h1>
          <p className="text-slate-600 mt-2">إدارة أنواع الإجازات المتاحة للموظفين</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition"
        >
          <Plus size={20} />
          <span>إضافة نوع جديد</span>
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
          <CheckCircle size={20} />
          <span>{success}</span>
        </div>
      )}

      {showAddForm && (
        <div className="mb-6 bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-800">إضافة نوع إجازة جديد</h2>
            <button
              onClick={() => setShowAddForm(false)}
              className="p-1 hover:bg-slate-100 rounded-lg transition"
            >
              <X size={20} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                الاسم بالعربية <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name_ar}
                onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="مثال: إجازة سنوية"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                الاسم بالإنجليزية
              </label>
              <input
                type="text"
                value={formData.name_en}
                onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="Annual Leave"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                عدد الأيام الافتراضية سنوياً
              </label>
              <input
                type="number"
                min="0"
                max="365"
                value={formData.default_days_per_year}
                onChange={(e) => setFormData({ ...formData, default_days_per_year: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                اللون
              </label>
              <input
                type="color"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="w-full h-10 px-1 py-1 border border-slate-300 rounded-lg cursor-pointer"
              />
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_paid}
                  onChange={(e) => setFormData({ ...formData, is_paid: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm text-slate-700">مدفوعة الأجر</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm text-slate-700">نشطة</span>
              </label>
            </div>
          </div>

          <div className="mt-4 flex gap-3">
            <button
              onClick={handleAdd}
              disabled={saving || !formData.name_ar.trim()}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save size={18} />
              <span>{saving ? 'جاري الحفظ...' : 'حفظ'}</span>
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-right text-sm font-semibold text-slate-700">الترتيب</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-slate-700">الاسم</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-slate-700">النوع</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-slate-700">الأيام السنوية</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-slate-700">الحالة</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-slate-700">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {leaveTypes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    لا توجد أنواع إجازات. اضغط "إضافة نوع جديد" لإنشاء واحد.
                  </td>
                </tr>
              ) : (
                leaveTypes.map((leaveType, index) => (
                  <tr key={leaveType.id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <GripVertical size={16} className="text-slate-400" />
                        <button
                          onClick={() => handleReorder(leaveType.id, 'up')}
                          disabled={index === 0 || saving}
                          className="text-slate-400 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          ▲
                        </button>
                        <button
                          onClick={() => handleReorder(leaveType.id, 'down')}
                          disabled={index === leaveTypes.length - 1 || saving}
                          className="text-slate-400 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          ▼
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {editingId === leaveType.id ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            defaultValue={leaveType.name_ar}
                            onBlur={(e) => handleUpdate(leaveType.id, { name_ar: e.target.value })}
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
                            placeholder="الاسم بالعربية"
                          />
                          <input
                            type="text"
                            defaultValue={leaveType.name_en || ''}
                            onBlur={(e) => handleUpdate(leaveType.id, { name_en: e.target.value })}
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
                            placeholder="الاسم بالإنجليزية"
                          />
                        </div>
                      ) : (
                        <div>
                          <div className="font-medium text-slate-800">{leaveType.name_ar}</div>
                          <div className="text-sm text-slate-500">{leaveType.name_en || leaveType.name}</div>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
                        style={{ backgroundColor: leaveType.color + '20', color: leaveType.color }}
                      >
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: leaveType.color }}></span>
                        {leaveType.is_paid ? 'مدفوعة' : 'غير مدفوعة'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {editingId === leaveType.id ? (
                        <input
                          type="number"
                          min="0"
                          max="365"
                          defaultValue={leaveType.default_days_per_year}
                          onBlur={(e) => handleUpdate(leaveType.id, { default_days_per_year: parseInt(e.target.value) || 0 })}
                          className="w-20 px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
                        />
                      ) : (
                        <span className="text-slate-700">{leaveType.default_days_per_year} يوم</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleUpdate(leaveType.id, { is_active: !leaveType.is_active })}
                        disabled={saving}
                        className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                          leaveType.is_active
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {leaveType.is_active ? 'نشط' : 'معطل'}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEditingId(editingId === leaveType.id ? null : leaveType.id)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="تعديل"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(leaveType.id)}
                          disabled={saving}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                          title="حذف"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-bold text-blue-900 mb-2">ملاحظات هامة:</h3>
        <ul className="text-sm text-blue-800 space-y-1 list-disc mr-5">
          <li>الأنواع المعطلة لن تظهر للموظفين عند طلب الإجازات</li>
          <li>يمكنك إعادة ترتيب الأنواع باستخدام الأسهم</li>
          <li>عند حذف نوع إجازة، سيتم حذف جميع الطلبات المرتبطة به</li>
          <li>الأيام الافتراضية السنوية هي الأيام التي يحصل عليها الموظف من هذا النوع سنوياً</li>
        </ul>
      </div>
    </div>
  );
}
