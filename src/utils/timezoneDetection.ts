export interface TimezoneResult {
  timezone: string;
  source: 'GPS' | 'CACHED' | 'DEFAULT';
  timestamp: number;
  coordinates?: { lat: number; lng: number };
}

export interface TimeSync {
  serverTime: Date;
  source: 'SERVER_GPS' | 'SERVER_CACHED_TZ' | 'DEVICE_FALLBACK';
  timezone: string;
  timezoneSource: 'GPS' | 'MANUAL' | 'CACHED' | 'DEFAULT';
  offset: number;
  syncedAt: number;
}

const TIMEZONE_CACHE_KEY = 'last_known_timezone';
const TIMEZONE_CACHE_COORDS_KEY = 'last_timezone_coords';
const DEFAULT_TIMEZONE = 'Asia/Riyadh';

export async function getTimezoneFromGPS(lat: number, lng: number): Promise<TimezoneResult> {
  const timestamp = Date.now();

  try {
    const cachedTimezone = getCachedTimezone();
    if (cachedTimezone) {
      return {
        timezone: cachedTimezone.timezone,
        source: 'CACHED',
        timestamp
      };
    }

    const browserTimezone = getBrowserTimezone();
    if (browserTimezone) {
      const result: TimezoneResult = {
        timezone: browserTimezone,
        source: 'GPS',
        timestamp,
        coordinates: { lat, lng }
      };
      cacheTimezone(result);
      return result;
    }

    return {
      timezone: DEFAULT_TIMEZONE,
      source: 'DEFAULT',
      timestamp
    };
  } catch (error) {
    console.error('Failed to get timezone:', error);
    return {
      timezone: DEFAULT_TIMEZONE,
      source: 'DEFAULT',
      timestamp: Date.now()
    };
  }
}

function getBrowserTimezone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (error) {
    console.error('Failed to get browser timezone:', error);
    return null;
  }
}

function cacheTimezone(result: TimezoneResult): void {
  try {
    localStorage.setItem(TIMEZONE_CACHE_KEY, JSON.stringify({
      timezone: result.timezone,
      timestamp: result.timestamp,
      coordinates: result.coordinates
    }));
  } catch (error) {
    console.error('Failed to cache timezone:', error);
  }
}

function getCachedTimezone(): { timezone: string; timestamp: number; coordinates?: { lat: number; lng: number } } | null {
  try {
    const cached = localStorage.getItem(TIMEZONE_CACHE_KEY);
    if (!cached) return null;

    const parsed = JSON.parse(cached);
    const age = Date.now() - parsed.timestamp;

    if (age > 7 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(TIMEZONE_CACHE_KEY);
      return null;
    }

    return parsed;
  } catch (error) {
    return null;
  }
}

export async function syncServerTime(timezone?: string): Promise<TimeSync> {
  const browserTimezone = getBrowserTimezone();
  const effectiveTimezone = timezone || browserTimezone || DEFAULT_TIMEZONE;
  const timezoneSource: 'GPS' | 'MANUAL' | 'CACHED' | 'DEFAULT' =
    timezone ? 'GPS' :
    (getCachedTimezone() ? 'CACHED' :
    (browserTimezone ? 'DEFAULT' : 'DEFAULT'));

  return {
    serverTime: new Date(),
    source: 'DEVICE_FALLBACK',
    timezone: effectiveTimezone,
    timezoneSource,
    offset: 0,
    syncedAt: Date.now()
  };
}

export async function syncServerTimeWithGPS(lat?: number, lng?: number): Promise<TimeSync> {
  if (lat !== undefined && lng !== undefined) {
    const timezoneResult = await getTimezoneFromGPS(lat, lng);
    const timeSync = await syncServerTime(timezoneResult.timezone);

    return {
      ...timeSync,
      timezoneSource: timezoneResult.source
    };
  }

  const cached = getCachedTimezone();
  if (cached) {
    const timeSync = await syncServerTime(cached.timezone);
    return {
      ...timeSync,
      timezoneSource: 'CACHED'
    };
  }

  const timeSync = await syncServerTime(DEFAULT_TIMEZONE);
  return {
    ...timeSync,
    timezoneSource: 'DEFAULT'
  };
}

export function getServerNow(timeSync: TimeSync): Date {
  const elapsed = Date.now() - timeSync.syncedAt;
  return new Date(timeSync.serverTime.getTime() + elapsed);
}

export function formatTimeSyncInfo(timeSync: TimeSync, isRTL: boolean = true): string {
  const tzSource = timeSync.timezoneSource;

  if (tzSource === 'GPS') {
    return isRTL
      ? `تم التحديد تلقائيًا حسب الموقع (${timeSync.timezone})`
      : `Auto-detected from location (${timeSync.timezone})`;
  }

  if (tzSource === 'CACHED') {
    return isRTL
      ? `المنطقة الزمنية المحفوظة (${timeSync.timezone})`
      : `Cached timezone (${timeSync.timezone})`;
  }

  return isRTL
    ? `المنطقة الزمنية المحلية (${timeSync.timezone})`
    : `Local timezone (${timeSync.timezone})`;
}

export async function logTimeSync(
  timeSync: TimeSync,
  employeeId?: string,
  gpsCoordinates?: { lat: number; lng: number }
): Promise<void> {
  try {
    const deviceTime = new Date();
    const timeDrift = (timeSync.serverTime.getTime() - deviceTime.getTime()) / 1000;

    const logData = {
      employee_id: employeeId || null,
      time_source: timeSync.source,
      timezone_source: timeSync.timezoneSource,
      timezone: timeSync.timezone,
      gps_latitude: gpsCoordinates?.lat || null,
      gps_longitude: gpsCoordinates?.lng || null,
      server_time: timeSync.serverTime.toISOString(),
      device_time: deviceTime.toISOString(),
      time_drift_seconds: timeDrift,
      synced_at: new Date().toISOString()
    };

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/time_sync_logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(logData)
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.warn('[TIME_SYNC] Non-critical: Failed to log time sync:', errorText);
    }
  } catch (error) {
    console.warn('[TIME_SYNC] Non-critical: Error logging time sync:', error);
  }
}
