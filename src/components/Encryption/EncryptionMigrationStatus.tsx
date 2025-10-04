import React from 'react';
import { useEncryptionMigrationStatus } from '../../hooks/useEncryptionMigrationStatus';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Small unobtrusive status pill for encryption migration.
 * Appears only while there is work to do.
 */
export const EncryptionMigrationStatus: React.FC = () => {
  const { user } = useAuth();
  const { running, allDone, collections, totalUpdated, totalProcessed } = useEncryptionMigrationStatus();

  if (!user) return null; // guest mode - not encrypting
  if (allDone) return null; // nothing to show

  const totalCollections = Object.keys(collections).length;
  const doneCollections = Object.values(collections).filter(c => c.done).length;

  return (
    <div style={{
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
    }}>
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
