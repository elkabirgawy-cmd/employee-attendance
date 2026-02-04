import { useEffect, useState } from 'react';
import { AlertTriangle, Shield, MapPin, Smartphone, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';

interface FraudAlertsProps {
  currentPage?: string;
}

interface FraudAlert {
  id: string;
  alert_type: string;
  severity: string;
  description: string;
  is_resolved: boolean;
  created_at: string;
  employees: {
    full_name: string;
    employee_code: string;
  };
}

export default function FraudAlerts({ currentPage }: FraudAlertsProps) {
  const { t } = useLanguage();
  const [alerts, setAlerts] = useState<FraudAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unresolved' | 'resolved'>('unresolved');

  useEffect(() => {
    if (currentPage === 'fraud') {
      fetchAlerts();
    }
  }, [currentPage, filter]);

  async function fetchAlerts() {
    try {
      setLoading(true);
      let query = supabase
        .from('fraud_alerts')
        .select(`
          *,
          employees (full_name, employee_code)
        `)
        .order('created_at', { ascending: false });

      if (filter === 'unresolved') {
        query = query.eq('is_resolved', false);
      } else if (filter === 'resolved') {
        query = query.eq('is_resolved', true);
      }

      const { data, error } = await query;
      if (error) throw error;
      setAlerts(data || []);
    } catch (error) {
      console.error('Error fetching fraud alerts:', error);
    } finally {
      setLoading(false);
    }
  }

  function getSeverityColor(severity: string) {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      default:
        return 'bg-blue-100 text-blue-700 border-blue-200';
    }
  }

  function getAlertIcon(type: string) {
    switch (type) {
      case 'fake_gps':
        return <MapPin size={20} />;
      case 'rooted_device':
        return <Shield size={20} />;
      case 'poor_gps_accuracy':
        return <MapPin size={20} />;
      default:
        return <Smartphone size={20} />;
    }
  }

  function getAlertLabel(type: string) {
    switch (type) {
      case 'fake_gps':
        return t('fraudAlerts.fakeGPS');
      case 'rooted_device':
        return t('fraudAlerts.rootedDevice');
      case 'out_of_range':
        return t('fraudAlerts.outOfRange');
      case 'poor_gps_accuracy':
        return t('fraudAlerts.poorGPSAccuracy');
      case 'time_manipulation':
        return t('fraudAlerts.timeManipulation');
      default:
        return t('fraudAlerts.suspiciousActivity');
    }
  }

  if (currentPage !== 'fraud') return null;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">{t('fraudAlerts.title')}</h1>
          <p className="text-slate-600">{t('fraudAlerts.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {t('fraudAlerts.all')}
          </button>
          <button
            onClick={() => setFilter('unresolved')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filter === 'unresolved'
                ? 'bg-red-600 text-white'
                : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {t('fraudAlerts.unresolved')}
          </button>
          <button
            onClick={() => setFilter('resolved')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filter === 'resolved'
                ? 'bg-green-600 text-white'
                : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {t('fraudAlerts.resolved')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <p className="text-sm text-slate-600 mb-1">{t('fraudAlerts.totalAlerts')}</p>
          <p className="text-2xl font-bold text-slate-800">{alerts.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-red-200 bg-red-50">
          <p className="text-sm text-red-600 mb-1">{t('fraudAlerts.critical')}</p>
          <p className="text-2xl font-bold text-red-700">
            {alerts.filter((a) => a.severity === 'critical').length}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-orange-200 bg-orange-50">
          <p className="text-sm text-orange-600 mb-1">{t('fraudAlerts.highPriority')}</p>
          <p className="text-2xl font-bold text-orange-700">
            {alerts.filter((a) => a.severity === 'high').length}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-green-200 bg-green-50">
          <p className="text-sm text-green-600 mb-1">{t('fraudAlerts.resolved')}</p>
          <p className="text-2xl font-bold text-green-700">
            {alerts.filter((a) => a.is_resolved).length}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse bg-slate-100 h-24 rounded-lg" />
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-12">
            <Shield className="mx-auto text-green-500 mb-3" size={48} />
            <p className="text-slate-600 font-medium mb-1">{t('fraudAlerts.noAlerts')}</p>
            <p className="text-sm text-slate-500">{t('fraudAlerts.noAlertsDesc')}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {alerts.map((alert) => (
              <div key={alert.id} className="p-6 hover:bg-slate-50 transition">
                <div className="flex items-start gap-4">
                  <div
                    className={`w-12 h-12 rounded-lg flex items-center justify-center ${getSeverityColor(
                      alert.severity
                    )} border`}
                  >
                    {getAlertIcon(alert.alert_type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-bold text-slate-800 mb-1">
                          {getAlertLabel(alert.alert_type)}
                        </h3>
                        <p className="text-sm text-slate-600">{alert.description}</p>
                      </div>
                      <span
                        className={`px-3 py-1 text-xs font-medium rounded-full ${getSeverityColor(
                          alert.severity
                        )}`}
                      >
                        {alert.severity.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-500">
                      <span>
                        {t('fraudAlerts.employee')}: <strong>{alert.employees.full_name}</strong> (
                        {alert.employees.employee_code})
                      </span>
                      <span>•</span>
                      <span>{new Date(alert.created_at).toLocaleString()}</span>
                      {alert.is_resolved && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1 text-green-600 font-medium">
                            <CheckCircle size={14} />
                            {t('fraudAlerts.resolved')}
                          </span>
                        </>
                      )}
                    </div>
                    {!alert.is_resolved && (
                      <div className="flex gap-2 mt-4">
                        <button className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition">
                          {t('fraudAlerts.markResolved')}
                        </button>
                        <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition">
                          {t('fraudAlerts.viewDetails')}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
