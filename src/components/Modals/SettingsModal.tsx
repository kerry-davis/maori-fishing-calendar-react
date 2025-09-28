import React, { useState, useRef } from 'react';
import { Button } from '../UI';
import { Modal, ModalHeader, ModalBody } from './Modal';
import { dataExportService } from '../../services/dataExportService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLegacyMigration?: () => void; // Add callback for legacy migration
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onLegacyMigration }) => {
  const [isExportingJSON, setIsExportingJSON] = useState(false);
  const [isExportingCSV, setIsExportingCSV] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportJSON = async () => {
    setIsExportingJSON(true);
    setExportError(null);
    
    try {
      const blob = await dataExportService.exportDataAsZip();
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `fishing-calendar-data-${timestamp}.zip`;
      dataExportService.downloadBlob(blob, filename);
    } catch (error) {
      console.error('Export error:', error);
      setExportError(error instanceof Error ? error.message : 'Failed to export data');
    } finally {
      setIsExportingJSON(false);
    }
  };

  const handleExportCSV = async () => {
    setIsExportingCSV(true);
    setExportError(null);
    
    try {
      const blob = await dataExportService.exportDataAsCSV();
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `fishing-calendar-csv-${timestamp}.zip`;
      dataExportService.downloadBlob(blob, filename);
    } catch (error) {
      console.error('CSV export error:', error);
      setExportError(error instanceof Error ? error.message : 'Failed to export CSV data');
    } finally {
      setIsExportingCSV(false);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Confirm import action
    const confirmed = window.confirm(
      `Are you sure you want to import data from "${file.name}"? This will overwrite ALL existing log data.`
    );
    
    if (!confirmed) {
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    setIsImporting(true);
    setImportError(null);
    setImportSuccess(null);

    try {
      await dataExportService.importData(file);
      setImportSuccess(`Successfully imported data from "${file.name}". The page will reload to reflect changes.`);
      
      // Reload page after a short delay to show success message
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error('Import error:', error);
      setImportError(error instanceof Error ? error.message : 'Failed to import data');
    } finally {
      setIsImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const clearErrors = () => {
    setExportError(null);
    setImportError(null);
    setImportSuccess(null);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalHeader title="Settings" onClose={onClose} />
      <ModalBody>
        <div className="space-y-6">
        {/* Data Export Section */}
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

        {/* Legacy Data Migration Section */}
        <div className="pb-6" style={{ borderBottom: '1px solid var(--border-color)' }}>
          <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--primary-text)' }}>
            Legacy Data Migration
          </h3>
          <p className="text-sm mb-4" style={{ color: 'var(--secondary-text)' }}>
            Import fishing data from your previous Māori Fishing Calendar app (legacy version).
          </p>

          <div className="flex flex-col gap-3">
            <Button
              onClick={() => {
                console.log('Import Legacy Data button clicked');
                console.log('Calling onLegacyMigration callback');
                onLegacyMigration?.(); // Open migration modal - parent will handle modal transitions
              }}
              variant="secondary"
            >
              <i className="fas fa-file-import mr-2"></i>
              Import Legacy Data
            </Button>

            <p className="text-xs" style={{ color: 'var(--secondary-text)' }}>
              Supports zip files exported from the legacy app. Perfect for mobile devices!
            </p>
          </div>
        </div>

        {/* Data Import Section */}
        <div className="pb-6" style={{ borderBottom: '1px solid var(--border-color)' }}>
          <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--primary-text)' }}>
            Import Data
          </h3>
          <p className="text-sm mb-4" style={{ color: 'var(--secondary-text)' }}>
            Import data from a previously exported ZIP file or JSON file. This will replace all existing data.
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

        {/* Error/Success Messages */}
        {(exportError || importError || importSuccess) && (
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
                  </div>
                  <button
                    onClick={clearErrors}
                    className="transition-colors"
                    style={{ color: 'var(--success-text)' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = 'var(--success-text)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = 'var(--success-text)';
                    }}
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        </div>
      </ModalBody>
    </Modal>
  );
};