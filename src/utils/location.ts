import { Geolocation } from '@capacitor/geolocation';

export interface LocationResult {
  lat: number;
  lng: number;
  accuracy: number;
  mocked?: boolean;
}

export interface LocationPermissionStatus {
  granted: boolean;
  canRequest: boolean;
  status: 'granted' | 'denied' | 'prompt';
}

export async function checkLocationPermission(): Promise<LocationPermissionStatus> {
  try {
    const perm = await Geolocation.checkPermissions();

    if (perm.location === 'granted') {
      return { granted: true, canRequest: false, status: 'granted' };
    } else if (perm.location === 'denied') {
      return { granted: false, canRequest: false, status: 'denied' };
    } else {
      return { granted: false, canRequest: true, status: 'prompt' };
    }
  } catch (error) {
    console.error('Error checking location permission:', error);
    return { granted: false, canRequest: false, status: 'denied' };
  }
}

export async function requestLocationPermission(): Promise<boolean> {
  try {
    const perm = await Geolocation.requestPermissions();
    return perm.location === 'granted';
  } catch (error) {
    console.error('Error requesting location permission:', error);
    return false;
  }
}

export async function getCurrentLocationSafe(): Promise<LocationResult> {
  const permStatus = await checkLocationPermission();

  if (!permStatus.granted) {
    const error: any = new Error('Location permission required');
    error.code = 'LOCATION_PERMISSION_REQUIRED';
    throw error;
  }

  const pos = await Geolocation.getCurrentPosition({
    enableHighAccuracy: true,
    timeout: 15000,
  });

  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    accuracy: pos.coords.accuracy || 0,
    mocked: (pos.coords as any).mocked || false,
  };
}

export async function getCurrentLocation(): Promise<LocationResult> {
  const perm = await Geolocation.requestPermissions();
  if (perm.location !== 'granted') {
    throw new Error('Permission denied');
  }

  const pos = await Geolocation.getCurrentPosition({
    enableHighAccuracy: true,
    timeout: 15000,
  });

  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    accuracy: pos.coords.accuracy || 0,
    mocked: (pos.coords as any).mocked || false,
  };
}

export async function watchLocation(
  onSuccess: (location: LocationResult) => void,
  onError: (error: string) => void
): Promise<string> {
  const permStatus = await checkLocationPermission();

  if (!permStatus.granted) {
    onError('LOCATION_PERMISSION_REQUIRED');
    const error: any = new Error('Location permission required');
    error.code = 'LOCATION_PERMISSION_REQUIRED';
    throw error;
  }

  const watchId = await Geolocation.watchPosition(
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    },
    (position, err) => {
      if (err) {
        onError(err.message || 'Unknown error');
        return;
      }

      if (position) {
        onSuccess({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy || 0,
          mocked: (position.coords as any).mocked || false,
        });
      }
    }
  );

  return watchId;
}

export async function clearWatch(watchId: string): Promise<void> {
  await Geolocation.clearWatch({ id: watchId });
}
