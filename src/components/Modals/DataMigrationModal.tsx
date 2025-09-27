import React, { useState, useEffect } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter } from './Modal';
import { useDatabaseService } from '../../contexts/DatabaseContext';
import { Button } from '../UI';
import { useAuth } from '../../contexts/AuthContext';
import { browserZipImportService } from '../../services/browserZipImportService';
import type { ZipImportResult } from '../../services/browserZipImportService';

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
  const [showZipImport, setShowZipImport] = useState(false);
  const [isZipImporting, setIsZipImporting] = useState(false);
  const [zipImportResults, setZipImportResults] = useState<ZipImportResult | null>(null);

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

  const handleZipFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setError('Please select a valid zip file');
      return;
    }

    setIsZipImporting(true);
    setError(null);

    try {
      // Check if user is authenticated
      const isAuthenticated = user !== null;
      console.log('Zip import - User authenticated:', isAuthenticated);

      const results = await browserZipImportService.processZipFile(file, isAuthenticated);
      setZipImportResults(results);

      if (results.success) {
        if (user) {
          // Mark migration as complete for authenticated users
          localStorage.setItem(`migrationComplete_${user.uid}`, 'true');
          onMigrationComplete?.();
        } else {
          // For guest users, just show success message
          console.log('Guest zip import completed successfully');
        }
      }
    } catch (err) {
      console.error('Zip import failed:', err);
      setError(err instanceof Error ? err.message : 'Zip import failed');
    } finally {
      setIsZipImporting(false);
    }
  };


  // Don't show modal if already migrated (but allow showing for zip import even without local data)
  if (!isOpen || (hasLocalData && hasCompletedMigration)) {
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
        ) : zipImportResults ? (
          // Zip import completed
          <div className="space-y-4">
            <div className="text-center">
              <i className={`fas ${zipImportResults.success ? 'fa-check-circle text-green-500' : 'fa-exclamation-triangle text-red-500'} text-4xl mb-4`}></i>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
                {zipImportResults.success ? 'Zip Import Complete!' : 'Zip Import Failed'}
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {zipImportResults.success
                  ? 'Your legacy data has been successfully imported from the zip file.'
                  : 'There were errors importing your zip file.'
                }
              </p>
            </div>

            {zipImportResults.success && (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                <h4 className="font-medium text-gray-800 dark:text-gray-100 mb-3">Import Summary:</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Trips:</span>
                    <span className="font-medium">{zipImportResults.tripsImported}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Weather Logs:</span>
                    <span className="font-medium">{zipImportResults.weatherLogsImported}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Fish Catches:</span>
                    <span className="font-medium">{zipImportResults.fishCatchesImported}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Photos:</span>
                    <span className="font-medium">{zipImportResults.photosImported}</span>
                  </div>
                </div>
              </div>
            )}

            {zipImportResults.errors.length > 0 && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <h4 className="font-medium text-red-800 dark:text-red-200 mb-2">Errors:</h4>
                <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
                  {zipImportResults.errors.map((error, index) => (
                    <li key={index}>• {error}</li>
                  ))}
                </ul>
              </div>
            )}

            {zipImportResults.warnings.length > 0 && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">Warnings:</h4>
                <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                  {zipImportResults.warnings.map((warning, index) => (
                    <li key={index}>• {warning}</li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-sm text-gray-500 dark:text-gray-400">
              {zipImportResults.success
                ? user
                  ? 'Your data is now saved to your cloud account and synced across all devices.'
                  : 'Your data is now saved locally. When you log in to your account, it will be uploaded to the cloud automatically.'
                : 'Please check the errors above and try again, or contact support if the problem persists.'
              }
            </p>
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
        ) : showZipImport || (!hasLocalData && !migrationResults) ? (
          // Zip import prompt (show when no local data or explicitly requested)
          <div className="space-y-4">
            <div className="text-center">
              <i className="fas fa-file-archive text-green-500 text-4xl mb-4"></i>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
                Import Legacy Data from Zip File
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Upload a zip file exported from your legacy Māori Fishing Calendar app.
              </p>
            </div>

            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <h4 className="font-medium text-green-800 dark:text-green-200 mb-2">How to get your zip file:</h4>
              <ol className="text-sm text-green-700 dark:text-green-300 space-y-1">
                <li>1. Open your legacy Māori Fishing Calendar app</li>
                <li>2. Click "Export Data" to download a zip file</li>
                <li>3. Select that zip file below to import</li>
              </ol>
            </div>

            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center">
              <input
                type="file"
                accept=".zip"
                onChange={handleZipFileUpload}
                disabled={isZipImporting}
                className="hidden"
                id="zip-file-input"
              />
              <label
                htmlFor="zip-file-input"
                className="cursor-pointer flex flex-col items-center"
              >
                <i className="fas fa-cloud-upload-alt text-2xl text-gray-400 mb-2"></i>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {isZipImporting ? 'Processing zip file...' : 'Click to select zip file'}
                </span>
              </label>
            </div>

            <div className="text-sm text-gray-500 dark:text-gray-400">
              <p className="mb-2">
                <strong>Perfect for mobile!</strong> No Node.js required - works directly in your browser.
              </p>
              <p className="mb-2">
                {user ? (
                  <>Data will be saved to your cloud account and synced across all devices.</>
                ) : (
                  <>Data will be saved locally. When you log in, it will be uploaded to the cloud.</>
                )}
              </p>
              <p>
                Supports both data.json and CSV formats from your legacy app exports.
              </p>
            </div>
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

            {/* Alternative zip import option */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                <strong>Alternative:</strong> Import from a zip file exported from your legacy app
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowZipImport(true)}
                className="w-full"
              >
                <i className="fas fa-file-archive mr-2"></i>
                Import from Zip File Instead
              </Button>
            </div>
          </div>
        )}
      </ModalBody>

      <ModalFooter>
        <div className="flex justify-end space-x-3">
          {zipImportResults ? (
            <Button variant="primary" onClick={onClose}>
              Get Started
            </Button>
          ) : showZipImport || (!hasLocalData && !migrationResults) ? (
            <>
              <Button variant="secondary" onClick={onClose} disabled={isZipImporting}>
                Cancel
              </Button>
              <Button onClick={() => document.getElementById('zip-file-input')?.click()} loading={isZipImporting} disabled={isZipImporting}>
                {isZipImporting ? 'Importing...' : 'Select Zip File'}
              </Button>
            </>
          ) : (
            <>
              {!migrationResults && (
                <Button variant="secondary" onClick={handleSkipMigration} disabled={isMigrating}>
                  Skip for Now
                </Button>
              )}
              <Button onClick={handleMigrateData} loading={isMigrating} disabled={isMigrating || isChecking}>
                {isMigrating ? 'Migrating...' : 'Migrate Data'}
              </Button>
            </>
          )}
        </div>
      </ModalFooter>
    </Modal>
  );
};

export default DataMigrationModal;