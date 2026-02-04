import { useEffect, useState, useCallback } from 'react';
import {
  Users,
  Clock,
  MapPin,
  AlertTriangle,
  UserCheck,
  UserPlus,
  CalendarClock,
  Building2,
  FileText,
  UserX
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import ServerTimeCard from '../components/ServerTimeCard';
import { OnboardingSetupCard } from '../components/OnboardingSetupCard';
import AbsentEmployeesModal from '../components/AbsentEmployeesModal';
import AnimatedNumber from '../components/AnimatedNumber';

interface DashboardProps {
  currentPage?: string;
  onNavigate?: (page: string, params?: Record<string, any>) => void;
}

interface Stats {
  totalEmployees: number;
  activeEmployees: number;
  totalBranches: number;
  todayAttendance: number;
  presentNow: number;
  absentToday: number;
  lateArrivals: number;
  fraudAlerts: number;
  lastCheckIn?: string;
}

export default function Dashboard({ currentPage, onNavigate }: DashboardProps) {
  const { language } = useLanguage();
  const { companyId } = useAuth();
  const [stats, setStats] = useState<Stats>({
    totalEmployees: 0,
    activeEmployees: 0,
    totalBranches: 0,
    todayAttendance: 0,
    presentNow: 0,
    absentToday: 0,
    lateArrivals: 0,
    fraudAlerts: 0,
  });
  const [loading, setLoading] = useState(true);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number>(0);
  const [showAbsentModal, setShowAbsentModal] = useState(false);
  const [dayStatus, setDayStatus] = useState<{
    status: 'WORKDAY' | 'OFFDAY';
    reason: string | null;
    detail: string | null;
  } | null>(null);

  const refreshDashboardStats = useCallback(async () => {
    if (!companyId) return;

    try {
      const now = new Date();
      const todayDate = now.toISOString().split('T')[0];
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();

      const [dayStatusRes, activeEmployeesRes, branchesRes, presentTodayRes, presentNowRes, absentTodayRes, lateRes, fraudRes, lastCheckInRes] = await Promise.all([
        supabase.rpc('get_today_status', { p_company_id: companyId, p_check_date: todayDate }),
        supabase
          .from('employees')
          .select('id', { count: 'exact', head: true })
          .eq('is_active', true),
        supabase.from('branches').select('id', { count: 'exact', head: true }),
        supabase.rpc('get_present_today_count', { p_day: todayDate, p_branch_id: null }),
        supabase.rpc('get_present_now_count', { p_day: todayDate, p_branch_id: null }),
        supabase.rpc('get_absent_today_count', { p_day: todayDate, p_company_id: companyId }),
        supabase
          .from('attendance_logs')
          .select('status, employees!inner(is_active)')
          .gte('check_in_time', startOfDay)
          .lte('check_in_time', endOfDay)
          .eq('status', 'late')
          .eq('employees.is_active', true),
        supabase
          .from('fraud_alerts')
          .select('id', { count: 'exact' })
          .eq('is_resolved', false),
        supabase
          .from('attendance_logs')
          .select('check_in_time')
          .gte('check_in_time', startOfDay)
          .lte('check_in_time', endOfDay)
          .order('check_in_time', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const presentTodayCount = presentTodayRes.data || 0;
      const presentNowCount = presentNowRes.data || 0;
      const absentTodayCount = absentTodayRes.data || 0;
      const lateCount = lateRes.data?.length || 0;

      const totalActive = activeEmployeesRes.count || 0;

      // Set day status
      if (dayStatusRes.data) {
        setDayStatus(dayStatusRes.data);
      }

      setStats({
        totalEmployees: totalActive,
        activeEmployees: totalActive,
        totalBranches: branchesRes.count || 0,
        todayAttendance: presentTodayCount,
        presentNow: presentNowCount,
        absentToday: absentTodayCount,
        lateArrivals: lateCount,
        fraudAlerts: fraudRes.count || 0,
        lastCheckIn: lastCheckInRes.data?.check_in_time,
      });

      setLastUpdate(0);
    } catch (error) {
      console.error('Error refreshing dashboard stats:', error);
    }
  }, [companyId]);

  useEffect(() => {
    if (currentPage === 'dashboard') {
      fetchDashboardStats();

      // Setup Realtime subscription for live updates
      const channel = supabase
        .channel('admin-dashboard-realtime')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'attendance_logs'
          },
          () => {
            refreshDashboardStats();
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'employees'
          },
          () => {
            refreshDashboardStats();
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'branches'
          },
          () => {
            refreshDashboardStats();
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'fraud_alerts'
          },
          () => {
            refreshDashboardStats();
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'leave_requests'
          },
          () => {
            refreshDashboardStats();
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'free_tasks'
          },
          () => {
            refreshDashboardStats();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [currentPage, refreshDashboardStats]);

  // Update "last updated" timer every second
  useEffect(() => {
    const timer = setInterval(() => {
      setLastUpdate((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  async function fetchDashboardStats() {
    setLoading(true);
    try {
      await refreshDashboardStats();
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleNavigate(page: string, params?: Record<string, any>) {
    console.log('🔵 Navigation clicked:', page, 'with params:', params);

    if (params?.openAddModal) {
      const urlParams = new URLSearchParams(window.location.search);
      urlParams.set('openAddModal', 'true');
      window.history.pushState({}, '', `${window.location.pathname}?${urlParams.toString()}`);
    }

    if (onNavigate) {
      onNavigate(page, params);
    }
  }

  function handleCardClick(page: string, cardName: string, cardId: string) {
    console.log('📊 Card clicked:', cardName, '-> Navigate to:', page);
    setSelectedCardId(cardId);

    const todayDate = new Date().toISOString().split('T')[0];

    if (cardId === 'absent') {
      setShowAbsentModal(true);
    } else if (cardId === 'present-now') {
      handleNavigate('attendance', {
        mode: 'present_now',
        day: todayDate,
        branchId: null
      });
    } else if (page === 'present-today') {
      handleNavigate('attendance', {
        mode: 'present_today',
        day: todayDate,
        branchId: null
      });
    } else {
      handleNavigate(page);
    }
  }

  if (currentPage !== 'dashboard') return null;

  // Format last check-in time
  const formatLastCheckIn = () => {
    if (!stats.lastCheckIn) return language === 'ar' ? 'لا يوجد' : 'None';
    const checkInTime = new Date(stats.lastCheckIn);
    const hours = checkInTime.getHours().toString().padStart(2, '0');
    const minutes = checkInTime.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  // Format last update time
  const formatLastUpdate = () => {
    if (lastUpdate === 0) return language === 'ar' ? 'الآن' : 'now';
    if (lastUpdate < 60) return language === 'ar' ? `منذ ${lastUpdate} ثانية` : `${lastUpdate}s ago`;
    const minutes = Math.floor(lastUpdate / 60);
    return language === 'ar' ? `منذ ${minutes} دقيقة` : `${minutes}m ago`;
  };

  const summaryCards = [
    {
      id: 'attendance',
      title: language === 'ar' ? 'الحضور اليوم' : 'Attendance Today',
      value: stats.todayAttendance,
      subtitle: language === 'ar' ? `آخر تسجيل: ${formatLastCheckIn()}` : `Last: ${formatLastCheckIn()}`,
      icon: Clock,
      iconBg: 'bg-green-50',
      iconColor: 'text-green-600',
      borderColor: 'border-green-200',
      page: 'present-today',
    },
    {
      id: 'absent',
      title: language === 'ar' ? 'الغياب اليوم' : 'Absent Today',
      value: stats.absentToday,
      subtitle: dayStatus?.status === 'OFFDAY'
        ? language === 'ar' ? 'لا يُحسب الغياب في الإجازات' : 'No absences on off days'
        : language === 'ar' ? 'لم يسجل اليوم' : 'Not checked in',
      icon: UserX,
      iconBg: stats.absentToday === 0 ? 'bg-green-50' : 'bg-amber-50',
      iconColor: stats.absentToday === 0 ? 'text-green-600' : 'text-amber-600',
      borderColor: stats.absentToday === 0 ? 'border-green-200' : 'border-amber-200',
      page: 'attendance',
    },
    {
      id: 'present-now',
      title: language === 'ar' ? 'الحاضرون الآن' : 'Present Now',
      value: stats.presentNow,
      subtitle: language === 'ar' ? 'داخل نطاق العمل' : 'Inside Work Area',
      icon: UserCheck,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      borderColor: 'border-blue-200',
      page: 'attendance',
    },
    {
      id: 'employees',
      title: language === 'ar' ? 'إجمالي الموظفين' : 'Total Employees',
      value: stats.totalEmployees,
      subtitle: `${stats.activeEmployees} ${language === 'ar' ? 'نشط' : 'active'}`,
      icon: Users,
      iconBg: 'bg-purple-50',
      iconColor: 'text-purple-600',
      borderColor: 'border-purple-200',
      page: 'employees',
    },
    {
      id: 'branches',
      title: language === 'ar' ? 'الفروع النشطة' : 'Active Branches',
      value: stats.totalBranches,
      subtitle: language === 'ar' ? 'فرع مفعّل' : 'branches active',
      icon: MapPin,
      iconBg: 'bg-orange-50',
      iconColor: 'text-orange-600',
      borderColor: 'border-orange-200',
      page: 'branches',
    },
    {
      id: 'fraud',
      title: language === 'ar' ? 'تنبيهات الاحتيال' : 'Fraud Alerts',
      value: stats.fraudAlerts,
      subtitle: language === 'ar' ? 'قيد المراجعة' : 'pending review',
      icon: AlertTriangle,
      iconBg: stats.fraudAlerts === 0 ? 'bg-green-50' : 'bg-red-50',
      iconColor: stats.fraudAlerts === 0 ? 'text-green-600' : 'text-red-600',
      borderColor: stats.fraudAlerts === 0 ? 'border-green-200' : 'border-red-200',
      page: 'fraud',
    },
  ];

  const quickActions = [
    {
      id: 'add-employee',
      title: language === 'ar' ? 'إضافة موظف' : 'Add Employee',
      icon: UserPlus,
      page: 'employees',
      color: 'bg-blue-500 hover:bg-blue-600',
    },
    {
      id: 'add-shift',
      title: language === 'ar' ? 'إضافة وردية' : 'Add Shift',
      icon: CalendarClock,
      page: 'shifts',
      color: 'bg-purple-500 hover:bg-purple-600',
    },
    {
      id: 'add-branch',
      title: language === 'ar' ? 'إضافة فرع' : 'Add Branch',
      icon: Building2,
      page: 'branches',
      color: 'bg-orange-500 hover:bg-orange-600',
    },
    {
      id: 'daily-report',
      title: language === 'ar' ? 'تقرير اليوم' : 'Daily Report',
      icon: FileText,
      page: 'reports',
      color: 'bg-green-500 hover:bg-green-600',
    },
  ];

  return (
    <div className="min-h-full bg-slate-200 -m-4 p-4 lg:-m-6 lg:p-6 pb-24">
      {/* Server Time Card */}
      <ServerTimeCard />

      {/* Page Header */}
      <div className="mb-8 pt-2">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-slate-800 tracking-tight">
                {language === 'ar' ? 'لوحة التحكم' : 'Dashboard'}
              </h1>
              {dayStatus && (
                <span
                  className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border backdrop-blur-md shadow-sm ${dayStatus.status === 'OFFDAY'
                    ? 'bg-amber-50/80 text-amber-700 border-amber-200'
                    : 'bg-emerald-50/80 text-emerald-700 border-emerald-200'
                    }`}
                >
                  {dayStatus.status === 'OFFDAY'
                    ? (language === 'ar' ? 'إجازة' : 'OFF DAY')
                    : (language === 'ar' ? 'يوم عمل' : 'WORK DAY')}
                </span>
              )}
            </div>
            <p className="text-slate-500 flex items-center gap-2 text-sm font-medium">
              <span>{new Date().toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full"></span>
              <span>{language === 'ar' ? 'آخر تحديث:' : 'Updated:'} {formatLastUpdate()}</span>
            </p>
          </div>

          {dayStatus?.status === 'OFFDAY' && dayStatus.detail && (
            <div className="px-5 py-3 bg-white/60 border border-white/60 rounded-2xl text-amber-700 text-sm font-medium shadow-sm backdrop-blur-md">
              {dayStatus.reason === 'weekly_off'
                ? language === 'ar' ? `إجازة أسبوعية (${dayStatus.detail})` : `Weekly Off (${dayStatus.detail})`
                : dayStatus.detail}
            </div>
          )}
        </div>
      </div>

      {/* Onboarding Setup Card */}
      {companyId && (
        <div className="mb-6">
          <OnboardingSetupCard
            companyId={companyId}
            onNavigateToBranches={() => handleNavigate('branches', { openAddModal: true })}
            onNavigateToEmployees={() => handleNavigate('employees', { openAddModal: true })}
          />
        </div>
      )}

      {/* Status Cards */}
      <div className="mb-8">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1.5 md:gap-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white/60 rounded-xl p-5 animate-pulse h-[96px] border border-white/40 shadow-sm" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1.5 md:gap-2">
            {summaryCards.map((card) => {
              const Icon = card.icon;
              const isSelected = selectedCardId === card.id;

              return (
                <button
                  key={card.id}
                  onClick={() => handleCardClick(card.page, card.title, card.id)}
                  className={`
                    group
                    relative
                    flex items-center justify-between
                    h-[96px]
                    px-4 py-3
                    rounded-xl
                    bg-white
                    shadow-sm hover:shadow-md
                    border border-slate-200
                    transition-all duration-200 ease-out
                    active:scale-[0.99]
                    w-full
                    rtl:flex-row-reverse
                    overflow-hidden
                    ${isSelected ? 'ring-2 ring-blue-600/10 border-blue-600/30 bg-blue-50/5' : ''}
                  `}
                  dir={language === 'ar' ? 'rtl' : 'ltr'}
                >
                  {/* LEFT ICON */}
                  <div className="order-1 shrink-0 opacity-50 group-hover:opacity-100 transition-opacity">
                    <div className={`
                      w-9 h-9
                      rounded-lg
                      bg-slate-50
                      flex items-center justify-center
                      border border-slate-100
                      group-hover:scale-105 transition-transform duration-300
                      ${card.iconColor}
                    `}>
                      <Icon size={18} strokeWidth={2} className="transform scale-90" />
                    </div>
                  </div>

                  {/* CONTENT (RIGHT) - Grouped Tightly */}
                  <div className="order-2 flex-1 pl-3 rtl:pl-0 rtl:pr-3 text-right flex flex-col justify-center h-full">
                    <div className="flex flex-col justify-center">
                      <p className="text-sm font-semibold text-slate-700 leading-none mb-0.5">
                        {card.title}
                      </p>

                      {/* Number - Bold & Balanced */}
                      <span className="text-2xl font-bold text-slate-800 tabular-nums block tracking-tight leading-none">
                        <AnimatedNumber value={card.value} />
                      </span>

                      {(card.subtitle && card.subtitle !== "") && (
                        <p className="text-[10px] text-slate-500 mt-0.5 truncate font-medium opacity-60">
                          {card.subtitle}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
        <h2 className="text-lg font-bold text-slate-800 mb-4" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          {language === 'ar' ? 'إجراءات سريعة' : 'Quick Actions'}
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                onClick={() => handleNavigate(action.page)}
                className={`${action.color} text-white rounded-xl p-4 transition-all duration-200 hover:shadow-md active:scale-[0.98] flex items-center justify-center gap-3`}
                dir={language === 'ar' ? 'rtl' : 'ltr'}
              >
                <Icon size={20} />
                <span className="font-medium">{action.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      <AbsentEmployeesModal
        isOpen={showAbsentModal}
        onClose={() => setShowAbsentModal(false)}
        expectedCount={stats.absentToday}
      />
    </div>
  );
}
