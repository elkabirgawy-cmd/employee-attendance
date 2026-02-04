import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  MapPin, LogOut, Clock, User, Calendar, Sun, Moon,
  ArrowRight, CheckCircle, XCircle, Loader2, ChevronRight, ChevronDown,
  Fingerprint, ArrowUpCircle, AlertCircle, CheckCircle2, Calculator, FileText, Globe
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import Avatar from '../components/Avatar';
import {
  calculateMonthlyStats as computeMonthlyStats,
  type AttendanceRecord,
  type AttendanceSettings,
  type EmployeeWorkdaysConfig,
  type MonthlyStats
} from '../utils/attendanceCalculations';
import ServerTimeCard from '../components/ServerTimeCard';
import { type TimeSync } from '../utils/timezoneDetection';
import LeaveRequestModal from '../components/LeaveRequestModal';
import RequestsBottomSheet from '../components/RequestsBottomSheet';
import LeaveHistoryModal from '../components/LeaveHistoryModal';
import EmployeeDelayPermissionModal from '../components/EmployeeDelayPermissionModal';
import BranchDebugPanel from '../components/BranchDebugPanel';
import { useFCM } from '../hooks/useFCM';

interface Employee {
  id: string;
  full_name: string;
  employee_code: string;
  phone: string;
  branch_id: string;
  avatar_url: string | null;
  company_id: string;
}

interface AttendanceLog {
  id: string;
  check_in_time: string;
  check_out_time: string | null;
  late_minutes: number;
  early_leave_minutes: number;
}

interface Theme {
  type: 'morning' | 'night';
  cardGradient: string;
  actionGradient: string;
  shiftColor: string;
  shiftBg: string;
  icon: any;
}

const morningTheme: Theme = {
  type: 'morning',
  cardGradient: 'from-[#FFE8B5] to-[#FFD39A]',
  actionGradient: 'from-[#FF3B30] to-[#FFB300]',
  shiftColor: '#F4A11A',
  shiftBg: 'bg-orange-50',
  icon: Sun
};

const nightTheme: Theme = {
  type: 'night',
  cardGradient: 'from-[#CFE6FF] to-[#BFD8FF]',
  actionGradient: 'from-[#FF3B30] to-[#FFB300]',
  shiftColor: '#3B6FB6',
  shiftBg: 'bg-blue-50',
  icon: Moon
};

const DEBUG_LOCATION_RECOVERY = false;

