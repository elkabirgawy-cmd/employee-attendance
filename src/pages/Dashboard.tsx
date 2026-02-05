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
import AbsentEmployeesModal from '../components/AbsentEmployeesModal';
import AttendanceListPanel from '../components/AttendanceListPanel';
import FraudListPanel from '../components/FraudListPanel';
import EmployeeListPanel from '../components/EmployeeListPanel';
import AnimatedNumber from '../components/AnimatedNumber';
import AdminPageShell from '../components/admin-ui/AdminPageShell';
import AdminStatCard from '../components/admin-ui/AdminStatCard';
import AdminSectionHeader from '../components/admin-ui/AdminSectionHeader';
import AdminSkeleton from '../components/admin-ui/AdminSkeleton';
import { adminTheme } from '@/lib/adminTheme';

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
      title={language === 'ar' ? 'لوحة التحكم' : 'Dashboard'}
      subtitle={new Date().toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      actions={
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-3">
            {dayStatus && (
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border shadow-sm ${dayStatus.status === 'OFFDAY'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}
              >
                {dayStatus.status === 'OFFDAY'
                  ? (language === 'ar' ? 'إجازة' : 'OFF DAY')
                  : (language === 'ar' ? 'يوم عمل' : 'WORK DAY')}
              </span>
            )}
            <div className="text-xs text-slate-500 flex items-center gap-2 bg-white px-3 py-1 rounded-full border border-slate-200 shadow-sm">
              <span className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${flash ? 'bg-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.6)] scale-125' : 'bg-slate-400 scale-100'}`}></span>
              <span>{formatLastUpdate()}</span>
            </div>
          </div>
          {dayStatus?.status === 'OFFDAY' && dayStatus.detail && (
            <div className="text-xs text-amber-600 font-medium bg-amber-50 px-3 py-1 rounded-lg border border-amber-100">
              {dayStatus.reason === 'weekly_off'
                ? language === 'ar' ? `إجازة أسبوعية (${dayStatus.detail})` : `Weekly Off (${dayStatus.detail})`
                : dayStatus.detail}
            </div>
          )}
        </div>
      }
    >
      {/* Server Time Card - Keeping prominent but integrated */}
      <ServerTimeCard />

      {/* Onboarding Setup Card */}
      {companyId && (
        <OnboardingSetupCard
          companyId={companyId}
          onNavigateToBranches={() => handleNavigate('branches', { openAddModal: true })}
          onNavigateToEmployees={() => handleNavigate('employees', { openAddModal: true })}
        />
      )}

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {loading ? (
          <AdminSkeleton type="card" count={8} className="h-32" />
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
                className={`h-full ${isSelected ? 'ring-2 ring-blue-500 border-blue-500 bg-blue-50/10' : ''}`}
                trend={undefined} // Could add trend logic if available
              />
            );
          })
        )}
      </div>

      {/* Quick Actions */}
      <div>
        <AdminSectionHeader title={language === 'ar' ? 'إجراءات سريعة' : 'Quick Actions'} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            // Extract color class to apply to bg/text cleanly if possible, or use inline style for complex gradients
            // quickActions use full classes like 'bg-blue-500 hover:bg-blue-600'
            // I'll keep the button style but make it consistent with AdminCard
            return (
              <button
                key={action.id}
                onClick={() => handleNavigate(action.page)}
                className={`${action.color} text-white ${adminTheme.radii.card} p-4 transition-all duration-200 hover:shadow-lg active:scale-[0.98] flex flex-col items-center justify-center gap-3 h-24`}
                dir={language === 'ar' ? 'rtl' : 'ltr'}
              >
                <Icon size={24} />
                <span className="font-bold text-sm">{action.title}</span>
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
