import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { databaseService } from '../services/databaseService';
import type { DatabaseContextType } from '../types';

// Create the database context
const DatabaseContext = createContext<DatabaseContextType | undefined>(undefined);

// Database provider component
interface DatabaseProviderProps {
  children: ReactNode;
}

export function DatabaseProvider({ children }: DatabaseProviderProps) {
  const [db, setDb] = useState<IDBDatabase | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize database on mount
  useEffect(() => {
    let isMounted = true;

    const initializeDatabase = async () => {
      try {
        setError(null);
        console.log('Initializing database...');
        
        await databaseService.initialize();
        
        // Only update state if component is still mounted
        if (isMounted) {
          const database = databaseService.getDatabase();
          setDb(database);
          setIsReady(true);
          console.log('Database context ready');
        }
      } catch (err) {
        console.error('Database initialization failed:', err);
        
        if (isMounted) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown database error';
          setError(errorMessage);
          setIsReady(false);
          setDb(null);
        }
      }
    };

    initializeDatabase();

    // Cleanup function
    return () => {
      isMounted = false;
      // Note: We don't close the database here as it might be used by other components
      // The database service manages its own lifecycle
    };
  }, []);

  // Handle database connection errors
  useEffect(() => {
    if (db) {
      const handleError = (event: Event) => {
        console.error('Database connection error:', event);
        setError('Database connection lost');
        setIsReady(false);
        setDb(null);
      };

      const handleBlocked = (event: Event) => {
        console.warn('Database upgrade blocked:', event);
        setError('Database upgrade blocked - please close other tabs');
      };

      const handleVersionChange = (event: Event) => {
        console.warn('Database version changed:', event);
        setError('Database version changed - please refresh the page');
        setIsReady(false);
        setDb(null);
      };

      db.addEventListener('error', handleError);
      db.addEventListener('blocked', handleBlocked);
      db.addEventListener('versionchange', handleVersionChange);

      return () => {
        db.removeEventListener('error', handleError);
        db.removeEventListener('blocked', handleBlocked);
        db.removeEventListener('versionchange', handleVersionChange);
      };
    }
  }, [db]);

  const contextValue: DatabaseContextType = {
    db,
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
  
  return databaseService;
}

// Export the context for testing purposes
export { DatabaseContext };