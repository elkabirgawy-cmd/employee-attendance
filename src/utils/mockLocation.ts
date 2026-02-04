export interface LocationData {
  lat: number;
  lng: number;
  accuracy: number;
  mocked?: boolean;
}

export function isMockLocation(location: LocationData): boolean {
  if (location.mocked === true) {
    return true;
  }

  return false;
}

export function getMockLocationStatus(location: LocationData): {
  isMocked: boolean;
  reason: string;
} {
  if (location.mocked === true) {
    return {
      isMocked: true,
      reason: 'GPS coordinates flagged as mocked'
    };
  }

  return {
    isMocked: false,
    reason: 'Location appears genuine'
  };
}
