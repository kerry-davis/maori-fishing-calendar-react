import React, { useEffect, useState } from 'react';
import { useEncryptionMigrationStatus } from '@shared/hooks/useEncryptionMigrationStatus';
import { useAuth } from '@app/providers/AuthContext';
import { photoMigrationService, type MigrationProgress } from '@shared/services/photoMigrationService';

/**
 * Small unobtrusive status pill for encryption migration.
 * Appears only while there is work to do.
 * Automatically disappears when migration is complete.
 */
export const EncryptionMigrationStatus: React.FC = () => {
  const { user } = useAuth();
  const { running, allDone, collections, totalUpdated, totalProcessed, error } = useEncryptionMigrationStatus();
  const [photoMigrationProgress, setPhotoMigrationProgress] = useState<MigrationProgress | null>(null);
  const [showPhotoMigration, setShowPhotoMigration] = useState(false);

  // Monitor photo migration progress
  useEffect(() => {
    if (!user) return;

    const updatePhotoProgress = () => {
      const progress = photoMigrationService.getProgress();
      setPhotoMigrationProgress(progress);
      setShowPhotoMigration(progress.status !== 'completed' && progress.totalPhotos > 0);
    };

    // Initial load
    updatePhotoProgress();

    // Poll for updates every 2 seconds during migration
    const interval = setInterval(updatePhotoProgress, 2000);

    return () => clearInterval(interval);
  }, [user]);

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
    if (allDone && !showPhotoMigration) {
      console.log('[enc-migration-pill] Pill hidden: all migrations complete');
      return;
    }
    console.log('[enc-migration-pill] Pill visible: migration in progress', {
      user: user.email,
      running,
      allDone,
      totalUpdated,
      totalProcessed,
      showPhotoMigration,
      photoProgress: photoMigrationProgress
    });
  }, [user, allDone, running, totalUpdated, totalProcessed, error, showPhotoMigration, photoMigrationProgress]);

  // Don't show if user is guest, all migrations are complete, or if there's a fatal error (handled separately)
  if (!user) return null; // guest mode - not encrypting
  if (allDone && !showPhotoMigration) return null; // nothing to show

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

  // Determine what type of migration is running
  const hasDataMigration = running || !allDone;
  const hasPhotoMigration = showPhotoMigration && photoMigrationProgress && photoMigrationProgress.status !== 'completed';

  if (!hasDataMigration && !hasPhotoMigration) {
    return null; // Nothing to show
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
        zIndex: 2000,
        maxWidth: '500px',
        flexWrap: 'wrap'
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
        <span style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: (running || photoMigrationService.isMigrationRunning()) ? '#10b981' : '#64748b',
          boxShadow: (running || photoMigrationService.isMigrationRunning()) ? '0 0 4px #10b981' : 'none',
          transition: 'background 0.3s'
        }} />
        {hasPhotoMigration ? 'Encrypting photos…' : 'Encrypting data…'}
      </span>

      {/* Data migration status */}
      {hasDataMigration && (
        <>
          <span style={{ opacity: 0.8 }}>docs: {totalUpdated}</span>
          <span style={{ opacity: 0.5 }}>|</span>
          <span style={{ opacity: 0.8 }}>processed: {totalProcessed}</span>
          <span style={{ opacity: 0.5 }}>|</span>
          <span style={{ opacity: 0.8 }}>collections: {doneCollections}/{totalCollections}</span>
        </>
      )}

      {/* Photo migration status */}
      {hasPhotoMigration && photoMigrationProgress && (
        <>
          {hasDataMigration && <span style={{ opacity: 0.5 }}>|</span>}
          <span style={{ opacity: 0.8 }}>photos: {photoMigrationProgress.processedPhotos}/{photoMigrationProgress.totalPhotos}</span>
          {photoMigrationProgress.failedPhotos.length > 0 && (
            <>
              <span style={{ opacity: 0.5 }}>|</span>
              <span style={{ opacity: 0.8, color: '#ef4444' }}>failed: {photoMigrationProgress.failedPhotos.length}</span>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default EncryptionMigrationStatus;
