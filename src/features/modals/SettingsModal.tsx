import React, { useState, useRef, useCallback } from 'react';
import { Button, ProgressBar } from '@shared/components';
import { Modal, ModalHeader, ModalBody } from './Modal';
import { dataExportService, type ImportResult } from '@shared/services/dataExportService';
import { browserZipImportService, type ZipImportResult } from '@shared/services/browserZipImportService';
import ConfirmationDialog from '@shared/components/ConfirmationDialog';
import { useAuth } from '../../app/providers/AuthContext';
import { firebaseDataService } from '@shared/services/firebaseDataService';
import { databaseService } from '@shared/services/databaseService';
import type { ImportProgress } from '../../shared/types';
import { useLocationContext } from '@app/providers/LocationContext';
import { DEV_LOG, PROD_ERROR } from '../../shared/utils/loggingHelpers';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const { userLocation, tideCoverage, refreshTideCoverage } = useLocationContext();
  const [isExportingJSON, setIsExportingJSON] = useState(false);
  const [isExportingCSV, setIsExportingCSV] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [importStats, setImportStats] = useState<ImportResult | ZipImportResult | null>(null);
  const [deleteProgress, setDeleteProgress] = useState<ImportProgress | null>(null);
  const [checkingTideCoverage, setCheckingTideCoverage] = useState(false);

  // Trigger file chooser for import
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleExportJSON = async () => {
    setIsExportingJSON(true);
    setExportError(null);
    try {
      const blob = await dataExportService.exportDataAsZip();
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `fishing-calendar-data-${timestamp}.zip`;
      dataExportService.downloadBlob(blob, filename);
    } catch (error) {
      PROD_ERROR('Export error:', error);
      setExportError(error instanceof Error ? error.message : 'Failed to export data');
    } finally {
      setIsExportingJSON(false);
    }
  };
  // Close Settings: if import ran, refresh after modal closes
  const handleCloseSettings = useCallback(() => {
    const hadImport = !!importStats;
    onClose();
    if (hadImport) {
      setTimeout(() => window.location.reload(), 0);
    }
  }, [onClose, importStats]);

  const handleExportCSV = async () => {
    setIsExportingCSV(true);
    setExportError(null);
    try {
      const blob = await dataExportService.exportDataAsCSV();
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `fishing-calendar-csv-${timestamp}.zip`;
      dataExportService.downloadBlob(blob, filename);
    } catch (error) {
      PROD_ERROR('CSV export error:', error);
      setExportError(error instanceof Error ? error.message : 'Failed to export CSV data');
    } finally {
      setIsExportingCSV(false);
    }
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    // Show styled confirmation dialog
    setPendingImportFile(file);
    setShowImportConfirm(true);
  };

  const handleConfirmImport = async () => {
    if (!pendingImportFile) return;
    const file = pendingImportFile;
    setIsImporting(true);
    setImportProgress({ phase: 'starting', current: 0, total: 1, percent: 0, message: 'Preparing…' });
    setImportError(null);
    setImportSuccess(null);
    setImportStats(null);

    try {
      const isZip = file.name.toLowerCase().endsWith('.zip');
      let stats: ImportResult | ZipImportResult;
      if (isZip) {
        // Use browser-based zip importer for both legacy and normal zips
        const isAuthenticated = !!user;
        stats = await browserZipImportService.processZipFile(file, isAuthenticated, { strategy: 'wipe' }, (p) => setImportProgress(p));
      } else {
        // JSON imports handled by standard importer
        stats = await dataExportService.importData(file, (p) => setImportProgress(p));
      }
      setImportStats(stats);
      // Notify app layers to refresh views after import
      try {
        window.dispatchEvent(new CustomEvent('databaseDataReady', { detail: { source: 'Import', timestamp: Date.now() } }));
        window.dispatchEvent(new CustomEvent('userDataReady', { detail: { userId: user?.uid ?? null, isGuest: !user, source: 'Import', timestamp: Date.now() } }));
      } catch {}
      const seconds = Math.max(0, Math.round((stats.durationMs || 0) / 1000));
      setImportSuccess(`Successfully imported data from "${file.name}" in ${seconds}s.`);
      setShowImportConfirm(false);
      setPendingImportFile(null);
    } catch (error) {
      PROD_ERROR('Import error:', error);
      setImportError(error instanceof Error ? error.message : 'Failed to import data');
    } finally {
      setIsImporting(false);
      setImportProgress(null);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleCancelImport = () => {
    setShowImportConfirm(false);
    setPendingImportFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleTideCoverageCheck = useCallback(async () => {
    if (!userLocation) {
      return;
    }

    setCheckingTideCoverage(true);
    try {
      await refreshTideCoverage();
    } finally {
      setCheckingTideCoverage(false);
    }
  }, [refreshTideCoverage, userLocation]);

  const clearErrors = () => {
    setExportError(null);
    setImportError(null);
    setImportSuccess(null);
  };

  const handleDeleteAllData = async () => {
    setIsDeletingAll(true);
    clearErrors();
    setDeleteProgress({
      phase: 'preparing',
      current: 0,
      total: 1,
      percent: 0,
      message: 'Preparing data wipe…'
    });

    try {
      if (user) {
        await firebaseDataService.clearFirestoreUserData((progress) => {
          setDeleteProgress(progress);
        });
      } else {
        setDeleteProgress({
          phase: 'preparing',
          current: 0,
          total: 2,
          percent: 0,
          message: 'Preparing local data wipe…'
        });
        await databaseService.clearAllData();
        setDeleteProgress({
          phase: 'complete',
          current: 2,
          total: 2,
          percent: 100,
          message: 'Local data cleared'
        });
      }

      localStorage.removeItem('tacklebox');
      localStorage.removeItem('gearTypes');

      setShowDeleteAllConfirm(false);
      setImportSuccess('All data has been deleted. The page will reload.');
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      PROD_ERROR('Failed to delete all data:', e);
      setImportError(e instanceof Error ? e.message : 'Failed to delete all data');
    } finally {
      setIsDeletingAll(false);
      setDeleteProgress(null);
    }
  };

  // Explicit debug to confirm rendering state if users report it not opening
  if (isOpen) {
    try { DEV_LOG('[SettingsModal] rendering open'); } catch (e) { /* ignore errors */ }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleCloseSettings}>
      <ModalHeader title="Settings" onClose={handleCloseSettings} />
      <ModalBody>
        <div className="space-y-6">

        {/* Location & Tide Coverage Section */}
        <div className="pb-6" style={{ borderBottom: '1px solid var(--border-color)' }}>
          <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--primary-text)' }}>
            Location & Tide Coverage
          </h3>
          <p className="text-sm mb-3" style={{ color: 'var(--secondary-text)' }}>
            Confirm that your saved location can retrieve marine tide forecasts from Open-Meteo.
          </p>
          <div className="rounded-lg p-3" style={{ border: '1px solid var(--border-color)' }}>
            <p className="text-sm" style={{ color: 'var(--primary-text)' }}>
              Current location:{' '}
              <span className="font-medium">
                {userLocation ? userLocation.name : 'Not set'}
              </span>
            </p>
            <p className="text-xs mt-2" style={{ color: 'var(--secondary-text)' }}>
              {userLocation
                ? tideCoverage
                  ? tideCoverage.available
                    ? `Tide data available (checked ${new Date(tideCoverage.checkedAt).toLocaleString()})`
                    : tideCoverage.message || 'Tide data is not available for this location.'
                  : 'Checking coverage…'
                : 'Set a location to verify tide coverage.'}
            </p>
          </div>
          <div className="flex gap-3 mt-4">
            <Button
              onClick={handleTideCoverageCheck}
              disabled={!userLocation || checkingTideCoverage}
              loading={checkingTideCoverage}
            >
              {checkingTideCoverage ? 'Checking…' : 'Check Tide Coverage'}
            </Button>
          </div>
        </div>

        {/* Data Export Section (auth only) */}
        {user && (
        <div className="pb-6" style={{ borderBottom: '1px solid var(--border-color)' }}>
          <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--primary-text)' }}>
            Export Data
          </h3>
          <p className="text-sm mb-4" style={{ color: 'var(--secondary-text)' }}>
            Export your fishing logs, weather data, and tackle box information.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={handleExportJSON} disabled={isExportingJSON || isExportingCSV} loading={isExportingJSON}>
              {isExportingJSON ? 'Exporting JSON…' : (
                <>
                  <i className="fas fa-download mr-2"></i>
                  Export as ZIP (JSON)
                </>
              )}
            </Button>
            
            <Button onClick={handleExportCSV} disabled={isExportingJSON || isExportingCSV} loading={isExportingCSV}>
              {isExportingCSV ? 'Exporting CSV…' : (
                <>
                  <i className="fas fa-file-csv mr-2"></i>
                  Export as CSV
                </>
              )}
            </Button>
          </div>
        </div>
        )}

        {/* Data Import Section - auth only */}
        {user && (
        <div className="pb-6">
          <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--primary-text)' }}>
            Import Data
          </h3>
          <p className="text-sm mb-4" style={{ color: 'var(--secondary-text)' }}>
            Import data from a ZIP or JSON file. We’ll detect legacy vs normal format automatically. This will replace all existing data.
          </p>

          <div className="flex flex-col gap-3">
            <Button onClick={handleImportClick} disabled={isImporting} loading={isImporting}>
              {isImporting ? 'Importing…' : (
                <>
                  <i className="fas fa-upload mr-2"></i>
                  Import Data File
                </>
              )}
            </Button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".zip,.json"
              onChange={handleFileImport}
              className="hidden"
            />

            <p className="text-xs" style={{ color: 'var(--secondary-text)' }}>
              Supported formats: ZIP files (exported from this app) or JSON files
            </p>
          </div>
        </div>
        )}

        {/* Legacy section removed: single import handles both */}

        {/* Error/Success Messages + Import stats */}
        {(exportError || importError || importSuccess || importStats) && (
          <div className="space-y-3">
            {exportError && (
              <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--error-background)', border: '1px solid var(--error-border)' }}>
                <div className="flex items-start">
                  <i className="fas fa-exclamation-triangle mr-2 mt-0.5" style={{ color: 'var(--error-text)' }}></i>
                  <div className="flex-1">
                    <p className="text-sm font-medium" style={{ color: 'var(--error-text)' }}>
                      Export Error
                    </p>
                    <p className="text-sm mt-1" style={{ color: 'var(--error-text)' }}>
                      {exportError}
                    </p>
                  </div>
                  <button
                    onClick={clearErrors}
                    className="transition-colors"
                    style={{ color: 'var(--error-text)' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = 'var(--error-text)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = 'var(--error-text)';
                    }}
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>
              </div>
            )}

            {importError && (
              <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--error-background)', border: '1px solid var(--error-border)' }}>
                <div className="flex items-start">
                  <i className="fas fa-exclamation-triangle mr-2 mt-0.5" style={{ color: 'var(--error-text)' }}></i>
                  <div className="flex-1">
                    <p className="text-sm font-medium" style={{ color: 'var(--error-text)' }}>
                      Import Error
                    </p>
                    <p className="text-sm mt-1" style={{ color: 'var(--error-text)' }}>
                      {importError}
                    </p>
                  </div>
                  <button
                    onClick={clearErrors}
                    className="transition-colors"
                    style={{ color: 'var(--error-text)' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = 'var(--error-text)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = 'var(--error-text)';
                    }}
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>
              </div>
            )}

            {importSuccess && (
              <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--success-background)', border: '1px solid var(--success-border)' }}>
                <div className="flex items-start">
                  <i className="fas fa-check-circle mr-2 mt-0.5" style={{ color: 'var(--success-text)' }}></i>
                  <div className="flex-1">
                    <p className="text-sm font-medium" style={{ color: 'var(--success-text)' }}>
                      Import Successful
                    </p>
                    <p className="text-sm mt-1" style={{ color: 'var(--success-text)' }}>
                      {importSuccess}
                    </p>
                    {importStats && (
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="flex justify-between"><span>Trips</span><span className="font-medium">{importStats.tripsImported}</span></div>
                        <div className="flex justify-between"><span>Weather</span><span className="font-medium">{importStats.weatherLogsImported}</span></div>
                        <div className="flex justify-between"><span>Fish</span><span className="font-medium">{importStats.fishCatchesImported}</span></div>
                        <div className="flex justify-between"><span>Photos</span><span className="font-medium">{importStats.photosImported}</span></div>
                        <div className="col-span-2 flex justify-between pt-2" style={{ borderTop: '1px solid var(--border-color)' }}>
                          <span>Duration</span><span className="font-medium">{Math.max(0, Math.round((importStats.durationMs || 0)/1000))}s</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

  {/* Danger Zone */}
  <div className="mt-6 pt-6">
          <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--primary-text)' }}>Danger Zone</h3>
          <p className="text-sm mb-3" style={{ color: 'var(--secondary-text)' }}>
            Permanently delete all your {user ? 'cloud and local' : 'local'} data. This cannot be undone.
          </p>
          <Button
            variant="danger"
            onClick={() => setShowDeleteAllConfirm(true)}
            disabled={isDeletingAll}
          >
            {isDeletingAll ? 'Deleting…' : (<><i className="fas fa-trash-alt mr-2"></i>Delete All Data</>)}
          </Button>
        </div>
        </div>
      </ModalBody>

      <ConfirmationDialog
        isOpen={showDeleteAllConfirm}
        title="Delete All Data"
        message={`This will permanently delete all ${user ? 'cloud and local' : 'local'} trips, weather logs, and fish catches${user ? ' for your account' : ''}. This action cannot be undone.`}
        confirmText={isDeletingAll ? 'Deleting…' : 'Delete Everything'}
        cancelText="Cancel"
        onConfirm={handleDeleteAllData}
        onCancel={() => {
          if (!isDeletingAll) {
            setShowDeleteAllConfirm(false);
            setDeleteProgress(null);
          }
        }}
        variant="danger"
        overlayStyle="blur"
        confirmDisabled={isDeletingAll}
        cancelDisabled={isDeletingAll}
      >
        {(isDeletingAll || deleteProgress) && (
          <div className="mt-3">
            <ProgressBar progress={deleteProgress} />
          </div>
        )}
      </ConfirmationDialog>

      <ConfirmationDialog
        isOpen={showImportConfirm}
        title="Import Data"
        message={pendingImportFile ? `Are you sure you want to import data from "${pendingImportFile.name}"? This will overwrite ALL existing log data.` : 'Are you sure you want to import data? This will overwrite ALL existing log data.'}
        confirmText={isImporting ? 'Importing…' : 'Import'}
        cancelText="Cancel"
        onConfirm={handleConfirmImport}
        onCancel={handleCancelImport}
        variant="danger"
        overlayStyle="blur"
        confirmDisabled={isImporting}
        cancelDisabled={isImporting}
      >
        {isImporting && (
          <div className="mt-3">
            <ProgressBar progress={importProgress} />
          </div>
        )}
      </ConfirmationDialog>
    </Modal>
  );
};