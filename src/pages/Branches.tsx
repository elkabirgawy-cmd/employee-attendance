import { useEffect, useState } from 'react';
import { MapPin, Plus, Edit2, Trash2, Radio, X, Navigation, Map, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import AdminPageShell from '../components/admin-ui/AdminPageShell';
import AdminCard from '../components/admin-ui/AdminCard';
import AdminToolbar from '../components/admin-ui/AdminToolbar';
import AdminModal from '../components/admin/AdminModal';
import { useAdminTheme } from '../contexts/AdminThemeContext';

interface BranchesProps {
  currentPage?: string;
  onNavigate?: (page: string, params?: Record<string, any>) => void;
}

interface Branch {
  id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  geofence_radius: number;
  timezone: string;
  is_active: boolean;
  created_at: string;
  employee_count?: number;
}

interface BranchFormData {
  name: string;
  address: string;
  latitude: string;
  longitude: string;
  geofence_radius: string;
  timezone: string;
  is_active: boolean;
}

const TIMEZONES = [
  { value: 'Asia/Riyadh', label: 'آسيا/الرياض (UTC+3)' },
  { value: 'Asia/Dubai', label: 'آسيا/دبي (UTC+4)' },
  { value: 'Asia/Kuwait', label: 'آسيا/الكويت (UTC+3)' },
  { value: 'Asia/Bahrain', label: 'آسيا/البحرين (UTC+3)' },
  { value: 'Asia/Qatar', label: 'آسيا/قطر (UTC+3)' },
  { value: 'Asia/Muscat', label: 'آسيا/مسقط (UTC+4)' },
  { value: 'Asia/Baghdad', label: 'آسيا/بغداد (UTC+3)' },
  { value: 'Asia/Beirut', label: 'آسيا/بيروت (UTC+2)' },
  { value: 'Asia/Damascus', label: 'آسيا/دمشق (UTC+2)' },
  { value: 'Asia/Amman', label: 'آسيا/عمان (UTC+2)' },
  { value: 'Asia/Jerusalem', label: 'آسيا/القدس (UTC+2)' },
  { value: 'Africa/Cairo', label: 'أفريقيا/القاهرة (UTC+2)' },
  { value: 'Africa/Casablanca', label: 'أفريقيا/الدار البيضاء (UTC+1)' },
  { value: 'Africa/Algiers', label: 'أفريقيا/الجزائر (UTC+1)' },
  { value: 'Africa/Tunis', label: 'أفريقيا/تونس (UTC+1)' },
  { value: 'Africa/Tripoli', label: 'أفريقيا/طرابلس (UTC+2)' },
  { value: 'Africa/Khartoum', label: 'أفريقيا/الخرطوم (UTC+2)' },
  { value: 'Asia/Tehran', label: 'آسيا/طهران (UTC+3:30)' },
  { value: 'Asia/Istanbul', label: 'آسيا/إسطنبول (UTC+3)' },
  { value: 'Asia/Karachi', label: 'آسيا/كراتشي (UTC+5)' },
  { value: 'Asia/Kolkata', label: 'آسيا/كولكاتا (UTC+5:30)' },
  { value: 'Asia/Dhaka', label: 'آسيا/دكا (UTC+6)' },
  { value: 'Asia/Bangkok', label: 'آسيا/بانكوك (UTC+7)' },
  { value: 'Asia/Singapore', label: 'آسيا/سنغافورة (UTC+8)' },
  { value: 'Asia/Hong_Kong', label: 'آسيا/هونغ كونغ (UTC+8)' },
  { value: 'Asia/Shanghai', label: 'آسيا/شنغهاي (UTC+8)' },
  { value: 'Asia/Tokyo', label: 'آسيا/طوكيو (UTC+9)' },
  { value: 'Asia/Seoul', label: 'آسيا/سيول (UTC+9)' },
  { value: 'Australia/Sydney', label: 'أستراليا/سيدني (UTC+10)' },
  { value: 'Pacific/Auckland', label: 'المحيط الهادئ/أوكلاند (UTC+12)' },
  { value: 'Europe/London', label: 'أوروبا/لندن (UTC+0)' },
  { value: 'Europe/Paris', label: 'أوروبا/باريس (UTC+1)' },
  { value: 'Europe/Berlin', label: 'أوروبا/برلين (UTC+1)' },
  { value: 'Europe/Rome', label: 'أوروبا/روما (UTC+1)' },
  { value: 'Europe/Madrid', label: 'أوروبا/مدريد (UTC+1)' },
  { value: 'Europe/Athens', label: 'أوروبا/أثينا (UTC+2)' },
  { value: 'Europe/Moscow', label: 'أوروبا/موسكو (UTC+3)' },
  { value: 'America/New_York', label: 'أمريكا/نيويورك (UTC-5)' },
  { value: 'America/Chicago', label: 'أمريكا/شيكاغو (UTC-6)' },
  { value: 'America/Denver', label: 'أمريكا/دنفر (UTC-7)' },
  { value: 'America/Los_Angeles', label: 'أمريكا/لوس أنجلوس (UTC-8)' },
  { value: 'America/Toronto', label: 'أمريكا/تورنتو (UTC-5)' },
  { value: 'America/Mexico_City', label: 'أمريكا/مكسيكو سيتي (UTC-6)' },
  { value: 'America/Sao_Paulo', label: 'أمريكا/ساو باولو (UTC-3)' },
  { value: 'America/Buenos_Aires', label: 'أمريكا/بوينس آيرس (UTC-3)' },
];

export default function Branches({ currentPage, onNavigate }: BranchesProps) {
  const { companyId } = useAuth();
  const theme = useAdminTheme();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [showTimezoneDropdown, setShowTimezoneDropdown] = useState(false);
  const [timezoneSearch, setTimezoneSearch] = useState('');
  const [formData, setFormData] = useState<BranchFormData>({
    name: '',
    address: '',
    latitude: '',
    longitude: '',
    geofence_radius: '100',
    timezone: 'Asia/Riyadh',
    is_active: true,
  });

  useEffect(() => {
    if (currentPage === 'branches') {
      fetchBranches();

      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('openAddModal') === 'true') {
        setShowModal(true);
        urlParams.delete('openAddModal');
        window.history.replaceState({}, '', `${window.location.pathname}${urlParams.toString() ? '?' + urlParams.toString() : ''}`);
      }
    }
  }, [currentPage]);

  const filteredTimezones = TIMEZONES.filter(tz =>
    tz.label.includes(timezoneSearch) ||
    tz.value.toLowerCase().includes(timezoneSearch.toLowerCase())
  );

  const getTimezoneLabel = (value: string) => {
    const tz = TIMEZONES.find(t => t.value === value);
    return tz ? tz.label : value;
  };

  async function fetchBranches() {
    try {
      setLoading(true);
      const { data: branchesData, error } = await supabase
        .from('branches')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const branchesWithCount = await Promise.all(
        (branchesData || []).map(async (branch) => {
          const { count } = await supabase
            .from('employees')
            .select('*', { count: 'exact', head: true })
            .eq('branch_id', branch.id)
            .eq('is_active', true);

          return {
            ...branch,
            employee_count: count || 0,
          };
        })
      );

      setBranches(branchesWithCount);
    } catch (error) {
      console.error('Error fetching branches:', error);
      alert('فشل تحميل الفروع');
    } finally {
      setLoading(false);
    }
  }

  function openAddModal() {
    setEditingBranch(null);
    setFormData({
      name: '',
      address: '',
      latitude: '',
      longitude: '',
      geofence_radius: '100',
      timezone: 'Asia/Riyadh',
      is_active: true,
    });
    setTimezoneSearch('');
    setShowTimezoneDropdown(false);
    setShowModal(true);
  }

  function openEditModal(branch: Branch) {
    setEditingBranch(branch);
    setFormData({
      name: branch.name,
      address: branch.address || '',
      latitude: branch.latitude.toString(),
      longitude: branch.longitude.toString(),
      geofence_radius: branch.geofence_radius.toString(),
      timezone: branch.timezone,
      is_active: branch.is_active,
    });
    setTimezoneSearch('');
    setShowTimezoneDropdown(false);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingBranch(null);
    setTimezoneSearch('');
    setShowTimezoneDropdown(false);
  }

  async function detectTimezone(latitude: number, longitude: number) {
    try {
      const response = await fetch(
        `https://timeapi.io/api/TimeZone/coordinate?latitude=${latitude}&longitude=${longitude}`
      );

      if (response.ok) {
        const data = await response.json();
        if (data.timeZone) {
          const matchedTimezone = TIMEZONES.find(tz => tz.value === data.timeZone);
          if (matchedTimezone) {
            setFormData(prev => ({
              ...prev,
              timezone: matchedTimezone.value
            }));
          }
        }
      }
    } catch (error) {
      console.error('Error detecting timezone:', error);
    }
  }

  function getCurrentLocation() {
    if (!navigator.geolocation) {
      alert('المتصفح لا يدعم تحديد الموقع الجغرافي');
      return;
    }

    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        setFormData({
          ...formData,
          latitude: lat.toFixed(6),
          longitude: lng.toFixed(6),
        });

        await detectTimezone(lat, lng);
        setGettingLocation(false);
        alert('تم تحديد الموقع والمنطقة الزمنية بنجاح!');
      },
      (error) => {
        setGettingLocation(false);
        let message = 'فشل تحديد الموقع';
        if (error.code === error.PERMISSION_DENIED) {
          message = 'يرجى السماح بالوصول إلى الموقع من إعدادات المتصفح';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          message = 'الموقع غير متاح حالياً';
        } else if (error.code === error.TIMEOUT) {
          message = 'انتهت مهلة تحديد الموقع';
        }
        alert(message);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  }

  function openGoogleMaps() {
    const lat = formData.latitude || '24.774265';
    const lng = formData.longitude || '46.738586';
    const mapsUrl = `https://www.google.com/maps/@${lat},${lng},15z`;
    window.open(mapsUrl, '_blank');
  }

  function useGoogleMapsLocation() {
    const input = prompt(
      'الصق رابط خرائط جوجل أو أدخل الإحداثيات بالشكل التالي:\n24.774265, 46.738586'
    );

    if (!input) return;

    try {
      let lat: number | null = null;
      let lng: number | null = null;

      if (input.includes('google.com/maps')) {
        const match = input.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (match) {
          lat = parseFloat(match[1]);
          lng = parseFloat(match[2]);
        }
      } else {
        const coords = input.split(',').map(s => s.trim());
        if (coords.length === 2) {
          lat = parseFloat(coords[0]);
          lng = parseFloat(coords[1]);
        }
      }

      if (lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng)) {
        setFormData({
          ...formData,
          latitude: lat.toFixed(6),
          longitude: lng.toFixed(6),
        });
        alert('تم تحديد الموقع بنجاح!');
      } else {
        alert('صيغة غير صحيحة. يرجى المحاولة مرة أخرى');
      }
    } catch (error) {
      alert('فشل استخراج الإحداثيات. تأكد من صحة الرابط أو الصيغة');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    try {
      const branchData = {
        name: formData.name.trim(),
        address: formData.address.trim() || null,
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
        geofence_radius: parseInt(formData.geofence_radius),
        timezone: formData.timezone,
        is_active: formData.is_active,
      };

      if (editingBranch) {
        const { error } = await supabase
          .from('branches')
          .update(branchData)
          .eq('id', editingBranch.id);

        if (error) throw error;
        alert('تم تحديث الفرع بنجاح');
      } else {
        const { error } = await supabase
          .from('branches')
          .insert([{ ...branchData, company_id: companyId }]);

        if (error) throw error;
        alert('تم إنشاء الفرع بنجاح');
      }

      closeModal();
      fetchBranches();
    } catch (error: any) {
      console.error('Error saving branch:', error);
      alert(error.message || 'فشل حفظ الفرع');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(branch: Branch) {
    if (!confirm(`هل أنت متأكد من حذف "${branch.name}"؟`)) {
      return;
    }

    try {
      const { count: employeeCount } = await supabase
        .from('employees')
        .select('*', { count: 'exact', head: true })
        .eq('branch_id', branch.id);

      const { count: attendanceCount } = await supabase
        .from('attendance_logs')
        .select('*', { count: 'exact', head: true })
        .eq('branch_id', branch.id);

      if ((employeeCount ?? 0) > 0 || (attendanceCount ?? 0) > 0) {
        alert(
          `لا يمكن حذف هذا الفرع لأنه مرتبط بـ:\n` +
          `- ${employeeCount ?? 0} موظف\n` +
          `- ${attendanceCount ?? 0} سجل حضور\n\n` +
          `يرجى نقل الموظفين والسجلات أولاً أو تعطيل الفرع بدلاً من حذفه`
        );
        return;
      }

      const { error } = await supabase
        .from('branches')
        .delete()
        .eq('id', branch.id);

      if (error) throw error;
      alert('تم حذف الفرع بنجاح');
      fetchBranches();
    } catch (error: any) {
      console.error('Error deleting branch:', error);
      alert(error.message || 'فشل حذف الفرع');
    }
  }

  if (currentPage !== 'branches') return null;

  return (
    <AdminPageShell
      title="إدارة الفروع"
      subtitle="إدارة مواقع العمل وإعدادات السياج الجغرافي"
      actions={
        <button
          onClick={openAddModal}
          className={theme.button.primary}
        >
          <Plus size={20} />
          إضافة فرع
        </button>
      }
    >

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <div key={i} className="animate-pulse bg-white rounded-xl p-6 border border-slate-200">
              <div className="h-6 bg-slate-200 rounded mb-4 w-1/2" />
              <div className="h-4 bg-slate-200 rounded mb-2" />
              <div className="h-4 bg-slate-200 rounded mb-2 w-3/4" />
            </div>
          ))}
        </div>
      ) : branches.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <MapPin className="mx-auto text-slate-400 mb-3" size={48} />
          <p className="text-slate-600 font-medium mb-1">لا توجد فروع</p>
          <p className="text-sm text-slate-500 mb-4">ابدأ بإضافة أول فرع لديك</p>
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition"
          >
            <Plus size={18} />
            إضافة أول فرع
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {branches.map((branch) => (
            <AdminCard
              key={branch.id}
              className="hover:shadow-lg transition"
              header={
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                      <MapPin className="text-green-600" size={24} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-800">{branch.name}</h3>
                      <p className="text-sm text-slate-500">{branch.address || 'لا يوجد عنوان'}</p>
                    </div>
                  </div>
                  {branch.is_active ? (
                    <span className="px-2.5 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                      نشط
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded">
                      غير نشط
                    </span>
                  )}
                </div>
              }
              footer={
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditModal(branch)}
                    className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-blue-50 hover:bg-blue-100 text-blue-600 font-medium rounded-lg transition"
                  >
                    <Edit2 size={16} />
                    تعديل
                  </button>
                  <button
                    onClick={() => handleDelete(branch)}
                    className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-red-50 hover:bg-red-100 text-red-600 font-medium rounded-lg transition"
                  >
                    <Trash2 size={16} />
                    حذف
                  </button>
                </div>
              }
            >
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Users className="text-green-500" size={16} />
                  <span className="text-slate-500 font-medium">عدد الموظفين:</span>
                  <span className="text-slate-700 font-bold">{branch.employee_count || 0} موظف</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-slate-500 font-medium">الإحداثيات:</span>
                  <span className="text-slate-700">
                    {branch.latitude.toFixed(6)}, {branch.longitude.toFixed(6)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Radio className="text-blue-500" size={16} />
                  <span className="text-slate-500 font-medium">نطاق السياج:</span>
                  <span className="text-slate-700 font-medium">{branch.geofence_radius} متر</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-slate-500 font-medium">المنطقة الزمنية:</span>
                  <span className="text-slate-700">{branch.timezone}</span>
                </div>
              </div>
            </AdminCard>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center overflow-y-auto z-50" onClick={closeModal}>
          <div className="bg-white rounded-xl max-w-2xl w-full m-4 my-8" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10 rounded-t-xl">
              <h2 className="text-2xl font-bold text-slate-800">
                {editingBranch ? 'تعديل الفرع' : 'إضافة فرع جديد'}
              </h2>
              <button
                onClick={closeModal}
                type="button"
                className="p-2 hover:bg-slate-100 rounded-lg transition"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col max-h-[calc(90vh-80px)]">
              <div className="p-6 space-y-5 overflow-y-auto flex-1">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    اسم الفرع *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="المكتب الرئيسي"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    العنوان
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="شارع الملك فهد، الرياض"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-3">
                    تحديد الموقع الجغرافي *
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                    <button
                      type="button"
                      onClick={getCurrentLocation}
                      disabled={gettingLocation}
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition"
                    >
                      <Navigation size={18} />
                      {gettingLocation ? 'جاري التحديد...' : 'موقعي الحالي (GPS)'}
                    </button>
                    <button
                      type="button"
                      onClick={useGoogleMapsLocation}
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition"
                    >
                      <Map size={18} />
                      من خرائط جوجل
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      خط العرض (Latitude) *
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={formData.latitude}
                      onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="24.774265"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      خط الطول (Longitude) *
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={formData.longitude}
                      onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="46.738586"
                    />
                  </div>
                </div>

                {formData.latitude && formData.longitude && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <button
                      type="button"
                      onClick={openGoogleMaps}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2"
                    >
                      <Map size={16} />
                      عرض الموقع على خرائط جوجل
                    </button>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    نطاق السياج الجغرافي (متر) *
                  </label>
                  <input
                    type="number"
                    required
                    min="10"
                    max="5000"
                    value={formData.geofence_radius}
                    onChange={(e) => setFormData({ ...formData, geofence_radius: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                  <p className="mt-1 text-xs text-slate-500">النطاق: 10 - 5000 متر</p>
                </div>

                <div className="relative">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-slate-700">
                      المنطقة الزمنية *
                    </label>
                    {formData.latitude && formData.longitude && (
                      <button
                        type="button"
                        onClick={() => detectTimezone(parseFloat(formData.latitude), parseFloat(formData.longitude))}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                      >
                        <Radio size={14} />
                        تحديد تلقائياً
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    required
                    value={timezoneSearch || getTimezoneLabel(formData.timezone)}
                    onChange={(e) => {
                      setTimezoneSearch(e.target.value);
                      setShowTimezoneDropdown(true);
                    }}
                    onFocus={() => setShowTimezoneDropdown(true)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="ابحث عن المنطقة الزمنية..."
                    autoComplete="off"
                  />
                  {showTimezoneDropdown && filteredTimezones.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                      {filteredTimezones.map((tz) => (
                        <button
                          key={tz.value}
                          type="button"
                          onClick={() => {
                            setFormData({ ...formData, timezone: tz.value });
                            setTimezoneSearch('');
                            setShowTimezoneDropdown(false);
                          }}
                          className={`w-full text-right px-4 py-2.5 hover:bg-green-50 transition-colors ${formData.timezone === tz.value ? 'bg-green-100 font-medium' : ''
                            }`}
                        >
                          {tz.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {showTimezoneDropdown && (
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => {
                        setShowTimezoneDropdown(false);
                        setTimezoneSearch('');
                      }}
                    />
                  )}
                  <p className="mt-1 text-xs text-slate-500">
                    {formData.timezone ? `المحدد: ${getTimezoneLabel(formData.timezone)}` : 'ابحث واختر المنطقة الزمنية'}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                  />
                  <label htmlFor="is_active" className="text-sm font-medium text-slate-700">
                    فرع نشط
                  </label>
                </div>
              </div>

              <div className="p-6 border-t border-slate-200 bg-slate-50 rounded-b-xl flex items-center gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={submitting}
                  className="flex-1 py-2.5 px-4 border border-slate-300 bg-white text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition disabled:opacity-50"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition disabled:opacity-50"
                >
                  {submitting ? 'جاري الحفظ...' : editingBranch ? 'تحديث الفرع' : 'إنشاء الفرع'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminPageShell>
  );
}
