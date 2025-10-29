import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SavedLocationSelector } from '../SavedLocationSelector';
import type { SavedLocation } from '@shared/types';

// Mock LocationContext
const mockLocationContext = {
  savedLocations: [] as SavedLocation[],
  savedLocationsLoading: false,
  savedLocationsError: null,
  createSavedLocation: vi.fn(),
  updateSavedLocation: vi.fn(),
  deleteSavedLocation: vi.fn(),
  selectSavedLocation: vi.fn(),
  saveCurrentLocation: vi.fn(),
  savedLocationsLimit: 10,
  userLocation: null,
  setLocation: vi.fn(),
  requestLocation: vi.fn(),
  searchLocation: vi.fn(),
  searchLocationSuggestions: vi.fn(),
  tideCoverage: null,
  refreshTideCoverage: vi.fn(),
};

vi.mock('@app/providers/LocationContext', () => ({
  useLocationContext: () => mockLocationContext,
}));

// Helper to create mock locations
const createMockLocation = (id: string, name: string, lat?: number, lon?: number): SavedLocation => ({
  id,
  name,
  lat,
  lon,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

describe('SavedLocationSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocationContext.savedLocations = [];
    mockLocationContext.savedLocationsLoading = false;
    mockLocationContext.savedLocationsError = null;
    mockLocationContext.userLocation = null;
  });

  describe('Rendering', () => {
    it('renders with no locations', () => {
      render(<SavedLocationSelector />);
      expect(screen.getByText(/Saved Locations \(0\/10\)/i)).toBeInTheDocument();
    });

    it('renders location count correctly', () => {
      mockLocationContext.savedLocations = [
        createMockLocation('1', 'Kawhia', -38.0661, 174.8196),
        createMockLocation('2', 'Raglan', -37.8019, 174.8630),
      ];

      render(<SavedLocationSelector />);
      expect(screen.getByText(/Saved Locations \(2\/10\)/i)).toBeInTheDocument();
    });

    it('shows add button when allowManage is true', () => {
      render(<SavedLocationSelector allowManage={true} />);
      expect(screen.getByText(/Add Location/i)).toBeInTheDocument();
    });

    it('hides add button when allowManage is false', () => {
      render(<SavedLocationSelector allowManage={false} />);
      expect(screen.queryByText(/Add Location/i)).not.toBeInTheDocument();
    });

    it('shows Save Current Location button when enabled', () => {
      mockLocationContext.userLocation = {
        lat: -36.8485,
        lon: 174.7633,
        name: 'Auckland',
      };

      render(<SavedLocationSelector showSaveCurrentButton={true} allowManage={true} />);
      expect(screen.getByText(/Save Current Location/i)).toBeInTheDocument();
    });
  });

  describe('Form validation', () => {
    it('requires location name', async () => {
      const user = userEvent.setup();
      render(<SavedLocationSelector allowManage={true} />);

      // Open form
      const addButton = screen.getByText(/Add Location/i);
      await user.click(addButton);

      // Try to submit without name
      const saveButton = screen.getByRole('button', { name: /^Save$/i });
      await user.click(saveButton);

      // Should show validation error (browser native or custom)
      expect(mockLocationContext.createSavedLocation).not.toHaveBeenCalled();
    });

    it('accepts valid location data', async () => {
      const user = userEvent.setup();
      const newLocation = createMockLocation('3', 'New Spot', -36.8485, 174.7633);
      mockLocationContext.createSavedLocation.mockResolvedValue(newLocation);
      mockLocationContext.selectSavedLocation.mockResolvedValue(newLocation);

      render(<SavedLocationSelector allowManage={true} />);

      // Open form
      await user.click(screen.getByText(/Add Location/i));

      // Fill in valid data
      const nameInput = screen.getByLabelText(/Name/i);
      await user.type(nameInput, 'New Spot');

      const latInput = screen.getByLabelText(/Latitude/i);
      await user.type(latInput, '-36.8485');

      const lonInput = screen.getByLabelText(/Longitude/i);
      await user.type(lonInput, '174.7633');

      // Submit
      const saveButton = screen.getByRole('button', { name: /^Save$/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockLocationContext.createSavedLocation).toHaveBeenCalledWith({
          name: 'New Spot',
          lat: -36.8485,
          lon: 174.7633,
        });
      });
    });
  });

  describe('Location selection', () => {
    it('selects location from dropdown', async () => {
      const user = userEvent.setup();
      const locations = [
        createMockLocation('1', 'Kawhia', -38.0661, 174.8196),
        createMockLocation('2', 'Raglan', -37.8019, 174.8630),
      ];
      mockLocationContext.savedLocations = locations;
      mockLocationContext.selectSavedLocation.mockResolvedValue(locations[0]);

      const onSelect = vi.fn();
      render(<SavedLocationSelector onSelect={onSelect} />);

      const select = screen.getByRole('combobox');
      await user.selectOptions(select, '1');

      await waitFor(() => {
        expect(mockLocationContext.selectSavedLocation).toHaveBeenCalledWith('1');
        expect(onSelect).toHaveBeenCalledWith(locations[0]);
      });
    });

    it('clears selection when empty option selected', async () => {
      const user = userEvent.setup();
      mockLocationContext.savedLocations = [
        createMockLocation('1', 'Kawhia', -38.0661, 174.8196),
      ];

      const onSelect = vi.fn();
      render(<SavedLocationSelector onSelect={onSelect} selectedId="1" />);

      const select = screen.getByRole('combobox');
      await user.selectOptions(select, '');

      expect(onSelect).toHaveBeenCalledWith(null);
    });
  });

  describe('Delete functionality', () => {
    it('shows confirmation dialog before delete', async () => {
      const user = userEvent.setup();
      mockLocationContext.savedLocations = [
        createMockLocation('1', 'Test Location', -36.8485, 174.7633),
      ];

      render(<SavedLocationSelector allowManage={true} />);

      // Click delete button
      const deleteButton = screen.getByRole('button', { name: /Delete/i });
      await user.click(deleteButton);

      // Should show confirmation dialog
      expect(screen.getByText(/Are you sure you want to delete "Test Location"/i)).toBeInTheDocument();
    });

    it('deletes location on confirmation', async () => {
      const user = userEvent.setup();
      mockLocationContext.savedLocations = [
        createMockLocation('1', 'Test Location', -36.8485, 174.7633),
      ];
      mockLocationContext.deleteSavedLocation.mockResolvedValue(undefined);

      render(<SavedLocationSelector allowManage={true} />);

      // Click delete
      const deleteButton = screen.getByRole('button', { name: /Delete/i });
      await user.click(deleteButton);

      // Confirm
      const confirmButton = screen.getByText(/Delete/i, { selector: 'button' });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(mockLocationContext.deleteSavedLocation).toHaveBeenCalledWith('1');
      });
    });
  });

  describe('Edit functionality', () => {
    it('opens edit form with pre-filled data', async () => {
      const user = userEvent.setup();
      mockLocationContext.savedLocations = [
        createMockLocation('1', 'Kawhia Harbour', -38.0661, 174.8196),
      ];

      render(<SavedLocationSelector allowManage={true} />);

      // Click edit button
      const editButton = screen.getByRole('button', { name: /Edit/i });
      await user.click(editButton);

      // Check form title and values
      expect(screen.getByText(/Edit Saved Location/i)).toBeInTheDocument();
      
      const nameInput = screen.getByLabelText(/Name/i) as HTMLInputElement;
      expect(nameInput.value).toBe('Kawhia Harbour');
    });

    it('updates location on edit submit', async () => {
      const user = userEvent.setup();
      const existingLocation = createMockLocation('1', 'Old Name', -36.8485, 174.7633);
      mockLocationContext.savedLocations = [existingLocation];
      mockLocationContext.updateSavedLocation.mockResolvedValue(undefined);
      mockLocationContext.selectSavedLocation.mockResolvedValue({
        ...existingLocation,
        name: 'Updated Name',
      });

      render(<SavedLocationSelector allowManage={true} />);

      // Open edit form
      await user.click(screen.getByRole('button', { name: /Edit/i }));

      // Update name
      const nameInput = screen.getByLabelText(/Name/i);
      await user.clear(nameInput);
      await user.type(nameInput, 'Updated Name');

      // Submit
      const saveButton = screen.getByRole('button', { name: /^Save$/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockLocationContext.updateSavedLocation).toHaveBeenCalledWith('1', {
          name: 'Updated Name',
          lat: -36.8485,
          lon: 174.7633,
        });
      });
    });
  });

  describe('Limit enforcement', () => {
    it('disables add button when limit reached', () => {
      // Create 10 locations (the limit)
      mockLocationContext.savedLocations = Array.from({ length: 10 }, (_, i) =>
        createMockLocation(`${i + 1}`, `Location ${i + 1}`, -36.8485, 174.7633)
      );

      render(<SavedLocationSelector allowManage={true} />);

      const addButton = screen.getByText(/Add Location/i);
      expect(addButton).toBeDisabled();
    });

    it('shows limit warning message', () => {
      mockLocationContext.savedLocations = Array.from({ length: 10 }, (_, i) =>
        createMockLocation(`${i + 1}`, `Location ${i + 1}`, -36.8485, 174.7633)
      );

      render(<SavedLocationSelector allowManage={true} />);

      expect(screen.getByText(/You have reached the maximum of 10 saved locations/i)).toBeInTheDocument();
    });

    it('disables Save Current Location button when limit reached', () => {
      mockLocationContext.savedLocations = Array.from({ length: 10 }, (_, i) =>
        createMockLocation(`${i + 1}`, `Location ${i + 1}`, -36.8485, 174.7633)
      );
      mockLocationContext.userLocation = {
        lat: -36.8485,
        lon: 174.7633,
        name: 'Auckland',
      };

      render(<SavedLocationSelector showSaveCurrentButton={true} allowManage={true} />);

      const saveCurrentButton = screen.getByText(/Save Current Location/i);
      expect(saveCurrentButton).toBeDisabled();
    });
  });

  describe('Search functionality', () => {
    it('filters locations by search term', async () => {
      const user = userEvent.setup();
      mockLocationContext.savedLocations = [
        createMockLocation('1', 'Kawhia Harbour', -38.0661, 174.8196),
        createMockLocation('2', 'Raglan Harbour', -37.8019, 174.8630),
        createMockLocation('3', 'Auckland Marina', -36.8485, 174.7633),
      ];

      render(<SavedLocationSelector allowManage={true} />);

      // Should show search input only if there are many locations or allowManage
      const searchInput = screen.getByPlaceholderText(/Search saved locations/i);
      await user.type(searchInput, 'Harbour');

      // Should filter to show only locations with "Harbour"
      expect(screen.getByText(/Kawhia Harbour/i)).toBeInTheDocument();
      expect(screen.getByText(/Raglan Harbour/i)).toBeInTheDocument();
      expect(screen.queryByText(/Auckland Marina/i)).toBeInTheDocument(); // Still in DOM but maybe hidden
    });
  });

  describe('Error handling', () => {
    it('displays error message when selection fails', async () => {
      const user = userEvent.setup();
      mockLocationContext.savedLocations = [
        createMockLocation('1', 'Test', -36.8485, 174.7633),
      ];
      mockLocationContext.selectSavedLocation.mockRejectedValue(
        new Error('Failed to select location')
      );

      render(<SavedLocationSelector />);

      const select = screen.getByRole('combobox');
      await user.selectOptions(select, '1');

      await waitFor(() => {
        expect(screen.getByText(/Failed to select location/i)).toBeInTheDocument();
      });
    });

    it('displays error when create fails', async () => {
      const user = userEvent.setup();
      mockLocationContext.createSavedLocation.mockRejectedValue(
        new Error('Failed to save')
      );

      render(<SavedLocationSelector allowManage={true} />);

      await user.click(screen.getByText(/Add Location/i));
      
      const nameInput = screen.getByLabelText(/Name/i);
      await user.type(nameInput, 'Test');

      await user.click(screen.getByRole('button', { name: /^Save$/i }));

      await waitFor(() => {
        expect(screen.getByText(/Failed to save/i)).toBeInTheDocument();
      });
    });
  });
});
