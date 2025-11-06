import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SettingsModal } from '@features/modals/SettingsModal';
import userEvent from '@testing-library/user-event';

const authState = vi.hoisted(() => ({
  user: { uid: 'user-123' } as { uid: string } | null,
}));

vi.mock('@app/providers/AuthContext', () => ({
  useAuth: () => authState,
}));

const mockLocationContext = vi.hoisted(() => ({
  userLocation: null,
  setLocation: vi.fn(),
  requestLocation: vi.fn(),
  searchLocation: vi.fn(),
  searchLocationSuggestions: vi.fn(),
  tideCoverage: null,
  refreshTideCoverage: vi.fn(),
  savedLocations: [] as any[],
  savedLocationsLoading: false,
  savedLocationsError: null,
  createSavedLocation: vi.fn(),
  updateSavedLocation: vi.fn(),
  deleteSavedLocation: vi.fn(),
  selectSavedLocation: vi.fn(),
  saveCurrentLocation: vi.fn(),
  savedLocationsLimit: 10,
}));

vi.mock('@app/providers/LocationContext', () => ({
  useLocationContext: () => mockLocationContext,
}));

vi.mock('@shared/hooks/useFirebaseTackleBox', () => ({
  useFirebaseTackleBox: () => [[], vi.fn(), vi.fn(), null, false],
}));

const firebaseServiceMock = vi.hoisted(() => ({
  isReady: vi.fn(() => true),
  getAllTrips: vi.fn(async () => []),
  getAllWeatherLogs: vi.fn(async () => []),
  getAllFishCaught: vi.fn(async () => []),
  getSavedLocations: vi.fn(async () => mockLocationContext.savedLocations),
}));

vi.mock('@shared/services/firebaseDataService', () => ({
  firebaseDataService: firebaseServiceMock,
}));

vi.mock('@shared/services/dataExportService', () => ({
  dataExportService: {
    exportDataAsZip: vi.fn(),
    exportDataAsCSV: vi.fn(),
    downloadBlob: vi.fn(),
    importData: vi.fn(),
  },
}));

vi.mock('@shared/services/browserZipImportService', () => ({
  browserZipImportService: {
    processZipFile: vi.fn(),
  },
}));

vi.mock('@shared/services/databaseService', () => ({
  databaseService: {
    getAllTrips: vi.fn(async () => []),
    getAllWeatherLogs: vi.fn(async () => []),
    getAllFishCaught: vi.fn(async () => []),
  },
}));

describe('SettingsModal saved location management', () => {
  beforeEach(() => {
    mockLocationContext.savedLocations = [];
    authState.user = { uid: 'user-123' };
    mockLocationContext.selectSavedLocation.mockReset();
  });

  it('shows empty-state guidance without add button for authenticated user with no saved locations', () => {
    render(<SettingsModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /Add Location/i })).not.toBeInTheDocument();
    expect(screen.getByText(/You haven't saved any locations yet/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save Current Location/i })).toBeDisabled();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('shows only the chosen saved location details in the manage section', async () => {
    const user = userEvent.setup();
    const locations = [
      { id: '1', name: 'Auckland Marina', water: 'Waitematā', location: '', lat: -36.84, lon: 174.76 },
      { id: '2', name: 'Wellington Harbour', water: 'Te Whanganui-a-Tara', location: '', lat: -41.29, lon: 174.78 },
    ];
    mockLocationContext.savedLocations = locations as any[];
    mockLocationContext.selectSavedLocation.mockResolvedValue(locations[1] as any);

    render(<SettingsModal isOpen={true} onClose={vi.fn()} />);

    const select = await screen.findByRole('combobox');
    await user.selectOptions(select, '2');

    await waitFor(() => {
      expect(mockLocationContext.selectSavedLocation).toHaveBeenCalledWith('2');
    });

    expect(screen.getByText('Wellington Harbour', { selector: 'p' })).toBeInTheDocument();
    expect(screen.queryByText('Auckland Marina', { selector: 'p' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Delete$/i })).toBeInTheDocument();
  });
});
