import React, { useState, useEffect } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter } from './Modal';
import { useDatabaseService } from '../../contexts/DatabaseContext';
import { Button } from '../UI';
import { useAuth } from '../../contexts/AuthContext';

export interface DataMigrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMigrationComplete?: () => void;
}

/**
 * Data Migration Modal - Prompts users to migrate existing local data to Firebase
 */
export const DataMigrationModal: React.FC<DataMigrationModalProps> = ({
  isOpen,
  onClose,
  onMigrationComplete,
}) => {
  const { user } = useAuth();
  const db = useDatabaseService();
  const [hasLocalData, setHasLocalData] = useState(false);
  const [hasCompletedMigration, setHasCompletedMigration] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationResults, setMigrationResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && user) {
      checkMigrationStatus();
    }
  }, [isOpen, user]);

  const checkMigrationStatus = async () => {
    if (!user) return;

    setIsChecking(true);
    setError(null);

    try {
      const [hasData, completed] = await Promise.all([
        db.hasLocalData(),
        db.hasCompletedMigration()
      ]);

      setHasLocalData(hasData);
      setHasCompletedMigration(completed);
    } catch (err) {
      console.error('Error checking migration status:', err);
      setError('Failed to check migration status');
    } finally {
      setIsChecking(false);
    }
  };

  const handleMigrateData = async () => {
    if (!user) return;

    setIsMigrating(true);
    setError(null);

    try {
      const results = await db.migrateLocalData();
      setMigrationResults(results);

      // Notify parent component
      onMigrationComplete?.();

      console.log('Migration completed successfully:', results);
    } catch (err) {
      console.error('Migration failed:', err);
      setError(err instanceof Error ? err.message : 'Migration failed');
    } finally {
      setIsMigrating(false);
    }
  };

  const handleSkipMigration = () => {
    // Mark as completed even if skipped
    if (user) {
      localStorage.setItem(`migrationComplete_${user.uid}`, 'true');
    }
    onClose();
  };

  // Don't show modal if no local data or already migrated
  if (!isOpen || !hasLocalData || hasCompletedMigration) {
    return null;
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="md">
      <ModalHeader
        title="Welcome to Cloud Sync!"
        subtitle="Migrate your existing data to the cloud"
        onClose={onClose}
      />

      <ModalBody className="space-y-4">
        {error && (
          <div className="p-3 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg">
            <div className="flex items-center">
              <i className="fas fa-exclamation-triangle text-red-500 mr-2"></i>
              <span className="text-red-700 dark:text-red-300 text-sm">{error}</span>
            </div>
          </div>
        )}

        {isChecking ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className="ml-3 text-gray-600 dark:text-gray-400">Checking your data...</span>
          </div>
        ) : migrationResults ? (
          // Migration completed
          <div className="space-y-4">
            <div className="text-center">
              <i className="fas fa-check-circle text-green-500 text-4xl mb-4"></i>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
                Migration Complete!
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Your data has been successfully migrated to the cloud.
              </p>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h4 className="font-medium text-gray-800 dark:text-gray-100 mb-3">Migration Summary:</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Trips:</span>
                  <span className="font-medium">{migrationResults.tripsMigrated}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Weather Logs:</span>
                  <span className="font-medium">{migrationResults.weatherLogsMigrated}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Fish Catches:</span>
                  <span className="font-medium">{migrationResults.fishCatchesMigrated}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Tackle Items:</span>
                  <span className="font-medium">{migrationResults.tackleItemsMigrated}</span>
                </div>
              </div>
            </div>

            <p className="text-sm text-gray-500 dark:text-gray-400">
              Your data is now synced across all your devices. Any future changes will automatically sync to the cloud.
            </p>
          </div>
        ) : (
          // Migration prompt
          <div className="space-y-4">
            <div className="text-center">
              <i className="fas fa-cloud-upload-alt text-blue-500 text-4xl mb-4"></i>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
                Migrate Your Data
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                We found existing fishing data on your device. Would you like to migrate it to the cloud for cross-device syncing?
              </p>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">What happens during migration:</h4>
              <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                <li>• Your trips, weather logs, and fish catches will be uploaded to the cloud</li>
                <li>• Your tackle box items will be synced across devices</li>
                <li>• All data remains secure and private to your account</li>
                <li>• Future changes will automatically sync</li>
              </ul>
            </div>

            <div className="text-sm text-gray-500 dark:text-gray-400">
              <p className="mb-2">
                <strong>Note:</strong> This is a one-time migration. Your local data will remain intact as a backup.
              </p>
              <p>
                You can skip this now and migrate later from Settings if needed.
              </p>
            </div>
          </div>
        )}
      </ModalBody>

      <ModalFooter>
        <div className="flex justify-end space-x-3">
          {!migrationResults && (
              <Button variant="secondary" onClick={handleSkipMigration} disabled={isMigrating}>
                Skip for Now
              </Button>
          )}

          {migrationResults ? (
              <Button variant="primary" onClick={onClose}>Get Started</Button>
          ) : (
              <Button onClick={handleMigrateData} loading={isMigrating} disabled={isMigrating || isChecking}>
                {isMigrating ? 'Migrating...' : 'Migrate Data'}
              </Button>
          )}
        </div>
      </ModalFooter>
    </Modal>
  );
};

export default DataMigrationModal;