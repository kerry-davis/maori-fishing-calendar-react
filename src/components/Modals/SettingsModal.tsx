import React, { useState, useRef } from 'react';
import { Button } from '../UI';
import { Modal, ModalHeader, ModalBody } from './Modal';
import { dataExportService } from '../../services/dataExportService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
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
        <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Export Data
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
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

        {/* Data Import Section */}
        <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Import Data
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
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
            
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Supported formats: ZIP files (exported from this app) or JSON files
            </p>
          </div>
        </div>

        {/* Error/Success Messages */}
        {(exportError || importError || importSuccess) && (
          <div className="space-y-3">
            {exportError && (
              <div className="p-3 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg">
                <div className="flex items-start">
                  <i className="fas fa-exclamation-triangle text-red-600 dark:text-red-400 mr-2 mt-0.5"></i>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-800 dark:text-red-200">
                      Export Error
                    </p>
                    <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                      {exportError}
                    </p>
                  </div>
                  <button
                    onClick={clearErrors}
                    className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>
              </div>
            )}

            {importError && (
              <div className="p-3 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg">
                <div className="flex items-start">
                  <i className="fas fa-exclamation-triangle text-red-600 dark:text-red-400 mr-2 mt-0.5"></i>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-800 dark:text-red-200">
                      Import Error
                    </p>
                    <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                      {importError}
                    </p>
                  </div>
                  <button
                    onClick={clearErrors}
                    className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>
              </div>
            )}

            {importSuccess && (
              <div className="p-3 bg-green-100 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-lg">
                <div className="flex items-start">
                  <i className="fas fa-check-circle text-green-600 dark:text-green-400 mr-2 mt-0.5"></i>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-800 dark:text-green-200">
                      Import Successful
                    </p>
                    <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                      {importSuccess}
                    </p>
                  </div>
                  <button
                    onClick={clearErrors}
                    className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* App Information */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            About
          </h3>
          <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
            <p>
              <strong>Māori Fishing Calendar</strong> - React Version
            </p>
            <p>
              This application helps you plan your fishing trips based on traditional Māori lunar calendar knowledge.
            </p>
            <p>
              Data is stored locally in your browser and can be exported for backup or transfer to other devices.
            </p>
          </div>
        </div>
        </div>
      </ModalBody>
    </Modal>
  );
};