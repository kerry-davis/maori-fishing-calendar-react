import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter } from './Modal';
import ConfirmationDialog from '@shared/components/ConfirmationDialog';
import { useDatabaseService } from '@app/providers/DatabaseContext';
import { Button, ProgressBar } from '@shared/components';
import { useAuth } from '../../app/providers/AuthContext';
import { browserZipImportService } from '@shared/services/browserZipImportService';
import type { ZipImportResult } from '@shared/services/browserZipImportService';
import { DEV_LOG, PROD_ERROR } from '../../shared/utils/loggingHelpers';

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
  const [zipProgress, setZipProgress] = useState<import('@shared/types').ImportProgress | null>(null);
  const [showImportConfirmation, setShowImportConfirmation] = useState(false);
  const [confirmAcknowledged, setConfirmAcknowledged] = useState(false);
  const [importStrategy, setImportStrategy] = useState<'wipe' | 'merge'>('wipe');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const initializedRef = useRef(false);

  const checkMigrationStatus = useCallback(async () => {
    if (!user) return;

    DEV_LOG('DataMigrationModal: checkMigrationStatus called for user:', user.uid);
    setIsChecking(true);
    setError(null);

    try {
      const [hasData, completed] = await Promise.all([
        db.hasLocalData(),
        db.hasCompletedMigration()
      ]);

      DEV_LOG('DataMigrationModal: Migration status - hasData:', hasData, 'completed:', completed);
      setHasLocalData(hasData);
      setHasCompletedMigration(completed);
    } catch (err) {
      PROD_ERROR('DataMigrationModal: Error checking migration status:', err);
      setError('Failed to check migration status');
    } finally {
      setIsChecking(false);
    }
  }, [user, db]);

  useEffect(() => {
    DEV_LOG('DataMigrationModal: isOpen changed to:', isOpen, 'user:', user);

    if (isOpen && !initializedRef.current) {
      // Only initialize once when modal opens
      initializedRef.current = true;

      // Check if this modal was opened for zip import
      const isForZipImport = sessionStorage.getItem('dataMigrationForZipImport') === 'true';
      if (isForZipImport) {
        DEV_LOG('DataMigrationModal: Opened for zip import');
        setShowZipImport(true);
        sessionStorage.removeItem('dataMigrationForZipImport'); // Clear the flag
      }

      if (user) {
        DEV_LOG('DataMigrationModal: Starting migration status check for authenticated user');
        checkMigrationStatus();
      } else {
        // Guest mode - no need to check migration status
        DEV_LOG('DataMigrationModal: Guest mode - skipping migration status check');
        setIsChecking(false);
        setHasLocalData(false);
        setHasCompletedMigration(false);
      }
    } else if (!isOpen && initializedRef.current) {
      // Reset initialization when modal closes
      initializedRef.current = false;
    }
  }, [isOpen, user, checkMigrationStatus]);

  const handleMigrateData = async () => {
    if (!user) return;

    setIsMigrating(true);
    setError(null);

    try {
      const results = await db.migrateLocalData();
      setMigrationResults(results);

      // Notify parent component
      onMigrationComplete?.();

      DEV_LOG('Migration completed successfully:', results);
    } catch (err) {
      PROD_ERROR('Migration failed:', err);
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

    // Store the selected file
    setSelectedFile(file);

    // Show confirmation dialog before proceeding
    setConfirmAcknowledged(false);
    setShowImportConfirmation(true);
  };

  const handleConfirmImport = async () => {
    if (!selectedFile) return;

    setIsZipImporting(true);
    setError(null);
    // Keep the confirmation dialog open while importing to show progress consistently
    setZipProgress({ phase: 'starting', current: 0, total: 1, percent: 0, message: 'Preparing…' });

    try {
      // Check if user is authenticated
      const isAuthenticated = user !== null;
      DEV_LOG('Zip import - User authenticated:', isAuthenticated);
      DEV_LOG('Processing file:', selectedFile.name);

  const results = await browserZipImportService.processZipFile(selectedFile, isAuthenticated, { strategy: importStrategy }, (p) => setZipProgress(p));
      setZipImportResults(results);

      if (results.success && user) {
        // Mark migration as complete for authenticated users
        localStorage.setItem(`migrationComplete_${user.uid}`, 'true');
      }
    } catch (err) {
      PROD_ERROR('Zip import failed:', err);
      setError(err instanceof Error ? err.message : 'Zip import failed');
    } finally {
      setIsZipImporting(false);
      setZipProgress(null);
      // Close the confirmation dialog after import completes
      setShowImportConfirmation(false);
      // Clear the selected file after processing
      setSelectedFile(null);
    }
  };

  const handleCancelImport = () => {
    setShowImportConfirmation(false);
    setConfirmAcknowledged(false);
    // Clear the selected file from state and DOM
    setSelectedFile(null);
    const fileInput = document.getElementById('zip-file-input') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
    // No immediate refresh; will refresh when modal closes
  };


  // Don't show modal if not supposed to be open
  // Allow showing for zip import even if user has completed migration
  if (!isOpen) {
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

        {showImportConfirmation ? (
          // Import confirmation dialog
          <div className="space-y-4">
            <div className="text-center">
              <i className="fas fa-exclamation-triangle text-yellow-500 text-4xl mb-4"></i>
              <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--primary-text)' }}>
                Confirm Data Import
              </h3>
              <p className="mb-4" style={{ color: 'var(--secondary-text)' }}>
                This will delete all your current fishing data and replace it with the data from the zip file.
              </p>
            </div>

            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <h4 className="font-medium mb-2 modal-primary-text">⚠️ Warning: Data Loss</h4>
              <ul className="text-sm space-y-1 modal-secondary-text">
                <li>• All current trips will be permanently deleted</li>
                <li>• All weather logs will be permanently deleted</li>
                <li>• All fish catches will be permanently deleted</li>
                <li>• Tackle box items will be permanently deleted</li>
                <li>• This action cannot be undone</li>
              </ul>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h4 className="font-medium mb-2 modal-primary-text">What will be imported:</h4>
              <ul className="text-sm space-y-1 modal-secondary-text">
                <li>• All trips from the zip file</li>
                <li>• All weather logs from the zip file</li>
                <li>• All fish catches from the zip file</li>
                <li>• All tackle box items from the zip file</li>
                <li>• Photos will be compressed and attached to fish catches</li>
              </ul>
            </div>

            <p className="text-sm" style={{ color: 'var(--secondary-text)' }}>
              Make sure this is the correct zip file from your legacy Māori Fishing Calendar app before proceeding.
            </p>

            {user && (
              <>
              <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--secondary-background)', border: '1px solid var(--border-color)' }}>
                <h5 className="text-sm font-medium mb-2" style={{ color: 'var(--primary-text)' }}>Import Mode</h5>
                <div className="space-y-2 text-sm">
                  <label className="flex items-start space-x-2">
                    <input
                      type="radio"
                      name="import-mode"
                      checked={importStrategy === 'wipe'}
                      onChange={() => setImportStrategy('wipe')}
                    />
                    <span className="modal-secondary-text">
                      <strong>Replace (Recommended)</strong> — Wipes your current cloud data and replaces it with the zip contents.
                    </span>
                  </label>
                  <label className="flex items-start space-x-2">
                    <input
                      type="radio"
                      name="import-mode"
                      checked={importStrategy === 'merge'}
                      onChange={() => setImportStrategy('merge')}
                    />
                    <span className="modal-secondary-text">
                      <strong>Merge</strong> — Keeps existing cloud data and adds items from the zip (may create duplicates).
                    </span>
                  </label>
                </div>
              </div>
              <div className="flex items-start space-x-2 p-3 rounded-md" style={{ backgroundColor: 'var(--secondary-background)', border: '1px solid var(--border-color)' }}>
                <input
                  id="confirm-wipe"
                  type="checkbox"
                  checked={confirmAcknowledged}
                  onChange={(e) => setConfirmAcknowledged(e.target.checked)}
                  className="mt-1"
                />
                <label htmlFor="confirm-wipe" className="text-sm" style={{ color: 'var(--secondary-text)' }}>
                  {importStrategy === 'wipe'
                    ? 'I understand this will permanently delete all existing trips, weather logs, and fish catches in my cloud account and replace them with the contents of this zip file.'
                    : 'I understand importing may add to my existing cloud data and could create duplicates.'}
                </label>
              </div>
              </>
            )}
          </div>
        ) : isChecking ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className="ml-3" style={{ color: 'var(--secondary-text)' }}>Checking your data...</span>
          </div>
        ) : zipImportResults ? (
          // Zip import completed
          <div className="space-y-4">
            <div className="text-center">
              <i className={`fas ${zipImportResults.success ? 'fa-check-circle text-green-500' : 'fa-exclamation-triangle text-red-500'} text-4xl mb-4`}></i>
              <h3 className="text-lg font-semibold mb-2 modal-primary-text">
                {zipImportResults.success ? 'Zip Import Complete!' : 'Zip Import Failed'}
              </h3>
              <p className="modal-secondary-text">
                {zipImportResults.success
                  ? 'Your legacy data has been successfully imported from the zip file.'
                  : 'There were errors importing your zip file.'
                }
              </p>
            </div>

            {zipImportResults.success && (
              <div
                className="rounded-lg p-4"
                style={{
                  backgroundColor: 'var(--secondary-background)',
                  border: '1px solid var(--border-color)'
                }}
              >
                <h4 className="font-medium mb-3" style={{ color: 'var(--primary-text)' }}>Import Summary:</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--secondary-text)' }}>Trips:</span>
                    <span className="font-medium">{zipImportResults.tripsImported}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--secondary-text)' }}>Weather Logs:</span>
                    <span className="font-medium">{zipImportResults.weatherLogsImported}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--secondary-text)' }}>Fish Catches:</span>
                    <span className="font-medium">{zipImportResults.fishCatchesImported}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--secondary-text)' }}>Photos:</span>
                    <span className="font-medium">{zipImportResults.photosImported}</span>
                  </div>
                </div>
                {typeof zipImportResults.durationMs === 'number' && zipImportResults.durationMs > 0 && (
                  <div className="mt-3 pt-3 text-xs flex justify-between" style={{ borderTop: '1px solid var(--border-color)' }}>
                    <span style={{ color: 'var(--secondary-text)' }}>Duration</span>
                    <span className="font-medium">{Math.max(0, Math.round((zipImportResults.durationMs || 0)/1000))}s</span>
                  </div>
                )}

                {(zipImportResults.duplicatesSkipped.trips > 0 ||
                  zipImportResults.duplicatesSkipped.weatherLogs > 0 ||
                  zipImportResults.duplicatesSkipped.fishCatches > 0) && (
                  <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border-color)' }}>
                    <h5 className="text-sm font-medium mb-2" style={{ color: 'var(--primary-text)' }}>Duplicates Skipped:</h5>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      {zipImportResults.duplicatesSkipped.trips > 0 && (
                        <div className="flex justify-between">
                          <span style={{ color: 'var(--secondary-text)' }}>Trips:</span>
                          <span className="font-medium text-orange-600">{zipImportResults.duplicatesSkipped.trips}</span>
                        </div>
                      )}
                      {zipImportResults.duplicatesSkipped.weatherLogs > 0 && (
                        <div className="flex justify-between">
                          <span style={{ color: 'var(--secondary-text)' }}>Weather:</span>
                          <span className="font-medium text-orange-600">{zipImportResults.duplicatesSkipped.weatherLogs}</span>
                        </div>
                      )}
                      {zipImportResults.duplicatesSkipped.fishCatches > 0 && (
                        <div className="flex justify-between">
                          <span style={{ color: 'var(--secondary-text)' }}>Fish:</span>
                          <span className="font-medium text-orange-600">{zipImportResults.duplicatesSkipped.fishCatches}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {(() => {
                  DEV_LOG('📊 Compression stats received:', zipImportResults.compressionStats);
                  return zipImportResults.compressionStats && zipImportResults.compressionStats.imagesProcessed > 0 ? (
                    <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border-color)' }}>
                      <h5 className="text-sm font-medium mb-2" style={{ color: 'var(--primary-text)' }}>Image Compression:</h5>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex justify-between">
                          <span style={{ color: 'var(--secondary-text)' }}>Images:</span>
                          <span className="font-medium text-blue-600">{zipImportResults.compressionStats.imagesProcessed}</span>
                        </div>
                        <div className="flex justify-between">
                          <span style={{ color: 'var(--secondary-text)' }}>Size Reduction:</span>
                          <span className="font-medium text-green-600">
                            {zipImportResults.compressionStats?.compressionRatio?.toFixed ?
                              zipImportResults.compressionStats.compressionRatio.toFixed(1) : '0.0'}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span style={{ color: 'var(--secondary-text)' }}>Original:</span>
                          <span className="font-medium">
                            {zipImportResults.compressionStats?.originalSize ?
                              (zipImportResults.compressionStats.originalSize / 1024 / 1024).toFixed(2) : '0.00'} MB
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span style={{ color: 'var(--secondary-text)' }}>Compressed:</span>
                          <span className="font-medium">
                            {zipImportResults.compressionStats?.compressedSize ?
                              (zipImportResults.compressionStats.compressedSize / 1024 / 1024).toFixed(2) : '0.00'} MB
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : null;
                })()}
              </div>
            )}

            {zipImportResults.errors.length > 0 && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <h4 className="font-medium mb-2 modal-primary-text">Errors:</h4>
                <ul className="text-sm space-y-1 modal-secondary-text">
                  {zipImportResults.errors.map((error, index) => (
                    <li key={index}>• {error}</li>
                  ))}
                </ul>
              </div>
            )}

            {zipImportResults.warnings.length > 0 && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <h4 className="font-medium mb-2 modal-primary-text">Warnings:</h4>
                <ul className="text-sm space-y-1 modal-secondary-text">
                  {zipImportResults.warnings.map((warning, index) => (
                    <li key={index}>• {warning}</li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-sm" style={{ color: 'var(--secondary-text)' }}>
              {zipImportResults.success
                ? user
                  ? 'Your data is now saved to your cloud account and synced across all devices. Close this window to refresh the calendar with your new data.'
                  : 'Your data is now saved locally. When you log in to your account, it will be uploaded to the cloud automatically. Close this window to refresh the calendar with your new data.'
                : 'Please check the errors above and try again, or contact support if the problem persists.'
              }
            </p>
          </div>
        ) : migrationResults ? (
          // Migration completed
          <div className="space-y-4">
            <div className="text-center">
              <i className="fas fa-check-circle text-green-500 text-4xl mb-4"></i>
              <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--primary-text)' }}>
                Migration Complete!
              </h3>
              <p style={{ color: 'var(--secondary-text)' }}>
                Your data has been successfully migrated to the cloud.
              </p>
            </div>

            <div
              className="rounded-lg p-4"
              style={{
                backgroundColor: 'var(--secondary-background)',
                border: '1px solid var(--border-color)'
              }}
            >
              <h4 className="font-medium mb-3" style={{ color: 'var(--primary-text)' }}>Migration Summary:</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex justify-between">
                  <span style={{ color: 'var(--secondary-text)' }}>Trips:</span>
                  <span className="font-medium">{migrationResults.tripsMigrated}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--secondary-text)' }}>Weather Logs:</span>
                  <span className="font-medium">{migrationResults.weatherLogsMigrated}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--secondary-text)' }}>Fish Catches:</span>
                  <span className="font-medium">{migrationResults.fishCatchesMigrated}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--secondary-text)' }}>Tackle Items:</span>
                  <span className="font-medium">{migrationResults.tackleItemsMigrated}</span>
                </div>
              </div>
            </div>

            <p className="text-sm" style={{ color: 'var(--secondary-text)' }}>
              Your data is now synced across all your devices. Any future changes will automatically sync to the cloud.
            </p>
          </div>
        ) : showZipImport || (!hasLocalData && !migrationResults) || (hasCompletedMigration && !migrationResults) ? (
          // Zip import prompt (show when no local data or explicitly requested)
          <div className="space-y-4">
            <div className="text-center">
              <i className="fas fa-file-archive text-green-500 text-4xl mb-4"></i>
              <h3 className="text-lg font-semibold mb-2 modal-primary-text">
                Import Legacy Data from Zip File
              </h3>
              <p className="modal-secondary-text">
                Upload a zip file exported from your legacy Māori Fishing Calendar app.
              </p>
            </div>

            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <h4 className="font-medium mb-2 modal-primary-text">How to get your zip file:</h4>
              <ol className="text-sm space-y-1 modal-secondary-text">
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
                <span className="text-sm modal-secondary-text">
                  {isZipImporting ? 'Processing zip file...' : 'Click to select zip file'}
                </span>
              </label>
            </div>

            {/* Progress is now displayed within the confirmation dialog to standardize UX */}

            <div className="text-sm modal-secondary-text">
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
              <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--primary-text)' }}>
                Migrate Your Data
              </h3>
              <p style={{ color: 'var(--secondary-text)' }}>
                We found existing fishing data on your device. Would you like to migrate it to the cloud for cross-device syncing?
              </p>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h4 className="font-medium mb-2 modal-primary-text">What happens during migration:</h4>
              <ul className="text-sm space-y-1 modal-secondary-text">
                <li>• Your trips, weather logs, and fish catches will be uploaded to the cloud</li>
                <li>• Your tackle box items will be synced across devices</li>
                <li>• All data remains secure and private to your account</li>
                <li>• Future changes will automatically sync</li>
              </ul>
            </div>

            <div className="text-sm" style={{ color: 'var(--secondary-text)' }}>
              <p className="mb-2">
                <strong>Note:</strong> This is a one-time migration. Your local data will remain intact as a backup.
              </p>
              <p>
                You can skip this now and migrate later from Settings if needed.
              </p>
            </div>

            {/* Alternative zip import option */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <p className="text-sm modal-secondary-text mb-3">
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
            <Button variant="primary" onClick={() => {
              onClose();
              onMigrationComplete?.();
            }}>
              Get Started
            </Button>
          ) : showZipImport || (!hasLocalData && !migrationResults) || (hasCompletedMigration && !migrationResults) ? (
            <>
              <Button variant="secondary" onClick={() => {
                onClose();
              }} disabled={isZipImporting}>
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

      {/* Inline confirmation dialog progress when importing */}
      <ConfirmationDialog
        isOpen={showImportConfirmation}
        title="Import Data"
        message={selectedFile ? `Are you sure you want to import data from "${selectedFile.name}"? This will overwrite ALL existing log data.` : 'Are you sure you want to import data? This will overwrite ALL existing log data.'}
        confirmText={isZipImporting ? 'Importing…' : 'Import'}
        cancelText="Cancel"
        onConfirm={handleConfirmImport}
        onCancel={handleCancelImport}
        variant="danger"
        overlayStyle="blur"
        confirmDisabled={isZipImporting}
        cancelDisabled={isZipImporting}
      >
        {isZipImporting && (
          <div className="mt-3">
            <ProgressBar progress={zipProgress} />
          </div>
        )}
      </ConfirmationDialog>
    </Modal>
  );
};

export default DataMigrationModal;