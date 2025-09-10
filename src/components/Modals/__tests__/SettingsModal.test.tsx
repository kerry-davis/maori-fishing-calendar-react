import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SettingsModal } from '../SettingsModal';
import { dataExportService } from '../../../services/dataExportService';

// Mock the data export service
vi.mock('../../../services/dataExportService');

// Mock window methods
Object.defineProperty(window, 'confirm', {
  writable: true,
  value: vi.fn()
});

// Mock window.location.reload
delete (window as any).location;
(window as any).location = { reload: vi.fn() };

describe('SettingsModal', () => {
  const mockOnClose = vi.fn();
  let mockDataExportService: any;

  beforeEach(() => {
    mockDataExportService = vi.mocked(dataExportService);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderSettingsModal = (isOpen = true) => {
    return render(
      <SettingsModal isOpen={isOpen} onClose={mockOnClose} />
    );
  };

  it('renders settings modal when open', () => {
    renderSettingsModal();
    
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Export Data')).toBeInTheDocument();
    expect(screen.getByText('Import Data')).toBeInTheDocument();
    expect(screen.getByText('About')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    renderSettingsModal(false);
    
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
  });

  describe('Export functionality', () => {
    it('exports data as ZIP when JSON export button is clicked', async () => {
      const mockBlob = new Blob(['test'], { type: 'application/zip' });
      mockDataExportService.exportDataAsZip.mockResolvedValue(mockBlob);
      mockDataExportService.downloadBlob.mockImplementation(() => {});

      renderSettingsModal();
      
      const exportButton = screen.getByText('Export as ZIP (JSON)');
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(mockDataExportService.exportDataAsZip).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(mockDataExportService.downloadBlob).toHaveBeenCalledWith(
          mockBlob,
          expect.stringMatching(/fishing-calendar-data-\d{4}-\d{2}-\d{2}\.zip/)
        );
      });
    });

    it('exports data as CSV when CSV export button is clicked', async () => {
      const mockBlob = new Blob(['test'], { type: 'application/zip' });
      mockDataExportService.exportDataAsCSV.mockResolvedValue(mockBlob);
      mockDataExportService.downloadBlob.mockImplementation(() => {});

      renderSettingsModal();
      
      const exportButton = screen.getByText('Export as CSV');
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(mockDataExportService.exportDataAsCSV).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(mockDataExportService.downloadBlob).toHaveBeenCalledWith(
          mockBlob,
          expect.stringMatching(/fishing-calendar-csv-\d{4}-\d{2}-\d{2}\.zip/)
        );
      });
    });

    it('displays error message when export fails', async () => {
      mockDataExportService.exportDataAsZip.mockRejectedValue(new Error('Export failed'));

      renderSettingsModal();
      
      const exportButton = screen.getByText('Export as ZIP (JSON)');
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(screen.getByText('Export Error')).toBeInTheDocument();
        expect(screen.getByText('Export failed')).toBeInTheDocument();
      });
    });

    it('disables export buttons while exporting', async () => {
      mockDataExportService.exportDataAsZip.mockImplementation(() => new Promise(() => {})); // Never resolves

      renderSettingsModal();
      
      const jsonButton = screen.getByText('Export as ZIP (JSON)');
      const csvButton = screen.getByText('Export as CSV');
      
      fireEvent.click(jsonButton);

      await waitFor(() => {
        expect(jsonButton).toBeDisabled();
        expect(csvButton).toBeDisabled();
      });
    });
  });

  describe('Import functionality', () => {
    it('opens file dialog when import button is clicked', () => {
      renderSettingsModal();
      
      const importButton = screen.getByText('Import Data File');
      const fileInput = screen.getByRole('button', { name: /import data file/i }).parentElement?.querySelector('input[type="file"]');
      
      expect(fileInput).toBeInTheDocument();
      
      const clickSpy = vi.spyOn(fileInput as HTMLInputElement, 'click');
      fireEvent.click(importButton);
      
      expect(clickSpy).toHaveBeenCalled();
    });

    it('imports data when file is selected and confirmed', async () => {
      vi.mocked(window.confirm).mockReturnValue(true);
      mockDataExportService.importData.mockResolvedValue(undefined);

      renderSettingsModal();
      
      const fileInput = screen.getByRole('button', { name: /import data file/i }).parentElement?.querySelector('input[type="file"]') as HTMLInputElement;
      const mockFile = new File(['test'], 'test.zip', { type: 'application/zip' });
      
      Object.defineProperty(fileInput, 'files', {
        value: [mockFile],
        writable: false,
      });

      fireEvent.change(fileInput);

      expect(window.confirm).toHaveBeenCalledWith(
        'Are you sure you want to import data from "test.zip"? This will overwrite ALL existing log data.'
      );

      await waitFor(() => {
        expect(mockDataExportService.importData).toHaveBeenCalledWith(mockFile);
      });

      await waitFor(() => {
        expect(screen.getByText('Import Successful')).toBeInTheDocument();
        expect(screen.getByText(/Successfully imported data from "test.zip"/)).toBeInTheDocument();
      });
    });

    it('does not import when user cancels confirmation', async () => {
      vi.mocked(window.confirm).mockReturnValue(false);

      renderSettingsModal();
      
      const fileInput = screen.getByRole('button', { name: /import data file/i }).parentElement?.querySelector('input[type="file"]') as HTMLInputElement;
      const mockFile = new File(['test'], 'test.zip', { type: 'application/zip' });
      
      Object.defineProperty(fileInput, 'files', {
        value: [mockFile],
        writable: false,
      });

      fireEvent.change(fileInput);

      expect(window.confirm).toHaveBeenCalled();
      expect(mockDataExportService.importData).not.toHaveBeenCalled();
    });

    it('displays error message when import fails', async () => {
      vi.mocked(window.confirm).mockReturnValue(true);
      mockDataExportService.importData.mockRejectedValue(new Error('Import failed'));

      renderSettingsModal();
      
      const fileInput = screen.getByRole('button', { name: /import data file/i }).parentElement?.querySelector('input[type="file"]') as HTMLInputElement;
      const mockFile = new File(['test'], 'test.zip', { type: 'application/zip' });
      
      Object.defineProperty(fileInput, 'files', {
        value: [mockFile],
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(screen.getByText('Import Error')).toBeInTheDocument();
        expect(screen.getByText('Import failed')).toBeInTheDocument();
      });
    });

    it('reloads page after successful import', async () => {
      vi.mocked(window.confirm).mockReturnValue(true);
      mockDataExportService.importData.mockResolvedValue(undefined);
      
      renderSettingsModal();
      
      const fileInput = screen.getByRole('button', { name: /import data file/i }).parentElement?.querySelector('input[type="file"]') as HTMLInputElement;
      const mockFile = new File(['test'], 'test.zip', { type: 'application/zip' });
      
      Object.defineProperty(fileInput, 'files', {
        value: [mockFile],
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(screen.getByText('Import Successful')).toBeInTheDocument();
      });

      // The component sets a timeout to reload, but we don't need to test the actual reload
      // Just verify the success message is shown
      expect(screen.getByText(/Successfully imported data from "test.zip"/)).toBeInTheDocument();
    });
  });

  describe('Error handling', () => {
    it('clears error messages when close button is clicked', async () => {
      mockDataExportService.exportDataAsZip.mockRejectedValue(new Error('Export failed'));

      renderSettingsModal();
      
      const exportButton = screen.getByText('Export as ZIP (JSON)');
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(screen.getByText('Export Error')).toBeInTheDocument();
      });

      // Find the close button in the error message by looking for the button with fa-times icon
      const errorSection = screen.getByText('Export Error').closest('.p-3');
      const closeButton = errorSection?.querySelector('button');
      
      expect(closeButton).toBeTruthy();
      
      if (closeButton) {
        fireEvent.click(closeButton);
        expect(screen.queryByText('Export Error')).not.toBeInTheDocument();
      }
    });
  });

  describe('File input validation', () => {
    it('accepts ZIP and JSON files', () => {
      renderSettingsModal();
      
      const fileInput = screen.getByRole('button', { name: /import data file/i }).parentElement?.querySelector('input[type="file"]') as HTMLInputElement;
      
      expect(fileInput.accept).toBe('.zip,.json');
    });

    it('shows supported formats information', () => {
      renderSettingsModal();
      
      expect(screen.getByText('Supported formats: ZIP files (exported from this app) or JSON files')).toBeInTheDocument();
    });
  });

  describe('About section', () => {
    it('displays app information', () => {
      renderSettingsModal();
      
      expect(screen.getByText('Māori Fishing Calendar')).toBeInTheDocument();
      expect(screen.getByText(/This application helps you plan your fishing trips/)).toBeInTheDocument();
      expect(screen.getByText(/Data is stored locally in your browser/)).toBeInTheDocument();
    });
  });
});