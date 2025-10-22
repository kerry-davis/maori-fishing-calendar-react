import { useState, useEffect, useCallback } from 'react';
import type { UserLocation, TackleItem } from '../types';
import { DEFAULT_GEAR_TYPES } from '../types';

// Generic localStorage hook with TypeScript support
export function useLocalStorage<T>(
  key: string,
  defaultValue: T
): [T, (value: T | ((prev: T) => T)) => void, () => void, string | null] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return defaultValue;
    }
  });

  const [error, setError] = useState<string | null>(null);

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    try {
      setError(null);
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      const errorMessage = `Error setting localStorage key "${key}": ${error}`;
      console.error(errorMessage);
      setError(errorMessage);
    }
  }, [key]);

  const removeValue = useCallback(() => {
    try {
      setError(null);
      window.localStorage.removeItem(key);
      setStoredValue(defaultValue);
    } catch (error) {
      const errorMessage = `Error removing localStorage key "${key}": ${error}`;
      console.error(errorMessage);
      setError(errorMessage);
    }
  }, [key, defaultValue]);

  // Listen for changes to localStorage from other tabs/windows
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          setError(null);
          setStoredValue(JSON.parse(e.newValue));
        } catch (error) {
          console.error(`Error parsing localStorage change for key "${key}":`, error);
          setError(`Error parsing localStorage change for key "${key}": ${error}`);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key]);

  return [storedValue, setValue, removeValue, error];
}

// Specific hook for theme management
export function useTheme(): [boolean, () => void, string | null] {
  const [themeString, setThemeString, , error] = useLocalStorage<string>('theme', 'light');

  const isDark = themeString === 'dark';

  const toggleTheme = useCallback(() => {
    console.log('toggleTheme called, current isDark:', isDark, 'current themeString:', themeString);
    const newTheme = isDark ? 'light' : 'dark';
    console.log('Setting theme to:', newTheme);
    setThemeString(newTheme);
  }, [isDark, themeString, setThemeString]);

  // Apply theme class
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;

    console.log('Applying theme in useEffect, isDark:', isDark, 'themeString:', themeString);

    if (isDark) {
      // Apply to both html and body for compatibility
      html.classList.add('dark');
      body.classList.add('dark-theme');
      html.dataset.theme = 'dark';
      body.dataset.theme = 'dark';
      console.log('Added dark class to html and dark-theme class to body');
    } else {
      // Remove from both html and body for compatibility
      html.classList.remove('dark');
      body.classList.remove('dark-theme');
      html.dataset.theme = 'light';
      body.dataset.theme = 'light';
      console.log('Removed dark class from html and dark-theme class from body');
    }

    console.log('Current html classes:', html.className);
    console.log('Current body classes:', body.className);
    console.log('Current html data-theme:', html.dataset.theme);
    console.log('Current body data-theme:', body.dataset.theme);
  }, [isDark, themeString]);

  return [isDark, toggleTheme, error];
}

// Specific hook for user location management
export function useLocationStorage(): [
  UserLocation | null, 
  (location: UserLocation | null) => void, 
  () => void, 
  string | null
] {
  const [userLocation, setUserLocation, removeLocation, error] = useLocalStorage<UserLocation | null>(
    'userLocation', 
    null
  );

  return [userLocation, setUserLocation, removeLocation, error];
}

// Specific hook for tackle box data management
export function useTackleBoxStorage(): [
  TackleItem[], 
  (tacklebox: TackleItem[] | ((prev: TackleItem[]) => TackleItem[])) => void, 
  () => void, 
  string | null
] {
  const [tacklebox, setTacklebox, removeTacklebox, error] = useLocalStorage<TackleItem[]>(
    'tacklebox', 
    []
  );

  return [tacklebox, setTacklebox, removeTacklebox, error];
}

// Specific hook for gear types management
export function useGearTypesStorage(): [
  string[], 
  (gearTypes: string[] | ((prev: string[]) => string[])) => void, 
  () => void, 
  string | null
] {
  const [gearTypes, setGearTypes, removeGearTypes, error] = useLocalStorage<string[]>(
    'gearTypes', 
    [...DEFAULT_GEAR_TYPES] // Default gear types from constants
  );

  return [gearTypes, setGearTypes, removeGearTypes, error];
}

