import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { firebaseDataService } from '../services/firebaseDataService';
import type { DatabaseContextType } from '../types';

// Create the database context
const DatabaseContext = createContext<DatabaseContextType | undefined>(undefined);

// Database provider component
interface DatabaseProviderProps {
  children: ReactNode;
}

export function DatabaseProvider({ children }: DatabaseProviderProps) {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const initializeDatabase = async () => {
      try {
        setError(null);
        console.log('Initializing database service in guest mode...');
        await firebaseDataService.initialize(); // Initialize as guest
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

    initializeDatabase();

    return () => {
      isMounted = false;
    };
  }, []); // Run only once on mount

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