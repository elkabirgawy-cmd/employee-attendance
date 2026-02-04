import { useEffect, useState } from 'react';
import { Clock, Calendar, Sun, Moon } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { syncServerTimeWithGPS, getServerNow, formatTimeSyncInfo, logTimeSync, type TimeSync } from '../utils/timezoneDetection';

interface ServerTimeCardProps {
  gpsCoordinates?: { lat: number; lng: number } | null;
  onTimeSyncUpdate?: (timeSync: TimeSync) => void;
  employeeId?: string;
  timezone?: string | null;
  locationCity?: string | null;
  locationCountry?: string | null;
}

export default function ServerTimeCard({
  gpsCoordinates,
  onTimeSyncUpdate,
  employeeId,
  timezone,
  locationCity,
  locationCountry,
}: ServerTimeCardProps) {
  const { language } = useLanguage();
  const [serverTime, setServerTime] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeSync, setTimeSync] = useState<TimeSync | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const isRTL = language === 'ar';

  useEffect(() => {
    let clockInterval: NodeJS.Timeout;
    let retryTimeout: NodeJS.Timeout;

    async function performSync() {
      try {
        const sync = await syncServerTimeWithGPS(
          gpsCoordinates?.lat,
          gpsCoordinates?.lng
        );

        setTimeSync(sync);
        setServerTime(sync.serverTime);
        setLoading(false);
        setRetryCount(0);

        if (onTimeSyncUpdate) {
          onTimeSyncUpdate(sync);
        }

        logTimeSync(sync, employeeId, gpsCoordinates || undefined).catch(err => {
          console.warn('[TIME_SYNC] Non-critical: Failed to log time sync', err);
        });

        clockInterval = setInterval(() => {
          if (sync) {
            setServerTime(getServerNow(sync));
          }
        }, 1000);
      } catch (error) {
        console.warn('[TIME_SYNC] Non-critical: Failed to sync time', error);
        setServerTime(new Date());
        setLoading(false);

        clockInterval = setInterval(() => {
          setServerTime(new Date());
        }, 1000);
      }
    }

    performSync();

    return () => {
      if (clockInterval) clearInterval(clockInterval);
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [gpsCoordinates?.lat, gpsCoordinates?.lng, employeeId]);

  function formatTime12Hour(date: Date) {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const ampmArabic = hours >= 12 ? 'م' : 'ص';
    const displayHours = hours % 12 || 12;
    return {
      time: `${displayHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`,
      period: isRTL ? ampmArabic : ampm
    };
  }

  function isDaytime(date: Date) {
    const hours = date.getHours();
    return hours >= 6 && hours < 18;
  }

  function formatDateArabic(date: Date) {
    const arabicDays = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const arabicMonths = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

    const englishDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const englishMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const dayName = isRTL ? arabicDays[date.getDay()] : englishDays[date.getDay()];
    const day = date.getDate();
    const month = isRTL ? arabicMonths[date.getMonth()] : englishMonths[date.getMonth()];
    const year = date.getFullYear();

    return `${dayName} · ${day} ${month} ${year}`;
  }

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-blue-50 via-blue-25 to-white border border-blue-100 rounded-2xl shadow-md p-4 overflow-hidden mb-6 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-300 to-orange-400 flex-shrink-0"></div>
          <div className="flex flex-col items-end gap-2">
            <div className="h-8 w-32 bg-blue-200 rounded"></div>
            <div className="h-4 w-48 bg-blue-100 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!serverTime) return null;

  const { time, period } = formatTime12Hour(serverTime);
  const isDay = isDaytime(serverTime);
  const TimeIcon = isDay ? Sun : Moon;
  const iconBgColor = isDay
    ? 'bg-gradient-to-br from-orange-300 to-orange-400'
    : 'bg-gradient-to-br from-indigo-400 to-purple-500';

  return (
    <div className="bg-gradient-to-br from-blue-50 via-blue-25 to-white border border-blue-100 rounded-2xl shadow-md p-4 overflow-hidden mb-6 transition-all duration-300">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-shrink-0">
          <div className={`w-12 h-12 rounded-full ${iconBgColor} animate-pulse flex items-center justify-center shadow-md transition-all duration-500`}>
            <TimeIcon size={24} className="text-white" />
          </div>
        </div>

        <div className="flex flex-col items-end" dir={isRTL ? 'rtl' : 'ltr'}>
          <div className="text-2xl font-extrabold leading-none mb-1 text-blue-900">
            {time} <span className="text-base">{period}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-blue-700">
            <Calendar size={12} />
            <span className="font-medium">{formatDateArabic(serverTime)}</span>
          </div>
          <div className="flex flex-col gap-1 mt-1.5 text-[10px]">
            {locationCity && locationCountry && (
              <div className="flex items-center gap-1 text-blue-600">
                <Clock size={10} />
                <span>{isRTL ? `الموقع: ${locationCity}, ${locationCountry}` : `Location: ${locationCity}, ${locationCountry}`}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
