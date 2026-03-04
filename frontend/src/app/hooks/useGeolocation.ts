import { useCallback, useState } from 'react';

interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

interface GeolocationState {
  coords: Coordinates | null;
  loading: boolean;
  error: string | null;
  getLocation: () => void;
}

export function useGeolocation(): GeolocationState {
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getLocation = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setError('Geolocation is not supported by this browser.');
      return;
    }

    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        setLoading(false);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setError('Location permission was denied. Please enable it in your browser settings.');
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setError('Location information is unavailable right now.');
        } else if (err.code === err.TIMEOUT) {
          setError('Timed out while trying to get your location. Please try again.');
        } else {
          setError('An unknown error occurred while getting your location.');
        }
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000,
      },
    );
  }, []);

  return { coords, loading, error, getLocation };
}

