import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { firebaseDataService } from '../services/firebaseDataService';
import { useAuth } from './AuthContext';
import type { DatabaseContextType } from '../types';

// Create the database context
const DatabaseContext = createContext<DatabaseContextType | undefined>(undefined);

// Database provider component
interface DatabaseProviderProps {
  children: ReactNode;
}

export function DatabaseProvider({ children }: DatabaseProviderProps) {
  const { user, loading: authLoading } = useAuth();
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize database when user is available
  useEffect(() => {
    let isMounted = true;

    const initializeDatabase = async () => {
      try {
        setError(null);
        console.log('Initializing Firebase database service...');

        if (user) {
          await firebaseDataService.initialize(user.uid);
          console.log('Firebase database service initialized for user:', user.uid);
        } else {
          // If no user, we're in offline/local mode
          console.log('No authenticated user - using offline mode');
        }

        // Only update state if component is still mounted
        if (isMounted) {
          setIsReady(true);
          console.log('Database context ready');
        }
      } catch (err) {
        console.error('Database initialization failed:', err);

        if (isMounted) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown database error';
          setError(errorMessage);
          setIsReady(false);
        }
      }
    };

    // Only initialize if auth is not loading
    if (!authLoading) {
      initializeDatabase();
    }

    // Cleanup function
    return () => {
      isMounted = false;
    };
  }, [user, authLoading]);

  const contextValue: DatabaseContextType = {
    db: null, // Firebase doesn't expose a database object like IndexedDB
    isReady,
    error
  };

  return (
    <DatabaseContext.Provider value={contextValue}>
      {children}
    </DatabaseContext.Provider>
  );
}

// Custom hook to use database context
export function useDatabaseContext(): DatabaseContextType {
  const context = useContext(DatabaseContext);
  
  if (context === undefined) {
    throw new Error('useDatabaseContext must be used within a DatabaseProvider');
  }
  
  return context;
}

// Custom hook to get the database service instance
// This provides access to all database operations
export function useDatabaseService() {
  const { isReady, error } = useDatabaseContext();

  if (error) {
    throw new Error(`Database error: ${error}`);
  }

  if (!isReady) {
    throw new Error('Database not ready. Please wait for initialization.');
  }

  return firebaseDataService;
}

// Export the context for testing purposes
export { DatabaseContext };