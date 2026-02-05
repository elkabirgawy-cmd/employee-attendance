import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, X, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import AdminPageLayout from '../components/admin/AdminPageLayout';
import AdminPageHeader from '../components/admin/AdminPageHeader';
import AdminCard from '../components/admin/AdminCard';
import { adminTheme } from '@/lib/adminTheme';

interface DepartmentsProps {
  currentPage?: string;
}

interface Department {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export default function Departments({ currentPage }: DepartmentsProps) {
  const { language } = useLanguage();
  const { companyId } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [departmentToDelete, setDepartmentToDelete] = useState<{ id: string; name: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [departmentName, setDepartmentName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (currentPage === 'departments') {
      fetchDepartments();
    }
  }, [currentPage]);

  async function fetchDepartments() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .order('name');

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const { error } = await supabase
        .from('departments')
        .insert({ name: departmentName.trim(), company_id: companyId });

      if (error) {
        if (error.code === '23505') {
          setError(language === 'ar' ? 'اسم القسم موجود بالفعل' : 'Department name already exists');
        } else {
          throw error;
        }
        return;
      }

      setShowAddModal(false);
      setDepartmentName('');
      fetchDepartments();
    } catch (error: any) {
      console.error('Error adding department:', error);
      setError(error.message || 'Failed to add department');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editingDepartment) return;

    setSubmitting(true);
    setError('');

    try {
      const { error } = await supabase
        .from('departments')
        .update({ name: departmentName.trim() })
        .eq('id', editingDepartment.id);

      if (error) {
        if (error.code === '23505') {
          setError(language === 'ar' ? 'اسم القسم موجود بالفعل' : 'Department name already exists');
        } else {
          throw error;
        }
        return;
      }

      setShowEditModal(false);
      setEditingDepartment(null);
      setDepartmentName('');
      fetchDepartments();
    } catch (error: any) {
      console.error('Error updating department:', error);
      setError(error.message || 'Failed to update department');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!departmentToDelete) return;

    setSubmitting(true);
    setError('');

    try {
      const { error } = await supabase
        .from('departments')
        .delete()
        .eq('id', departmentToDelete.id);

      if (error) {
        if (error.code === '23503') {
          setError(language === 'ar'
            ? 'لا يمكن حذف القسم لأنه مرتبط بموظفين'
            : 'Cannot delete department because it has employees');
        } else {
          throw error;
        }
        return;
      }

      setShowDeleteModal(false);
      setDepartmentToDelete(null);
      fetchDepartments();
    } catch (error: any) {
      console.error('Error deleting department:', error);
      setError(error.message || 'Failed to delete department');
    } finally {
      setSubmitting(false);
    }
  }

  function openEditModal(department: Department) {
    setEditingDepartment(department);
    setDepartmentName(department.name);
    setError('');
    setShowEditModal(true);
  }

  function openDeleteModal(department: Department) {
    setDepartmentToDelete({ id: department.id, name: department.name });
    setError('');
    setShowDeleteModal(true);
  }

  function openAddModal() {
    setDepartmentName('');
    setError('');
    setShowAddModal(true);
  }

  if (currentPage !== 'departments') return null;

  return (
    <AdminPageLayout>
      <AdminPageHeader
        title={language === 'ar' ? 'الأقسام' : 'Departments'}
        subtitle={language === 'ar' ? 'إدارة أقسام المؤسسة' : 'Manage organization departments'}
        actions={
          <button
            onClick={openAddModal}
            className={adminTheme.button.primary}
          >
            <Plus size={20} />
            {language === 'ar' ? 'إضافة قسم' : 'Add Department'}
          </button>
        }
      />

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : departments.length === 0 ? (
        <AdminCard className="text-center py-12">
          <p className="text-slate-600">
            {language === 'ar' ? 'لا توجد أقسام بعد' : 'No departments yet'}
          </p>
        </AdminCard>
      ) : (
        <AdminCard className="overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">
                  {language === 'ar' ? 'اسم القسم' : 'Department Name'}
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">
                  {language === 'ar' ? 'تاريخ الإنشاء' : 'Created At'}
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">
                  {language === 'ar' ? 'الإجراءات' : 'Actions'}
                </th>
              </tr>
            </thead>
            <tbody>
              {departments.map((department) => (
                <tr key={department.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-4 px-4">
                    <p className="text-sm font-medium text-slate-800">{department.name}</p>
                  </td>
                  <td className="py-4 px-4">
                    <p className="text-sm text-slate-600">
                      {new Date(department.created_at).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US')}
                    </p>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditModal(department)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => openDeleteModal(department)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminCard>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full" dir={language === 'ar' ? 'rtl' : 'ltr'}>
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-800">
                {language === 'ar' ? 'إضافة قسم جديد' : 'Add New Department'}
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition"
              >
                <X size={24} className="text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleAdd} className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {language === 'ar' ? 'اسم القسم' : 'Department Name'} *
                </label>
                <input
                  type="text"
                  required
                  value={departmentName}
                  onChange={(e) => setDepartmentName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder={language === 'ar' ? 'أدخل اسم القسم' : 'Enter department name'}
                />
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-5 py-2.5 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition"
                >
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (language === 'ar' ? 'جاري الإضافة...' : 'Adding...') : (language === 'ar' ? 'إضافة' : 'Add')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && editingDepartment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full" dir={language === 'ar' ? 'rtl' : 'ltr'}>
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-800">
                {language === 'ar' ? 'تعديل القسم' : 'Edit Department'}
              </h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingDepartment(null);
                }}
                className="p-2 hover:bg-slate-100 rounded-lg transition"
              >
                <X size={24} className="text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleUpdate} className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {language === 'ar' ? 'اسم القسم' : 'Department Name'} *
                </label>
                <input
                  type="text"
                  required
                  value={departmentName}
                  onChange={(e) => setDepartmentName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingDepartment(null);
                  }}
                  className="px-5 py-2.5 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition"
                >
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (language === 'ar' ? 'جاري التحديث...' : 'Updating...') : (language === 'ar' ? 'تحديث' : 'Update')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteModal && departmentToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">
                {language === 'ar' ? 'حذف القسم' : 'Delete Department'}
              </h2>
              <p className="text-slate-600">
                {language === 'ar'
                  ? `هل أنت متأكد من حذف القسم "${departmentToDelete.name}"؟`
                  : `Are you sure you want to delete "${departmentToDelete.name}"?`}
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDepartmentToDelete(null);
                }}
                className="flex-1 px-5 py-2.5 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition"
              >
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={handleDelete}
                disabled={submitting}
                className="flex-1 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (language === 'ar' ? 'جاري الحذف...' : 'Deleting...') : (language === 'ar' ? 'حذف' : 'Delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminPageLayout>
  );
}