export default function EmployeeApp() {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [currentLog, setCurrentLog] = useState<AttendanceLog | null>(null);
  const [timeSync, setTimeSync] = useState<TimeSync | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number; accuracy?: number; timestamp?: number } | null>(null);
  const [resolvedTimezone, setResolvedTimezone] = useState<string | null>(() => {
    return localStorage.getItem('employee_resolved_timezone');
  });
  const [locationCity, setLocationCity] = useState<string | null>(() => {
    return localStorage.getItem('employee_location_city');
  });
  const [locationCountry, setLocationCountry] = useState<string | null>(() => {
    return localStorage.getItem('employee_location_country');
  });
  const [timezoneResolutionError, setTimezoneResolutionError] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showRequestsSheet, setShowRequestsSheet] = useState(false);
  const [showLeaveHistory, setShowLeaveHistory] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'leaves' | 'delays'>('all');
  const [showDelayPermissionModal, setShowDelayPermissionModal] = useState(false);
  const [pendingRequestsCount, setPendingRequestsCount] = useState<number | null>(null);
  const [theme, setTheme] = useState<Theme>(morningTheme);
  const [branchLocation, setBranchLocation] = useState<{ lat: number; lng: number; radius: number } | null>(null);
  const [branchUpdatedAt, setBranchUpdatedAt] = useState<string | null>(null);
  const [branchDebugData, setBranchDebugData] = useState<{
    id: string;
    company_id: string;
    name: string;
    latitude: number;
    longitude: number;
    geofence_radius: number;
    updated_at: string;
  } | null>(null);
  const [branchFetchTime, setBranchFetchTime] = useState<Date | null>(null);
  const [branchDataSource, setBranchDataSource] = useState<string>('loadBranchLocation');
  const [currentDistance, setCurrentDistance] = useState<number | null>(null);
  const [currentInRange, setCurrentInRange] = useState<boolean | null>(null);
  const [isLocationValid, setIsLocationValid] = useState(true);
  const [locationHealth, setLocationHealth] = useState<{
    permission: 'granted' | 'denied' | 'prompt' | 'unknown';
    lastFixAtMs: number | null;
    lastFixAgeSec: number | null;
    isFresh: boolean;
    isDisabled: boolean;
    isStale: boolean;
  }>({
    permission: 'unknown',
    lastFixAtMs: null,
    lastFixAgeSec: null,
    isFresh: false,
    isDisabled: false,
    isStale: false
  });
  const [isConfirmedOutside, setIsConfirmedOutside] = useState(false);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [attendanceSettings, setAttendanceSettings] = useState<AttendanceSettings | null>(null);
  const [employeeWorkdaysConfig, setEmployeeWorkdaysConfig] = useState<EmployeeWorkdaysConfig | null>(null);
  const [approvedVacationDays, setApprovedVacationDays] = useState(0);
  const [loadingStats, setLoadingStats] = useState(false);
  const [lastStatsUpdate, setLastStatsUpdate] = useState(Date.now());
  const [autoCheckoutSettings, setAutoCheckoutSettings] = useState<{
    id: number;
    auto_checkout_enabled: boolean;
    auto_checkout_after_seconds: number;
    verify_outside_with_n_readings?: number;
    watch_interval_seconds?: number;
    max_location_accuracy_meters?: number;
  } | null>(null);
  const [autoCheckout, setAutoCheckout] = useState<{
    active: boolean;
    reason: 'LOCATION_DISABLED' | 'OUT_OF_BRANCH' | null;
    startedAtServerMs: number | null;
    endsAtServerMs: number | null;
    executionState: 'IDLE' | 'COUNTING' | 'EXECUTING' | 'DONE' | 'CANCELLED';
  }>({
    active: false,
    reason: null,
    startedAtServerMs: null,
    endsAtServerMs: null,
    executionState: 'IDLE'
  });
  const [showAutoCheckoutToast, setShowAutoCheckoutToast] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());
  const [isAppVisible, setIsAppVisible] = useState(!document.hidden);

  const autoCheckoutSettingsRef = useRef(autoCheckoutSettings);
  const currentLogRef = useRef(currentLog);
  const locationRef = useRef(location);
  const locationHealthRef = useRef(locationHealth);
  const branchLocationRef = useRef(branchLocation);
  const employeeRef = useRef(employee);
  const isConfirmedOutsideRef = useRef(isConfirmedOutside);
  const isAppVisibleRef = useRef(isAppVisible);
  const lastValidLocationRef = useRef<{ lat: number; lng: number; accuracy?: number; timestamp?: number } | null>(null);

  const [preCheckInVerifying, setPreCheckInVerifying] = useState(false);
  const [preCheckInElapsedSec, setPreCheckInElapsedSec] = useState(0);
  const [preCheckInError, setPreCheckInError] = useState('');
  const [locationState, setLocationState] = useState<'LOCATING' | 'OK' | 'STALE' | 'ERROR'>('LOCATING');
  const [locationError, setLocationError] = useState<string>('');
  const [lastLocationUpdateAt, setLastLocationUpdateAt] = useState<number>(0);
  const [locationAttemptCount, setLocationAttemptCount] = useState(0);
  const [locationAgeSeconds, setLocationAgeSeconds] = useState<number>(0);
  const [locatingMessageIndex, setLocatingMessageIndex] = useState(0);
  const watchIdRef = useRef<number | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);
  const lastPositionRef = useRef<{ lat: number; lng: number } | null>(null);
  const locationStartTimeRef = useRef<number>(Date.now());
  const preCheckInTimerRef = useRef<number | null>(null);
  const preCheckInRetryRef = useRef<number | null>(null);
  const locationPollingRef = useRef<number | null>(null);
  const locationAttemptTimerRef = useRef<number | null>(null);
  const locationStatusPollingRef = useRef<number | null>(null);
  const loginLocationWasOffRef = useRef<boolean>(false);
  const locationSupervisorRef = useRef<number | null>(null);
  const locationFixSuccessRef = useRef<boolean>(false);

  useFCM({
    userId: employee?.id || null,
    role: 'employee',
    platform: 'web',
    enabled: !!employee,
    onMessage: (payload) => {
      console.log('Push notification received:', payload);
    }
  });

  const FRESH_WINDOW_SECONDS = 20;
  const UPDATE_INTERVAL_SECONDS = 12;
  const ATTEMPT_TIMEOUT_SECONDS = 8;
  const LOCATING_PULSE_SECONDS = 3;

  const LOCATING_MESSAGES = [
    'جاري تحديد الموقع... الرجاء الانتظار',
    'جاري البحث عن إحداثيات موقعك...',
    'يتم الاتصال بخدمات الموقع...',
    'يرجى التحقق من تفعيل GPS...',
  ];

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  const monthlyStats = useMemo(() => {
    if (!attendanceRecords.length && !loadingStats) {
      return {
        totalHours: 0,
        effectiveDays: 1,
        averageHoursPerDay: 0,
        monthKey: `${new Date().getFullYear()}-${new Date().getMonth()}`
      };
    }

    return computeMonthlyStats(
      attendanceRecords,
      attendanceSettings,
      employeeWorkdaysConfig,
      approvedVacationDays,
      new Date()
    );
  }, [attendanceRecords, attendanceSettings, employeeWorkdaysConfig, approvedVacationDays, lastStatsUpdate]);

  const fetchMonthlyStatsData = useCallback(async () => {
    if (!employee?.id || !employee?.company_id) {
      console.log('[STATS] Skipping: employee not loaded or missing company_id');
      return;
    }

    try {
      setLoadingStats(true);

      const companyId = employee.company_id;
      console.log('[STATS] Loading for employee:', { employeeId: employee.id, companyId });

      const { data: empData } = await supabase
        .from('employees')
        .select('custom_working_days, custom_working_days_enabled, weekly_off_days')
        .eq('id', employee.id)
        .maybeSingle();

      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      const firstDay = new Date(year, month, 1).toISOString();
      const lastDay = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

      const [settingsResponse, attendanceResponse, vacationsResponse] = await Promise.all([
        supabase.from('attendance_calculation_settings').select('*').eq('company_id', companyId).maybeSingle(),
        supabase.from('attendance_logs')
          .select('check_in_time, check_out_time')
          .eq('employee_id', employee.id)
          .eq('company_id', companyId)
          .gte('check_in_time', firstDay)
          .lte('check_in_time', lastDay),
        supabase.from('employee_vacation_requests')
          .select('days_count')
          .eq('employee_id', employee.id)
          .eq('company_id', companyId)
          .eq('status', 'approved')
          .gte('start_date', firstDay.split('T')[0])
          .lte('end_date', lastDay.split('T')[0])
      ]);

      let settings = settingsResponse.data;
      const attendanceLogs = attendanceResponse.data || [];
      const vacations = vacationsResponse.data || [];

      if (!settings || settingsResponse.error) {
        console.log('[STATS] Settings missing or error, ensuring they exist...');
        const { data: ensureResult, error: ensureError } = await supabase
          .rpc('ensure_attendance_calculation_settings', {
            p_company_id: companyId
          });

        if (!ensureError && ensureResult?.settings) {
          settings = ensureResult.settings;
          console.log('[STATS] Created missing settings:', settings);
        } else {
          console.error('[STATS] Failed to create settings:', ensureError);
        }
      }

      console.log('[STATS] Loaded:', {
        attendanceCount: attendanceLogs.length,
        vacationDays: vacations.length,
        hasSettings: !!settings
      });

      setAttendanceRecords(attendanceLogs);
      setAttendanceSettings(settings);
      setEmployeeWorkdaysConfig(empData);
      setApprovedVacationDays(vacations.reduce((sum: number, v: any) => sum + v.days_count, 0));
    } catch (error: any) {
      console.error('Error fetching monthly stats data:', error);
    } finally {
      setLoadingStats(false);
    }
  }, [employee]);

  const fetchPendingRequestsCount = useCallback(async () => {
    if (!employee) return;

    try {
      const { count, error } = await supabase
        .from('leave_requests')
        .select('id', { count: 'exact', head: true })
        .eq('employee_id', employee.id)
        .eq('company_id', employee.company_id)
        .eq('status', 'pending');

      if (error) throw error;

      const finalCount = count ?? 0;
      setPendingRequestsCount(finalCount);
      console.log('Badge Count:', finalCount);
    } catch (error) {
      console.error('Error fetching pending requests:', error);
      setPendingRequestsCount(0);
    }
  }, [employee]);

  const getServerNowMs = (): number => {
    return Date.now();
  };

  const checkPermission = async () => {
    try {
      if ('permissions' in navigator) {
        const result = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
        return result.state as 'granted' | 'denied' | 'prompt';
      }
    } catch (err) {
      console.log('Permission API not supported');
    }
    return 'unknown' as const;
  };

  const recheckLocationState = async (): Promise<{ enabled: boolean; permission: 'granted' | 'denied' | 'prompt' | 'unknown' }> => {
    if (!('geolocation' in navigator)) {
      return { enabled: false, permission: 'denied' };
    }

    const permission = await checkPermission();
    const enabled = permission === 'granted';

    return { enabled, permission };
  };

  const stopLocationSupervisor = () => {
    if (locationSupervisorRef.current) {
      clearInterval(locationSupervisorRef.current);
      locationSupervisorRef.current = null;

      if (DEBUG_LOCATION_RECOVERY) {
        console.log('[LocationSupervisor] Stopped');
      }
    }
  };

  const attemptLocationFix = () => {
    if (DEBUG_LOCATION_RECOVERY) {
      console.log('[LocationSupervisor] Attempting getCurrentPosition...');
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (DEBUG_LOCATION_RECOVERY) {
          console.log('[LocationSupervisor] SUCCESS - Fix obtained:', {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
        }

        locationFixSuccessRef.current = true;
        stopLocationSupervisor();

        const now = Date.now();
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp
        });
        setLastLocationUpdateAt(now);
        setLocationState('OK');
        setLocationError('');
        setLocationHealth(prev => ({
          ...prev,
          permission: 'granted',
          lastFixAtMs: now,
          lastFixAgeSec: 0,
          isFresh: true,
          isDisabled: false,
          isStale: false
        }));

        lastUpdateTimeRef.current = now;
        lastPositionRef.current = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };

        if (DEBUG_LOCATION_RECOVERY) {
          console.log('[LocationSupervisor] Starting watchPosition for continuous updates');
        }

        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }

        startLocationWatcher();
      },
      (error) => {
        if (DEBUG_LOCATION_RECOVERY) {
          console.log('[LocationSupervisor] Error:', {
            code: error.code,
            message: error.message
          });
        }

        if (error.code === 1) {
          setLocationError('جاري تحديد الموقع...');
          setLocationHealth(prev => ({
            ...prev,
            permission: 'denied',
            isDisabled: true
          }));
        } else if (error.code === 2 || error.code === 3) {
          setLocationError('جاري البحث عن إحداثيات موقعك...');
        }
      },
      {
        enableHighAccuracy: false,
        timeout: 6000,
        maximumAge: 0
      }
    );
  };

  const startLocationSupervisor = () => {
    stopLocationSupervisor();

    if (DEBUG_LOCATION_RECOVERY) {
      console.log('[LocationSupervisor] Starting 2-second loop');
    }

    locationFixSuccessRef.current = false;
    attemptLocationFix();

    locationSupervisorRef.current = window.setInterval(() => {
      if (!locationFixSuccessRef.current) {
        attemptLocationFix();
      }
    }, 2000);
  };

  const silentSessionRefresh = async () => {
    if (DEBUG_LOCATION_RECOVERY) {
      console.log('[silentSessionRefresh] Starting silent refresh...');
    }

    try {
      const sessionToken = localStorage.getItem('geoshift_session_token');
      const employeeData = localStorage.getItem('geoshift_employee');

      if (!sessionToken || !employeeData) {
        if (DEBUG_LOCATION_RECOVERY) {
          console.log('[silentSessionRefresh] No session data found, skipping');
        }
        return;
      }

      const emp = JSON.parse(employeeData);

      if (DEBUG_LOCATION_RECOVERY) {
        console.log('[silentSessionRefresh] Refreshing employee profile and branch data...');
      }

      const { data: empData } = await supabase
        .from('employees')
        .select('id, full_name, employee_code, phone, branch_id, avatar_url, company_id')
        .eq('id', emp.id)
        .maybeSingle();

      if (empData) {
        setEmployee(empData);
        localStorage.setItem('geoshift_employee', JSON.stringify(empData));

        const { data: branchData } = await supabase
          .from('branches')
          .select('latitude, longitude, geofence_radius')
          .eq('id', empData.branch_id)
          .maybeSingle();

        if (branchData) {
          setBranchLocation({
            lat: branchData.latitude,
            lng: branchData.longitude,
            radius: branchData.geofence_radius
          });
        }

        if (DEBUG_LOCATION_RECOVERY) {
          console.log('[silentSessionRefresh] Employee and branch data refreshed successfully');
        }
      }
    } catch (error) {
      console.error('[silentSessionRefresh] Error during refresh:', error);
    }
  };

  const stopLocationWatcher = () => {
    if (watchIdRef.current !== null) {
      if (DEBUG_LOCATION_RECOVERY) {
        console.log('[stopLocationWatcher] Stopping watch ID:', watchIdRef.current);
      }

      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  };

  const updateLocationHealth = (newLocation?: { timestamp?: number } | null) => {
    const nowMs = getServerNowMs();
    const lastFixAtMs = newLocation?.timestamp || locationHealth.lastFixAtMs;
    const lastFixAgeSec = lastFixAtMs ? Math.floor((nowMs - lastFixAtMs) / 1000) : null;

    const isFresh = locationHealth.permission === 'granted' &&
                    lastFixAtMs !== null &&
                    lastFixAgeSec !== null &&
                    lastFixAgeSec <= 30;

    const isDisabled = locationHealth.permission === 'denied' ||
                       locationHealth.permission === 'prompt';

    const isStale = locationHealth.permission === 'granted' &&
                    lastFixAtMs !== null &&
                    lastFixAgeSec !== null &&
                    lastFixAgeSec > 60;

    if (DEBUG_LOCATION_RECOVERY && newLocation?.timestamp) {
      console.log('[updateLocationHealth] Updated health metrics:', {
        lastFixAtMs,
        lastFixAgeSec,
        isFresh,
        isDisabled,
        isStale
      });
    }

    setLocationHealth(prev => ({
      ...prev,
      lastFixAtMs: lastFixAtMs || prev.lastFixAtMs,
      lastFixAgeSec,
      isFresh,
      isDisabled,
      isStale
    }));
  };

  const handleLocationSuccess = async (position: GeolocationPosition) => {
    const newLat = position.coords.latitude;
    const newLng = position.coords.longitude;
    const newAccuracy = position.coords.accuracy;
    const newTimestamp = position.timestamp;
    const now = Date.now();

    console.log('[GEO_UPDATE]', {
      lat: newLat,
      lng: newLng,
      accuracy: Math.round(newAccuracy),
      timestamp: new Date(newTimestamp).toISOString()
    });

    if (DEBUG_LOCATION_RECOVERY) {
      console.log('[handleLocationSuccess] ✅ REAL COORDS RECEIVED:', {
        lat: newLat,
        lng: newLng,
        accuracy: newAccuracy,
        timestamp: new Date(newTimestamp).toISOString(),
        lastFixAtMs: newTimestamp
      });
    }

    const currentPermission = await checkPermission();

    const newLocation = {
      lat: newLat,
      lng: newLng,
      accuracy: newAccuracy,
      timestamp: newTimestamp,
    };

    setLocation(newLocation);
    lastPositionRef.current = { lat: newLat, lng: newLng };
    lastUpdateTimeRef.current = now;
    setLastLocationUpdateAt(now);
    setError('');
    setLocationError('');
    setLocationState('OK');

    if (locationAttemptTimerRef.current) {
      clearTimeout(locationAttemptTimerRef.current);
      locationAttemptTimerRef.current = null;
    }

    setLocationHealth(prev => ({
      ...prev,
      permission: currentPermission,
      lastFixAtMs: newTimestamp,
      isDisabled: false,
      isFresh: true
    }));
    updateLocationHealth(newLocation);

    if (DEBUG_LOCATION_RECOVERY) {
      console.log('[handleLocationSuccess] ✅ State: LOCATION_READY | lastFixTimestamp updated');
    }
  };

  const startLocationWatcher = () => {
    stopLocationWatcher();

    const isCheckedIn = currentLog !== null;
    const useHighAccuracy = isCheckedIn;

    console.log('[GEO_WATCH_START]', {
      useHighAccuracy,
      isCheckedIn
    });

    if (DEBUG_LOCATION_RECOVERY) {
      console.log('[startLocationWatcher] Starting watch with highAccuracy:', useHighAccuracy);
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      handleLocationSuccess,
      async (error) => {
        console.log('[GEO_ERROR]', {
          code: error.code,
          message: error.message
        });
        console.error('[startLocationWatcher] Error:', error);

        const currentPermission = await checkPermission();

        if (error.code === error.PERMISSION_DENIED) {
          if (DEBUG_LOCATION_RECOVERY) {
            console.log('[startLocationWatcher] PERMISSION_DENIED - stopping watcher and starting supervisor');
          }

          setLocationState('LOCATING');
          setLocationError('يرجى السماح بالوصول إلى الموقع');
          setLocationHealth(prev => ({
            ...prev,
            permission: 'denied',
            isDisabled: true
          }));
          stopLocationWatcher();
          startLocationSupervisor();
        } else {
          if (DEBUG_LOCATION_RECOVERY) {
            console.log('[startLocationWatcher] Non-permission error, updating health state');
          }

          setLocationHealth(prev => ({
            ...prev,
            permission: currentPermission
          }));
        }
      },
      {
        enableHighAccuracy: useHighAccuracy,
        timeout: 30000,
        maximumAge: 5000
      }
    );

    if (DEBUG_LOCATION_RECOVERY) {
      console.log('[startLocationWatcher] Watch started with ID:', watchIdRef.current);
    }
  };

  const startLocationRequests = async () => {
    if (DEBUG_LOCATION_RECOVERY) {
      console.log('[startLocationRequests] HARD RESET - clearing all watchers and timers');
    }

    stopLocationWatcher();
    if (locationAttemptTimerRef.current) {
      clearTimeout(locationAttemptTimerRef.current);
      locationAttemptTimerRef.current = null;
    }

    const attemptGetCurrentPosition = (highAccuracy: boolean, timeout: number): Promise<GeolocationPosition> => {
      return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          {
            enableHighAccuracy: highAccuracy,
            timeout: timeout,
            maximumAge: 0
          }
        );
      });
    };

    try {
      let position: GeolocationPosition;

      if (DEBUG_LOCATION_RECOVERY) {
        console.log('[startLocationRequests] Attempt 1: lowAccuracy, 10s timeout');
      }

      try {
        setLocationError('يتم الاتصال بخدمات الموقع...');
        position = await attemptGetCurrentPosition(false, 10000);

        if (DEBUG_LOCATION_RECOVERY) {
          console.log('[startLocationRequests] Attempt 1 SUCCESS:', {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
        }
      } catch (firstError: any) {
        if (DEBUG_LOCATION_RECOVERY) {
          console.log('[startLocationRequests] Attempt 1 failed:', firstError.code, firstError.message);
        }

        if (firstError.code === 1) {
          if (DEBUG_LOCATION_RECOVERY) {
            console.log('[startLocationRequests] PERMISSION_DENIED - starting recovery loop');
          }
          setLocationState('LOCATING');
          setLocationError('يرجى السماح بالوصول إلى الموقع');
          setLocationHealth(prev => ({
            ...prev,
            permission: 'denied',
            isDisabled: true
          }));
          loginLocationWasOffRef.current = true;
          startLocationPollingWhenOff();
          return;
        }

        if (DEBUG_LOCATION_RECOVERY) {
          console.log('[startLocationRequests] Attempt 2: highAccuracy, 12s timeout');
        }

        try {
          setLocationError('جاري البحث عن إحداثيات موقعك...');
          position = await attemptGetCurrentPosition(true, 12000);

          if (DEBUG_LOCATION_RECOVERY) {
            console.log('[startLocationRequests] Attempt 2 SUCCESS:', {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              accuracy: position.coords.accuracy
            });
          }
        } catch (secondError: any) {
          if (DEBUG_LOCATION_RECOVERY) {
            console.log('[startLocationRequests] Attempt 2 failed:', secondError.code, secondError.message);
          }

          if (secondError.code === 1) {
            if (DEBUG_LOCATION_RECOVERY) {
              console.log('[startLocationRequests] PERMISSION_DENIED - starting recovery loop');
            }
            setLocationState('LOCATING');
            setLocationError('يرجى السماح بالوصول إلى الموقع');
            setLocationHealth(prev => ({
              ...prev,
              permission: 'denied',
              isDisabled: true
            }));
            loginLocationWasOffRef.current = true;
            startLocationPollingWhenOff();
            return;
          }
          throw secondError;
        }
      }

      if (DEBUG_LOCATION_RECOVERY) {
        console.log('[startLocationRequests] Got position! Processing and updating lastFixTimestamp...');
      }

      await handleLocationSuccess(position);

      if (DEBUG_LOCATION_RECOVERY) {
        console.log('[startLocationRequests] Starting fresh continuous watcher...');
      }

      startLocationWatcher();

    } catch (error: any) {
      console.error('[startLocationRequests] Failed:', error);
      setLocationState('LOCATING');
      setLocationError('تعذر تحديد الموقع، جاري إعادة المحاولة...');
    }
  };

  const ensureLocationFlow = async () => {
    if (DEBUG_LOCATION_RECOVERY) {
      console.log('[ensureLocationFlow] Starting LocationSupervisor for continuous fix attempts');
    }

    setLocationState('LOCATING');
    setLocationError('جاري تحديد الموقع...');

    stopLocationPollingWhenOff();
    stopLocationWatcher();

    if (locationAttemptTimerRef.current) {
      clearTimeout(locationAttemptTimerRef.current);
      locationAttemptTimerRef.current = null;
    }

    startLocationSupervisor();
  };

  const stopLocationPollingWhenOff = () => {
    if (locationStatusPollingRef.current) {
      clearInterval(locationStatusPollingRef.current);
      locationStatusPollingRef.current = null;
    }
  };

  const startLocationPollingWhenOff = () => {
    stopLocationPollingWhenOff();

    if (DEBUG_LOCATION_RECOVERY) {
      console.log('[LocationRecoveryLoop] Started - checking every 1500ms for Location ON');
    }

    locationStatusPollingRef.current = window.setInterval(async () => {
      const { enabled, permission } = await recheckLocationState();

      if (DEBUG_LOCATION_RECOVERY) {
        console.log('[LocationRecoveryLoop] Check:', { enabled, permission, loginWasOff: loginLocationWasOffRef.current });
      }

      if (enabled && permission === 'granted') {
        if (DEBUG_LOCATION_RECOVERY) {
          console.log('[LocationRecoveryLoop] Location is ON! Detected OFF→ON transition');
        }

        stopLocationPollingWhenOff();

        if (loginLocationWasOffRef.current) {
          if (DEBUG_LOCATION_RECOVERY) {
            console.log('[LocationRecoveryLoop] First OFF→ON after login - performing silent session refresh');
          }

          await silentSessionRefresh();
          loginLocationWasOffRef.current = false;
        }

        if (DEBUG_LOCATION_RECOVERY) {
          console.log('[LocationRecoveryLoop] Stopping all watchers and restarting location engine...');
        }

        stopLocationWatcher();
        if (locationAttemptTimerRef.current) {
          clearTimeout(locationAttemptTimerRef.current);
          locationAttemptTimerRef.current = null;
        }

        await ensureLocationFlow();
      }
    }, 1500);
  };

  useEffect(() => {
    validateSession();
    loadAutoCheckoutSettings();

    const hour = new Date().getHours();
    if (hour >= 6 && hour < 18) {
      setTheme(morningTheme);
    } else {
      setTheme(nightTheme);
    }

    const settingsRefreshInterval = setInterval(() => {
      loadAutoCheckoutSettings();
    }, 60000);

    return () => {
      stopWatchingLocation();
      clearInterval(settingsRefreshInterval);
    };
  }, []);

  useEffect(() => {
    if (!employee?.branch_id || !employee?.company_id) return;

    console.log('[REALTIME] Setting up branch location subscription:', {
      branch_id: employee.branch_id,
      company_id: employee.company_id
    });

    const channel = supabase
      .channel(`employee-branch-updates-${employee.branch_id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'branches',
          filter: `id=eq.${employee.branch_id}&company_id=eq.${employee.company_id}` // ✅ Multi-tenant filter
        },
        (payload) => {
          console.log('[REALTIME] Branch updated, refreshing geofence...', payload.new);

          if (payload.new && 'id' in payload.new && 'name' in payload.new && 'latitude' in payload.new && 'longitude' in payload.new && 'company_id' in payload.new && 'updated_at' in payload.new) {
            const updatedBranch = payload.new as {
              id: string;
              name: string;
              latitude: number;
              longitude: number;
              geofence_radius: number;
              company_id: string;
              updated_at: string
            };

            // ✅ Verify company_id matches (extra safety check)
            if (updatedBranch.company_id !== employee.company_id) {
              console.error('[REALTIME] Branch belongs to different company, ignoring update');
              return;
            }

            setBranchLocation({
              lat: updatedBranch.latitude,
              lng: updatedBranch.longitude,
              radius: updatedBranch.geofence_radius
            });
            setBranchUpdatedAt(updatedBranch.updated_at);
            setBranchDataSource('realtime_subscription');
            setBranchFetchTime(new Date());

            // Update debug data
            setBranchDebugData({
              id: updatedBranch.id,
              company_id: updatedBranch.company_id,
              name: updatedBranch.name,
              latitude: updatedBranch.latitude,
              longitude: updatedBranch.longitude,
              geofence_radius: updatedBranch.geofence_radius,
              updated_at: updatedBranch.updated_at
            });

            console.log('[REALTIME] ✅ Branch location updated:', {
              id: updatedBranch.id,
              name: updatedBranch.name,
              lat: updatedBranch.latitude,
              lng: updatedBranch.longitude,
              radius: updatedBranch.geofence_radius,
              company_id: updatedBranch.company_id,
              updated_at: updatedBranch.updated_at,
              source: 'realtime_subscription'
            });
          } else {
            // Fallback: re-fetch with company_id scope
            console.log('[REALTIME] Incomplete payload, falling back to loadBranchLocation');
            loadBranchLocation(employee.branch_id, employee.company_id);
          }
        }
      )
      .subscribe();

    return () => {
      console.log('[REALTIME] Cleaning up branch location subscription');
      supabase.removeChannel(channel);
    };
  }, [employee?.branch_id, employee?.company_id]); // ✅ Re-subscribe on company_id change

  // 🔄 Window focus listener: Refetch branch data on window focus (no caching)
  useEffect(() => {
    if (!employee?.branch_id || !employee?.company_id) return;

    const handleWindowFocus = () => {
      console.log('[WINDOW_FOCUS] Window focused, refetching branch data...');
      loadBranchLocation(employee.branch_id, employee.company_id);
    };

    window.addEventListener('focus', handleWindowFocus);

    return () => {
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [employee?.branch_id, employee?.company_id]);

  useEffect(() => {
    locationStartTimeRef.current = Date.now();
  }, []);

  useEffect(() => {
    if (currentLog && employee) {
      startWatchingLocation();
    }
  }, [currentLog, employee]);

  useEffect(() => {
    let lastMonthKey = `${new Date().getFullYear()}-${new Date().getMonth()}`;

    const monthCheckTimer = setInterval(() => {
      const currentMonthKey = `${new Date().getFullYear()}-${new Date().getMonth()}`;
      if (currentMonthKey !== lastMonthKey) {
        lastMonthKey = currentMonthKey;
        fetchMonthlyStatsData();
      }
    }, 60000);

    const statsRefreshTimer = setInterval(() => {
      if (currentLog) {
        setLastStatsUpdate(Date.now());
      }
    }, 30000);

    return () => {
      clearInterval(monthCheckTimer);
      clearInterval(statsRefreshTimer);
    };
  }, [currentLog, fetchMonthlyStatsData]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      const wasVisible = isAppVisibleRef.current;
      const nowVisible = document.visibilityState === 'visible';

      setIsAppVisible(nowVisible);
      isAppVisibleRef.current = nowVisible;

      if (nowVisible && !wasVisible) {
        console.log('[VISIBILITY] App resumed (was hidden, now visible)');

        if (employee?.id && employee?.company_id) {
          loadCurrentAttendance(employee.id, employee.company_id);
        }

        startWatchingLocation();

        if (currentLogRef.current) {
          sendHeartbeat();
        }
      } else if (!nowVisible) {
        console.log('[VISIBILITY] App hidden, stopping location watchers only');
        stopWatchingLocation();
      }
    };

    const handleFocus = () => {
      console.log('[FOCUS] Window focused');
      setIsAppVisible(true);
      isAppVisibleRef.current = true;

      if (employee?.id && employee?.company_id) {
        loadCurrentAttendance(employee.id, employee.company_id);
      }
      startWatchingLocation();

      if (currentLogRef.current) {
        sendHeartbeat();
      }
    };

    const handleBeforeUnload = () => {
      console.log('[BEFOREUNLOAD] Stopping watchers, NO heartbeat sent');
      stopWatchingLocation();
    };

    const handlePageHide = () => {
      console.log('[PAGEHIDE] Stopping watchers, NO heartbeat sent');
      stopWatchingLocation();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [employee]);

  useEffect(() => {
    let permissionStatus: PermissionStatus | null = null;
    let handlePermissionChange: (() => void) | null = null;

    const setupPermissionListener = async () => {
      try {
        if ('permissions' in navigator) {
          permissionStatus = await navigator.permissions.query({ name: 'geolocation' as PermissionName });

          handlePermissionChange = () => {
            if (permissionStatus?.state === 'granted') {
              startWatchingLocation();
            }
          };

          permissionStatus.addEventListener('change', handlePermissionChange);
        }
      } catch (err) {
        console.log('Permission monitoring not supported');
      }
    };

    setupPermissionListener();

    return () => {
      if (permissionStatus && handlePermissionChange) {
        permissionStatus.removeEventListener('change', handlePermissionChange);
      }
    };
  }, []);

  useEffect(() => {
    if (locationState === 'LOCATING') {
      setIsConfirmedOutside(false);
      return;
    }

    if (!location || !branchLocation) {
      setIsConfirmedOutside(false);
      return;
    }

    const distance = calculateDistance(
      location.lat,
      location.lng,
      branchLocation.lat,
      branchLocation.lng
    );

    const isOutside = distance > branchLocation.radius;
    const inRange = !isOutside;
    setIsConfirmedOutside(isOutside);

    // 📊 Store for debug panel
    setCurrentDistance(distance);
    setCurrentInRange(inRange);

    // 🔍 DEBUG: GPS distance calculation
    console.log('🔍 [GPS_VALIDATION]', {
      employee_id: employee?.id,
      branch_id: employee?.branch_id,
      branch_lat: branchLocation.lat,
      branch_lng: branchLocation.lng,
      branch_radius: branchLocation.radius,
      employee_lat: location.lat,
      employee_lng: location.lng,
      distance: Math.round(distance),
      inRange,
      status: inRange ? 'داخل الفرع' : 'خارج الفرع'
    });

    if (DEBUG_LOCATION_RECOVERY) {
      console.log('[isConfirmedOutside] Updated status:', {
        distance: Math.round(distance),
        radius: branchLocation.radius,
        isOutside,
        status: isOutside ? 'خارج الفرع' : 'داخل الفرع'
      });
    }
  }, [location, branchLocation, locationState]);

  useEffect(() => {
    autoCheckoutSettingsRef.current = autoCheckoutSettings;
  }, [autoCheckoutSettings]);

  useEffect(() => {
    currentLogRef.current = currentLog;
  }, [currentLog]);

  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  useEffect(() => {
    locationHealthRef.current = locationHealth;
  }, [locationHealth]);

  useEffect(() => {
    branchLocationRef.current = branchLocation;
  }, [branchLocation]);

  useEffect(() => {
    employeeRef.current = employee;
  }, [employee]);

  useEffect(() => {
    isConfirmedOutsideRef.current = isConfirmedOutside;
  }, [isConfirmedOutside]);

  useEffect(() => {
    if (currentLog) {
      console.log('[AC_STATUS_CHANGE]', {
        status: 'CHECKED_IN',
        checkInId: currentLog.id,
        hasSettings: !!autoCheckoutSettings,
        enabled: autoCheckoutSettings?.auto_checkout_enabled
      });
    } else {
      console.log('[AC_STATUS_CHANGE]', {
        status: 'CHECKED_OUT'
      });
    }
  }, [currentLog]);

  useEffect(() => {
    if (autoCheckoutSettings) {
      console.log('[AC_SETTINGS_CHANGE]', {
        enabled: autoCheckoutSettings.auto_checkout_enabled,
        afterSec: autoCheckoutSettings.auto_checkout_after_seconds,
        isCheckedIn: !!currentLog
      });
    }
  }, [autoCheckoutSettings]);

  useEffect(() => {
    if (employee && !loading) {
      console.log('[AC_SESSION_READY]', {
        employeeId: employee.id,
        hasSettings: !!autoCheckoutSettings,
        isCheckedIn: !!currentLog
      });
    }
  }, [employee, loading]);

  useEffect(() => {
    const healthCheckInterval = setInterval(() => {
      updateLocationHealth();
    }, 5000);

    return () => clearInterval(healthCheckInterval);
  }, [locationHealth.lastFixAtMs, locationHealth.permission]);

  useEffect(() => {
    if (locationState === 'OK' && lastLocationUpdateAt > 0) {
      const checkFreshnessTimer = window.setInterval(() => {
        const ageSeconds = (Date.now() - lastLocationUpdateAt) / 1000;
        if (ageSeconds > FRESH_WINDOW_SECONDS) {
          setLocationState('STALE');
        }
      }, 1000);

      return () => clearInterval(checkFreshnessTimer);
    }
  }, [locationState, lastLocationUpdateAt]);

  useEffect(() => {
    if (lastLocationUpdateAt > 0) {
      const updateAgeTimer = window.setInterval(() => {
        const ageSeconds = Math.floor((Date.now() - lastLocationUpdateAt) / 1000);
        setLocationAgeSeconds(ageSeconds);
      }, 1000);

      return () => clearInterval(updateAgeTimer);
    }
  }, [lastLocationUpdateAt]);

  useEffect(() => {
    if (locationState === 'STALE' && lastLocationUpdateAt > 0) {
      const pulseTimer = window.setInterval(() => {
        setLocationState('LOCATING');
        setTimeout(() => {
          const ageSeconds = (Date.now() - lastLocationUpdateAt) / 1000;
          if (ageSeconds > FRESH_WINDOW_SECONDS) {
            setLocationState('STALE');
          }
        }, LOCATING_PULSE_SECONDS * 1000);
      }, (UPDATE_INTERVAL_SECONDS - 1) * 1000);

      return () => clearInterval(pulseTimer);
    }
  }, [locationState, lastLocationUpdateAt]);

  useEffect(() => {
    return () => {
      if (preCheckInTimerRef.current) {
        clearInterval(preCheckInTimerRef.current);
        preCheckInTimerRef.current = null;
      }
      if (preCheckInRetryRef.current) {
        clearTimeout(preCheckInRetryRef.current);
        preCheckInRetryRef.current = null;
      }
      if (locationPollingRef.current) {
        clearInterval(locationPollingRef.current);
        locationPollingRef.current = null;
      }
      if (locationAttemptTimerRef.current) {
        clearTimeout(locationAttemptTimerRef.current);
        locationAttemptTimerRef.current = null;
      }
      stopLocationWatcher();
      stopLocationPollingWhenOff();
      stopLocationSupervisor();
    };
  }, []);

  useEffect(() => {
    if (locationState === 'LOCATING' || locationHealth.isDisabled) {
      const interval = setInterval(() => {
        setLocatingMessageIndex((prev) => (prev + 1) % LOCATING_MESSAGES.length);
      }, 3000);

      return () => clearInterval(interval);
    }
  }, [locationState, locationHealth.isDisabled]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (DEBUG_LOCATION_RECOVERY) {
          console.log('[Lifecycle] App became visible - triggering immediate location attempt');
        }
        if (locationSupervisorRef.current && !locationFixSuccessRef.current) {
          attemptLocationFix();
        }
      }
    };

    const handleFocus = () => {
      if (DEBUG_LOCATION_RECOVERY) {
        console.log('[Lifecycle] Window focused - triggering immediate location attempt');
      }
      if (locationSupervisorRef.current && !locationFixSuccessRef.current) {
        attemptLocationFix();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  useEffect(() => {
    if (employee) {
      if (DEBUG_LOCATION_RECOVERY) {
        console.log('[Lifecycle] Employee loaded - starting location flow');
      }
      ensureLocationFlow();
    }
  }, [employee]);

  useEffect(() => {
    async function resolveTimezoneAndLocation() {
      if (!location || !location.lat || !location.lng) return;

      try {
        const { data: settingsData } = await supabase
          .from('system_settings')
          .select('key, value')
          .in('key', ['timezone_mode', 'fixed_timezone']);

        let timezoneMode: 'auto_gps' | 'fixed' = 'auto_gps';
        let fixedTimezone = 'Asia/Riyadh';

        if (settingsData) {
          settingsData.forEach((setting: any) => {
            if (setting.key === 'timezone_mode') {
              timezoneMode = setting.value as 'auto_gps' | 'fixed';
            } else if (setting.key === 'fixed_timezone') {
              fixedTimezone = setting.value as string;
            }
          });
        }

        if (timezoneMode === 'fixed') {
          setResolvedTimezone(fixedTimezone);
          localStorage.setItem('employee_resolved_timezone', fixedTimezone);
          setTimezoneResolutionError(false);
        }

        // Geocode to get country code and map to timezone
        const geocodePromise = fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${location.lat}&lon=${location.lng}&zoom=10&addressdetails=1`,
          {
            headers: {
              'User-Agent': 'GeoShift-Attendance-App'
            }
          }
        );

        const geocodeResponse = await geocodePromise;

        if (geocodeResponse.ok) {
          const geocodeData = await geocodeResponse.json();
          const city = geocodeData.address?.city || geocodeData.address?.town || geocodeData.address?.village || geocodeData.address?.state || 'Unknown';
          const country = geocodeData.address?.country || 'Unknown';
          const countryCode = geocodeData.address?.country_code?.toUpperCase() || '';

          setLocationCity(city);
          setLocationCountry(country);
          localStorage.setItem('employee_location_city', city);
          localStorage.setItem('employee_location_country', country);

          // Map country code to timezone
          const countryTimezoneMap: Record<string, string> = {
            'EG': 'Africa/Cairo',
            'SA': 'Asia/Riyadh',
            'AE': 'Asia/Dubai',
            'KW': 'Asia/Kuwait',
            'QA': 'Asia/Qatar',
            'BH': 'Asia/Bahrain',
            'OM': 'Asia/Muscat',
            'JO': 'Asia/Amman',
            'LB': 'Asia/Beirut',
            'SY': 'Asia/Damascus',
            'IQ': 'Asia/Baghdad',
            'YE': 'Asia/Aden',
            'PS': 'Asia/Gaza',
            'LY': 'Africa/Tripoli',
            'TN': 'Africa/Tunis',
            'DZ': 'Africa/Algiers',
            'MA': 'Africa/Casablanca',
            'SD': 'Africa/Khartoum',
          };

          if (countryCode && countryTimezoneMap[countryCode]) {
            const mappedTimezone = countryTimezoneMap[countryCode];
            setResolvedTimezone(mappedTimezone);
            localStorage.setItem('employee_resolved_timezone', mappedTimezone);
            setTimezoneResolutionError(false);
          } else {
            // If country code not in map, try timezone API as fallback
            if (timezoneMode !== 'fixed') {
              try {
                const timezoneResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resolve-timezone`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                  },
                  body: JSON.stringify({
                    latitude: location.lat,
                    longitude: location.lng,
                    deviceTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone
                  })
                });

                if (timezoneResponse.ok) {
                  const timezoneData = await timezoneResponse.json();
                  if (timezoneData.timezone) {
                    setResolvedTimezone(timezoneData.timezone);
                    localStorage.setItem('employee_resolved_timezone', timezoneData.timezone);
                    setTimezoneResolutionError(false);
                  }
                }
              } catch (tzError) {
                console.error('Timezone API fallback failed:', tzError);
              }
            }

            // Check if we have a cached timezone, otherwise set error
            const cachedTimezone = localStorage.getItem('employee_resolved_timezone');
            if (!cachedTimezone && !resolvedTimezone) {
              setTimezoneResolutionError(true);
            }
          }
        } else {
          // Geocoding failed, check cache
          const cachedTimezone = localStorage.getItem('employee_resolved_timezone');
          if (!cachedTimezone) {
            setTimezoneResolutionError(true);
          }
        }
      } catch (error) {
        console.error('Error resolving timezone/location:', error);
        const cachedTimezone = localStorage.getItem('employee_resolved_timezone');
        if (!cachedTimezone) {
          setTimezoneResolutionError(true);
        }
      }
    }

    resolveTimezoneAndLocation();
  }, [location?.lat, location?.lng]);

  useEffect(() => {
    if (!employee) return;

    fetchPendingRequestsCount();

    const subscription = supabase
      .channel('leave_requests_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leave_requests',
          filter: `employee_id=eq.${employee.id}`
        },
        () => {
          fetchPendingRequestsCount();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [employee, fetchPendingRequestsCount]);

  const validateSession = async () => {
    console.log('[SESSION] ========== Starting session validation ==========');
    const sessionToken = localStorage.getItem('geoshift_session_token');
    const employeeData = localStorage.getItem('geoshift_employee');

    console.log('[SESSION] localStorage check:', {
      hasSessionToken: !!sessionToken,
      hasEmployeeData: !!employeeData
    });

    if (!sessionToken || !employeeData) {
      console.warn('[SESSION] No session found, redirecting to login');
      window.location.href = '/employee-login';
      return;
    }

    try {
      const emp = JSON.parse(employeeData);

      console.log('[SESSION] Parsed employee data:', {
        id: emp.id,
        company_id: emp.company_id,
        branch_id: emp.branch_id,
        full_name: emp.full_name
      });

      if (!emp.company_id) {
        console.error('[SESSION] Missing company_id, re-login required');
        handleLogout();
        return;
      }

      setEmployee(emp);
      console.log('[SESSION] Employee state set successfully');

      console.log('[INIT] Step 1: Ensuring company settings exist...');
      try {
        const { data: settingsResult, error: settingsError } = await supabase
          .rpc('upsert_company_settings', {
            p_company_id: emp.company_id
          });

        if (settingsError) {
          console.error('[INIT] Failed to ensure settings:', settingsError);
          console.log('[INIT] Continuing anyway - settings may be cached or already exist');
        } else {
          console.log('[INIT] Settings ensured successfully:', settingsResult);
        }
      } catch (settingsErr) {
        console.error('[INIT] Settings upsert exception (non-critical):', settingsErr);
        console.log('[INIT] Continuing with existing settings');
      }

      console.log('[INIT] Step 2: Loading attendance state...');
      try {
        await loadCurrentAttendance(emp.id, emp.company_id);
        console.log('[INIT] Attendance state loaded successfully');
      } catch (attendanceErr) {
        console.error('[INIT] Failed to load attendance:', attendanceErr);
        console.log('[INIT] Continuing without attendance data - employee can check-in normally');
      }

      console.log('[INIT] Step 3: Loading branch location...');
      try {
        await loadBranchLocation(emp.branch_id, emp.company_id);
        console.log('[INIT] Branch location loaded successfully');
      } catch (branchErr) {
        console.error('[INIT] Failed to load branch:', branchErr);
        console.log('[INIT] Continuing without branch data - may need to refresh');
      }

      console.log('[INIT] Step 4: Scheduling stats load...');
      setTimeout(() => {
        fetchMonthlyStatsData();
      }, 100);

      console.log('[SESSION] ========== Session validation completed ==========');
    } catch (err) {
      console.error('[SESSION] Validation error:', err);
      setError('فشل تحميل البيانات - يرجى المحاولة مرة أخرى');
    } finally {
      setLoading(false);
    }
  };

  const loadBranchLocation = async (branchId: string, companyId: string) => {
    const functionName = 'loadBranchLocation';
    setBranchDataSource(functionName);

    try {
      // ❌ HARD RULE: Branch ID must be provided
      if (!branchId) {
        const errorMsg = 'DATA INTEGRITY ERROR: No branch_id provided';
        console.error(`[${functionName}]`, errorMsg);
        setError('لم يتم تعيين فرع للموظف');
        throw new Error(errorMsg);
      }

      // ❌ HARD RULE: Company ID must be provided
      if (!companyId) {
        const errorMsg = 'DATA INTEGRITY ERROR: No company_id provided';
        console.error(`[${functionName}]`, errorMsg);
        setError('خطأ في معرف الشركة');
        throw new Error(errorMsg);
      }

      console.log(`[${functionName}] 🔄 HARD FETCH (NO CACHE):`, { branchId, companyId });

      // 🎯 HARD-CODED NO-CACHE FETCH: Always fetch fresh data by ID
      // SELECT id, company_id, name, latitude, longitude, geofence_radius, updated_at
      // FROM public.branches
      // WHERE id = branchId AND company_id = companyId AND is_active = true
      // LIMIT 1;
      const { data, error } = await supabase
        .from('branches')
        .select('id, company_id, name, latitude, longitude, geofence_radius, updated_at')
        .eq('id', branchId)
        .eq('company_id', companyId)
        .eq('is_active', true)
        .maybeSingle();

      // Record fetch time
      const fetchTime = new Date();
      setBranchFetchTime(fetchTime);

      // ❌ ASSERT: Query must not fail
      if (error) {
        const errorMsg = `RLS/QUERY ERROR: ${error.message}`;
        console.error(`[${functionName}]`, errorMsg, error);
        setError('فشل تحميل بيانات الفرع - خطأ في الاستعلام');
        throw new Error(errorMsg);
      }

      // ❌ ASSERT: Branch must exist
      if (!data) {
        const errorMsg = 'RLS/BRANCH NOT FOUND: Branch does not exist or RLS blocked access';
        console.error(`[${functionName}]`, errorMsg, { branchId, companyId });
        setError('الفرع غير موجود أو غير نشط');
        throw new Error(errorMsg);
      }

      // ❌ ASSERT: Company ID must match (DATA INTEGRITY CHECK)
      if (data.company_id !== companyId) {
        const errorMsg = 'DATA INTEGRITY ERROR: Branch company_id does not match employee company_id';
        console.error(`[${functionName}] 🚨`, errorMsg, {
          branchCompanyId: data.company_id,
          employeeCompanyId: companyId,
          branchId,
          branchName: data.name
        });
        setError('خطأ في تكامل البيانات - الفرع ينتمي لشركة أخرى');
        throw new Error(errorMsg);
      }

      // ✅ All assertions passed - store data
      const hasChanged = branchUpdatedAt !== data.updated_at;

      setBranchLocation({
        lat: data.latitude,
        lng: data.longitude,
        radius: data.geofence_radius
      });
      setBranchUpdatedAt(data.updated_at);

      // Store debug data for panel
      setBranchDebugData({
        id: data.id,
        company_id: data.company_id,
        name: data.name,
        latitude: data.latitude,
        longitude: data.longitude,
        geofence_radius: data.geofence_radius,
        updated_at: data.updated_at
      });

      // 🔍 DEBUG: Branch fetch results
      console.log('🔍 [BRANCH_REFRESH]', {
        function: functionName,
        fetch_time: fetchTime.toISOString(),
        employee_id: employee?.id,
        branch_id: data.id,
        branch_name: data.name,
        company_id: data.company_id,
        branch_lat: data.latitude,
        branch_lng: data.longitude,
        branch_radius: data.geofence_radius,
        branch_updated_at: data.updated_at,
        previous_updated_at: branchUpdatedAt,
        data_changed: hasChanged,
        integrity_checks: {
          company_id_match: true,
          branch_exists: true,
          query_succeeded: true
        }
      });

      console.log(`[${functionName}] ✅ Loaded successfully:`, {
        branchId: data.id,
        branchName: data.name,
        companyId: data.company_id,
        radius: data.geofence_radius,
        updated_at: data.updated_at,
        hasChanged
      });

      // Note: GPS re-evaluation happens automatically via useEffect when branchLocation changes
      if (hasChanged) {
        console.log(`[${functionName}] 🔄 Data changed, GPS distance will be recalculated automatically`);
      }

      return data; // Return for chaining if needed
    } catch (err) {
      console.error(`[${functionName}] ❌ Exception:`, err);
      setError('فشل تحميل بيانات الفرع');
      throw err; // Re-throw to allow caller to handle
    }
  };

  const loadCurrentAttendance = async (employeeId: string, companyId: string, retryCount = 0) => {
    const MAX_RETRIES = 2;

    try {
      const today = new Date().toISOString().split('T')[0];
      const nowUTC = new Date().toISOString();

      console.log('[LOAD_ATTENDANCE] Starting...', {
        employeeId,
        companyId,
        today,
        nowUTC,
        retry: retryCount,
        dateRange: {
          from: `${today}T00:00:00`,
          to: `${today}T23:59:59`
        }
      });

      const { data, error } = await supabase
        .from('attendance_logs')
        .select('id, check_in_time, check_out_time, company_id, employee_id')
        .eq('employee_id', employeeId)
        .eq('company_id', companyId)
        .gte('check_in_time', `${today}T00:00:00`)
        .lte('check_in_time', `${today}T23:59:59`)
        .is('check_out_time', null)
        .order('check_in_time', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('[LOAD_ATTENDANCE] Query error:', {
          error,
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });

        if (retryCount < MAX_RETRIES) {
          console.log('[LOAD_ATTENDANCE] Retrying...', retryCount + 1);
          await new Promise(resolve => setTimeout(resolve, 1000));
          return loadCurrentAttendance(employeeId, companyId, retryCount + 1);
        }

        console.error('[LOAD_ATTENDANCE] All retries exhausted, defaulting to no active session');
        setCurrentLog(null);
        currentLogRef.current = null;
        setAutoCheckout({
          active: false,
          reason: null,
          startedAtServerMs: null,
          endsAtServerMs: null,
          executionState: 'CANCELLED'
        });
        return;
      }

      if (!error && data) {
        console.log('[LOAD_ATTENDANCE] Found active session:', {
          status: 'CHECKED_IN',
          logId: data.id,
          checkInTime: data.check_in_time,
          companyId: data.company_id,
          employeeId: data.employee_id
        });
        setCurrentLog(data);
        currentLogRef.current = data;

        const { data: pendingData, error: pendingError } = await supabase
          .from('auto_checkout_pending')
          .select('id, reason, started_at, ends_at')
          .eq('employee_id', employeeId)
          .eq('company_id', companyId)
          .eq('attendance_log_id', data.id)
          .eq('status', 'PENDING')
          .maybeSingle();

        if (!pendingError && pendingData) {
          console.log('[LOAD_ATTENDANCE] Found pending auto-checkout:', pendingData);
          const endsAtMs = pendingData.ends_at ? new Date(pendingData.ends_at).getTime() : null;
          const startedAtMs = pendingData.started_at ? new Date(pendingData.started_at).getTime() : null;
          setAutoCheckout({
            active: true,
            reason: pendingData.reason as 'LOCATION_DISABLED' | 'OUT_OF_BRANCH',
            startedAtServerMs: startedAtMs,
            endsAtServerMs: endsAtMs,
            executionState: 'COUNTING'
          });
        } else {
          console.log('[LOAD_ATTENDANCE] No pending auto-checkout');
          setAutoCheckout({
            active: false,
            reason: null,
            startedAtServerMs: null,
            endsAtServerMs: null,
            executionState: 'CANCELLED'
          });
        }
      } else {
        console.log('[LOAD_ATTENDANCE] No active session:', {
          status: 'CHECKED_OUT'
        });
        setCurrentLog(null);
        currentLogRef.current = null;
        setAutoCheckout({
          active: false,
          reason: null,
          startedAtServerMs: null,
          endsAtServerMs: null,
          executionState: 'CANCELLED'
        });
      }
    } catch (err) {
      console.error('[LOAD_ATTENDANCE] Exception:', err);

      if (retryCount < MAX_RETRIES) {
        console.log('[LOAD_ATTENDANCE] Retrying after exception...', retryCount + 1);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return loadCurrentAttendance(employeeId, companyId, retryCount + 1);
      }

      throw err;
    }
  };

  const loadAutoCheckoutSettings = async () => {
    if (!employee?.id || !employee?.company_id) {
      console.log('[AC_SETTINGS] No employee loaded or missing company_id, skipping');
      return null;
    }

    try {
      const companyId = employee.company_id;
      console.log('[AC_SETTINGS] Loading for company:', companyId);

      const { data, error } = await supabase
        .from('auto_checkout_settings')
        .select('*')
        .eq('company_id', companyId)
        .maybeSingle();

      if (error) {
        console.error('[AC_SETTINGS] Load error:', error.message);

        console.log('[AC_SETTINGS] Attempting to create missing settings...');
        const { data: ensureResult, error: ensureError } = await supabase
          .rpc('ensure_auto_checkout_settings', {
            p_company_id: companyId
          });

        if (ensureError) {
          console.error('[AC_SETTINGS] Failed to create settings:', ensureError);
          const fallback = {
            id: 1,
            auto_checkout_enabled: true,
            auto_checkout_after_seconds: 900
          };
          setAutoCheckoutSettings(fallback);
          return fallback;
        }

        const createdSettings = ensureResult?.settings;
        if (createdSettings) {
          console.log('[AC_SETTINGS] Created settings:', createdSettings);
          setAutoCheckoutSettings(createdSettings);
          return createdSettings;
        }
      }

      if (!data) {
        console.log('[AC_SETTINGS] No settings found, creating...');
        const { data: ensureResult, error: ensureError } = await supabase
          .rpc('ensure_auto_checkout_settings', {
            p_company_id: companyId
          });

        if (ensureError) {
          console.error('[AC_SETTINGS] Failed to create settings:', ensureError);
          const fallback = {
            id: 1,
            auto_checkout_enabled: true,
            auto_checkout_after_seconds: 900
          };
          setAutoCheckoutSettings(fallback);
          return fallback;
        }

        const createdSettings = ensureResult?.settings;
        if (createdSettings) {
          console.log('[AC_SETTINGS] Created settings:', createdSettings);
          setAutoCheckoutSettings(createdSettings);
          return createdSettings;
        }

        const fallback = {
          id: 1,
          auto_checkout_enabled: true,
          auto_checkout_after_seconds: 900
        };
        setAutoCheckoutSettings(fallback);
        return fallback;
      }

      setAutoCheckoutSettings(data);
      console.log('[AC_SETTINGS] Loaded:', {
        enabled: data.auto_checkout_enabled,
        afterSec: data.auto_checkout_after_seconds,
        companyId
      });
      return data;
    } catch (err: any) {
      console.error('[AC_SETTINGS] Exception:', err?.message || String(err));
      const fallback = {
        id: 1,
        auto_checkout_enabled: true,
        auto_checkout_after_seconds: 900
      };
      setAutoCheckoutSettings(fallback);
      return fallback;
    }
  };

  const hasLocationWarning = (): { hasWarning: boolean; reason: 'LOCATION_DISABLED' | 'OUT_OF_BRANCH' | null } => {
    if (locationHealth.isDisabled || locationHealth.isStale) {
      return { hasWarning: true, reason: 'LOCATION_DISABLED' };
    }

    if (!location && locationState !== 'LOCATING') {
      return { hasWarning: true, reason: 'LOCATION_DISABLED' };
    }

    if (isConfirmedOutside && location) {
      return { hasWarning: true, reason: 'OUT_OF_BRANCH' };
    }

    return { hasWarning: false, reason: null };
  };

  const syncAutoCheckoutState = async (isPolling = false) => {
    if (!employee || !currentLog) {
      return;
    }

    try {
      const { data: logData } = await supabase
        .from('attendance_logs')
        .select('check_out_time, checkout_type')
        .eq('id', currentLog.id)
        .maybeSingle();

      const logCheckedOut = logData?.check_out_time !== null;

      if (!isPolling) {
        console.log('[SYNC_STATE]', {
          logCheckedOut,
          checkoutType: logData?.checkout_type
        });
      }

      if (logCheckedOut) {
        if (currentLog) {
          console.log('[SYNC_STATE] Checkout detected, clearing current log');
          setCurrentLog(null);
          currentLogRef.current = null;
          setAutoCheckout({
            active: false,
            reason: null,
            startedAtServerMs: null,
            endsAtServerMs: null,
            executionState: 'DONE'
          });

          if (logData?.checkout_type === 'AUTO') {
            setShowAutoCheckoutToast(true);
            setTimeout(() => setShowAutoCheckoutToast(false), 5000);
          }
        }
      }
    } catch (err) {
      console.error('[SYNC_ERROR]', err);
    }
  };

  const sendHeartbeat = async () => {
    if (!employee || !currentLog) {
      return;
    }

    if (!isAppVisibleRef.current) {
      console.log('[HEARTBEAT_SKIPPED] App not visible');
      return;
    }

    try {
      const gpsOk = !locationHealth.isDisabled && !locationHealth.isStale && location !== null;
      const inBranch = !isConfirmedOutside && location !== null;

      if (location && gpsOk) {
        lastValidLocationRef.current = location;
      }

      const { data, error } = await supabase
        .rpc('record_heartbeat_and_check_auto_checkout', {
          p_employee_id: employee.id,
          p_attendance_log_id: currentLog.id,
          p_in_branch: inBranch,
          p_gps_ok: gpsOk,
          p_latitude: location?.lat || null,
          p_longitude: location?.lng || null,
          p_accuracy: location?.accuracy || null
        });

      if (error) {
        console.error('[HEARTBEAT_ERROR]', error);
        return;
      }

      console.log('[HEARTBEAT_SENT]', { gpsOk, inBranch, response: data });

      if (data?.auto_checkout_executed) {
        console.log('[AUTO_CHECKOUT_EXECUTED]', data.reason);
        setCurrentLog(null);
        currentLogRef.current = null;
        setAutoCheckout({
          active: false,
          reason: null,
          startedAtServerMs: null,
          endsAtServerMs: null,
          executionState: 'DONE'
        });
        setShowAutoCheckoutToast(true);
        setTimeout(() => setShowAutoCheckoutToast(false), 5000);
      } else if (data?.pending_cancelled) {
        console.log('[PENDING_CANCELLED]', data.reason);
        setAutoCheckout({
          active: false,
          reason: null,
          startedAtServerMs: null,
          endsAtServerMs: null,
          executionState: 'CANCELLED'
        });
      } else if (data?.pending_created || data?.pending_active) {
        const endsAtMs = data.ends_at ? new Date(data.ends_at).getTime() : null;
        setAutoCheckout({
          active: true,
          reason: data.reason as 'LOCATION_DISABLED' | 'OUT_OF_BRANCH',
          startedAtServerMs: endsAtMs ? endsAtMs - (data.seconds_remaining || 0) * 1000 : null,
          endsAtServerMs: endsAtMs,
          executionState: 'COUNTING'
        });
      } else if (data?.status === 'OK') {
        setAutoCheckout({
          active: false,
          reason: null,
          startedAtServerMs: null,
          endsAtServerMs: null,
          executionState: 'CANCELLED'
        });
      }
    } catch (err) {
      console.error('[HEARTBEAT_ERROR]', err);
    }
  };

  const handleCheckOutRef = useRef<((options?: { source?: 'manual' | 'auto' }) => Promise<void>) | null>(null);
  const autoCheckoutTimerRef = useRef<number | null>(null);
  const autoCheckoutRef = useRef(autoCheckout);
  const autoCheckoutPendingIdRef = useRef<string | null>(null);
  const locationHeartbeatIntervalRef = useRef<number | null>(null);
  const retryCheckoutTimerRef = useRef<number | null>(null);
  const retryCheckoutAttemptsRef = useRef<number>(0);

  const startWatchingLocation = async () => {
    ensureLocationFlow();
  };

  const stopWatchingLocation = () => {
    stopLocationWatcher();
    stopLocationPollingWhenOff();
    stopLocationSupervisor();
    if (locationPollingRef.current) {
      clearInterval(locationPollingRef.current);
      locationPollingRef.current = null;
    }
    if (locationAttemptTimerRef.current) {
      clearTimeout(locationAttemptTimerRef.current);
      locationAttemptTimerRef.current = null;
    }
  };

  const getValidLocationForCheckIn = (): Promise<{ lat: number; lng: number; accuracy: number; timestamp: number }> => {
    return new Promise((resolve, reject) => {
      const MAX_TIMEOUT_MS = 30000;
      const RETRY_INTERVAL_MS = 3000;
      const MAX_ACCURACY_METERS = 80;
      const MAX_AGE_SECONDS = 20;

      const startTime = Date.now();
      let attemptCount = 0;

      const cleanupTimers = () => {
        if (preCheckInTimerRef.current) {
          clearInterval(preCheckInTimerRef.current);
          preCheckInTimerRef.current = null;
        }
        if (preCheckInRetryRef.current) {
          clearTimeout(preCheckInRetryRef.current);
          preCheckInRetryRef.current = null;
        }
      };

      preCheckInTimerRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setPreCheckInElapsedSec(elapsed);
      }, 1000);

      const attemptGetLocation = () => {
        attemptCount++;
        const attemptStartTime = Date.now();

        navigator.geolocation.getCurrentPosition(
          (position) => {
            const now = Date.now();
            const readingAge = (now - position.timestamp) / 1000;
            const accuracy = position.coords.accuracy;

            if (accuracy <= MAX_ACCURACY_METERS && readingAge <= MAX_AGE_SECONDS) {
              cleanupTimers();
              setPreCheckInVerifying(false);
              setPreCheckInElapsedSec(0);
              resolve({
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                accuracy: accuracy,
                timestamp: position.timestamp
              });
            } else {
              const elapsedTotal = now - startTime;
              if (elapsedTotal >= MAX_TIMEOUT_MS) {
                cleanupTimers();
                setPreCheckInVerifying(false);
                setPreCheckInElapsedSec(0);
                reject(new Error('TIMEOUT'));
              } else {
                preCheckInRetryRef.current = window.setTimeout(attemptGetLocation, RETRY_INTERVAL_MS);
              }
            }
          },
          (error) => {
            const elapsedTotal = Date.now() - startTime;
            if (elapsedTotal >= MAX_TIMEOUT_MS) {
              cleanupTimers();
              setPreCheckInVerifying(false);
              setPreCheckInElapsedSec(0);
              reject(new Error('TIMEOUT'));
            } else {
              preCheckInRetryRef.current = window.setTimeout(attemptGetLocation, RETRY_INTERVAL_MS);
            }
          },
          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0
          }
        );
      };

      attemptGetLocation();
    });
  };

  const handleCheckIn = async () => {
    if (!employee) {
      setError('طلب غير صالح');
      return;
    }

    setError('');
    setPreCheckInError('');
    setPreCheckInVerifying(true);
    setPreCheckInElapsedSec(0);

    try {
      const validLocation = await getValidLocationForCheckIn();

      setLocation({
        lat: validLocation.lat,
        lng: validLocation.lng,
        accuracy: validLocation.accuracy,
        timestamp: validLocation.timestamp
      });

      if (branchLocation) {
        const distance = calculateDistance(
          validLocation.lat,
          validLocation.lng,
          branchLocation.lat,
          branchLocation.lng
        );

        if (distance > branchLocation.radius) {
          setPreCheckInError('أنت خارج نطاق موقع الفرع');
          return;
        }
      }

      setActionLoading(true);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/employee-check-in`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            employee_id: employee.id,
            location: {
              lat: validLocation.lat,
              lng: validLocation.lng,
              accuracy: validLocation.accuracy,
              timestamp: validLocation.timestamp
            },
            deviceTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone
          })
        }
      );

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.message_ar || 'فشل تسجيل الحضور');
      }

      console.log('[CHECKIN_SUCCESS] Check-in completed:', {
        logId: result.data.id,
        checkInTime: result.data.check_in_time,
        companyId: result.data.company_id,
        employeeId: result.data.employee_id
      });

      setCurrentLog(result.data);
      currentLogRef.current = result.data;

      console.log('[CHECKIN_SUCCESS] State updated:', {
        status: 'CHECKED_IN',
        currentLogId: result.data.id,
        hasCurrentLog: true
      });

      console.log('[CHECKIN_SUCCESS] Attendance record should persist after refresh with these filters:', {
        employee_id: employee.id,
        company_id: employee.company_id,
        today: new Date().toISOString().split('T')[0],
        check_out_time: 'IS NULL'
      });

      fetchMonthlyStatsData();
    } catch (err: any) {
      if (err.message === 'TIMEOUT') {
        setPreCheckInError('TIMEOUT');
      } else {
        setError(err.message || 'فشل تسجيل الحضور');
      }
      console.error('Check-in error:', err);
    } finally {
      setActionLoading(false);
      setPreCheckInVerifying(false);
      setPreCheckInElapsedSec(0);
    }
  };

  const handleCheckOut = async (options?: { source?: 'manual' | 'auto' }) => {
    const source = options?.source || 'manual';

    console.log('[CHECKOUT_REQUEST]', { source });

    if (!employee || !currentLog) {
      setError('طلب غير صالح');
      return;
    }

    // MANUAL checkout: Block if outside branch (requires user to be inside)
    // AUTO checkout: NEVER blocked - executes regardless of location
    if (source === 'manual' && isConfirmedOutside) {
      console.log('[CHECKOUT_BLOCKED]', { reason: 'outside_branch_manual' });
      setError('أنت خارج نطاق موقع الفرع');
      return;
    }

    setActionLoading(true);
    setError('');
    setShowConfirmation(false);

    console.log('[CHECKOUT_EXECUTED]', { source });

    try {
      const checkoutLocation = location || { lat: 0, lng: 0, accuracy: 0, timestamp: Date.now() };

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/employee-check-out`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            employee_id: employee.id,
            location: {
              lat: checkoutLocation.lat,
              lng: checkoutLocation.lng,
              accuracy: checkoutLocation.accuracy,
              timestamp: checkoutLocation.timestamp
            },
            deviceTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone
          })
        }
      );

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.message_ar || 'فشل تسجيل الانصراف');
      }

      if (source === 'auto' && currentLog) {
        const checkoutReason = autoCheckoutRef.current.reason === 'LOCATION_DISABLED'
          ? 'LOCATION_DISABLED'
          : autoCheckoutRef.current.reason === 'OUT_OF_BRANCH'
          ? 'OUT_OF_BRANCH'
          : 'AUTO';

        await supabase
          .from('attendance_logs')
          .update({
            checkout_type: 'AUTO',
            checkout_reason: checkoutReason
          })
          .eq('id', currentLog.id);
      }

      setCurrentLog(null);
      currentLogRef.current = null;

      fetchMonthlyStatsData();

      if (source === 'auto') {
        setShowAutoCheckoutToast(true);
        setTimeout(() => setShowAutoCheckoutToast(false), 5000);
      }
    } catch (err: any) {
      setError(err.message || 'فشل تسجيل الانصراف');
      console.error('[CHECKOUT_ERROR]', { source, error: err.message || err });
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    handleCheckOutRef.current = handleCheckOut;
  }, [handleCheckOut]);

  useEffect(() => {
    autoCheckoutRef.current = autoCheckout;
  }, [autoCheckout]);

  // Mount/Resume: Fetch from DB only (NEVER create)
  useEffect(() => {
    if (!currentLog || !employee) {
      return;
    }

    syncAutoCheckoutState();
  }, [currentLog, employee]);

  // Polling every 5 seconds for live updates
  useEffect(() => {
    if (!currentLog || !employee) {
      return;
    }

    const pollingInterval = window.setInterval(() => {
      syncAutoCheckoutState(true);
    }, 5000);

    return () => {
      clearInterval(pollingInterval);
    };
  }, [currentLog, employee]);

  // Window focus/visibility handlers
  useEffect(() => {
    const handleFocus = () => {
      if (currentLog && employee) {
        syncAutoCheckoutState();
      }
    };

    const handleVisibilityChange = () => {
      if (!document.hidden && currentLog && employee) {
        syncAutoCheckoutState();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentLog, employee]);

  // Countdown tick (independent) - updates nowMs every second
  useEffect(() => {
    if (autoCheckout.active && autoCheckout.endsAtServerMs) {
      if (autoCheckoutTimerRef.current) {
        clearInterval(autoCheckoutTimerRef.current);
      }

      autoCheckoutTimerRef.current = window.setInterval(() => {
        const now = Date.now();
        setNowMs(now);

        const remainingSec = Math.max(0, Math.ceil((autoCheckout.endsAtServerMs! - now) / 1000));
        console.log('[TICK]', remainingSec);
      }, 1000);

      return () => {
        if (autoCheckoutTimerRef.current) {
          clearInterval(autoCheckoutTimerRef.current);
          autoCheckoutTimerRef.current = null;
        }
      };
    } else {
      if (autoCheckoutTimerRef.current) {
        clearInterval(autoCheckoutTimerRef.current);
        autoCheckoutTimerRef.current = null;
      }
    }
  }, [autoCheckout.active, autoCheckout.endsAtServerMs]);

  // Heartbeat interval
  useEffect(() => {
    if (!currentLog || !employee) {
      if (locationHeartbeatIntervalRef.current) {
        clearInterval(locationHeartbeatIntervalRef.current);
        locationHeartbeatIntervalRef.current = null;
      }
      return;
    }

    sendHeartbeat();

    const heartbeatInterval = autoCheckout.active ? 3000 : 15000;
    console.log('[HEARTBEAT_INTERVAL]', heartbeatInterval, 'ms', autoCheckout.active ? '(countdown active)' : '(normal)');

    locationHeartbeatIntervalRef.current = window.setInterval(() => {
      const currentEmployee = employeeRef.current;
      const currentAttendanceLog = currentLogRef.current;
      const currentLocation = locationRef.current;
      const currentLocationHealth = locationHealthRef.current;
      const currentIsConfirmedOutside = isConfirmedOutsideRef.current;
      const currentIsAppVisible = isAppVisibleRef.current;

      if (!currentEmployee || !currentAttendanceLog) {
        return;
      }

      if (!currentIsAppVisible) {
        console.log('[HEARTBEAT_SKIPPED] App not visible');
        return;
      }

      const gpsOk = !currentLocationHealth.isDisabled && !currentLocationHealth.isStale && currentLocation !== null;
      const inBranch = !currentIsConfirmedOutside && currentLocation !== null;

      if (currentLocation && gpsOk) {
        lastValidLocationRef.current = currentLocation;
      }

      supabase
        .rpc('record_heartbeat_and_check_auto_checkout', {
          p_employee_id: currentEmployee.id,
          p_attendance_log_id: currentAttendanceLog.id,
          p_in_branch: inBranch,
          p_gps_ok: gpsOk,
          p_latitude: currentLocation?.lat || null,
          p_longitude: currentLocation?.lng || null,
          p_accuracy: currentLocation?.accuracy || null
        })
        .then(({ data, error }) => {
          if (error) {
            console.error('[HEARTBEAT_ERROR]', error);
            return;
          }

          console.log('[HEARTBEAT_SENT]', { gpsOk, inBranch, response: data });

          if (data?.auto_checkout_executed) {
            console.log('[AUTO_CHECKOUT_EXECUTED]', data.reason);
            setCurrentLog(null);
            currentLogRef.current = null;
            setAutoCheckout({
              active: false,
              reason: null,
              startedAtServerMs: null,
              endsAtServerMs: null,
              executionState: 'DONE'
            });
            setShowAutoCheckoutToast(true);
            setTimeout(() => setShowAutoCheckoutToast(false), 5000);
          } else if (data?.pending_created || data?.pending_active) {
            const endsAtMs = data.ends_at ? new Date(data.ends_at).getTime() : null;
            setAutoCheckout({
              active: true,
              reason: data.reason as 'LOCATION_DISABLED' | 'OUT_OF_BRANCH',
              startedAtServerMs: endsAtMs ? endsAtMs - (data.seconds_remaining || 0) * 1000 : null,
              endsAtServerMs: endsAtMs,
              executionState: 'COUNTING'
            });
          } else if (data?.pending_cancelled) {
            console.log('[AUTO_CHECKOUT_CANCELLED]', data.reason);
            setAutoCheckout({
              active: false,
              reason: null,
              startedAtServerMs: null,
              endsAtServerMs: null,
              executionState: 'CANCELLED'
            });
          } else if (data?.status === 'OK') {
            setAutoCheckout({
              active: false,
              reason: null,
              startedAtServerMs: null,
              endsAtServerMs: null,
              executionState: 'CANCELLED'
            });
          }
        })
        .catch((err) => {
          console.error('[HEARTBEAT_EXCEPTION]', err);
        });
    }, heartbeatInterval);

    return () => {
      if (locationHeartbeatIntervalRef.current) {
        clearInterval(locationHeartbeatIntervalRef.current);
        locationHeartbeatIntervalRef.current = null;
      }
    };
  }, [currentLog, employee, autoCheckout.active]);

  const handleLogout = () => {
    localStorage.removeItem('geoshift_session_token');
    localStorage.removeItem('geoshift_employee');
    window.location.href = '/employee-login';
  };

  const getElapsedTime = () => {
    if (!currentLog) return { hours: 0, minutes: 0, seconds: 0, percentage: 0 };

    const checkInTime = new Date(currentLog.check_in_time);
    const now = new Date();
    const diffMs = now.getTime() - checkInTime.getTime();
    const totalSeconds = Math.floor(diffMs / 1000);

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const shiftDuration = 8 * 60 * 60;
    const percentage = Math.min((totalSeconds / shiftDuration) * 100, 100);

    return { hours, minutes, seconds, percentage };
  };

  const elapsed = getElapsedTime();
  const ShiftIcon = theme.icon;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F6FA] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-hidden" style={{ height: '874px', maxHeight: '874px', background: 'linear-gradient(145deg, #F8F9FC 0%, #F0F2F8 50%, #EAECF4 100%)' }}>
      <div className="max-w-md mx-auto h-full flex flex-col px-4" style={{ width: '402px', maxWidth: '402px' }}>
        {/* Top Bar - RTL: Profile (left) | الطلبات (center) | رجوع (right) */}
        <div
          className="flex items-center justify-between pt-4 pb-3"
          dir="rtl"
          style={{
            position: 'relative',
            zIndex: 10
          }}
        >
          {/* Right (RTL): رجوع button */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 backdrop-blur-sm transition-all hover:scale-[1.02] flex-shrink-0"
            style={{
              height: '40px',
              paddingLeft: '16px',
              paddingRight: '16px',
              background: 'rgba(255,255,255,0.95)',
              boxShadow: '0 4px 16px rgba(30,55,90,0.1)',
              border: '1px solid #E6ECFF',
              borderRadius: '24px'
            }}
          >
            <span className="text-sm font-semibold" style={{ color: '#1C2B4A' }}>رجوع</span>
            <ArrowRight className="w-4 h-4" style={{ color: '#6D7A99' }} strokeWidth={1.5} />
          </button>

          {/* Center: الطلبات button (3x width of رجوع) */}
          <div className="relative" style={{ width: '210px' }}>
            <button
              onClick={() => setShowRequestsSheet(true)}
              className="w-full flex items-center justify-center gap-2 requests-button"
              style={{
                height: '40px',
                background: 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)',
                boxShadow: '0 6px 20px rgba(139,92,246,0.35)',
                borderRadius: '24px'
              }}
            >
              <span className="text-sm font-bold text-white">الطلبات</span>
              <ChevronDown
                className={`w-4 h-4 text-white requests-arrow ${showRequestsSheet ? 'rotate-180' : 'rotate-0'}`}
                strokeWidth={2}
              />
            </button>

            {/* Badge - only show when count > 0 */}
            {pendingRequestsCount !== null && pendingRequestsCount > 0 && (
              <div
                className="absolute flex items-center justify-center badge-pop-in"
                style={{
                  top: '-6px',
                  left: '-6px',
                  minWidth: '20px',
                  height: '20px',
                  padding: '0 6px',
                  background: '#FF3B30',
                  borderRadius: '10px',
                  border: '2px solid white',
                  boxShadow: '0 2px 8px rgba(255,59,48,0.4)',
                  zIndex: 51
                }}
              >
                <span className="text-[11px] font-bold text-white leading-none">
                  {pendingRequestsCount > 99 ? '99+' : pendingRequestsCount}
                </span>
              </div>
            )}
          </div>

          {/* Left (RTL): Profile icon button */}
          <button
            className="flex items-center justify-center backdrop-blur-sm transition-all hover:scale-[1.05] flex-shrink-0"
            style={{
              width: '40px',
              height: '40px',
              background: 'rgba(255,255,255,0.95)',
              boxShadow: '0 4px 16px rgba(30,55,90,0.1)',
              border: '1px solid #E6ECFF',
              borderRadius: '50%'
            }}
          >
            <User className="w-5 h-5" style={{ color: '#6D7A99' }} strokeWidth={1.5} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto pb-4 space-y-1" style={{ maxHeight: 'calc(874px - 60px)', paddingTop: '14px' }}>
          {/* Time Card */}
          <ServerTimeCard
            gpsCoordinates={location}
            onTimeSyncUpdate={(sync) => setTimeSync(sync)}
            employeeId={employee?.id}
            timezone={resolvedTimezone}
            locationCity={locationCity}
            locationCountry={locationCountry}
          />

          {/* Profile Card */}
          <div
            className="bg-white p-4"
            style={{
              borderRadius: '20px',
              boxShadow: '0 10px 24px rgba(30,55,90,0.12), inset 0 -2px 10px rgba(255,255,255,0.8)',
              border: '1px solid #E6ECFF'
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div style={{ boxShadow: '0 4px 12px rgba(74,140,219,0.3)' }} className="rounded-full">
                  <Avatar
                    src={employee?.avatar_url}
                    name={employee?.full_name || ''}
                    size="md"
                  />
                </div>
                <div className="text-right" dir="rtl">
                  <h3 className="text-base font-bold" style={{ color: '#1C2B4A' }}>{employee?.full_name}</h3>
                  <p className="text-xs" style={{ color: '#6D7A99' }}>مهندس برمجيات · {employee?.employee_code}</p>
                </div>
              </div>

              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                style={{
                  background: theme.type === 'morning' ? 'rgba(244,161,26,0.1)' : 'rgba(59,111,182,0.1)'
                }}
              >
                <ShiftIcon className="w-3.5 h-3.5" style={{ color: theme.shiftColor }} strokeWidth={1.5} />
                <span className="text-xs font-medium" style={{ color: theme.shiftColor }}>
                  {theme.type === 'morning' ? 'وردية صباحية' : 'وردية مسائية'}
                </span>
              </div>
            </div>
          </div>



          {/* Status/Progress Card */}
          {currentLog ? (
            <div
              className="bg-white p-3.5 space-y-2.5"
              style={{
                borderRadius: '20px',
                boxShadow: '0 10px 24px rgba(30,55,90,0.12), inset 0 -2px 10px rgba(255,255,255,0.8)',
                border: '1px solid #E6ECFF'
              }}
            >
              {/* Status Row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(62,213,152,0.12)' }}
                  >
                    <ArrowUpCircle className="w-4 h-4 text-green-600" strokeWidth={1.5} />
                  </div>
                  <div className="text-right" dir="rtl">
                    <p className="text-xs" style={{ color: '#6D7A99' }}>الحضور</p>
                    <p className="text-sm font-semibold" style={{ color: '#1C2B4A' }}>
                      {new Date(currentLog.check_in_time).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(109,122,153,0.08)' }}
                  >
                    <Clock className="w-4 h-4" style={{ color: '#98A4C0' }} strokeWidth={1.5} />
                  </div>
                  <div className="text-right" dir="rtl">
                    <p className="text-xs" style={{ color: '#6D7A99' }}>الانصراف</p>
                    <p className="text-sm font-semibold" style={{ color: '#98A4C0' }}>لم يتم بعد</p>
                  </div>
                </div>
              </div>

              {/* Timer Section */}
              <div className="flex items-center justify-between py-2">
                <div className="text-right" dir="rtl">
                  <p className="text-xs mb-1" style={{ color: '#6D7A99' }}>الوقت المنقضي</p>
                  <div className="text-2xl font-bold font-mono" style={{ color: '#1C2B4A' }} dir="ltr">
                    {elapsed.hours.toString().padStart(2, '0')}:
                    {elapsed.minutes.toString().padStart(2, '0')}:
                    {elapsed.seconds.toString().padStart(2, '0')}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5" style={{ color: '#98A4C0' }} strokeWidth={1.5} />
                  <span className="text-2xl font-bold" style={{ color: '#3B6FB6' }}>{Math.floor(elapsed.percentage)}%</span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(109,122,153,0.1)' }}>
                  <div
                    className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 rounded-full transition-all duration-300"
                    style={{ width: `${elapsed.percentage}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs" style={{ color: '#98A4C0' }}>
                  <span>08:00 ص</span>
                  <span className="text-center" dir="rtl">
                    {elapsed.hours} ساعة و {elapsed.minutes} دقيقة من 8 ساعات
                  </span>
                  <span>04:00 م</span>
                </div>
              </div>
            </div>
          ) : (
            <div
              className="bg-white p-5 text-center"
              style={{
                borderRadius: '20px',
                boxShadow: '0 10px 24px rgba(30,55,90,0.12), inset 0 -2px 10px rgba(255,255,255,0.8)',
                border: '1px solid #E6ECFF'
              }}
            >
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3"
                style={{ background: 'rgba(59,111,182,0.1)' }}
              >
                <Clock className="w-7 h-7" style={{ color: '#3B6FB6' }} strokeWidth={1.5} />
              </div>
              <p className="text-base font-medium mb-1.5" style={{ color: '#1C2B4A' }}>لم يتم تسجيل الحضور بعد</p>
              <p className="text-sm" style={{ color: '#6D7A99' }}>اضغط على زر تسجيل الحضور للبدء</p>
            </div>
          )}

          {/* Monthly Average Hours Card */}
          {loadingStats ? (
            <div
              className="bg-white p-3.5"
              style={{
                borderRadius: '18px',
                boxShadow: '0 10px 24px rgba(30,55,90,0.12), inset 0 -2px 10px rgba(255,255,255,0.8)',
                border: '1px solid #E6ECFF'
              }}
            >
              <div className="h-3 rounded animate-pulse mb-2 w-32" style={{ background: 'rgba(109,122,153,0.15)' }}></div>
              <div className="flex gap-3">
                <div className="flex-1 h-12 rounded animate-pulse" style={{ background: 'rgba(109,122,153,0.08)' }}></div>
                <div className="flex-1 h-12 rounded animate-pulse" style={{ background: 'rgba(109,122,153,0.08)' }}></div>
              </div>
            </div>
          ) : monthlyStats ? (
            <div
              className="bg-white p-3.5"
              style={{
                borderRadius: '18px',
                boxShadow: '0 10px 24px rgba(30,55,90,0.12), inset 0 -2px 10px rgba(255,255,255,0.8)',
                border: '1px solid #E6ECFF'
              }}
            >
              <div className="flex items-center justify-between mb-2" dir="rtl">
                <h3 className="text-xs font-medium" style={{ color: '#6D7A99' }}>متوسط ساعات العمل</h3>
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(59,111,182,0.1)' }}
                >
                  <Calculator className="w-4 h-4" style={{ color: '#3B6FB6' }} strokeWidth={1.5} />
                </div>
              </div>

              <div className="text-right" dir="rtl">
                <div className="flex items-baseline justify-end gap-1.5">
                  <span className="text-xs" style={{ color: '#98A4C0' }}>ساعة/يوم</span>
                  <span className="text-2xl font-bold" style={{ color: '#1C2B4A' }} dir="ltr">
                    {monthlyStats.totalHours === 0 ? '0.0' : monthlyStats.averageHoursPerDay.toFixed(1)}
                  </span>
                </div>
              </div>
            </div>
          ) : null}

          {/* Unified System Status Card - Always above action button with fixed height */}
          <div
            className="transition-all duration-300 ease-in-out"
            style={{
              minHeight: '52px',
              opacity: 1,
              transform: 'scale(1)'
            }}
          >
            {autoCheckout.executionState === 'DONE' && currentLog === null ? (
              <div
                className="flex items-center gap-3 p-3.5"
                style={{
                  borderRadius: '12px',
                  background: 'rgba(62,213,152,0.08)',
                  border: '1px solid rgba(62,213,152,0.2)'
                }}
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(62,213,152,0.15)' }}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-600" strokeWidth={1.5} />
                </div>
                <p className="text-sm font-medium leading-tight" style={{ color: '#1C2B4A' }} dir="rtl">
                  تم تسجيل الانصراف تلقائيًا
                </p>
              </div>
            ) : error ? (
              <div
                className="flex items-center gap-3 p-3.5"
                style={{
                  borderRadius: '12px',
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.2)'
                }}
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(239,68,68,0.15)' }}
                >
                  <XCircle className="w-3.5 h-3.5 text-red-600" strokeWidth={1.5} />
                </div>
                <p className="text-sm font-medium text-red-800 leading-tight">{error}</p>
              </div>
            ) : (locationState === 'LOCATING' || locationHealth.isDisabled) && !autoCheckout.active ? (
              <div
                className="flex items-center gap-3 p-3.5"
                style={{
                  borderRadius: '12px',
                  background: 'rgba(59,111,182,0.08)',
                  border: '1px solid rgba(59,111,182,0.15)'
                }}
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(59,111,182,0.12)' }}
                >
                  <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: '#3B6FB6' }} strokeWidth={1.5} />
                </div>
                <p className="text-sm font-medium leading-tight" style={{ color: '#1C2B4A' }} dir="rtl">
                  {LOCATING_MESSAGES[locatingMessageIndex]}
                </p>
              </div>
            ) : locationState !== 'LOCATING' && !locationHealth.isDisabled && locationHealth.isStale && !autoCheckout.active ? (
              <div
                className="flex items-center gap-3 p-3.5"
                style={{
                  borderRadius: '12px',
                  background: 'rgba(245,158,11,0.08)',
                  border: '1px solid rgba(245,158,11,0.2)'
                }}
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(245,158,11,0.15)' }}
                >
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" strokeWidth={1.5} />
                </div>
                <p className="text-sm font-medium leading-tight" style={{ color: '#1C2B4A' }} dir="rtl">
                  تعذر تحديث الموقع حاليًا
                </p>
              </div>
            ) : locationState === 'OK' && isConfirmedOutside && !currentLog ? (
              <div
                className="flex items-center gap-3 p-3.5"
                style={{
                  borderRadius: '12px',
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.2)'
                }}
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(239,68,68,0.15)' }}
                >
                  <AlertCircle className="w-3.5 h-3.5 text-red-600" strokeWidth={1.5} />
                </div>
                <p className="text-sm font-medium leading-tight" style={{ color: '#1C2B4A' }} dir="rtl">
                  خارج نطاق الفرع
                </p>
              </div>
            ) : locationState === 'OK' && !isConfirmedOutside && !currentLog ? (
              <div
                className="flex items-center gap-3 p-3.5"
                style={{
                  borderRadius: '12px',
                  background: 'rgba(62,213,152,0.08)',
                  border: '1px solid rgba(62,213,152,0.2)'
                }}
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(62,213,152,0.15)' }}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-600" strokeWidth={1.5} />
                </div>
                <p className="text-sm font-medium leading-tight" style={{ color: '#1C2B4A' }} dir="rtl">
                  تم التحقق من موقعك - جاهز للتسجيل
                </p>
              </div>
            ) : currentLog && locationHealth.isFresh && !autoCheckout.active ? (
              <div
                className="flex items-center gap-3 p-3.5"
                style={{
                  borderRadius: '12px',
                  background: 'rgba(62,213,152,0.08)',
                  border: '1px solid rgba(62,213,152,0.2)'
                }}
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(62,213,152,0.15)' }}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-600" strokeWidth={1.5} />
                </div>
                <p className="text-sm font-medium leading-tight" style={{ color: '#1C2B4A' }} dir="rtl">
                  مراقبة الدوام نشطة
                </p>
              </div>
            ) : null}
          </div>

          {/* Action Button */}
          <div className="space-y-3">
            <button
              onClick={() => {
                // MANUAL CHECKOUT PATH: Show confirmation modal
                if (currentLog && !autoCheckout.active) {
                  console.log('[CONFIRM_SHOWN]');
                  setShowConfirmation(true);
                } else if (!currentLog) {
                  handleCheckIn();
                }
              }}
              disabled={loading || preCheckInVerifying || actionLoading || autoCheckout.active || (!currentLog && (locationState === 'LOCATING' || locationState === 'STALE')) || !employee || !branchLocation}
              className="w-full text-white py-4 font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex flex-col items-center justify-center gap-2"
              style={{
                borderRadius: '20px',
                background: preCheckInVerifying
                  ? 'linear-gradient(135deg, #4A8CDB 0%, #3B6FB6 100%)'
                  : autoCheckout.active
                  ? 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)'
                  : currentLog
                  ? 'linear-gradient(135deg, #FF3B30 0%, #FFB300 100%)'
                  : 'linear-gradient(135deg, #3ED598 0%, #2EBD7F 100%)',
                boxShadow: '0 10px 24px rgba(30,55,90,0.2)'
              }}
            >
              {preCheckInVerifying ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span>جاري تحديد الموقع...</span>
                  <div className="text-sm font-mono opacity-90" dir="ltr">
                    {preCheckInElapsedSec}s / 30s
                  </div>
                </>
              ) : actionLoading ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span>جاري المعالجة...</span>
                </>
              ) : autoCheckout.executionState === 'EXECUTING' ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span className="text-base">جاري تنفيذ الانصراف...</span>
                </>
              ) : autoCheckout.executionState === 'COUNTING' && autoCheckout.active ? (
                <>
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-6 h-6" />
                    <span className="text-base">انصراف تلقائي خلال</span>
                  </div>
                  <div className="text-3xl font-mono font-bold tracking-wider" dir="ltr">
                    {(() => {
                      const remainingSec = autoCheckout.endsAtServerMs
                        ? Math.max(0, Math.ceil((autoCheckout.endsAtServerMs - nowMs) / 1000))
                        : 0;

                      return `${Math.floor(remainingSec / 60).toString().padStart(2, '0')}:${(remainingSec % 60).toString().padStart(2, '0')}`;
                    })()}
                  </div>
                  <div className="text-xs opacity-90">
                    {autoCheckout.reason === 'LOCATION_DISABLED' ? 'خدمة الموقع معطلة' : 'خارج نطاق الفرع'}
                  </div>
                </>
              ) : !currentLog && locationState === 'LOCATING' ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">جاري تحديد الموقع...</span>
                </>
              ) : !currentLog && locationState === 'STALE' ? (
                <>
                  <AlertCircle className="w-5 h-5" />
                  <span className="text-sm">بانتظار تحديث الموقع</span>
                </>
              ) : (
                <>
                  <Fingerprint className="w-6 h-6" />
                  <span>{currentLog ? 'تسجيل الانصراف' : 'تسجيل الحضور'}</span>
                </>
              )}
            </button>

            {/* Pre-Check-In Timeout Error */}
            {preCheckInError === 'TIMEOUT' && (
              <div
                className="p-4"
                style={{
                  borderRadius: '20px',
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  boxShadow: '0 8px 20px rgba(239,68,68,0.1)'
                }}
              >
                <div className="flex items-start gap-3" dir="rtl">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(239,68,68,0.15)' }}
                  >
                    <AlertCircle className="w-4 h-4 text-red-600" strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 pt-1">
                    <p className="text-sm font-medium" style={{ color: '#1C2B4A' }}>
                      تعذر تحديد الموقع الآن - يرجى المحاولة مرة أخرى
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Pre-Check-In Outside Branch Error */}
            {preCheckInError && preCheckInError !== 'TIMEOUT' && (
              <div
                className="p-4"
                style={{
                  borderRadius: '20px',
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  boxShadow: '0 8px 20px rgba(239,68,68,0.1)'
                }}
              >
                <div className="flex items-start gap-3" dir="rtl">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(239,68,68,0.15)' }}
                  >
                    <AlertCircle className="w-4 h-4 text-red-600" strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 pt-1">
                    <p className="text-sm font-medium" style={{ color: '#1C2B4A' }}>
                      {preCheckInError}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* MANUAL CHECKOUT CONFIRMATION MODAL */}
            {/* This modal ONLY appears for manual checkout (user clicked button) */}
            {/* Auto-checkout NEVER triggers this modal */}
            {showConfirmation && (
              <div
                className="bg-white p-4 space-y-3"
                style={{
                  borderRadius: '20px',
                  boxShadow: '0 10px 24px rgba(30,55,90,0.12), inset 0 -2px 10px rgba(255,255,255,0.8)',
                  border: '1px solid #E6ECFF'
                }}
              >
                <p className="text-center text-sm font-medium" style={{ color: '#1C2B4A' }} dir="rtl">
                  هل أنت متأكد من تسجيل الانصراف؟
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setShowConfirmation(false)}
                    className="px-4 py-2.5 font-medium text-sm transition-colors"
                    style={{
                      borderRadius: '14px',
                      background: 'rgba(109,122,153,0.1)',
                      color: '#6D7A99'
                    }}
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={() => handleCheckOut({ source: 'manual' })} // Manual confirmation path
                    disabled={actionLoading}
                    className="px-4 py-2.5 text-white font-medium text-sm transition-all flex items-center justify-center gap-2"
                    style={{
                      borderRadius: '14px',
                      background: 'linear-gradient(135deg, #f97316 0%, #ef4444 100%)',
                      boxShadow: '0 4px 12px rgba(249,115,22,0.3)'
                    }}
                  >
                    <span>تأكيد</span>
                    <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Location & Timezone Info */}
          {location && (
            <div className="space-y-2">
              <div
                className="flex items-center gap-3 p-4"
                style={{
                  borderRadius: '18px',
                  background: 'rgba(109,122,153,0.04)',
                  border: '1px solid rgba(109,122,153,0.1)'
                }}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(109,122,153,0.08)' }}
                >
                  <MapPin
                    className="w-4 h-4"
                    style={{
                      color: branchLocation
                        ? (isConfirmedOutside ? '#ef4444' : '#22c55e')
                        : '#6D7A99'
                    }}
                    strokeWidth={1.5}
                  />
                </div>
                <div className="text-xs flex-1" dir="rtl">
                  <p className="font-medium mb-1" style={{ color: '#1C2B4A' }}>الموقع:</p>
                  {locationCity && locationCountry ? (
                    <p style={{
                      color: branchLocation
                        ? (isConfirmedOutside ? '#ef4444' : '#22c55e')
                        : '#6D7A99'
                    }}>
                      {locationCity}, {locationCountry}
                    </p>
                  ) : (
                    <p className="italic" style={{ color: '#98A4C0' }}>جاري تحديد الموقع...</p>
                  )}
                  <p
                    className="font-mono mt-1 text-[10px]"
                    style={{
                      color: branchLocation
                        ? (isConfirmedOutside ? '#ef4444' : '#22c55e')
                        : '#98A4C0'
                    }}
                  >
                    {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                  </p>
                  {location.accuracy && (
                    <p className="mt-0.5" style={{ color: '#98A4C0' }}>
                      دقة: ±{Math.round(location.accuracy)}م
                    </p>
                  )}
                </div>
              </div>

            </div>
          )}
        </div>
      </div>

      {showAutoCheckoutToast && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in">
          <div
            className="flex items-center gap-3 p-4 max-w-md"
            style={{
              borderRadius: '20px',
              background: 'rgba(249,115,22,0.1)',
              border: '2px solid rgba(249,115,22,0.25)',
              boxShadow: '0 12px 28px rgba(249,115,22,0.2)'
            }}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                boxShadow: '0 4px 12px rgba(249,115,22,0.3)'
              }}
            >
              <AlertCircle className="w-5 h-5 text-white" strokeWidth={1.5} />
            </div>
            <p className="text-sm font-medium" style={{ color: '#1C2B4A' }} dir="rtl">
              تم تسجيل الانصراف تلقائياً بسبب مشكلة في الموقع
            </p>
          </div>
        </div>
      )}

      <LeaveRequestModal
        isOpen={showLeaveModal}
        onClose={() => setShowLeaveModal(false)}
        employeeId={employee?.id || ''}
        employeeName={employee?.full_name || ''}
        companyId={employee?.company_id || ''}
      />

      <RequestsBottomSheet
        isOpen={showRequestsSheet}
        onClose={() => setShowRequestsSheet(false)}
        onLeaveRequest={() => setShowLeaveModal(true)}
        onLeaveHistory={() => setShowLeaveHistory(true)}
        onDelayPermission={() => setShowDelayPermissionModal(true)}
      />

      <LeaveHistoryModal
        isOpen={showLeaveHistory}
        onClose={() => {
          setShowLeaveHistory(false);
          setHistoryFilter('all');
        }}
        employeeId={employee?.id || ''}
        companyId={employee?.company_id || ''}
        onNewRequest={() => setShowLeaveModal(true)}
        initialFilter={historyFilter}
      />

      <EmployeeDelayPermissionModal
        isOpen={showDelayPermissionModal}
        onClose={() => setShowDelayPermissionModal(false)}
        employeeId={employee?.id || ''}
        companyId={employee?.company_id || ''}
        onViewHistory={() => {
          setShowDelayPermissionModal(false);
          setHistoryFilter('delays');
          setShowLeaveHistory(true);
        }}
      />

      {/* 🔍 DEBUG PANEL - Always visible for diagnostics */}
      <BranchDebugPanel
        authUid={employee?.id || null}
        employee={employee ? {
          id: employee.id,
          company_id: employee.company_id,
          branch_id: employee.branch_id,
          full_name: employee.full_name
        } : null}
        branch={branchDebugData}
        location={location}
        distance={currentDistance}
        inRange={currentInRange}
        lastFetchTime={branchFetchTime}
        dataSource={branchDataSource}
        onRefresh={() => {
          if (employee?.branch_id && employee?.company_id) {
            console.log('[DEBUG_PANEL] Force refreshing branch data...');
            loadBranchLocation(employee.branch_id, employee.company_id);
          }
        }}
      />

      <style>{`
        @keyframes locationPulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.6;
          }
        }
        @keyframes fade-in {
          0% {
            opacity: 0;
            transform: translate(-50%, -20px);
          }
          100% {
            opacity: 1;
            transform: translate(-50%, 0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }

        .requests-button {
          transition: transform 110ms ease-out, box-shadow 200ms ease-out;
        }

        .requests-button:active {
          transform: scale(0.97);
        }

        @keyframes badgePopIn {
          0% {
            transform: scale(0.85);
            opacity: 0;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        .badge-indicator,
        .badge-count {
          animation: badgePopIn 140ms ease-out forwards;
        }
      `}</style>
    </div>
  );
}
