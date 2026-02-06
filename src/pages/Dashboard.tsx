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
import { toast } from 'sonner';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import AbsentEmployeesModal from '../components/AbsentEmployeesModal';
import AttendanceListPanel from '../components/AttendanceListPanel';
import FraudListPanel from '../components/FraudListPanel';
import EmployeeListPanel from '../components/EmployeeListPanel';
import AnimatedNumber from '../components/AnimatedNumber';
import AdminPageShell from '../components/admin-ui/AdminPageShell';
import AdminStatCard from '../components/admin-ui/AdminStatCard';
import AdminSectionHeader from '../components/admin-ui/AdminSectionHeader';
import AdminSkeleton from '../components/admin-ui/AdminSkeleton';
import ServerTimeCard from '../components/ServerTimeCard';
import { OnboardingSetupCard } from '../components/OnboardingSetupCard';
import { useAdminTheme } from '../contexts/AdminThemeContext';

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
  const theme = useAdminTheme();
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
  const [showAttendancePanel, setShowAttendancePanel] = useState(false);
  const [attendancePanelFilter, setAttendancePanelFilter] = useState<'present_now' | 'today_attendance' | 'late'>('present_now');
  const [showFraudPanel, setShowFraudPanel] = useState(false);
  const [showEmployeePanel, setShowEmployeePanel] = useState(false);
  const [employeePanelFilter, setEmployeePanelFilter] = useState<'all' | 'active'>('active');
  const [dayStatus, setDayStatus] = useState<{
    status: 'WORKDAY' | 'OFFDAY';
    reason: string | null;
    detail: string | null;
  } | null>(null);
  const [flash, setFlash] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleManualRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await refreshDashboardStats();
      toast.success(language === 'ar' ? 'تم تحديث البيانات' : 'Dashboard updated');
    } catch (error) {
      // Toast already handled in refreshDashboardStats catch
    } finally {
      setIsRefreshing(false);
    }
  };

  // Flash effect on stats update
  useEffect(() => {
    if (!loading) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 500);
      return () => clearTimeout(t);
    }
  }, [stats, loading]);

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
      toast.error(language === 'ar' ? 'فشل تحديث الإحصائيات' : 'Failed to refresh dashboard stats');
    }
  }, [companyId, language]);

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

    if (cardId === 'absent') {
      setShowAbsentModal(true);
      return;
    }

    if (cardId === 'fraud') {
      setShowFraudPanel(true);
      return;
    }

    if (cardId === 'late') {
      setAttendancePanelFilter('late');
      setShowAttendancePanel(true);
      return;
    }

    if (cardId === 'present-now') {
      setAttendancePanelFilter('present_now');
      setShowAttendancePanel(true);
      return;
    }

    if (page === 'present-today' || cardId === 'attendance') {
      setAttendancePanelFilter('today_attendance');
      setShowAttendancePanel(true);
      return;
    }

    if (cardId === 'employees') {
      setEmployeePanelFilter('active');
      setShowEmployeePanel(true);
      return;
    }

    handleNavigate(page);
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
      id: 'late',
      title: language === 'ar' ? 'المتأخرون' : 'Late Arrivals',
      value: stats.lateArrivals,
      subtitle: language === 'ar' ? 'تسجيل بعد الموعد' : 'Checked in late',
      icon: Clock,
      iconBg: stats.lateArrivals === 0 ? 'bg-green-50' : 'bg-amber-50',
      iconColor: stats.lateArrivals === 0 ? 'text-green-600' : 'text-amber-600',
      borderColor: stats.lateArrivals === 0 ? 'border-green-200' : 'border-amber-200',
      page: 'late',
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
    <AdminPageShell
      title=" "
      subtitle=""
    >
      {/* Custom Compact Header */}
      {/* Unified Dashboard Container (Full Width Background Override) */}
      <div className="bg-[#EEF3F9] -mx-6 -mt-6 px-4 py-4 min-h-[calc(100vh-4rem)]">
        <div className="mx-auto w-[96%] max-w-md flex flex-col gap-2 pb-8">

          {/* 1. Time Card (Focal Point) */}
          <div className="w-full shadow-sm rounded-[1.5rem] overflow-hidden">
            <ServerTimeCard />
          </div>

          {/* 2. Header Section (Title + Badges Inline) */}
          <div className="flex items-center justify-between px-2 py-1">
            {/* Left side (Status Chips) */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className={`text-[10px] text-slate-500 flex items-center gap-1 bg-white px-2 py-1 rounded-full shadow-sm border border-slate-200 transition-all active:scale-95 ${isRefreshing ? 'opacity-75' : ''}`}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${isRefreshing ? 'bg-blue-600 animate-ping' : flash ? 'bg-blue-400' : 'bg-slate-400'}`}></div>
                <span>{isRefreshing ? (language === 'ar' ? '...' : '...') : formatLastUpdate()}</span>
              </button>

              {dayStatus && (
                <span
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold shadow-sm ${dayStatus.status === 'OFFDAY'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-emerald-100 text-emerald-700'
                    }`}
                >
                  {dayStatus.status === 'OFFDAY'
                    ? (language === 'ar' ? 'إجازة' : 'OFF DAY')
                    : (language === 'ar' ? 'يوم عمل' : 'WORK DAY')}
                </span>
              )}
            </div>

            {/* Right side (Title) */}
            <h1 className="text-lg font-bold text-slate-700">
              {language === 'ar' ? 'لوحة التحكم' : 'Dashboard'}
            </h1>
          </div>

          {/* 3. Onboarding Actions */}
          {companyId && (
            <div className="w-full">
              <OnboardingSetupCard
                companyId={companyId}
                onNavigateToBranches={() => handleNavigate('branches', { openAddModal: true })}
                onNavigateToEmployees={() => handleNavigate('employees', { openAddModal: true })}
              />
            </div>
          )}

          {/* 4. Statistics Stack (Compact) */}
          <div className="flex flex-col gap-2">
            {loading ? (
              <AdminSkeleton type="card" count={7} className="h-20 rounded-2xl" />
            ) : (
              summaryCards.map((card) => {
                const isSelected = selectedCardId === card.id;

                return (
                  <AdminStatCard
                    key={card.id}
                    title={card.title}
                    value={<AnimatedNumber value={card.value} />}
                    icon={card.icon}
                    iconClassName={`${card.iconBg} ${card.iconColor}`}
                    onClick={() => handleCardClick(card.page, card.title, card.id)}
                    className={`w-full !rounded-xl transition-all duration-200 active:scale-[0.98] ${isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : 'bg-white shadow-sm hover:shadow-md'}`}
                    trend={undefined}
                  />
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-6">
        <AdminSectionHeader title={language === 'ar' ? 'إجراءات سريعة' : 'Quick Actions'} />
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                onClick={() => handleNavigate(action.page)}
                className={`${action.color} text-white ${theme.radii.card} p-3 transition-all duration-200 hover:shadow-lg active:scale-[0.98] flex flex-col items-center justify-center gap-2 h-20`}
                dir={language === 'ar' ? 'rtl' : 'ltr'}
              >
                <Icon size={20} />
                <span className="font-bold text-xs">{action.title}</span>
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

      <AttendanceListPanel
        isOpen={showAttendancePanel}
        onClose={() => setShowAttendancePanel(false)}
        filter={attendancePanelFilter}
      />

      <FraudListPanel
        isOpen={showFraudPanel}
        onClose={() => setShowFraudPanel(false)}
      />

      <EmployeeListPanel
        isOpen={showEmployeePanel}
        onClose={() => setShowEmployeePanel(false)}
        filterType={employeePanelFilter}
      />
    </AdminPageShell>
  );
}
