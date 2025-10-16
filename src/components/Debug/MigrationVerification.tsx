import React from 'react';
import { useEncryptionMigrationStatus } from '../../hooks/useEncryptionMigrationStatus';
import { useAuth } from '../../contexts/AuthContext';
import { DEV_LOG } from '../../utils/loggingHelpers';

/**
 * Development-only component for debugging and verifying migration status
 * This helps with the manual verification process outlined in FIRESTORE_INDEX_VERIFICATION.md
 */
export const MigrationVerification: React.FC = () => {
  const { user, encryptionReady } = useAuth();
  const migrationStatus = useEncryptionMigrationStatus();

  // Only show in development
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  const handleConsoleStatus = () => {
    DEV_LOG('=== Migration Verification Status ===');
    DEV_LOG('User:', user?.email || 'Not logged in');
    DEV_LOG('Encryption Ready:', encryptionReady);
    DEV_LOG('Migration Status:', migrationStatus);
    DEV_LOG('All Done:', migrationStatus.allDone);
    DEV_LOG('Running:', migrationStatus.running);
    DEV_LOG('Error:', migrationStatus.error);
    DEV_LOG('Collections:', migrationStatus.collections);
    DEV_LOG('Total Processed:', migrationStatus.totalProcessed);
    DEV_LOG('Total Updated:', migrationStatus.totalUpdated);
    DEV_LOG('=====================================');
  };

  const handleTriggerCompletion = () => {
    DEV_LOG('>>> Manually triggering migration completion event for testing');
    window.dispatchEvent(new CustomEvent('encryptionMigrationCompleted', {
      detail: {
        userId: user?.uid,
        status: migrationStatus
      }
    }));
  };

  const handleTriggerError = () => {
    DEV_LOG('>>> Manually triggering index error for testing');
    window.dispatchEvent(new CustomEvent('encryptionIndexError', {
      detail: {
        collection: 'trips',
        error: 'Test index error for verification',
        userId: user?.uid,
        consoleUrl: 'https://console.firebase.google.com/'
      }
    }));
  };

  const handleReset = () => {
    DEV_LOG('>>> Resetting migration status');
    migrationStatus.forceRestart();
  };

  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      left: '10px',
      background: 'rgba(0, 0, 0, 0.8)',
      color: 'white',
      padding: '1rem',
      borderRadius: '8px',
      fontSize: '12px',
      fontFamily: 'monospace',
      zIndex: 9999,
      maxWidth: '400px',
      border: '1px solid #444'
    }}>
      <div style={{ marginBottom: '1rem', fontWeight: 'bold', color: '#4ade80' }}>
        Migration Verification Tool (Dev)
      </div>
      
      <div style={{ marginBottom: '1rem' }}>
        Status: {migrationStatus.allDone ? 
          <span style={{ color: '#4ade80' }}>✅ Complete</span> : 
          migrationStatus.running ? 
          <span style={{ color: '#3b82f6' }}>🔄 Running</span> :
          migrationStatus.error ?
          <span style={{ color: '#ef4444' }}>❌ Error</span> :
          <span style={{ color: '#fbbf24' }}>⏸️ Ready</span>
        }
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <div>User: {user?.email || 'Not logged in'}</div>
        <div>Encryption Ready: {encryptionReady ? 'Yes' : 'No'}</div>
        <div>Collections Done: {Object.values(migrationStatus.collections).filter(c => c.done).length}/{Object.keys(migrationStatus.collections).length}</div>
        <div>Progress: {migrationStatus.totalProcessed} processed, {migrationStatus.totalUpdated} updated</div>
      </div>

      {migrationStatus.error && (
        <div style={{ 
          marginBottom: '1rem', 
          padding: '0.5rem', 
          background: 'rgba(239, 68, 68, 0.2)', 
          borderRadius: '4px',
          border: '1px solid #ef4444'
        }}>
          <div style={{ color: '#fca5a5', fontWeight: 'bold' }}>Index Error:</div>
          <div style={{ fontSize: '11px', marginTop: '0.25rem' }}>
            Collection: {migrationStatus.error.collection}
          </div>
          <div style={{ fontSize: '11px' }}>
            <a 
              href={migrationStatus.error.consoleUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ color: '#93c5fd', textDecoration: 'underline' }}
            >
              Open Firebase Console
            </a>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <button 
          onClick={handleConsoleStatus}
          style={{
            background: '#374151',
            color: 'white',
            border: '1px solid #4b5563',
            padding: '0.5rem',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '11px'
          }}
        >
          📊 Log Status to Console
        </button>

        <button 
          onClick={handleTriggerCompletion}
          style={{
            background: '#059669',
            color: 'white',
            border: '1px solid #047857',
            padding: '0.5rem',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '11px'
          }}
          disabled={migrationStatus.allDone}
        >
          ✅ Trigger Completion Test
        </button>

        <button 
          onClick={handleTriggerError}
          style={{
            background: '#dc2626',
            color: 'white',
            border: '1px solid #b91c1c',
            padding: '0.5rem',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '11px'
          }}
        >
          ❌ Trigger Index Error Test
        </button>

        <button 
          onClick={handleReset}
          style={{
            background: '#7c3aed',
            color: 'white',
            border: '1px solid #6d28d9',
            padding: '0.5rem',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '11px'
          }}
        >
          🔄 Reset Migration
        </button>
      </div>
    </div>
  );
};

export default MigrationVerification;
