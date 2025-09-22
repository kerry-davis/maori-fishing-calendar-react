// Context providers and hooks for the Māori Fishing Calendar

// Theme Context
export { 
  ThemeProvider, 
  useThemeContext, 
  ThemeContext 
} from './ThemeContext';

// Location Context
export { 
  LocationProvider, 
  useLocationContext, 
  LocationContext 
} from './LocationContext';

// Database Context
export { 
  DatabaseProvider, 
  useDatabaseContext, 
  useDatabaseService,
  DatabaseContext 
} from './DatabaseContext';

// PWA Context
export {
  PWAProvider,
  usePWA
} from './PWAContext';

// Auth Context
export {
  AuthProvider,
  useAuth,
  AuthContext
} from './AuthContext';

// Combined provider component for easy setup
import React from 'react';
import type { ReactNode } from 'react';
import { ThemeProvider } from './ThemeContext';
import { LocationProvider } from './LocationContext';
import { DatabaseProvider } from './DatabaseContext';
import { PWAProvider } from './PWAContext';
import { AuthProvider } from './AuthContext';

interface AppProvidersProps {
  children: ReactNode;
}

/**
 * Combined provider component that wraps all context providers
 * Use this to wrap your App component for easy setup
 */
export function AppProviders({ children }: AppProvidersProps): React.ReactElement {
  return React.createElement(
    AuthProvider,
    null,
    React.createElement(
      ThemeProvider,
      null,
      React.createElement(
        LocationProvider,
        null,
        React.createElement(
          DatabaseProvider,
          null,
          React.createElement(
            PWAProvider,
            null,
            React.createElement(
              AuthProvider,
              null,
              children
            )
          )
        )
      )
    )
  );
}