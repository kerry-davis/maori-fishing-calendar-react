import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { useTheme } from '@shared/hooks/useLocalStorage';
import type { ThemeContextType } from '@shared/types';

// Create the theme context
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Theme provider component
interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [isDark, toggleTheme, error] = useTheme();

  // Log theme errors but don't throw - graceful degradation
  if (error) {
    console.error('Theme context error:', error);
  }

  const contextValue: ThemeContextType = {
    isDark,
    toggleTheme
  };

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