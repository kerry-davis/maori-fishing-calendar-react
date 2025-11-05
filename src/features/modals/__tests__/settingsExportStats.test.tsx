import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { SettingsModal } from '@features/modals/SettingsModal';

const dataExportMocks = vi.hoisted(() => ({
  downloadBlob: vi.fn(),
  exportDataAsZip: vi.fn(),
}));

const authState = vi.hoisted(() => ({
  user: { uid: 'user-123' } as { uid: string } | null,
}));

const { downloadBlob, exportDataAsZip } = dataExportMocks;

vi.mock('@app/providers/AuthContext', () => ({
  useAuth: () => authState
}));

const mockLocationContext = {
  userLocation: null,
  setLocation: vi.fn(),
  requestLocation: vi.fn(),
  searchLocation: vi.fn(),
  searchLocationSuggestions: [],
  tideCoverage: null,
  refreshTideCoverage: vi.fn(),
  savedLocations: [
    { id: 'loc-1', name: 'Harbour A', createdAt: '', updatedAt: '' },
    { id: 'loc-2', name: 'Harbour B', createdAt: '', updatedAt: '' }
  ],
  savedLocationsLoading: false,
  savedLocationsError: null,
  createSavedLocation: vi.fn(),
  updateSavedLocation: vi.fn(),
  deleteSavedLocation: vi.fn(),
  selectSavedLocation: vi.fn(),
  saveCurrentLocation: vi.fn(),
  savedLocationsLimit: 10,
};

vi.mock('@app/providers/LocationContext', () => ({
  useLocationContext: () => mockLocationContext
}));

const mockFirebaseService = vi.hoisted(() => ({
  isReady: vi.fn(() => true),
  getAllTrips: vi.fn(async () => [{ id: 'trip-1' }]),
  getAllWeatherLogs: vi.fn(async () => [{ id: 'weather-1' }]),
  getAllFishCaught: vi.fn(async () => [{ id: 'fish-1', photo: null }]),
  getSavedLocations: vi.fn(async () => mockLocationContext.savedLocations),
}));

vi.mock('@shared/services/firebaseDataService', () => ({
  firebaseDataService: mockFirebaseService
}));

vi.mock('@shared/services/dataExportService', () => ({
  dataExportService: {
    exportDataAsZip: dataExportMocks.exportDataAsZip,
    downloadBlob: dataExportMocks.downloadBlob,
    exportDataAsCSV: vi.fn(),
    importData: vi.fn()
  }
}));

vi.mock('@shared/services/databaseService', () => ({
  databaseService: {
    getAllTrips: vi.fn(),
    getAllWeatherLogs: vi.fn(),
    getAllFishCaught: vi.fn()
  }
}));

describe('SettingsModal export stats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    exportDataAsZip.mockResolvedValue(new Blob());
    authState.user = { uid: 'user-123' };
  });

  it('displays saved locations count after a successful JSON export', async () => {
    const user = userEvent.setup();
    render(<SettingsModal isOpen={true} onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /Export as ZIP \(JSON\)/i }));

    await waitFor(() => {
      expect(exportDataAsZip).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.getByText(/Export Successful/i)).toBeInTheDocument();
    });

    const savedRow = await screen.findByTestId('export-stat-saved-locations');
    expect(savedRow).toHaveTextContent(/Saved Locations\s*2/);

    const durationRow = await screen.findByText(/Duration/i);
    expect(durationRow).toBeInTheDocument();
  });

  it('hides save controls for guests', () => {
    authState.user = null;

    render(<SettingsModal isOpen={true} onClose={vi.fn()} />);

    const saveCurrentButton = screen.getByRole('button', { name: /Save Current Location/i });
    expect(saveCurrentButton).toBeDisabled();
  });
});
