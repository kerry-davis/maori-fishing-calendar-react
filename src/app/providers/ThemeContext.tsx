import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { useTheme } from '@shared/hooks/useLocalStorage';
import type { ThemeContextType } from '@shared/types';
import { useAuth } from './AuthContext';
import { getThemePreference, setThemePreference } from '@shared/services/themePreferenceService';

// Create the theme context
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Theme provider component
interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const { user } = useAuth();
  const userId = user?.uid ?? null;
  const [isDark, setThemeValue, error] = useTheme();
  const previousUserIdRef = useRef<string | null>(null);

  const persistableToggle = useCallback<ThemeContextType['toggleTheme']>((mode) => {
    const nextTheme = mode ?? (isDark ? 'light' : 'dark');
    setThemeValue(nextTheme);

    if (!userId) {
      return;
    }

    void setThemePreference(userId, nextTheme).catch((persistError) => {
      console.warn('Theme preference persistence failed:', persistError);
    });
  }, [isDark, setThemeValue, userId]);

  useEffect(() => {
    const previousUserId = previousUserIdRef.current;

    if (!userId) {
      previousUserIdRef.current = null;
      setThemeValue('light');
      return;
    }

    if (previousUserId === userId) {
      return;
    }

    let cancelled = false;

    void getThemePreference(userId)
      .then((preference) => {
        if (!cancelled && preference) {
          setThemeValue(preference);
        }
      })
      .catch((fetchError) => {
        console.warn('Theme preference fetch failed:', fetchError);
      });

    previousUserIdRef.current = userId;

    return () => {
      cancelled = true;
    };
  }, [userId, setThemeValue]);

  // Log theme errors but don't throw - graceful degradation
  if (error) {
    console.error('Theme context error:', error);
  }

  const contextValue = useMemo<ThemeContextType>(() => ({
    isDark,
    toggleTheme: persistableToggle
  }), [isDark, persistableToggle]);

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

// Custom hook to use theme context
export function useThemeContext(): ThemeContextType {
  const context = useContext(ThemeContext);
  
  if (context === undefined) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }
  
  return context;
}

// Export the context for testing purposes
export { ThemeContext };