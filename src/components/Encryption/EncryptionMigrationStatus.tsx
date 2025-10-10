import React, { useEffect } from 'react';
import { useEncryptionMigrationStatus } from '../../hooks/useEncryptionMigrationStatus';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Small unobtrusive status pill for encryption migration.
 * Appears only while there is work to do.
 * Automatically disappears when migration is complete.
 */
export const EncryptionMigrationStatus: React.FC = () => {
  const { user } = useAuth();
  const { running, allDone, collections, totalUpdated, totalProcessed, error } = useEncryptionMigrationStatus();

  // Log when pill appears/disappears
  useEffect(() => {
    if (!user) {
      console.log('[enc-migration-pill] Pill hidden: guest mode');
      return;
    }
    if (error) {
      console.log('[enc-migration-pill] Pill visible: showing index error', { 
        user: user.email, 
        error: error.error,
        collection: error.collection,
        running,
        allDone
      });
      return;
    }
    if (allDone) {
      console.log('[enc-migration-pill] Pill hidden: migration complete');
      return;
    }
    console.log('[enc-migration-pill] Pill visible: migration in progress', { 
      user: user.email, 
      running, 
      allDone,
      totalUpdated,
      totalProcessed 
    });
  }, [user, allDone, running, totalUpdated, totalProcessed, error]);

  // Don't show if user is guest, migration is complete, or if there's a fatal error (handled separately)
  if (!user) return null; // guest mode - not encrypting
  if (allDone) return null; // nothing to show

  const totalCollections = Object.keys(collections).length;
  const doneCollections = Object.values(collections).filter(c => c.done).length;

  // Show error state instead of regular progress if there's an error
  if (error) {
    return (
      <div 
        data-testid="encryption-migration-pill-error"
        style={{
          position: 'fixed',
          bottom: '0.75rem',
          right: '0.75rem',
          background: 'rgba(239, 68, 68, 0.9)',
          color: '#f3f4f6',
          borderRadius: '9999px',
          padding: '0.4rem 0.9rem',
          fontSize: '0.75rem',
          fontFamily: 'system-ui, sans-serif',
          letterSpacing: '0.02em',
          boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.55rem',
          zIndex: 2000,
          maxWidth: '400px',
          flexWrap: 'wrap'
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#dc2626',
            boxShadow: '0 0 4px #dc2626',
            transition: 'background 0.3s'
          }} />
          Index Error
        </span>
        <span style={{ opacity: 0.9, fontSize: '0.7rem' }}>
          {error.collection} requires Firestore index
        </span>
        <span style={{ opacity: 0.5 }}>|</span>
        <a 
          href={error.consoleUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          style={{
            color: '#f3f4f6',
            textDecoration: 'underline',
            fontSize: '0.7rem'
          }}
          onClick={(e) => {
            e.preventDefault();
            window.open(error.consoleUrl, '_blank');
          }}
        >
          Fix in Console
        </a>
      </div>
    );
  }

  return (
    <div 
      data-testid="encryption-migration-pill"
      style={{
        position: 'fixed',
        bottom: '0.75rem',
        right: '0.75rem',
        background: 'rgba(30,41,59,0.9)',
        color: '#e2e8f0',
        borderRadius: '9999px',
        padding: '0.4rem 0.9rem',
        fontSize: '0.75rem',
        fontFamily: 'system-ui, sans-serif',
        letterSpacing: '0.02em',
        boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.55rem',
        zIndex: 2000
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
        <span style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: running ? '#10b981' : '#64748b',
          boxShadow: running ? '0 0 4px #10b981' : 'none',
          transition: 'background 0.3s'
        }} />
        Encrypting data…
      </span>
      <span style={{ opacity: 0.8 }}>docs updated: {totalUpdated}</span>
      <span style={{ opacity: 0.5 }}>|</span>
      <span style={{ opacity: 0.8 }}>processed: {totalProcessed}</span>
      <span style={{ opacity: 0.5 }}>|</span>
      <span style={{ opacity: 0.8 }}>collections: {doneCollections}/{totalCollections}</span>
    </div>
  );
};

export default EncryptionMigrationStatus;
