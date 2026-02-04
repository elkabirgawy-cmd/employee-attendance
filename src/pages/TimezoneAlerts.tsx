import { useEffect, useState } from 'react';
import { AlertTriangle, MapPin, Clock, CheckCircle, XCircle, User } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface TimezoneAlert {
  id: string;
  employee_id: string;
  attendance_log_id: string | null;
  resolved_timezone: string;
  device_timezone: string;
  gps_latitude: number;
  gps_longitude: number;
  time_difference_minutes: number;
  severity: string;
  is_resolved: boolean;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  created_at: string;
  employees?: {
    full_name: string;
    employee_code: string;
  };
}

interface TimezoneAlertsProps {
  currentPage?: string;
}

export default function TimezoneAlerts({ currentPage }: TimezoneAlertsProps) {
  const [alerts, setAlerts] = useState<TimezoneAlert[]>([]);
  const [activeTab, setActiveTab] = useState<'pending' | 'resolved'>('pending');
  const [loading, setLoading] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');

  useEffect(() => {
    if (currentPage === 'timezone-alerts') {
      fetchAlerts();
    }
  }, [currentPage, activeTab]);

  async function fetchAlerts() {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('timezone_alerts')
        .select(`
          *,
          employees(full_name, employee_code)
        `)
        .eq('is_resolved', activeTab === 'resolved')
        .order('created_at', { ascending: false });

      if (data) {
        setAlerts(data);
      }
    } catch (error) {
      console.error('Error fetching timezone alerts:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleResolve(alertId: string) {
    try {
      const { data: userData } = await supabase.auth.getUser();

      await supabase
        .from('timezone_alerts')
        .update({
          is_resolved: true,
          resolved_by: userData?.user?.id,
          resolved_at: new Date().toISOString(),
          resolution_notes: resolutionNotes || null,
        })
        .eq('id', alertId);

      alert('تم حل التنبيه بنجاح');
      setSelectedAlert(null);
      setResolutionNotes('');
      fetchAlerts();
    } catch (error: any) {
      alert('خطأ في حل التنبيه: ' + error.message);
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300' };
      case 'warning':
        return { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' };
      default:
        return { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' };
    }
  };

  if (currentPage !== 'timezone-alerts') return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50" dir="rtl">
      <div className="max-w-7xl mx-auto p-6">
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl">
              <AlertTriangle className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-800">تنبيهات المنطقة الزمنية</h1>
              <p className="text-gray-600">مراقبة حالات عدم تطابق المناطق الزمنية</p>
            </div>
          </div>

          <div className="flex gap-2 mb-6 border-b">
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-6 py-3 font-semibold transition-all ${
                activeTab === 'pending'
                  ? 'border-b-2 border-orange-600 text-orange-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <AlertTriangle className="w-5 h-5 inline ml-2" />
              قيد المراجعة ({alerts.filter(a => !a.is_resolved).length})
            </button>
            <button
              onClick={() => setActiveTab('resolved')}
              className={`px-6 py-3 font-semibold transition-all ${
                activeTab === 'resolved'
                  ? 'border-b-2 border-green-600 text-green-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <CheckCircle className="w-5 h-5 inline ml-2" />
              تم الحل ({alerts.filter(a => a.is_resolved).length})
            </button>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 border-4 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-600">جاري التحميل...</p>
            </div>
          ) : alerts.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <AlertTriangle className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>لا توجد تنبيهات في هذا القسم</p>
            </div>
          ) : (
            <div className="space-y-4">
              {alerts.map(alert => {
                const colors = getSeverityColor(alert.severity);
                return (
                  <div
                    key={alert.id}
                    className={`bg-white border-2 rounded-xl p-6 hover:shadow-lg transition-shadow ${colors.border}`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                            <User className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-gray-800">
                              {alert.employees?.full_name}
                            </h3>
                            <p className="text-sm text-gray-500">
                              {alert.employees?.employee_code}
                            </p>
                          </div>
                          <div className={`px-3 py-1 rounded-full text-sm font-bold ${colors.bg} ${colors.text}`}>
                            {alert.severity === 'critical' ? 'حرج' : alert.severity === 'warning' ? 'تحذير' : 'معلومة'}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div className="bg-gray-50 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <MapPin className="w-4 h-4 text-blue-600" />
                              <span className="text-sm font-semibold text-gray-700">المنطقة الزمنية من GPS</span>
                            </div>
                            <p className="text-sm text-gray-800 font-mono">{alert.resolved_timezone}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              الإحداثيات: {alert.gps_latitude.toFixed(4)}, {alert.gps_longitude.toFixed(4)}
                            </p>
                          </div>

                          <div className="bg-gray-50 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <Clock className="w-4 h-4 text-orange-600" />
                              <span className="text-sm font-semibold text-gray-700">منطقة الجهاز</span>
                            </div>
                            <p className="text-sm text-gray-800 font-mono">{alert.device_timezone}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              فرق الوقت: {alert.time_difference_minutes} دقيقة
                            </p>
                          </div>
                        </div>

                        {alert.time_difference_minutes >= 60 && (
                          <div className={`p-3 rounded-lg mb-3 ${colors.bg}`}>
                            <div className="flex items-start gap-2">
                              <AlertTriangle className={`w-5 h-5 ${colors.text} flex-shrink-0 mt-0.5`} />
                              <div>
                                <p className={`font-bold text-sm ${colors.text}`}>
                                  فرق زمني كبير!
                                </p>
                                <p className={`text-sm ${colors.text}`}>
                                  هناك فرق {Math.floor(alert.time_difference_minutes / 60)} ساعة و {alert.time_difference_minutes % 60} دقيقة بين المنطقة الزمنية للجهاز والموقع الفعلي.
                                  قد يشير هذا إلى محاولة تزوير الموقع أو تغيير إعدادات الجهاز.
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {alert.resolution_notes && (
                          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3">
                            <p className="font-bold text-green-800 text-sm mb-1">ملاحظات الحل:</p>
                            <p className="text-sm text-green-700">{alert.resolution_notes}</p>
                          </div>
                        )}

                        <div className="text-xs text-gray-500">
                          تاريخ التنبيه: {new Date(alert.created_at).toLocaleString('ar-SA')}
                          {alert.resolved_at && (
                            <span className="mr-4">
                              تاريخ الحل: {new Date(alert.resolved_at).toLocaleString('ar-SA')}
                            </span>
                          )}
                        </div>
                      </div>

                      {!alert.is_resolved && (
                        <div className="mr-4">
                          <button
                            onClick={() => {
                              if (selectedAlert === alert.id) {
                                setSelectedAlert(null);
                                setResolutionNotes('');
                              } else {
                                setSelectedAlert(alert.id);
                                setResolutionNotes('');
                              }
                            }}
                            className="px-6 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center gap-2"
                          >
                            <CheckCircle className="w-5 h-5" />
                            حل التنبيه
                          </button>
                        </div>
                      )}
                    </div>

                    {selectedAlert === alert.id && (
                      <div className="mt-4 pt-4 border-t">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          ملاحظات الحل (اختياري)
                        </label>
                        <textarea
                          value={resolutionNotes}
                          onChange={(e) => setResolutionNotes(e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                          rows={3}
                          placeholder="اكتب ملاحظات حول كيفية حل هذا التنبيه..."
                        />
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => handleResolve(alert.id)}
                            className="px-6 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700"
                          >
                            تأكيد الحل
                          </button>
                          <button
                            onClick={() => {
                              setSelectedAlert(null);
                              setResolutionNotes('');
                            }}
                            className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-400"
                          >
                            إلغاء
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
