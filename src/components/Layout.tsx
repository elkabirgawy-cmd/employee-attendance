import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  MapPin,
  Clock,
  FileText,
  Settings,
  LogOut,
  Menu,
  X,
  AlertTriangle,
  Globe,
  Smartphone,
  DollarSign,
  Calendar as CalendarIcon,
  Search,
  ChevronLeft,
  ChevronRight,
  UserCircle2,
  UserCheck,
  Shield,
  Bell
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import NotificationBell from './NotificationBell';
import { useFCM } from '../hooks/useFCM';

interface LayoutProps {
  children: React.ReactNode;
}

interface MenuItem {
  id: string;
  name: string;
  icon: any;
  section: string;
}

interface MenuSection {
  id: string;
  title: string;
  items: MenuItem[];
}

export default function Layout({ children }: LayoutProps) {
  const { user, signOut } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [pageParams, setPageParams] = useState<Record<string, any>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const { needsPermission, requestingPermission, requestPermission } = useFCM({
    userId: user?.id || null,
    role: 'admin',
    platform: 'web',
    enabled: !!user,
    onMessage: (payload) => {
      console.log('Admin push notification received:', payload);
    }
  });

  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);

  function handleDrawerToggle() {
    setSidebarOpen(!sidebarOpen);
  }

  function handleNavigation(pageId: string, pageName: string, params?: Record<string, any>) {
    console.log('🧭 Navigation:', pageName, '| Page ID:', pageId);
    setCurrentPage(pageId);
    setPageParams(params || {});
    setSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function navigateWithParams(pageId: string, params: Record<string, any>) {
    setCurrentPage(pageId);
    setPageParams(params);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const menuSections: MenuSection[] = [
    {
      id: 'management',
      title: 'الإدارة',
      items: [
        { id: 'dashboard', name: t('nav.dashboard'), icon: LayoutDashboard, section: 'management' }
      ]
    },
    {
      id: 'resources',
      title: 'الموارد البشرية',
      items: [
        { id: 'employees', name: t('nav.employees'), icon: Users, section: 'resources' },
        { id: 'departments', name: language === 'ar' ? 'الأقسام' : 'Departments', icon: Shield, section: 'resources' },
        { id: 'branches', name: t('nav.branches'), icon: MapPin, section: 'resources' },
        { id: 'shifts', name: t('nav.shifts'), icon: Clock, section: 'resources' }
      ]
    },
    {
      id: 'attendance',
      title: 'الحضور والغياب',
      items: [
        { id: 'attendance', name: t('nav.attendance'), icon: UserCheck, section: 'attendance' }
      ]
    },
    {
      id: 'payroll',
      title: 'الرواتب والإجازات',
      items: [
        { id: 'payroll', name: 'الرواتب', icon: DollarSign, section: 'payroll' },
        { id: 'leave-requests', name: 'طلبات الإجازات', icon: CalendarIcon, section: 'payroll' },
        { id: 'leave-types', name: 'أنواع الإجازات', icon: CalendarIcon, section: 'payroll' },
        { id: 'delay-permissions', name: 'طلبات إذن التأخير', icon: Clock, section: 'payroll' }
      ]
    },
    {
      id: 'tasks',
      title: 'المهام',
      items: [
        { id: 'free-tasks', name: 'المهام الحرة', icon: Clock, section: 'tasks' }
      ]
    },
    {
      id: 'security',
      title: 'الأمان والمراقبة',
      items: [
        { id: 'timezone-alerts', name: 'تنبيهات المنطقة الزمنية', icon: Clock, section: 'security' },
        { id: 'fraud', name: t('nav.fraudAlerts'), icon: AlertTriangle, section: 'security' },
        { id: 'device-approvals', name: 'الأجهزة المعتمدة', icon: Smartphone, section: 'security' }
      ]
    },
    {
      id: 'reports',
      title: 'التقارير',
      items: [
        { id: 'reports', name: t('nav.reports'), icon: FileText, section: 'reports' }
      ]
    },
    {
      id: 'settings',
      title: 'الإعدادات',
      items: [
        { id: 'settings', name: t('nav.settings'), icon: Settings, section: 'settings' }
      ]
    }
  ];


  const filteredSections = menuSections.map(section => ({
    ...section,
    items: section.items.filter(item =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(section => section.items.length > 0);

  return (
    <div className="min-h-screen bg-slate-50" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Top Header */}
      <div className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-slate-200 z-50">
        <div className="flex items-center justify-between h-full px-4">
          <div className="flex items-center gap-3">
            <button
              onClick={handleDrawerToggle}
              className="p-2 hover:bg-slate-100 rounded-lg lg:hidden transition-colors"
              aria-label="Toggle menu"
            >
              {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg">
                <MapPin className="text-white" size={24} />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-800">GPS Attendance</h1>
                <p className="text-xs text-slate-500 hidden sm:block">نظام إدارة الحضور</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell
              onNotificationClick={(entityType) => {
                if (entityType === 'leave_request') {
                  handleNavigation('leave-requests', 'Leave Requests');
                }
              }}
            />
            <div className="hidden md:flex items-center gap-3 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-200">
              <UserCircle2 size={20} className="text-slate-600" />
              <div className="text-right">
                <p className="text-sm font-medium text-slate-700">{user?.email}</p>
                <div className="flex items-center gap-1">
                  <Shield size={12} className="text-blue-600" />
                  <p className="text-xs text-blue-600 font-semibold">Admin</p>
                </div>
              </div>
            </div>
            <button
              onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
              className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 rounded-lg transition-colors border border-slate-200"
              title={language === 'ar' ? 'Switch to English' : 'تبديل إلى العربية'}
            >
              <Globe size={16} className="text-blue-600" />
              <span className="text-sm font-medium text-slate-700 hidden sm:inline">
                {language === 'ar' ? 'EN' : 'ع'}
              </span>
            </button>
            <button
              onClick={signOut}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-red-200"
              title={t('common.logout')}
            >
              <LogOut size={18} />
              <span className="hidden sm:inline">{t('common.logout')}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex pt-16">
        {/* Sidebar */}
        <aside
          className={`fixed lg:static inset-y-0 left-0 bg-white border-r border-slate-200 transform transition-all duration-300 ease-in-out z-40 pt-16 lg:pt-0 overflow-hidden flex flex-col ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
            } ${sidebarCollapsed ? 'lg:w-20' : 'lg:w-72'} w-72`}
        >
          {/* Sidebar Header */}
          <div className={`p-4 border-b border-slate-200 bg-gradient-to-br from-slate-50 to-white ${sidebarCollapsed ? 'lg:px-2' : ''}`}>
            {!sidebarCollapsed && (
              <div className="mb-3">
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="text-blue-600" size={20} />
                  <h2 className="text-lg font-bold text-slate-800">لوحة الإدارة</h2>
                </div>
                <p className="text-xs text-slate-500">تحكم كامل بالنظام</p>
              </div>
            )}

            {/* Search Box - Hidden when collapsed */}
            {!sidebarCollapsed && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="بحث في القائمة..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            )}

            {/* Collapse Button - Desktop Only */}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="hidden lg:flex absolute top-4 -right-3 w-6 h-6 items-center justify-center bg-white border-2 border-slate-200 rounded-full hover:bg-slate-50 transition-colors shadow-sm"
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>
          </div>

          {/* Navigation Menu */}
          <nav className="flex-1 overflow-y-auto py-4 px-2">
            {filteredSections.map((section, sectionIndex) => (
              <div key={section.id} className="mb-4">
                {/* Section Title */}
                {!sidebarCollapsed && (
                  <div className="px-3 mb-2">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      {section.title}
                    </h3>
                  </div>
                )}

                {/* Section Items */}
                <div className="space-y-1">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentPage === item.id;
                    const showTooltip = sidebarCollapsed && hoveredItem === item.id;

                    return (
                      <div key={item.id} className="relative">
                        <button
                          onClick={() => handleNavigation(item.id, item.name)}
                          onMouseEnter={() => setHoveredItem(item.id)}
                          onMouseLeave={() => setHoveredItem(null)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 relative group ${isActive
                            ? 'bg-blue-50 text-blue-600 font-semibold shadow-sm'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                            } ${sidebarCollapsed ? 'justify-center' : ''}`}
                        >
                          {/* Active Indicator */}
                          {isActive && (
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-600 rounded-r-full" />
                          )}

                          <Icon size={20} className={sidebarCollapsed ? '' : 'flex-shrink-0'} />

                          {!sidebarCollapsed && (
                            <span className="flex-1 text-right text-sm">
                              {item.name}
                            </span>
                          )}
                        </button>

                        {/* Tooltip for collapsed state */}
                        {showTooltip && (
                          <div className="hidden lg:block absolute left-full top-1/2 -translate-y-1/2 ml-2 px-3 py-2 bg-slate-900 text-white text-sm rounded-lg shadow-lg whitespace-nowrap z-50">
                            {item.name}
                            <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-l-slate-900" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Section Separator */}
                {sectionIndex < filteredSections.length - 1 && (
                  <div className={`my-3 ${sidebarCollapsed ? 'mx-2' : 'mx-3'}`}>
                    <div className="h-px bg-slate-200" />
                  </div>
                )}
              </div>
            ))}

            {/* No Results Message */}
            {searchQuery && filteredSections.length === 0 && (
              <div className="text-center py-8 px-4">
                <Search className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">لا توجد نتائج</p>
              </div>
            )}
          </nav>

          {/* Sidebar Footer */}
          <div className={`p-4 border-t border-slate-200 bg-slate-50 ${sidebarCollapsed ? 'hidden' : ''}`}>
            <div className="text-xs text-slate-500 text-center">
              <p className="font-semibold text-slate-700 mb-1">نظام GPS Attendance</p>
              <p>الإصدار 2.0</p>
            </div>
          </div>
        </aside>

        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden pt-16"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          />
        )}

        {/* Main Content */}
        <main className={`flex-1 p-4 lg:p-6 max-w-[1600px] mx-auto w-full transition-all duration-300 pb-24`}>
          {needsPermission && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-xl shadow-sm p-4 mb-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
              <div className="flex items-start gap-3">
                <div className="bg-blue-500 rounded-full p-2 flex-shrink-0">
                  <Bell className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-blue-900 mb-1">
                    {language === 'ar' ? 'فعّل الإشعارات' : 'Enable Notifications'}
                  </h3>
                  <p className="text-xs text-blue-700 mb-3">
                    {language === 'ar'
                      ? 'احصل على إشعارات فورية لطلبات الموظفين والتحديثات المهمة'
                      : 'Get instant notifications for employee requests and important updates'}
                  </p>
                  <button
                    onClick={requestPermission}
                    disabled={requestingPermission}
                    className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Bell size={16} />
                    <span>
                      {requestingPermission
                        ? (language === 'ar' ? 'جاري التفعيل...' : 'Enabling...')
                        : (language === 'ar' ? 'تفعيل الإشعارات' : 'Enable Notifications')}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {React.Children.map(children, child => {
            if (React.isValidElement(child)) {
              return React.cloneElement(child, {
                currentPage,
                onNavigate: navigateWithParams,
                pageParams
              } as any);
            }
            return child;
          })}
        </main>
      </div>
    </div>
  );
}
