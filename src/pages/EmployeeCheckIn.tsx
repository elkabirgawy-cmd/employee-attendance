import { useEffect, useState, useRef } from 'react';
import { Clock, MapPin, Calendar, CheckCircle, XCircle, User, Fingerprint, ArrowLeft, ArrowRight, Sun, Moon, Hourglass, Navigation, AlertCircle, Wifi, WifiOff, TrendingUp, Calculator } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { watchLocation, clearWatch, getCurrentLocation, requestLocationPermission, checkLocationPermission } from '../utils/location';
import { distanceMeters } from '../utils/distance';
import { isMockLocation, getMockLocationStatus } from '../utils/mockLocation';

interface Employee {
  id: string;
  employee_code: string;
  full_name: string;
  job_title: string;
  department: string;
  branch_id: string;
  company_id: string;
  branches?: {
    name: string;
    latitude: number;
    longitude: number;
    geofence_radius: number;
  };
  shifts?: {
    name: string;
    start_time: string;
    end_time: string;
    grace_period_minutes: number;
  };
}

interface TodayAttendance {
  id: string;
  check_in_time: string;
  check_out_time: string | null;
  status: string;
}

interface LocationData {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
  mocked?: boolean;
}

type AttendanceStatus =
  | 'loading'
  | 'branch_error'
  | 'out_of_branch'
  | 'ready'
  | 'gps_error'
  | 'checking_in'
  | 'checked_in'
  | 'checked_out';

function isWithinShiftTime(shiftStartTime: string, shiftEndTime: string, gracePeriodMinutes: number): boolean {
  const now = new Date();
  const currentTime = now.getHours() * 60 + now.getMinutes();

  const [startHour, startMin] = shiftStartTime.split(':').map(Number);
  const [endHour, endMin] = shiftEndTime.split(':').map(Number);

  const shiftStart = startHour * 60 + startMin - gracePeriodMinutes;
  const shiftEnd = endHour * 60 + endMin + gracePeriodMinutes;

  if (shiftStart < shiftEnd) {
    return currentTime >= shiftStart && currentTime <= shiftEnd;
  } else {
    return currentTime >= shiftStart || currentTime <= shiftEnd;
  }
}

