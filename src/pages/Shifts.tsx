import { useEffect, useState } from 'react';
import { Clock, Plus, Edit2, Trash2, Save, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import AdminPageLayout from '../components/admin/AdminPageLayout';
import AdminPageHeader from '../components/admin/AdminPageHeader';
import AdminCard from '../components/admin/AdminCard';
import { useAdminTheme } from '../contexts/AdminThemeContext';

interface ShiftsProps {
  currentPage?: string;
}

interface Shift {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  is_active: boolean;
  created_at: string;
}

export default function Shifts({ currentPage }: ShiftsProps) {
  const { t } = useLanguage();
  const { companyId } = useAuth();
  const theme = useAdminTheme();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    start_time: '',
    end_time: '',
  });

  useEffect(() => {
    if (currentPage === 'shifts') {
      fetchShifts();
    }
  }, [currentPage]);

  async function fetchShifts() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('shifts')
        .select('*')
        .order('start_time');

      if (error) throw error;
      setShifts(data || []);
    } catch (error) {
      console.error('Error fetching shifts:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      if (editingShift) {
        const { error } = await supabase
          .from('shifts')
          .update({
            name: formData.name,
            start_time: formData.start_time,
            end_time: formData.end_time,
          })
          .eq('id', editingShift.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('shifts')
          .insert([{
            name: formData.name,
            start_time: formData.start_time,
            end_time: formData.end_time,
            is_active: true,
            company_id: companyId,
          }]);

        if (error) throw error;
      }

      setShowAddModal(false);
      setEditingShift(null);
      setFormData({ name: '', start_time: '', end_time: '' });
      fetchShifts();
    } catch (error) {
      console.error('Error saving shift:', error);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(t('shifts.deleteConfirm'))) return;

    try {
      const { error } = await supabase
        .from('shifts')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchShifts();
    } catch (error) {
      console.error('Error deleting shift:', error);
    }
  }

  function handleEdit(shift: Shift) {
    setEditingShift(shift);
    setFormData({
      name: shift.name,
      start_time: shift.start_time,
      end_time: shift.end_time,
    });
    setShowAddModal(true);
  }

  function handleCloseModal() {
    setShowAddModal(false);
    setEditingShift(null);
    setFormData({ name: '', start_time: '', end_time: '' });
  }

  function formatTime(time: string) {
    return time.substring(0, 5);
  }

  if (currentPage !== 'shifts') return null;

  return (
    <AdminPageLayout>
      <AdminPageHeader
        title={t('shifts.title')}
        subtitle={t('shifts.currentShift')}
        actions={
          <button
            onClick={() => setShowAddModal(true)}
            className={theme.button.primary}
          >
            <Plus size={20} />
            {t('shifts.addShift')}
          </button>
        }
      />

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl p-6 border border-slate-200 animate-pulse">
              <div className="h-6 bg-slate-200 rounded mb-4" />
              <div className="h-4 bg-slate-200 rounded mb-2" />
              <div className="h-4 bg-slate-200 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : shifts.length === 0 ? (
        <AdminCard className="text-center py-12">
          <Clock className="mx-auto text-slate-300 mb-4" size={64} />
          <h3 className="text-xl font-semibold text-slate-700 mb-2">{t('shifts.noShifts')}</h3>
          <p className="text-slate-500 mb-6">{t('shifts.addShift')}</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition"
          >
            <Plus size={20} />
            {t('shifts.addShift')}
          </button>
        </AdminCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {shifts.map((shift) => (
            <AdminCard
              key={shift.id}
              className="hover:shadow-lg transition"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-100 p-3 rounded-lg">
                    <Clock className="text-blue-600" size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">{shift.name}</h3>
                    <span
                      className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${shift.is_active
                        ? 'bg-green-100 text-green-700'
                        : 'bg-slate-100 text-slate-600'
                        }`}
                    >
                      {shift.is_active ? t('common.active') : t('common.inactive')}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-3 mb-4">
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <span className="text-sm font-medium text-slate-600">{t('shifts.startTime')}</span>
                  <span className="text-lg font-bold text-slate-800">{formatTime(shift.start_time)}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <span className="text-sm font-medium text-slate-600">{t('shifts.endTime')}</span>
                  <span className="text-lg font-bold text-slate-800">{formatTime(shift.end_time)}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(shift)}
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-600 px-4 py-2 rounded-lg font-medium transition"
                >
                  <Edit2 size={16} />
                  {t('common.edit')}
                </button>
                <button
                  onClick={() => handleDelete(shift.id)}
                  className="flex-1 flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-lg font-medium transition"
                >
                  <Trash2 size={16} />
                  {t('common.delete')}
                </button>
              </div>
            </AdminCard>
          ))}
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 flex items-center justify-between rounded-t-2xl">
              <div className="flex items-center gap-3">
                <Clock size={28} />
                <h2 className="text-2xl font-bold">
                  {editingShift ? t('shifts.editShift') : t('shifts.addShift')}
                </h2>
              </div>
              <button
                onClick={handleCloseModal}
                className="hover:bg-white/20 rounded-full p-2 transition"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {t('shifts.shiftName')}
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {t('shifts.startTime')}
                </label>
                <input
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {t('shifts.endTime')}
                </label>
                <input
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg font-medium transition"
                >
                  <Save size={20} />
                  {t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminPageLayout>
  );
}
