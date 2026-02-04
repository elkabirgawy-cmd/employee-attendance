export interface Location {
  lat: number;
  lng: number;
  accuracy?: number;
  timestamp?: number;
}

export interface Branch {
  latitude: number;
  longitude: number;
  geofence_radius: number;
}

export interface GeofenceValidationResult {
  valid: boolean;
  distance: number;
  reason?: string;
  code?: string;
  message_ar?: string;
  status?: 'CONFIRMED_INSIDE' | 'CONFIRMED_OUTSIDE' | 'TRUST_LAST_KNOWN';
}

export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export function validateGeofence(
  deviceLocation: Location,
  branch: Branch,
  options?: { trustLastKnown?: boolean }
): GeofenceValidationResult {
  if (!deviceLocation || !deviceLocation.lat || !deviceLocation.lng) {
    return {
      valid: options?.trustLastKnown ? true : false,
      distance: -1,
      code: 'LOCATION_MISSING',
      reason: 'Device location is missing',
      message_ar: 'الموقع غير متوفر',
      status: 'TRUST_LAST_KNOWN',
    };
  }

  if (deviceLocation.accuracy && deviceLocation.accuracy > 500) {
    return {
      valid: options?.trustLastKnown ? true : false,
      distance: -1,
      code: 'LOW_ACCURACY',
      reason: 'Location accuracy is too low - trusting last known state',
      message_ar: 'دقة الموقع ضعيفة جدًا، حاول الاقتراب من النافذة أو تفعيل GPS',
      status: 'TRUST_LAST_KNOWN',
    };
  }

  if (deviceLocation.timestamp) {
    const now = Date.now();
    const locationAge = (now - deviceLocation.timestamp) / 1000;
    if (locationAge > 30) {
      return {
        valid: options?.trustLastKnown ? true : false,
        distance: -1,
        code: 'LOCATION_OUTDATED',
        reason: 'Location timestamp is too old - trusting last known state',
        message_ar: 'الموقع قديم، يرجى المحاولة مرة أخرى',
        status: 'TRUST_LAST_KNOWN',
      };
    }
  }

  const distance = calculateDistance(
    deviceLocation.lat,
    deviceLocation.lng,
    branch.latitude,
    branch.longitude
  );

  if (distance > branch.geofence_radius) {
    return {
      valid: false,
      distance,
      code: 'OUTSIDE_GEOFENCE',
      reason: `Distance ${distance.toFixed(0)}m exceeds radius ${branch.geofence_radius}m`,
      message_ar: 'أنت خارج نطاق موقع الفرع',
      status: 'CONFIRMED_OUTSIDE',
    };
  }

  return {
    valid: true,
    distance,
    status: 'CONFIRMED_INSIDE',
  };
}