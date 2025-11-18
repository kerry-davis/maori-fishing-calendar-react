import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button, ProgressBar } from '@shared/components';
import { Modal, ModalHeader, ModalBody } from './Modal';
import { dataExportService, type ImportResult } from '@shared/services/dataExportService';
import { browserZipImportService, type ZipImportResult } from '@shared/services/browserZipImportService';
import ConfirmationDialog from '@shared/components/ConfirmationDialog';
import { useAuth } from '../../app/providers/AuthContext';
import { firebaseDataService } from '@shared/services/firebaseDataService';
import { databaseService } from '@shared/services/databaseService';
import type { ImportProgress, UserLocation } from '../../shared/types';
import { useLocationContext } from '@app/providers/LocationContext';
import SavedLocationSelector from '@features/locations/SavedLocationSelector';
import type { SavedLocation } from '@shared/types';
import { DEV_LOG, PROD_ERROR } from '../../shared/utils/loggingHelpers';
import { clearUserContext } from '@shared/utils/clearUserContext';
import { useFirebaseTackleBox } from '@shared/hooks/useFirebaseTackleBox';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { user, biometricsAvailable, biometricsEnabled, toggleBiometrics } = useAuth();
  const {
    userLocation,
    setLocation,
    requestLocation,
    searchLocation,
    searchLocationSuggestions,
    tideCoverage,
    refreshTideCoverage,
  } = useLocationContext();
  const [isExportingJSON, setIsExportingJSON] = useState(false);
  const [isExportingCSV, setIsExportingCSV] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [importStats, setImportStats] = useState<ImportResult | ZipImportResult | null>(null);
  const [deleteProgress, setDeleteProgress] = useState<ImportProgress | null>(null);
  const [checkingTideCoverage, setCheckingTideCoverage] = useState(false);
  // Export progress and stats
  const [exportProgress, setExportProgress] = useState<ImportProgress | null>(null);
  const [exportStats, setExportStats] = useState<{ trips: number; weatherLogs: number; fishCatches: number; photos: number; filename: string; durationMs: number } | null>(null);
  // Delete stats
  const [deleteStats, setDeleteStats] = useState<{ trips: number; weatherLogs: number; fishCatches: number } | null>(null);
  // PWA reset state
  const [isResettingApp, setIsResettingApp] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  // Rebuild gear links state
  const [rebuildRunning, setRebuildRunning] = useState(false);
  const [rebuildResult, setRebuildResult] = useState<{ updated: number; total: number } | null>(null);
  const [tacklebox] = useFirebaseTackleBox();
  const [selectedSavedLocationId, setSelectedSavedLocationId] = useState<string>('');
  
  // Location search state
  const [locationInput, setLocationInput] = useState('');
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationSuggestions, setLocationSuggestions] = useState<UserLocation[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const [isTogglingBiometrics, setIsTogglingBiometrics] = useState(false);

  // No auto-matching - only show selection when explicitly chosen from dropdown

  const handleSavedLocationSwitch = useCallback((location: SavedLocation | null) => {
    setSelectedSavedLocationId(location?.id ?? '');
    if (location) {
      void refreshTideCoverage();
    }
  }, [refreshTideCoverage]);

  // Trigger file chooser for import
  const handleBiometricToggle = async () => {
    setIsTogglingBiometrics(true);
    try {
      await toggleBiometrics();
    } finally {
      setIsTogglingBiometrics(false);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleExportJSON = async () => {
    setIsExportingJSON(true);
    setExportError(null);
    setExportSuccess(null);
    setExportStats(null);
    setExportProgress({ phase: 'preparing', current: 0, total: 100, percent: 0, message: 'Preparing data…' });
    const start = Date.now();
    try {
      const useFirebase = firebaseDataService.isReady();
      const [trips, weather, fish] = await Promise.all([
        useFirebase ? firebaseDataService.getAllTrips() : databaseService.getAllTrips(),
        useFirebase ? firebaseDataService.getAllWeatherLogs() : databaseService.getAllWeatherLogs(),
        useFirebase ? firebaseDataService.getAllFishCaught() : databaseService.getAllFishCaught(),
      ]);
      const photos = fish.filter((f: any) => (typeof f.photo === 'string' && f.photo.startsWith('data:')) || f.photoPath || f.photoUrl).length;
      const blob = await dataExportService.exportDataAsZip((p) => setExportProgress(p));
      const now = new Date();
      const date = now.toISOString().split('T')[0];
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const filename = `fishing-calendar-data-${date}_${hh}${mm}.zip`;
      dataExportService.downloadBlob(blob, filename);
      setExportProgress({ phase: 'finalizing', current: 100, total: 100, percent: 100, message: 'Done' });
      setExportStats({ trips: trips.length, weatherLogs: weather.length, fishCatches: fish.length, photos, filename, durationMs: Math.max(0, Date.now() - start) });
      setExportSuccess(`Exported ZIP: ${filename}`);
    } catch (error) {
      PROD_ERROR('Export error:', error);
      setExportError(error instanceof Error ? error.message : 'Failed to export data');
    } finally {
      setIsExportingJSON(false);
      setTimeout(() => setExportProgress(null), 1200);
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
    setExportSuccess(null);
    setExportStats(null);
    setExportProgress({ phase: 'preparing', current: 0, total: 100, percent: 0, message: 'Preparing data…' });
    const start = Date.now();
    try {
      const useFirebase = firebaseDataService.isReady();
      const [trips, weather, fish] = await Promise.all([
        useFirebase ? firebaseDataService.getAllTrips() : databaseService.getAllTrips(),
        useFirebase ? firebaseDataService.getAllWeatherLogs() : databaseService.getAllWeatherLogs(),
        useFirebase ? firebaseDataService.getAllFishCaught() : databaseService.getAllFishCaught(),
      ]);
      const photos = fish.filter((f: any) => (typeof f.photo === 'string' && f.photo.startsWith('data:')) || f.photoPath || f.photoUrl).length;
      const blob = await dataExportService.exportDataAsCSV((p) => setExportProgress(p));
      const now = new Date();
      const date = now.toISOString().split('T')[0];
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const filename = `fishing-calendar-csv-${date}_${hh}${mm}.zip`;
      dataExportService.downloadBlob(blob, filename);
      setExportProgress({ phase: 'finalizing', current: 100, total: 100, percent: 100, message: 'Done' });
      setExportStats({ trips: trips.length, weatherLogs: weather.length, fishCatches: fish.length, photos, filename, durationMs: Math.max(0, Date.now() - start) });
      setExportSuccess(`Exported CSV ZIP: ${filename}`);
    } catch (error) {
      PROD_ERROR('CSV export error:', error);
      setExportError(error instanceof Error ? error.message : 'Failed to export CSV data');
    } finally {
      setIsExportingCSV(false);
      setTimeout(() => setExportProgress(null), 1200);
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

  const handleLocationRequest = useCallback(async () => {
    setIsRequestingLocation(true);
    setLocationError(null);
    try {
      await requestLocation();
    } catch (error) {
      setLocationError(error instanceof Error ? error.message : 'Failed to get location');
    } finally {
      setIsRequestingLocation(false);
    }
  }, [requestLocation]);

  const handleLocationSearch = useCallback(async () => {
    if (!locationInput.trim()) {
      return;
    }
    setIsSearchingLocation(true);
    setLocationError(null);
    try {
      await searchLocation(locationInput.trim());
      setLocationInput('');
      setLocationSuggestions([]);
      setShowSuggestions(false);
    } catch (error) {
      setLocationError(error instanceof Error ? error.message : 'Failed to search location');
    } finally {
      setIsSearchingLocation(false);
    }
  }, [locationInput, searchLocation]);

  const handleLocationInputChange = useCallback((value: string) => {
    setLocationInput(value);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    if (value.trim().length < 2) {
      setLocationSuggestions([]);
      setShowSuggestions(false);
      setSelectedSuggestionIndex(-1);
      setIsLoadingSuggestions(false);
      return;
    }
    setIsLoadingSuggestions(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const suggestions = await searchLocationSuggestions(value.trim());
        setLocationSuggestions(suggestions);
        setShowSuggestions(suggestions.length > 0);
        setSelectedSuggestionIndex(-1);
      } catch (error) {
        setLocationSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setIsLoadingSuggestions(false);
      }
    }, 300);
  }, [searchLocationSuggestions]);

  const handleSuggestionSelect = useCallback((suggestion: UserLocation) => {
    setLocation(suggestion);
    setLocationInput('');
    setLocationSuggestions([]);
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
    setLocationError(null);
  }, [setLocation]);

  const handleLocationInputKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isSearchingLocation) {
      if (showSuggestions && locationSuggestions.length > 0) {
        const selectedSuggestion = locationSuggestions[selectedSuggestionIndex >= 0 ? selectedSuggestionIndex : 0];
        handleSuggestionSelect(selectedSuggestion);
      } else {
        handleLocationSearch();
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setSelectedSuggestionIndex(-1);
    } else if (e.key === 'ArrowDown' && showSuggestions) {
      e.preventDefault();
      setSelectedSuggestionIndex(prev => prev < locationSuggestions.length - 1 ? prev + 1 : 0);
    } else if (e.key === 'ArrowUp' && showSuggestions) {
      e.preventDefault();
      setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : locationSuggestions.length - 1);
    }
  }, [handleLocationSearch, handleSuggestionSelect, isSearchingLocation, locationSuggestions, selectedSuggestionIndex, showSuggestions]);

  const handleClearLocation = useCallback(() => {
    setLocation(null);
    setLocationError(null);
  }, [setLocation]);

  const clearErrors = () => {
    setExportError(null);
    setImportError(null);
    setExportSuccess(null);
    setImportSuccess(null);
    setDeleteSuccess(null);
    setExportStats(null);
    setDeleteStats(null);
    setExportProgress(null);
    setResetError(null);
    setResetSuccess(null);
    setLocationError(null);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Reset dialog state on logout/auth changes
  useEffect(() => {
    const handleAuthChanged = (event: Event) => {
      try {
        const detail = (event as CustomEvent).detail || {};
        const loggedOut = !detail?.toUser;
        if (loggedOut) {
          // Clear all UI state and close modal
          clearErrors();
          setShowDeleteAllConfirm(false);
          setShowImportConfirm(false);
          setPendingImportFile(null);
          setIsDeletingAll(false);
          setIsImporting(false);
          setIsExportingCSV(false);
          setIsExportingJSON(false);
          setImportProgress(null);
          setDeleteProgress(null);
          setImportStats(null);
          setExportStats(null);
          try { if (fileInputRef.current) fileInputRef.current.value = ''; } catch {}
          // Close the settings modal if open
          if (isOpen) {
            onClose();
          }
        }
      } catch {}
    };
    window.addEventListener('authStateChanged', handleAuthChanged as EventListener);
    return () => window.removeEventListener('authStateChanged', handleAuthChanged as EventListener);
  }, [clearErrors, isOpen, onClose]);

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
      // Capture stats before deletion
      const useFirebase = !!user;
      const [tripsBefore, weatherBefore, fishBefore] = await Promise.all([
        useFirebase ? firebaseDataService.getAllTrips() : databaseService.getAllTrips(),
        useFirebase ? firebaseDataService.getAllWeatherLogs() : databaseService.getAllWeatherLogs(),
        useFirebase ? firebaseDataService.getAllFishCaught() : databaseService.getAllFishCaught(),
      ]);
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
      setDeleteStats({ trips: tripsBefore.length, weatherLogs: weatherBefore.length, fishCatches: fishBefore.length });
      setDeleteSuccess('All data has been deleted.');
      // Signal UI layers (Calendar, modals) to refresh immediately without navigation
      try {
        window.dispatchEvent(new CustomEvent('databaseDataReady', { detail: { source: 'DeleteAll', timestamp: Date.now() } }));
        window.dispatchEvent(new CustomEvent('userDataReady', { detail: { userId: user?.uid ?? null, isGuest: !user, source: 'DeleteAll', timestamp: Date.now() } }));
        window.dispatchEvent(new Event('forceCalendarRefresh'));
      } catch {}
    } catch (e) {
      PROD_ERROR('Failed to delete all data:', e);
      setImportError(e instanceof Error ? e.message : 'Failed to delete all data');
    } finally {
      setIsDeletingAll(false);
      // keep progress visible shortly then clear
      setTimeout(() => setDeleteProgress(null), 1200);
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
          <div className="mt-4">
            <SavedLocationSelector
              selectedId={selectedSavedLocationId}
              onSelect={handleSavedLocationSwitch}
              showSaveCurrentButton
              allowManage={false}
              placeholder="Select a saved location"
            />
          </div>

          {/* Location Search UI */}
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium" style={{ color: 'var(--secondary-text)' }}>
                Find New Location
              </label>
            </div>

            {locationError && (
              <p className="text-xs" style={{ color: 'var(--error-text)' }}>
                <i className="fas fa-exclamation-triangle mr-1"></i>
                {locationError}
              </p>
            )}

            <div className="flex items-center space-x-1">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={locationInput}
                  onChange={(e) => handleLocationInputChange(e.target.value)}
                  onKeyDown={handleLocationInputKeyPress}
                  onFocus={() => locationInput.trim().length >= 2 && setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  placeholder="Enter a location"
                  className="w-full px-3 py-2 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{
                    backgroundColor: 'var(--input-background)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--primary-text)'
                  }}
                />

                {showSuggestions && (
                  <div className="absolute z-50 w-full mt-1 border rounded-md shadow-lg max-h-60 overflow-y-auto" style={{
                    backgroundColor: 'var(--card-background)',
                    borderColor: 'var(--card-border)'
                  }}>
                    {isLoadingSuggestions ? (
                      <div className="px-2 py-1 text-xs" style={{ color: 'var(--secondary-text)' }}>
                        <i className="fas fa-spinner fa-spin mr-1"></i>
                        Searching locations...
                      </div>
                    ) : locationSuggestions.length > 0 ? (
                      locationSuggestions.map((suggestion, index) => (
                        <div
                          key={`${suggestion.lat}-${suggestion.lon}`}
                          onClick={() => handleSuggestionSelect(suggestion)}
                          className="px-2 py-1 cursor-pointer text-xs"
                          style={{
                            backgroundColor: index === selectedSuggestionIndex ? 'var(--secondary-background)' : 'transparent'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--tertiary-background)'}
                          onMouseOut={(e) => e.currentTarget.style.backgroundColor = index === selectedSuggestionIndex ? 'var(--secondary-background)' : 'transparent'}
                        >
                          <div className="font-medium" style={{ color: 'var(--primary-text)' }}>
                            {suggestion.name}
                          </div>
                          <div className="text-xs" style={{ color: 'var(--tertiary-text)' }}>
                            {suggestion.lat.toFixed(4)}, {suggestion.lon.toFixed(4)}
                          </div>
                        </div>
                      ))
                    ) : locationInput.trim().length >= 2 ? (
                      <div className="px-2 py-1 text-xs" style={{ color: 'var(--secondary-text)' }}>
                        No locations found
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
              <button
                onClick={handleLocationSearch}
                disabled={isSearchingLocation}
                className="px-3 py-2 rounded-none transition disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: 'var(--button-secondary)', color: 'white' }}
                onMouseOver={(e) => !isSearchingLocation && (e.currentTarget.style.backgroundColor = 'var(--button-secondary-hover)')}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'var(--button-secondary)'}
                title="Search location"
              >
                <i className={`fas ${isSearchingLocation ? "fa-spinner fa-spin" : "fa-search"}`}></i>
              </button>
              <button
                onClick={handleLocationRequest}
                disabled={isRequestingLocation}
                className="px-3 py-2 rounded-r bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
                title="Use current location"
              >
                <i className={`fas ${isRequestingLocation ? "fa-spinner fa-spin" : "fa-map-marker-alt"}`}></i>
              </button>
            </div>
            <p className="text-xs" style={{ color: 'var(--tertiary-text)' }}>
              Start typing to see location suggestions, or use GPS to get your current location
            </p>
          </div>

          <div className="flex gap-3 mt-4">
            {userLocation && (
              <Button
                onClick={handleClearLocation}
                variant="secondary"
              >
                Clear Location
              </Button>
            )}
            <Button
              onClick={handleTideCoverageCheck}
              disabled={!userLocation || checkingTideCoverage}
              loading={checkingTideCoverage}
            >
              {checkingTideCoverage ? 'Checking…' : 'Check Tide Coverage'}
            </Button>
          </div>
        </div>

        {/* Security Section */}
        {biometricsAvailable && (
          <div className="pb-6" style={{ borderBottom: '1px solid var(--border-color)' }}>
            <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--primary-text)' }}>
              Security
            </h3>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--primary-text)' }}>
                  Biometric Lock
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--secondary-text)' }}>
                  Require fingerprint or Face ID to unlock app after 1 hour of inactivity.
                </p>
              </div>
              <button
                onClick={handleBiometricToggle}
                disabled={isTogglingBiometrics}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${biometricsEnabled ? 'bg-blue-600' : 'bg-gray-200'}`}
                style={{ backgroundColor: biometricsEnabled ? 'var(--button-primary)' : 'var(--tertiary-background)' }}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${biometricsEnabled ? 'translate-x-6' : 'translate-x-1'}`}
                />
              </button>
            </div>
          </div>
        )}

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
          {exportProgress && (
            <div className="mt-3">
              <ProgressBar progress={exportProgress} />
            </div>
          )}
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
        {(exportError || importError || exportSuccess || deleteSuccess || importSuccess || importStats) && (
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

            {exportSuccess && (
              <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--success-background)', border: '1px solid var(--success-border)' }}>
                <div className="flex items-start">
                  <i className="fas fa-check-circle mr-2 mt-0.5" style={{ color: 'var(--success-text)' }}></i>
                  <div className="flex-1">
                    <p className="text-sm font-medium" style={{ color: 'var(--success-text)' }}>
                      Export Successful
                    </p>
                    <p className="text-sm mt-1" style={{ color: 'var(--success-text)' }}>
                      {exportSuccess}
                    </p>
                    {exportStats && (
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="flex justify-between"><span>Trips</span><span className="font-medium">{exportStats.trips}</span></div>
                        <div className="flex justify-between"><span>Weather</span><span className="font-medium">{exportStats.weatherLogs}</span></div>
                        <div className="flex justify-between"><span>Fish</span><span className="font-medium">{exportStats.fishCatches}</span></div>
                        <div className="flex justify-between"><span>Photos</span><span className="font-medium">{exportStats.photos}</span></div>
                        <div className="col-span-2 flex justify-between pt-2" style={{ borderTop: '1px solid var(--border-color)' }}>
                          <span>Filename</span><span className="font-medium">{exportStats.filename}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {deleteSuccess && (
              <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--success-background)', border: '1px solid var(--success-border)' }}>
                <div className="flex items-start">
                  <i className="fas fa-check-circle mr-2 mt-0.5" style={{ color: 'var(--success-text)' }}></i>
                  <div className="flex-1">
                    <p className="text-sm font-medium" style={{ color: 'var(--success-text)' }}>
                      Delete Successful
                    </p>
                    <p className="text-sm mt-1" style={{ color: 'var(--success-text)' }}>
                      {deleteSuccess}
                    </p>
                    {deleteStats && (
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="flex justify-between"><span>Trips</span><span className="font-medium">{deleteStats.trips}</span></div>
                        <div className="flex justify-between"><span>Weather</span><span className="font-medium">{deleteStats.weatherLogs}</span></div>
                        <div className="flex justify-between"><span>Fish</span><span className="font-medium">{deleteStats.fishCatches}</span></div>
                      </div>
                    )}
                  </div>
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

          <div className="mt-6">
            <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--primary-text)' }}>Reset App Cache (PWA)</h4>
            <p className="text-xs mb-3" style={{ color: 'var(--secondary-text)' }}>
              If the app is stuck or shows dev build errors on mobile, reset the PWA. This clears service workers, caches, and local data, then reloads.
            </p>
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                onClick={async () => {
                  setIsResettingApp(true);
                  setResetError(null);
                  setResetSuccess(null);
                  try {
                    await clearUserContext({ preserveGuestData: false });
                    if ('serviceWorker' in navigator) {
                      try {
                        const regs = await navigator.serviceWorker.getRegistrations();
                        await Promise.all(regs.map(r => r.unregister()));
                      } catch (e) {
                        console.warn('SW unregister failed:', e);
                      }
                    }
                    try {
                      if ('caches' in window) {
                        const keys = await caches.keys();
                        await Promise.all(keys.map(k => caches.delete(k)));
                      }
                    } catch {}
                    setResetSuccess('App cache cleared. Reloading…');
                    setTimeout(() => window.location.reload(), 600);
                  } catch (e) {
                    setResetError(e instanceof Error ? e.message : 'Failed to reset app cache');
                  } finally {
                    setIsResettingApp(false);
                  }
                }}
                disabled={isResettingApp}
                loading={isResettingApp}
              >
                {isResettingApp ? 'Resetting…' : 'Reset App Cache'}
              </Button>
              {resetSuccess && (
                <span className="text-sm" style={{ color: 'var(--success-text)' }}>{resetSuccess}</span>
              )}
              {resetError && (
                <span className="text-sm" style={{ color: 'var(--error-text)' }}>{resetError}</span>
              )}
            </div>
          </div>

          <div className="mt-6">
            <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--primary-text)' }}>Rebuild Catch Gear Links</h4>
            <p className="text-xs mb-3" style={{ color: 'var(--secondary-text)' }}>
              Map catches to stable gear IDs. Use after importing data or renaming gear. Safe to run multiple times.
            </p>
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                disabled={rebuildRunning}
                loading={rebuildRunning}
                onClick={async () => {
                  setRebuildRunning(true);
                  setRebuildResult(null);
                  try {
                    const norm = (v?: string) => (v || '').trim().toLowerCase();
                    const gearKey = (it: any) => `${norm(it.type)}|${norm(it.brand)}|${norm(it.name)}|${norm(it.colour)}`;
                    const hashFNV1a = (str: string) => { let h=0x811c9dc5; for (let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,0x01000193);} return ('0000000'+(h>>>0).toString(16)).slice(-8); };
                    const compositeToId = new Map<string, string>();
                    const nameToIds = new Map<string, string[]>();
                    for (const it of tacklebox) {
                      const key = gearKey(it);
                      const gid = it.gearId || `local-${hashFNV1a(key)}`;
                      if (!compositeToId.has(key)) compositeToId.set(key, gid);
                      const nm = norm(it.name);
                      const arr = nameToIds.get(nm) || [];
                      if (!arr.includes(gid)) arr.push(gid);
                      nameToIds.set(nm, arr);
                    }

                    const useFirebase = !!user;
                    const allFish = useFirebase ? await firebaseDataService.getAllFishCaught() : await databaseService.getAllFishCaught();
                    let updated = 0;
                    for (const f of allFish) {
                      const selected: string[] = Array.isArray(f.gear) ? f.gear : [];
                      const newIds: string[] = [];
                      for (const g of selected) {
                        const s = norm(String(g));
                        let gid: string | undefined;
                        if (s.includes('|')) gid = compositeToId.get(s);
                        else {
                          const ids = nameToIds.get(s) || [];
                          gid = ids.length === 1 ? ids[0] : (ids[0] || undefined);
                        }
                        if (!gid) gid = `local-${hashFNV1a(s)}`;
                        if (!newIds.includes(gid)) newIds.push(gid);
                      }
                      const prev = Array.isArray((f as any).gearIds) ? (f as any).gearIds : [];
                      const changed = newIds.length > 0 && (prev.length !== newIds.length || newIds.some((id, i) => id !== prev[i]));
                      if (changed) {
                        const updatedFish = { ...f, gearIds: newIds } as any;
                        if (useFirebase) await firebaseDataService.updateFishCaught(updatedFish);
                        else await databaseService.updateFishCaught(updatedFish);
                        updated++;
                      }
                    }
                    setRebuildResult({ updated, total: allFish.length });
                  } catch (e) {
                    setRebuildResult({ updated: 0, total: 0 });
                    PROD_ERROR('Rebuild gear links failed', e);
                  } finally {
                    setRebuildRunning(false);
                  }
                }}
              >
                {rebuildRunning ? 'Rebuilding…' : 'Rebuild Links'}
              </Button>
              {rebuildResult && (
                <span className="text-sm" style={{ color: 'var(--secondary-text)' }}>
                  Updated {rebuildResult.updated} of {rebuildResult.total} catches
                </span>
              )}
            </div>
          </div>
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