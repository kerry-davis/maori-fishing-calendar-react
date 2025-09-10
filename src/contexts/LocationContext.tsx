import { createContext, useContext, useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocationStorage } from '../hooks/useLocalStorage';
import type { LocationContextType, UserLocation } from '../types';

// Create the location context
const LocationContext = createContext<LocationContextType | undefined>(undefined);

// Location provider component
interface LocationProviderProps {
  children: ReactNode;
}

export function LocationProvider({ children }: LocationProviderProps) {
  const [userLocation, setUserLocationStorage, , storageError] = useLocationStorage();
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);

  // Set location and persist to localStorage
  const setLocation = useCallback((location: UserLocation) => {
    setUserLocationStorage(location);
  }, [setUserLocationStorage]);

  // Request user's current location using geolocation API
  const requestLocation = useCallback(async (): Promise<void> => {
    if (isRequestingLocation) {
      return; // Prevent multiple simultaneous requests
    }

    if (!navigator.geolocation) {
      throw new Error('Geolocation is not supported by this browser');
    }

    setIsRequestingLocation(true);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          {
            enableHighAccuracy: true,
            timeout: 10000, // 10 seconds timeout
            maximumAge: 300000 // 5 minutes cache
          }
        );
      });

      // Create location object with coordinates
      const location: UserLocation = {
        lat: position.coords.latitude,
        lon: position.coords.longitude,
        name: `${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`
      };

      // Try to get a more readable location name using reverse geocoding
      try {
        const response = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lon}&current=temperature_2m&timezone=auto`
        );
        
        if (response.ok) {
          // If the weather API works, we know the coordinates are valid
          // For now, keep the coordinate-based name, but this could be enhanced
          // with a proper reverse geocoding service in the future
          setLocation(location);
        } else {
          throw new Error('Unable to validate location coordinates');
        }
      } catch (geocodingError) {
        console.warn('Reverse geocoding failed, using coordinates as location name:', geocodingError);
        // Still set the location even if reverse geocoding fails
        setLocation(location);
      }
    } catch (error) {
      let errorMessage = 'Failed to get current location';
      
      if (error instanceof GeolocationPositionError) {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location access denied by user';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information unavailable';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out';
            break;
          default:
            errorMessage = 'Unknown location error occurred';
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      console.error('Geolocation error:', errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsRequestingLocation(false);
    }
  }, [isRequestingLocation, setLocation]);

  // Log storage errors but don't throw - graceful degradation
  if (storageError) {
    console.error('Location storage error:', storageError);
  }

  const contextValue: LocationContextType = {
    userLocation,
    setLocation,
    requestLocation
  };

  return (
    <LocationContext.Provider value={contextValue}>
      {children}
    </LocationContext.Provider>
  );
}

// Custom hook to use location context
export function useLocationContext(): LocationContextType {
  const context = useContext(LocationContext);
  
  if (context === undefined) {
    throw new Error('useLocationContext must be used within a LocationProvider');
  }
  
  return context;
}

// Export the context for testing purposes
export { LocationContext };