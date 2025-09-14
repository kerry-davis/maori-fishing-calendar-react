import { createContext, useContext, useCallback, useState } from "react";
import type { ReactNode } from "react";
import { useLocationStorage } from "../hooks/useLocalStorage";
import type { LocationContextType, UserLocation } from "../types";

// Create the location context
const LocationContext = createContext<LocationContextType | undefined>(
  undefined,
);

// Location provider component
interface LocationProviderProps {
  children: ReactNode;
}

export function LocationProvider({ children }: LocationProviderProps) {
  const [userLocation, setUserLocationStorage, , storageError] =
    useLocationStorage();
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);

  // Set location and persist to localStorage
  const setLocation = useCallback(
    (location: UserLocation) => {
      setUserLocationStorage(location);
    },
    [setUserLocationStorage],
  );

  // Request user's current location using geolocation API
  const requestLocation = useCallback(async (): Promise<void> => {
    if (isRequestingLocation) {
      return; // Prevent multiple simultaneous requests
    }

    if (!navigator.geolocation) {
      throw new Error("Geolocation is not supported by this browser");
    }

    setIsRequestingLocation(true);

    try {
      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000, // 10 seconds timeout
            maximumAge: 300000, // 5 minutes cache
          });
        },
      );

      // Create location object with coordinates
      const location: UserLocation = {
        lat: position.coords.latitude,
        lon: position.coords.longitude,
        name: `${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`,
      };

      // Try to get a more readable location name using reverse geocoding
      try {
        const geoResponse = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${location.lat}&lon=${location.lon}`,
        );

        if (geoResponse.ok) {
          const geoData = await geoResponse.json();
          if (geoData.address) {
            const { city, town, village, county, state, country } =
              geoData.address;
            const locality = city || town || village || county || state;
            const locationName = [locality, country].filter(Boolean).join(", ");
            if (locationName) {
              location.name = locationName;
            }
          }
        } else {
          console.warn(
            `Reverse geocoding service failed with status ${geoResponse.status}, using coordinates as name.`,
          );
        }
      } catch (geocodingError) {
        console.warn(
          "Reverse geocoding call failed, using coordinates as location name:",
          geocodingError,
        );
      }

      // Set the location (either with a readable name or coordinates)
      setLocation(location);
    } catch (error) {
      let errorMessage = "Failed to get current location";

      if (error instanceof GeolocationPositionError) {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "Location access denied by user";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Location information unavailable";
            break;
          case error.TIMEOUT:
            errorMessage = "Location request timed out";
            break;
          default:
            errorMessage = "Unknown location error occurred";
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      console.error("Geolocation error:", errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsRequestingLocation(false);
    }
  }, [isRequestingLocation, setLocation]);

  // Log storage errors but don't throw - graceful degradation
  if (storageError) {
    console.error("Location storage error:", storageError);
  }

  const contextValue: LocationContextType = {
    userLocation,
    setLocation,
    requestLocation,
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
    throw new Error(
      "useLocationContext must be used within a LocationProvider",
    );
  }

  return context;
}

// Export the context for testing purposes
export { LocationContext };
