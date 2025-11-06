import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SettingsModal } from '@features/modals/SettingsModal';

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
  });

  it('shows empty-state guidance without add button for authenticated user with no saved locations', () => {
    render(<SettingsModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /Add Location/i })).not.toBeInTheDocument();
    expect(screen.getByText(/You haven't saved any locations yet/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save Current Location/i })).toBeDisabled();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });
});