export default function EmployeeCheckIn() {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [todayAttendance, setTodayAttendance] = useState<TodayAttendance | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [serverTime, setServerTime] = useState<Date | null>(null);
  const [serverSyncError, setServerSyncError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [employeeCode, setEmployeeCode] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [location, setLocation] = useState<LocationData | null>(null);
  const [resolvedTimezone, setResolvedTimezone] = useState<string>(() => {
    return localStorage.getItem('checkin_resolved_timezone') || 'UTC';
  });
  const [gpsError, setGpsError] = useState<string>('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [buttonShake, setButtonShake] = useState(false);
  const [successAnimation, setSuccessAnimation] = useState(false);
  const [testingGPS, setTestingGPS] = useState(false);
  const [locationPermissionNeeded, setLocationPermissionNeeded] = useState(false);
  const [requestingLocationPermission, setRequestingLocationPermission] = useState(false);
  const watchIdRef = useRef<string | null>(null);

  // Request versioning to prevent race conditions
  const requestIdRef = useRef(0);
  const [attendanceStatus, setAttendanceStatus] = useState<AttendanceStatus>('loading');
  const [branchLoaded, setBranchLoaded] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    async function resolveTimezoneFromLocation() {
      if (!location || !location.lat || !location.lng) return;

      try {
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resolve-timezone`, {
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

        if (response.ok) {
          const data = await response.json();
          if (data.timezone) {
            setResolvedTimezone(data.timezone);
            localStorage.setItem('checkin_resolved_timezone', data.timezone);
          }
        }
      } catch (error) {
        console.error('Failed to resolve timezone:', error);
      }
    }

    resolveTimezoneFromLocation();
  }, [location?.lat, location?.lng]);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    async function syncWithServer() {
      try {
        const timezoneToUse = resolvedTimezone || 'UTC';
        const response = await fetch(`https://worldtimeapi.org/api/timezone/${timezoneToUse}`);
        const data = await response.json();
        const serverDateTime = new Date(data.datetime);
        setServerTime(serverDateTime);
        setServerSyncError(false);

        const offset = serverDateTime.getTime() - new Date().getTime();

        interval = setInterval(() => {
          setServerTime(new Date(Date.now() + offset));
        }, 1000);
      } catch (error) {
        console.error('Failed to sync with server:', error);
        setServerSyncError(true);
        setServerTime(new Date());

        interval = setInterval(() => {
          setServerTime(new Date());
        }, 1000);
      }
    }

    syncWithServer();

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [resolvedTimezone]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (isLoggedIn && employee?.id) {
      const currentRequestId = requestIdRef.current;
      const currentEmployeeId = employee.id;

      if (import.meta.env.DEV) {
        console.log('[DEBUG] Starting GPS watch', {
          requestId: currentRequestId,
          employee_id: currentEmployeeId
        });
      }

      const startWatching = async () => {
        try {
          const watchId = await watchLocation(
            (locationData) => {
              // Ignore updates from old requests/employees
              if (currentRequestId !== requestIdRef.current) {
                if (import.meta.env.DEV) {
                  console.log('[DEBUG] Ignoring outdated GPS update', {
                    currentRequestId,
                    latest: requestIdRef.current
                  });
                }
                return;
              }

              setLocation({
                lat: locationData.lat,
                lng: locationData.lng,
                accuracy: locationData.accuracy,
                timestamp: Date.now()
              });
              setGpsError('');
              setLocationPermissionNeeded(false);

              if (import.meta.env.DEV) {
                console.log('[DEBUG] GPS location updated', {
                  requestId: currentRequestId,
                  employee_id: currentEmployeeId,
                  accuracy: locationData.accuracy
                });
              }
            },
            (error) => {
              // Ignore errors from old requests/employees
              if (currentRequestId !== requestIdRef.current) {
                return;
              }

              if (error === 'LOCATION_PERMISSION_REQUIRED') {
                setLocationPermissionNeeded(true);
                setGpsError('');
              } else if (error.includes('denied')) {
                setGpsError('يرجى السماح بالوصول إلى الموقع لتسجيل الحضور');
                setAttendanceStatus('gps_error');
              } else if (error.includes('unavailable')) {
                setGpsError('لا يمكن تحديد الموقع حالياً');
                setAttendanceStatus('gps_error');
              } else if (error.includes('timeout')) {
                setGpsError('انتهت مهلة تحديد الموقع');
                setAttendanceStatus('gps_error');
              } else {
                setGpsError(error);
                setAttendanceStatus('gps_error');
              }
            }
          );
          watchIdRef.current = watchId;
        } catch (error: any) {
          if (currentRequestId !== requestIdRef.current) {
            return;
          }

          if (error.code === 'LOCATION_PERMISSION_REQUIRED') {
            setLocationPermissionNeeded(true);
            setGpsError('');
          } else {
            setGpsError(error.message || 'حدث خطأ في تحديد الموقع');
            setAttendanceStatus('gps_error');
          }
        }
      };

      startWatching();

      return () => {
        if (watchIdRef.current !== null) {
          clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }
      };
    }
  }, [isLoggedIn, employee?.id]);

  // Compute attendance status based on current state
  // This ensures the correct status is always displayed without race conditions
  useEffect(() => {
    if (!isLoggedIn || !employee) {
      setAttendanceStatus('loading');
      return;
    }

    // Check if already checked in/out
    if (todayAttendance?.check_out_time) {
      setAttendanceStatus('checked_out');
      return;
    }

    if (todayAttendance?.check_in_time) {
      setAttendanceStatus('checked_in');
      return;
    }

    // CRITICAL: Branch data must load FIRST before GPS validation
    if (!branchLoaded || !employee.branches) {
      setAttendanceStatus('branch_error');
      if (import.meta.env.DEV) {
        console.log('[DEBUG] Branch not loaded', {
          branchLoaded,
          hasBranchData: !!employee.branches,
          employee_id: employee.id
        });
      }
      return;
    }

    // GPS error takes precedence over location checks
    if (gpsError) {
      setAttendanceStatus('gps_error');
      return;
    }

    // Waiting for GPS location
    if (!location) {
      setAttendanceStatus('loading');
      return;
    }

    // Check geofence
    const distance = getDistanceFromBranch();
    if (distance === null) {
      setAttendanceStatus('loading');
      return;
    }

    const allowedRadius = employee.branches.geofence_radius || 150;
    if (distance > allowedRadius) {
      setAttendanceStatus('out_of_branch');
      if (import.meta.env.DEV) {
        console.log('[DEBUG] Outside geofence', {
          distance: Math.round(distance),
          allowedRadius,
          employee_id: employee.id
        });
      }
      return;
    }

    // All checks passed
    setAttendanceStatus('ready');
    if (import.meta.env.DEV) {
      console.log('[DEBUG] Ready for check-in', {
        distance: Math.round(distance),
        allowedRadius,
        employee_id: employee.id
      });
    }
  }, [isLoggedIn, employee, todayAttendance, branchLoaded, gpsError, location]);

  useEffect(() => {
    if (!isLoggedIn || !employee?.branch_id || !employee?.company_id) return;

    console.log('[REALTIME] Setting up branch location subscription:', {
      branch_id: employee.branch_id,
      company_id: employee.company_id
    });

    const channel = supabase
      .channel(`employee-branch-checkin-updates-${employee.branch_id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'branches',
          filter: `id=eq.${employee.branch_id}&company_id=eq.${employee.company_id}` // ✅ Multi-tenant filter
        },
        async (payload) => {
          console.log('[REALTIME] Branch updated, refreshing employee data with new geofence...', payload.new);

          // ✅ Verify company_id matches
          if (payload.new && 'company_id' in payload.new) {
            const updated = payload.new as { company_id: string };
            if (updated.company_id !== employee.company_id) {
              console.error('[REALTIME] Branch belongs to different company, ignoring update');
              return;
            }
          }

          try {
            const { data: empData } = await supabase
              .from('employees')
              .select(`
                *,
                branches (name, latitude, longitude, geofence_radius, company_id),
                shifts (name, start_time, end_time, grace_period_minutes)
              `)
              .eq('id', employee.id)
              .eq('company_id', employee.company_id) // ✅ Company scope
              .maybeSingle();

            if (empData) {
              // ✅ Double-check branch belongs to correct company
              if (empData.branches && empData.branches.company_id !== employee.company_id) {
                console.error('[REALTIME] Branch company mismatch, data integrity issue!');
                return;
              }

              setEmployee(empData);
              console.log('[REALTIME] Employee data refreshed with updated branch location:', {
                lat: empData.branches?.latitude,
                lng: empData.branches?.longitude,
                radius: empData.branches?.geofence_radius,
                company_id: empData.branches?.company_id
              });
            }
          } catch (error) {
            console.error('[REALTIME] Error refreshing employee data:', error);
          }
        }
      )
      .subscribe();

    return () => {
      console.log('[REALTIME] Cleaning up branch location subscription');
      supabase.removeChannel(channel);
    };
  }, [isLoggedIn, employee?.branch_id, employee?.company_id, employee?.id]); // ✅ Re-subscribe on company change

  const getShiftType = () => {
    if (!employee?.shifts) return 'morning';
    const currentHour = currentTime.getHours();
    const [startHour] = employee.shifts.start_time.split(':').map(Number);
    const [endHour] = employee.shifts.end_time.split(':').map(Number);

    if (startHour > endHour) {
      if (currentHour >= startHour || currentHour < endHour) {
        return 'night';
      }
      return 'morning';
    }

    if (startHour >= 12) {
      return 'night';
    }

    return 'morning';
  };

  const shiftType = getShiftType();

  const getDistanceFromBranch = () => {
    if (!location || !employee?.branches?.latitude || !employee?.branches?.longitude) {
      return null;
    }
    return distanceMeters(
      location.lat,
      location.lng,
      employee.branches.latitude,
      employee.branches.longitude
    );
  };

  const isInGeofence = () => {
    const distance = getDistanceFromBranch();
    if (distance === null) return false;
    const allowedRadius = employee?.branches?.geofence_radius || 150;
    return distance <= allowedRadius;
  };

  const getSmartStatus = () => {
    if (!employee) return { text: '', color: '', icon: '⏳' };

    // Use unified attendance status to prevent race conditions
    switch (attendanceStatus) {
      case 'checked_out':
        return {
          text: '✅ تم تسجيل الانصراف بنجاح',
          color: 'from-green-50 to-emerald-50 border-green-200 text-green-700',
          icon: '✅'
        };

      case 'checked_in':
        if (employee.shifts) {
          const [endHour, endMin] = employee.shifts.end_time.split(':').map(Number);
          const currentHour = currentTime.getHours();
          const currentMin = currentTime.getMinutes();
          const currentTotalMin = currentHour * 60 + currentMin;
          const endTotalMin = endHour * 60 + endMin;

          let remainingMin = endTotalMin - currentTotalMin;
          if (remainingMin < 0) remainingMin += 24 * 60;

          if (remainingMin <= 15 && remainingMin > 0) {
            return {
              text: `⏰ تبقّى ${remainingMin} دقيقة على نهاية الوردية`,
              color: 'from-orange-50 to-orange-50 border-orange-200 text-orange-700',
              icon: '⏰'
            };
          }
        }
        return {
          text: '🟢 تم تسجيل الحضور بنجاح',
          color: 'from-blue-50 to-blue-50 border-blue-200 text-blue-700',
          icon: '🟢'
        };

      case 'branch_error':
        return {
          text: 'فشل تحميل بيانات الفرع',
          color: 'from-red-50 to-red-50 border-red-200 text-red-700',
          icon: '❌'
        };

      case 'gps_error':
        return {
          text: gpsError || 'خطأ في تحديد الموقع',
          color: 'from-red-50 to-red-50 border-red-200 text-red-700',
          icon: '❌'
        };

      case 'loading':
        return {
          text: '⏳ جاري تحديد موقعك...',
          color: 'from-gray-50 to-gray-50 border-gray-200 text-gray-700',
          icon: '⏳'
        };

      case 'out_of_branch':
        const distance = getDistanceFromBranch();
        return {
          text: `❌ خارج نطاق موقع الفرع (${distance ? Math.round(distance) : '---'} متر)`,
          color: 'from-red-50 to-red-50 border-red-200 text-red-700',
          icon: '❌'
        };

      case 'ready':
        return {
          text: '✅ يمكنك تسجيل الحضور الآن',
          color: 'from-green-50 to-emerald-50 border-green-200 text-green-700',
          icon: '✅'
        };

      case 'checking_in':
        return {
          text: '⏳ جاري تسجيل الحضور...',
          color: 'from-blue-50 to-blue-50 border-blue-200 text-blue-700',
          icon: '⏳'
        };

      default:
        return {
          text: '⏳ جاري التحميل...',
          color: 'from-gray-50 to-gray-50 border-gray-200 text-gray-700',
          icon: '⏳'
        };
    }
  };

  const canCheckIn = () => {
    if (!location || !employee?.branches) return false;
    if (location.accuracy > 60) return false;
    if (!isInGeofence()) return false;
    if (!employee.shifts) return false;
    const gracePeriod = employee.shifts.grace_period_minutes || 15;
    return isWithinShiftTime(employee.shifts.start_time, employee.shifts.end_time, gracePeriod);
  };

  const getTimeSinceLastUpdate = () => {
    if (!location) return '';
    const seconds = Math.floor((Date.now() - location.timestamp) / 1000);
    if (seconds < 5) return 'الآن';
    return `منذ ${seconds} ث`;
  };

  // Reset all attendance-related state when employee changes
  const resetAttendanceState = () => {
    requestIdRef.current += 1;
    setLocation(null);
    setGpsError('');
    setAttendanceStatus('loading');
    setBranchLoaded(false);
    setLocationPermissionNeeded(false);
    setRequestingLocationPermission(false);

    // Clear watch if exists
    if (watchIdRef.current !== null) {
      clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    if (import.meta.env.DEV) {
      console.log('[DEBUG] Attendance state reset', {
        requestId: requestIdRef.current,
        timestamp: new Date().toISOString()
      });
    }
  };

  async function handleLogin() {
    const trimmedCode = employeeCode.trim().toUpperCase();

    if (!trimmedCode) {
      alert('الرجاء إدخال كود الموظف');
      return;
    }

    setLoading(true);
    resetAttendanceState(); // Clear all state before loading new employee

    const currentRequestId = requestIdRef.current;

    try {
      const { data: empData, error: empError } = await supabase
        .from('employees')
        .select(`
          *,
          branches (name, latitude, longitude, geofence_radius),
          shifts (name, start_time, end_time, grace_period_minutes)
        `)
        .eq('employee_code', trimmedCode)
        .eq('is_active', true)
        .maybeSingle();

      // Ignore outdated responses
      if (currentRequestId !== requestIdRef.current) {
        if (import.meta.env.DEV) {
          console.log('[DEBUG] Ignoring outdated employee fetch', { currentRequestId, latest: requestIdRef.current });
        }
        return;
      }

      if (empError) {
        alert('خطأ في الاتصال: ' + empError.message);
        return;
      }

      if (!empData) {
        alert(`كود الموظف "${trimmedCode}" غير موجود أو غير نشط\n\nجرب: EMP001 أو EMP002 أو EMP003`);
        return;
      }

      // Verify branch data loaded
      if (!empData.branches) {
        setAttendanceStatus('branch_error');
        if (import.meta.env.DEV) {
          console.log('[DEBUG] Branch data missing', { employee_id: empData.id });
        }
      } else {
        setBranchLoaded(true);
        if (import.meta.env.DEV) {
          console.log('[DEBUG] Branch data loaded', {
            employee_id: empData.id,
            branch_id: empData.branch_id,
            lat: empData.branches.latitude,
            lng: empData.branches.longitude
          });
        }
      }

      setEmployee(empData);
      setIsLoggedIn(true);
      await fetchTodayAttendance(empData.id);
    } catch (error: any) {
      alert('خطأ: ' + (error.message || 'حدث خطأ أثناء تسجيل الدخول'));
    } finally {
      setLoading(false);
    }
  }

  async function fetchTodayAttendance(employeeId: string) {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Fetch only OPEN attendance (check_out_time is null)
      // This allows multiple check-ins per day after checkout
      const { data, error } = await supabase
        .from('attendance_logs')
        .select('*')
        .eq('employee_id', employeeId)
        .is('check_out_time', null)
        .gte('created_at', `${today}T00:00:00Z`)
        .lte('created_at', `${today}T23:59:59Z`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      console.log('📊 Fetched today attendance (OPEN sessions only):', data ? 'Found' : 'None');
      if (data) {
        console.log('Open Session ID:', data.id);
        console.log('Check-in time:', data.check_in_time);
        console.log('Check-out time:', data.check_out_time || 'Still open');
      }

      setTodayAttendance(data);
    } catch (error: any) {
      console.error('Error fetching today attendance:', error);
    }
  }

  const triggerHapticFeedback = (type: 'light' | 'medium' | 'heavy' = 'light') => {
    if ('vibrate' in navigator) {
      const patterns = { light: 10, medium: 20, heavy: 50 };
      navigator.vibrate(patterns[type]);
    }
  };

  async function logFraudAttempt(
    alertType: string,
    description: string,
    metadata: Record<string, any>
  ) {
    try {
      // Report fraud via edge function (server-side company_id resolution)
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/employee-report-fraud`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            alert_type: alertType,
            description: description,
            severity: 'high',
            metadata: {
              ...metadata,
              employee_id: employee?.id || null,
            },
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        console.error('Failed to log fraud attempt:', error);
      }
    } catch (error) {
      console.error('Failed to log fraud attempt:', error);
    }
  }

  async function testGPS() {
    setTestingGPS(true);
    try {
      const result = await getCurrentLocation();
      alert(`✅ GPS Test Successful!\n\nLatitude: ${result.lat.toFixed(6)}\nLongitude: ${result.lng.toFixed(6)}\nAccuracy: ±${result.accuracy.toFixed(1)} meters`);
    } catch (error: any) {
      alert(`❌ GPS Test Failed!\n\nError: ${error.message || 'Unknown error'}`);
    } finally {
      setTestingGPS(false);
    }
  }

  async function handleRequestLocationPermission() {
    setRequestingLocationPermission(true);
    try {
      const granted = await requestLocationPermission();
      if (granted) {
        setLocationPermissionNeeded(false);

        const watchId = await watchLocation(
          (locationData) => {
            setLocation({
              lat: locationData.lat,
              lng: locationData.lng,
              accuracy: locationData.accuracy,
              timestamp: Date.now()
            });
            setGpsError('');
          },
          (error) => {
            if (error === 'LOCATION_PERMISSION_REQUIRED') {
              setLocationPermissionNeeded(true);
              setGpsError('');
            } else if (error.includes('denied')) {
              setGpsError('يرجى السماح بالوصول إلى الموقع لتسجيل الحضور');
            } else if (error.includes('unavailable')) {
              setGpsError('لا يمكن تحديد الموقع حالياً');
            } else if (error.includes('timeout')) {
              setGpsError('انتهت مهلة تحديد الموقع');
            } else {
              setGpsError(error);
            }
          }
        );
        watchIdRef.current = watchId;
      } else {
        setGpsError('تم رفض الإذن. يرجى السماح بالوصول إلى الموقع من إعدادات المتصفح');
        setLocationPermissionNeeded(false);
      }
    } catch (error: any) {
      setGpsError(error.message || 'حدث خطأ في طلب إذن الموقع');
      setLocationPermissionNeeded(false);
    } finally {
      setRequestingLocationPermission(false);
    }
  }

  async function handleCheckIn() {
    if (!employee) return;

    // Enhanced debug logging
    console.log('🔵 CHECK-IN ATTEMPT STARTED');
    console.log('Current User ID:', employee.id);
    console.log('Company ID:', employee.company_id);
    console.log('Current Date (ISO):', new Date().toISOString());
    console.log('Current Date (Local):', new Date().toLocaleDateString());
    console.log('Timezone:', Intl.DateTimeFormat().resolvedOptions().timeZone);
    console.log('Today Attendance State:', todayAttendance ? 'EXISTS' : 'NULL');
    if (todayAttendance) {
      console.log('Existing Attendance Record:', {
        id: todayAttendance.id,
        check_in_time: todayAttendance.check_in_time,
        check_out_time: todayAttendance.check_out_time,
        is_open: !todayAttendance.check_out_time,
      });
    }

    if (!employee.branch_id) {
      setButtonShake(true);
      setTimeout(() => setButtonShake(false), 500);
      triggerHapticFeedback('heavy');
      alert('⚠️ لم يتم تحديد الفرع لهذا الموظف. راجع الإدارة.');
      return;
    }

    if (!isOnline) {
      setButtonShake(true);
      setTimeout(() => setButtonShake(false), 500);
      triggerHapticFeedback('medium');
      alert('⚠️ لا يوجد اتصال بالإنترنت');
      return;
    }

    if (!location) {
      setButtonShake(true);
      setTimeout(() => setButtonShake(false), 500);
      triggerHapticFeedback('medium');
      alert('⚠️ لم يتم تحديد موقعك. الرجاء السماح للمتصفح بالوصول إلى موقعك الجغرافي.');
      return;
    }

    if (isMockLocation(location)) {
      setButtonShake(true);
      setTimeout(() => setButtonShake(false), 500);
      triggerHapticFeedback('heavy');

      await logFraudAttempt(
        'mock_location_check_in',
        'محاولة تسجيل حضور باستخدام موقع وهمي (Fake GPS)',
        {
          employee_code: employee.employee_code,
          employee_name: employee.full_name,
          location: { lat: location.lat, lng: location.lng },
          accuracy: location.accuracy,
          mocked: location.mocked,
          timestamp: new Date().toISOString()
        }
      );

      alert('🚫 تم رصد استخدام موقع وهمي (Fake GPS)\n\n⚠️ يجب إيقاف تطبيقات التلاعب بالموقع\n\n❌ تم تسجيل هذه المحاولة كتنبيه احتيال');
      return;
    }

    if (location.accuracy > 60) {
      setButtonShake(true);
      setTimeout(() => setButtonShake(false), 500);
      triggerHapticFeedback('medium');
      alert('⚠️ دقة الموقع ضعيفة، حاول الاقتراب من النافذة أو الخروج للمكان المفتوح');
      return;
    }

    if (!employee.branches || !employee.branches.latitude || !employee.branches.longitude) {
      setButtonShake(true);
      setTimeout(() => setButtonShake(false), 500);
      triggerHapticFeedback('heavy');
      alert('⚠️ لم يتم تحديد موقع الفرع. الرجاء التواصل مع الإدارة.');
      return;
    }

    const distance = distanceMeters(
      location.lat,
      location.lng,
      employee.branches.latitude,
      employee.branches.longitude
    );

    const allowedRadius = employee.branches.geofence_radius || 150;

    if (distance > allowedRadius) {
      setButtonShake(true);
      setTimeout(() => setButtonShake(false), 500);
      triggerHapticFeedback('heavy');
      alert(`🚫 أنت خارج نطاق الفرع\n\n📍 المسافة الحالية: ${Math.round(distance)} متر\n✅ المسموح: ${allowedRadius} متر\n\n⚠️ يجب أن تكون داخل نطاق الفرع لتسجيل الحضور`);
      return;
    }

    if (!employee.shifts) {
      alert('⚠️ لم يتم تحديد وردية عمل لك. الرجاء التواصل مع الإدارة.');
      return;
    }

    const gracePeriod = employee.shifts.grace_period_minutes || 15;
    if (!isWithinShiftTime(employee.shifts.start_time, employee.shifts.end_time, gracePeriod)) {
      setButtonShake(true);
      setTimeout(() => setButtonShake(false), 500);
      triggerHapticFeedback('medium');
      alert(`⚠️ أنت خارج وقت الوردية المحددة\n\nوقت الوردية: ${employee.shifts.start_time} - ${employee.shifts.end_time}\nفترة السماح: ${gracePeriod} دقيقة\n\nلا يمكن تسجيل الحضور خارج وقت الوردية.`);
      return;
    }

    setSubmitting(true);
    setAttendanceStatus('checking_in');
    triggerHapticFeedback('light');

    try {
      // Debug logging before check-in
      console.log('=== ATTENDANCE CHECK-IN DEBUG ===');
      console.log('Timestamp:', new Date().toISOString());
      console.log('Employee ID:', employee.id);
      console.log('Employee Code:', employee.employee_code);
      console.log('Employee Name:', employee.full_name);
      console.log('Company ID:', employee.company_id);
      console.log('Branch ID:', employee.branch_id);
      console.log('GPS Coordinates:', { lat: location.lat, lng: location.lng });
      console.log('GPS Accuracy:', location.accuracy, 'meters');
      console.log('Distance from Branch:', Math.round(distance), 'meters');
      console.log('Check-in Distance (m):', Math.round(distance * 100) / 100);

      // Call Edge Function instead of direct INSERT (uses service_role internally)
      console.log('Calling employee-check-in Edge Function...');
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
              lat: location.lat,
              lng: location.lng,
              accuracy: location.accuracy,
            },
            deviceTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          }),
        }
      );

      const result = await response.json();

      console.log('Edge Function Response:', {
        status: response.status,
        ok: response.ok,
        result: JSON.stringify(result, null, 2)
      });

      if (!response.ok || !result.ok) {
        console.error('❌ CHECK-IN FAILED');
        console.error('HTTP Status:', response.status);
        console.error('Error Code:', result.code);
        console.error('Error Message (AR):', result.message_ar);
        console.error('Full Response:', JSON.stringify(result, null, 2));

        // Handle specific error cases
        if (result.code === 'ALREADY_CHECKED_IN') {
          alert('⚠️ لقد سجلت حضورك بالفعل اليوم\n\nيرجى تسجيل الانصراف أولاً');
          await fetchTodayAttendance(employee.id);
          return;
        }

        throw new Error(result.message_ar || 'حدث خطأ في الخادم');
      }

      console.log('✅ SUCCESS: Attendance logged successfully');
      console.log('Inserted Row ID:', result.data?.id);
      console.log('================================');

      await fetchTodayAttendance(employee.id);

      setSuccessAnimation(true);
      triggerHapticFeedback('medium');
      setTimeout(() => setSuccessAnimation(false), 2000);

      alert(`✅ تم تسجيل الحضور بنجاح\n\n📍 المسافة من الفرع: ${Math.round(distance)} متر`);
    } catch (error: any) {
      setButtonShake(true);
      setTimeout(() => setButtonShake(false), 500);
      triggerHapticFeedback('heavy');

      // Detailed error logging for debugging (console only)
      console.error('❌❌❌ CHECK-IN FAILED ❌❌❌');
      console.error('Error Object:', error);
      console.error('Error Code:', error.code);
      console.error('Error Message:', error.message);
      console.error('Error Details:', error.details);
      console.error('Error Hint:', error.hint);
      console.error('Error Status:', error.status);
      console.error('Full Error JSON:', JSON.stringify(error, null, 2));
      console.error('================================');

      // Simple error message for user (keep UI text unchanged)
      alert('حدث خطأ أثناء تسجيل الحضور');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCheckOut() {
    if (!employee || !todayAttendance) return;

    if (!employee.branch_id) {
      setButtonShake(true);
      setTimeout(() => setButtonShake(false), 500);
      triggerHapticFeedback('heavy');
      alert('⚠️ لم يتم تحديد الفرع لهذا الموظف. راجع الإدارة.');
      return;
    }

    if (!isOnline) {
      setButtonShake(true);
      setTimeout(() => setButtonShake(false), 500);
      triggerHapticFeedback('medium');
      alert('⚠️ لا يوجد اتصال بالإنترنت');
      return;
    }

    if (!location) {
      setButtonShake(true);
      setTimeout(() => setButtonShake(false), 500);
      triggerHapticFeedback('medium');
      alert('⚠️ لم يتم تحديد موقعك. الرجاء السماح للمتصفح بالوصول إلى موقعك الجغرافي.');
      return;
    }

    if (isMockLocation(location)) {
      setButtonShake(true);
      setTimeout(() => setButtonShake(false), 500);
      triggerHapticFeedback('heavy');

      await logFraudAttempt(
        'mock_location_check_out',
        'محاولة تسجيل انصراف باستخدام موقع وهمي (Fake GPS)',
        {
          employee_code: employee.employee_code,
          employee_name: employee.full_name,
          location: { lat: location.lat, lng: location.lng },
          accuracy: location.accuracy,
          mocked: location.mocked,
          timestamp: new Date().toISOString()
        }
      );

      alert('🚫 تم رصد استخدام موقع وهمي (Fake GPS)\n\n⚠️ يجب إيقاف تطبيقات التلاعب بالموقع\n\n❌ تم تسجيل هذه المحاولة كتنبيه احتيال');
      return;
    }

    if (location.accuracy > 60) {
      setButtonShake(true);
      setTimeout(() => setButtonShake(false), 500);
      triggerHapticFeedback('medium');
      alert('⚠️ دقة الموقع ضعيفة، حاول الاقتراب من النافذة أو الخروج للمكان المفتوح');
      return;
    }

    if (!employee.branches || !employee.branches.latitude || !employee.branches.longitude) {
      setButtonShake(true);
      setTimeout(() => setButtonShake(false), 500);
      triggerHapticFeedback('heavy');
      alert('⚠️ لم يتم تحديد موقع الفرع. الرجاء التواصل مع الإدارة.');
      return;
    }

    const distance = distanceMeters(
      location.lat,
      location.lng,
      employee.branches.latitude,
      employee.branches.longitude
    );

    const allowedRadius = employee.branches.geofence_radius || 150;

    if (distance > allowedRadius) {
      setButtonShake(true);
      setTimeout(() => setButtonShake(false), 500);
      triggerHapticFeedback('heavy');
      alert(`🚫 أنت خارج نطاق الفرع\n\n📍 المسافة الحالية: ${Math.round(distance)} متر\n✅ المسموح: ${allowedRadius} متر\n\n⚠️ يجب أن تكون داخل نطاق الفرع لتسجيل الانصراف`);
      return;
    }

    setSubmitting(true);
    triggerHapticFeedback('light');

    try {
      const now = new Date().toISOString();

      // Debug logging before update
      console.log('=== ATTENDANCE CHECK-OUT DEBUG ===');
      console.log('Employee ID:', employee.id);
      console.log('Employee Code:', employee.employee_code);
      console.log('Company ID:', employee.company_id);
      console.log('Attendance Log ID:', todayAttendance.id);
      console.log('GPS Coordinates:', { lat: location.lat, lng: location.lng });
      console.log('GPS Accuracy:', location.accuracy, 'meters');
      console.log('Distance from Branch:', Math.round(distance), 'meters');
      console.log('Check-out Time:', now);

      const { error } = await supabase
        .from('attendance_logs')
        .update({
          check_out_time: now,
          check_out_device_time: now,
          check_out_latitude: location.lat,
          check_out_longitude: location.lng,
          check_out_accuracy: location.accuracy,
          check_out_distance_m: Math.round(distance * 100) / 100,
        })
        .eq('id', todayAttendance.id);

      if (error) {
        console.error('RLS or Database Error:', error);
        throw error;
      }

      console.log('SUCCESS: Check-out logged successfully');
      console.log('================================');

      await fetchTodayAttendance(employee.id);

      setSuccessAnimation(true);
      triggerHapticFeedback('medium');
      setTimeout(() => setSuccessAnimation(false), 2000);

      alert(`✅ تم تسجيل الانصراف بنجاح\n\n📍 المسافة من الفرع: ${Math.round(distance)} متر`);
    } catch (error: any) {
      setButtonShake(true);
      setTimeout(() => setButtonShake(false), 500);
      triggerHapticFeedback('heavy');
      alert('خطأ: ' + (error.message || 'حدث خطأ أثناء تسجيل الانصراف'));
    } finally {
      setSubmitting(false);
    }
  }

  function formatTime12Hour(date: Date) {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return {
      time: `${displayHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`,
      period: ampm
    };
  }

  function formatDateArabic(date: Date) {
    const arabicDays = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const arabicMonths = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

    const dayName = arabicDays[date.getDay()];
    const day = date.getDate();
    const month = arabicMonths[date.getMonth()];
    const year = date.getFullYear();

    return `${dayName} · ${day} ${month} ${year}`;
  }

  function calculateWorkProgress() {
    if (!todayAttendance?.check_in_time || !employee?.shifts)
      return { percentage: 0, remainingTime: '00:00:00', workedTime: '00:00:00', totalHours: 8 };

    const checkIn = new Date(todayAttendance.check_in_time);
    const now = todayAttendance.check_out_time
      ? new Date(todayAttendance.check_out_time)
      : currentTime;

    const [startHour, startMin] = employee.shifts.start_time.split(':').map(Number);
    const [endHour, endMin] = employee.shifts.end_time.split(':').map(Number);

    let totalShiftMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
    if (totalShiftMinutes < 0) totalShiftMinutes += 24 * 60;

    const workedMs = now.getTime() - checkIn.getTime();
    const workedMinutes = workedMs / (1000 * 60);

    const percentage = Math.min((workedMinutes / totalShiftMinutes) * 100, 100);
    const remainingMinutes = Math.max(totalShiftMinutes - workedMinutes, 0);

    const workedHours = Math.floor(workedMinutes / 60);
    const workedMins = Math.floor(workedMinutes % 60);
    const workedSecs = Math.floor((workedMinutes * 60) % 60);

    const remainingHours = Math.floor(remainingMinutes / 60);
    const remainingMins = Math.floor(remainingMinutes % 60);
    const remainingSecs = Math.floor((remainingMinutes * 60) % 60);

    const workedTime = `${workedHours.toString().padStart(2, '0')}:${workedMins.toString().padStart(2, '0')}:${workedSecs.toString().padStart(2, '0')}`;
    const remainingTime = `${remainingHours.toString().padStart(2, '0')}:${remainingMins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;

    return {
      percentage,
      remainingTime,
      workedTime,
      totalHours: totalShiftMinutes / 60
    };
  }

  function calculateDailySummary() {
    if (!todayAttendance?.check_in_time) return null;

    const checkIn = new Date(todayAttendance.check_in_time);
    const checkOut = todayAttendance.check_out_time ? new Date(todayAttendance.check_out_time) : null;

    const formatTime = (date: Date) => {
      const h = date.getHours();
      const m = date.getMinutes();
      return `${(h % 12 || 12).toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
    };

    let totalHours = '---';
    let status = 'جارٍ';

    if (checkOut) {
      const workedMs = checkOut.getTime() - checkIn.getTime();
      const workedMinutes = workedMs / (1000 * 60);
      const hours = Math.floor(workedMinutes / 60);
      const mins = Math.floor(workedMinutes % 60);
      totalHours = `${hours}:${mins.toString().padStart(2, '0')}`;

      if (employee?.shifts) {
        const [startHour, startMin] = employee.shifts.start_time.split(':').map(Number);
        const [endHour, endMin] = employee.shifts.end_time.split(':').map(Number);
        let totalShiftMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
        if (totalShiftMinutes < 0) totalShiftMinutes += 24 * 60;

        status = workedMinutes >= totalShiftMinutes * 0.9 ? 'مكتمل' : 'ناقص';
      }
    }

    return {
      checkInTime: formatTime(checkIn),
      checkOutTime: checkOut ? formatTime(checkOut) : '---',
      totalHours,
      status
    };
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center p-4" dir="rtl">
        <div className="bg-white rounded-3xl shadow-xl max-w-md w-full p-8">
          <button
            onClick={() => window.location.href = '/'}
            className="flex items-center gap-2 px-3 py-2 mb-6 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-xl transition-all duration-200 group"
          >
            <span className="text-sm font-medium">رجوع</span>
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </button>

          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full mb-4 shadow-xl">
              <Fingerprint size={48} className="text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">تسجيل الحضور</h1>
            <p className="text-gray-600">أدخل كود الموظف للمتابعة</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-800 mb-2 text-right">
                كود الموظف
              </label>
              <input
                type="text"
                value={employeeCode}
                onChange={(e) => setEmployeeCode(e.target.value.toUpperCase())}
                onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                placeholder="EMP001"
                className="w-full px-4 py-4 border-2 border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-lg text-center uppercase font-bold"
                disabled={loading}
                autoFocus
              />
            </div>

            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold rounded-2xl shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed text-lg hover:scale-105 active:scale-95"
            >
              {loading ? 'جاري التحميل...' : 'دخول'}
            </button>
          </div>

          <div className="mt-6 p-4 bg-gray-50 rounded-2xl border border-gray-200">
            <p className="text-sm text-gray-800 font-bold mb-3 text-right">أكواد الموظفين المتاحة للتجربة:</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {['EMP001', 'EMP002', 'EMP003', 'EMP006'].map((code) => (
                <button
                  key={code}
                  onClick={() => setEmployeeCode(code)}
                  className="px-4 py-2 bg-white border-2 border-gray-300 rounded-xl text-sm font-mono hover:bg-blue-50 hover:border-blue-400 transition-all font-bold hover:scale-105"
                >
                  {code}
                </button>
              ))}
            </div>
          </div>

          {location && (
            <div className="mt-4 p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200 animate-fade-in">
              <div className="flex items-center justify-center gap-2 text-sm text-green-700 font-bold">
                <CheckCircle size={18} />
                <span>تم تحديد الموقع بنجاح</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const workProgress = calculateWorkProgress();
  const displayTime = serverTime || currentTime;
  const { time, period } = formatTime12Hour(displayTime);
  const smartStatus = getSmartStatus();
  const distance = getDistanceFromBranch();
  const dailySummary = calculateDailySummary();

  return (
    <div className="h-screen overflow-hidden bg-gray-50 flex items-center justify-center p-3">
      <div className="w-full max-w-md h-full flex flex-col py-2" dir="rtl">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => {
              resetAttendanceState();
              setIsLoggedIn(false);
              setEmployee(null);
              setTodayAttendance(null);
              setEmployeeCode('');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-gray-600 hover:text-gray-800 transition-all text-xs"
          >
            <ArrowLeft size={14} />
            <span className="font-semibold">تسجيل خروج</span>
          </button>

          <div className="flex items-center gap-2">
            {!isOnline && (
              <div className="flex items-center gap-1 px-2 py-1 bg-red-100 rounded-full">
                <WifiOff size={12} className="text-red-600" />
                <span className="text-[10px] text-red-600 font-bold">غير متصل</span>
              </div>
            )}
            <button
              onClick={() => window.location.href = '/'}
              className="flex items-center gap-1.5 px-3 py-1.5 text-gray-600 hover:text-gray-800 transition-all text-xs"
            >
              <span className="font-semibold">رجوع</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>

        <div className={`rounded-2xl shadow-md p-4 relative overflow-hidden transition-all duration-700 mb-2 ${
          shiftType === 'morning'
            ? 'bg-gradient-to-br from-blue-50 via-blue-25 to-white border border-blue-100'
            : 'bg-gradient-to-br from-blue-900 via-blue-800 to-slate-700 border border-blue-700'
        }`}>
          {shiftType === 'night' && (
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute top-3 right-8 w-1.5 h-1.5 bg-yellow-200 rounded-full opacity-80 animate-pulse"></div>
              <div className="absolute top-6 right-16 w-1 h-1 bg-white rounded-full opacity-70 animate-pulse" style={{ animationDelay: '0.3s' }}></div>
              <div className="absolute top-4 right-24 w-1 h-1 bg-blue-200 rounded-full opacity-90 animate-pulse" style={{ animationDelay: '0.6s' }}></div>
            </div>
          )}

          <div className="absolute left-4 top-1/2 -translate-y-1/2">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-md transition-all duration-700 ${
              shiftType === 'morning'
                ? 'bg-gradient-to-br from-orange-300 to-orange-400 animate-pulse'
                : 'bg-gradient-to-br from-blue-600 to-indigo-700'
            }`}>
              {shiftType === 'morning' ? (
                <Sun size={24} className="text-white" />
              ) : (
                <Moon size={24} className="text-blue-100" />
              )}
            </div>
          </div>

          <div className="text-center relative z-10 ml-12">
            <div className={`text-2xl font-extrabold leading-none mb-0.5 transition-colors duration-700 ${
              shiftType === 'morning' ? 'text-blue-900' : 'text-white'
            }`}>
              {time} <span className="text-base">{period}</span>
            </div>
            <div className={`flex items-center justify-center gap-1.5 text-[10px] transition-colors duration-700 mb-1 ${
              shiftType === 'morning' ? 'text-blue-600' : 'text-blue-200'
            }`}>
              <Clock size={10} />
              <span className="font-medium">الوقت المعتمد من النظام</span>
            </div>
            <div className={`flex items-center justify-center gap-1.5 text-xs transition-colors duration-700 ${
              shiftType === 'morning' ? 'text-blue-700' : 'text-blue-100'
            }`}>
              <Calendar size={12} />
              <span className="font-medium">{formatDateArabic(displayTime)}</span>
            </div>
            {serverSyncError && (
              <div className={`flex items-center justify-center gap-1 mt-1 text-[9px] ${
                shiftType === 'morning' ? 'text-orange-600' : 'text-orange-300'
              }`}>
                <AlertCircle size={9} />
                <span>تعذر مزامنة الوقت</span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-3 mb-2">
          <div className="text-center">
            <div className="flex justify-center mb-2">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg overflow-hidden">
                <User size={24} className="text-white" />
              </div>
            </div>

            <div>
              <h2 className="text-lg font-bold text-gray-900 leading-tight mb-0.5">
                {employee?.full_name}
              </h2>
              <p className="text-gray-600 text-xs mb-2">
                {employee?.job_title} • <span className="font-semibold">{employee?.employee_code}</span>
              </p>
              {employee?.shifts && (
                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-white shadow-sm transition-all duration-700 ${
                  shiftType === 'morning'
                    ? 'bg-gradient-to-r from-orange-400 to-orange-500'
                    : 'bg-gradient-to-r from-blue-700 to-blue-800'
                }`}>
                  {shiftType === 'morning' ? <Sun size={12} /> : <Moon size={12} />}
                  <span>{shiftType === 'morning' ? 'وردية صباحية' : 'وردية مسائية'}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className={`rounded-2xl shadow-sm p-3 mb-2 border transition-all duration-300 bg-gradient-to-br ${smartStatus.color} ${successAnimation ? 'scale-105' : 'scale-100'}`}>
          <div className="flex items-center justify-center gap-2">
            <span className="text-sm font-bold">{smartStatus.text}</span>
          </div>
        </div>

        {locationPermissionNeeded && (
          <div className="bg-orange-50 border-2 border-orange-300 rounded-2xl shadow-sm p-4 mb-2">
            <div className="flex items-start gap-3">
              <div className="bg-orange-500 rounded-full p-2 flex-shrink-0">
                <MapPin className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-orange-900 mb-1">
                  مطلوب تفعيل الموقع
                </h3>
                <p className="text-xs text-orange-700 mb-3">
                  يحتاج التطبيق إلى الوصول لموقعك للتحقق من تواجدك في الفرع
                </p>
                <button
                  onClick={handleRequestLocationPermission}
                  disabled={requestingLocationPermission}
                  className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 rounded-lg font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Navigation size={16} />
                  <span>{requestingLocationPermission ? 'جاري الطلب...' : 'تفعيل الموقع الآن'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {location && (
          <div className="bg-white rounded-2xl shadow-sm p-3 mb-2 border-2" style={{
            borderColor: isInGeofence() ? '#10b981' : '#ef4444'
          }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${isInGeofence() ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
                <span className="text-sm font-bold" style={{
                  color: isInGeofence() ? '#10b981' : '#ef4444'
                }}>
                  {isInGeofence() ? '✓ داخل النطاق' : '✗ خارج النطاق'}
                </span>
              </div>
              <span className="text-[10px] text-gray-500">آخر تحديث: {getTimeSinceLastUpdate()}</span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg" style={{
                backgroundColor: isInGeofence() ? '#f0fdf4' : '#fef2f2'
              }}>
                <span className="text-gray-700 font-semibold">📍 المسافة من الفرع</span>
                <span className="font-bold text-base" style={{
                  color: isInGeofence() ? '#10b981' : '#ef4444'
                }}>
                  {distance !== null ? `${Math.round(distance)} متر` : '---'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">دقة الموقع</span>
                <span className={`font-bold ${location.accuracy <= 60 ? 'text-green-600' : 'text-orange-600'}`}>
                  ± {Math.round(location.accuracy)} متر
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">✅ النطاق المسموح</span>
                <span className="font-bold text-blue-600">{employee?.branches?.geofence_radius || 150} متر</span>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm p-3 mb-2 flex-shrink-0">
          <div className="space-y-2 mb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-green-100">
                  <CheckCircle size={16} className="text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-600">الحضور</p>
                  <p className="text-sm font-bold text-gray-900">
                    {todayAttendance?.check_in_time
                      ? (() => {
                          const d = new Date(todayAttendance.check_in_time);
                          const h = d.getHours();
                          const m = d.getMinutes();
                          return `${(h % 12 || 12).toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
                        })()
                      : '--:--'}
                  </p>
                </div>
              </div>
              <ArrowRight size={16} className="text-gray-400" />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-100">
                  <Clock size={16} className="text-gray-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-600">الانصراف</p>
                  <p className="text-sm font-bold text-gray-900">
                    {todayAttendance?.check_out_time ? (
                      (() => {
                        const d = new Date(todayAttendance.check_out_time);
                        const h = d.getHours();
                        const m = d.getMinutes();
                        return `${(h % 12 || 12).toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
                      })()
                    ) : (
                      'لم يتم بعد'
                    )}
                  </p>
                </div>
              </div>
              <ArrowRight size={16} className="text-gray-400" />
            </div>
          </div>

          {todayAttendance?.check_in_time && employee?.shifts && !todayAttendance?.check_out_time && (
            <div className="pt-3 border-t border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-blue-600" />
                  <span className="text-xs text-gray-600">مدة العمل</span>
                </div>
                <p className="text-base font-bold text-blue-600 font-mono">{workProgress.workedTime}</p>
              </div>

              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-600">تقدم الوردية</span>
                <div className="flex items-center gap-1.5 bg-gradient-to-r from-blue-50 to-blue-100 px-2 py-0.5 rounded-full">
                  <TrendingUp size={12} className="text-blue-600" />
                  <span className="text-xs font-bold text-blue-600">{workProgress.percentage.toFixed(0)}%</span>
                </div>
              </div>

              <div className="relative h-2.5 bg-gray-200 rounded-full overflow-hidden mb-2 shadow-inner">
                <div
                  className={`h-full transition-all duration-1000 rounded-full ${
                    workProgress.percentage < 50
                      ? 'bg-gradient-to-r from-green-400 to-green-500'
                      : workProgress.percentage < 80
                      ? 'bg-gradient-to-r from-yellow-400 to-yellow-500'
                      : 'bg-gradient-to-r from-orange-400 to-orange-500'
                  }`}
                  style={{ width: `${workProgress.percentage}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>
                  {(() => {
                    const [h] = employee.shifts.start_time.split(':').map(Number);
                    return `${employee.shifts.start_time.substring(0, 5)} ${h >= 12 ? 'PM' : 'AM'}`;
                  })()}
                </span>
                <span>
                  {(() => {
                    const [h] = employee.shifts.end_time.split(':').map(Number);
                    return `${employee.shifts.end_time.substring(0, 5)} ${h >= 12 ? 'PM' : 'AM'}`;
                  })()}
                </span>
              </div>
            </div>
          )}
        </div>

        {dailySummary && todayAttendance?.check_out_time && (
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl shadow-sm p-3 mb-2 border border-blue-200 animate-fade-in">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
                <TrendingUp size={16} className="text-white" />
              </div>
              <span className="text-sm font-bold text-blue-900">ملخص اليوم</span>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-blue-700">وقت الحضور</span>
                <span className="font-bold text-blue-900">{dailySummary.checkInTime}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-blue-700">وقت الانصراف</span>
                <span className="font-bold text-blue-900">{dailySummary.checkOutTime}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-blue-700">إجمالي ساعات العمل</span>
                <span className="font-bold text-blue-900">{dailySummary.totalHours}</span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-blue-200">
                <span className="text-blue-700">حالة اليوم</span>
                <span className={`font-bold px-2 py-0.5 rounded-full ${
                  dailySummary.status === 'مكتمل'
                    ? 'bg-green-200 text-green-800'
                    : 'bg-orange-200 text-orange-800'
                }`}>
                  {dailySummary.status}
                </span>
              </div>
            </div>
          </div>
        )}

        {todayAttendance && !todayAttendance.check_out_time && (
          <button
            onClick={handleCheckOut}
            disabled={submitting}
            className={`w-full py-4 bg-gradient-to-r from-red-500 via-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white font-bold text-lg rounded-2xl shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mb-2 ${buttonShake ? 'animate-shake' : ''}`}
          >
            {submitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>جاري التنفيذ...</span>
              </>
            ) : (
              <>
                <Fingerprint size={28} />
                <span>تسجيل الانصراف</span>
              </>
            )}
          </button>
        )}

        {!todayAttendance && (
          <button
            onClick={handleCheckIn}
            disabled={submitting || !canCheckIn() || !isOnline}
            className={`w-full py-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold text-lg rounded-2xl shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mb-2 ${buttonShake ? 'animate-shake' : ''} ${successAnimation ? 'scale-105' : 'scale-100'}`}
          >
            {submitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>جاري التسجيل...</span>
              </>
            ) : (
              <>
                <Fingerprint size={28} />
                <span>تسجيل الحضور</span>
              </>
            )}
          </button>
        )}

        {isLoggedIn && (
          <button
            onClick={testGPS}
            disabled={testingGPS}
            className="w-full py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold text-base rounded-2xl shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {testingGPS ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Testing GPS...</span>
              </>
            ) : (
              <>
                <Navigation size={20} />
                <span>GPS TEST</span>
              </>
            )}
          </button>
        )}
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-10px); }
          75% { transform: translateX(10px); }
        }
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
