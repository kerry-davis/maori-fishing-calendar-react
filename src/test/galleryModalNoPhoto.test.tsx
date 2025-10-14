import { describe, it, expect, vi } from 'vitest';
import { GalleryModal } from '../components/Modals/GalleryModal';
import { render, screen, within } from '@testing-library/react';
import React from 'react';
import { DatabaseContext } from '../contexts/DatabaseContext';

const mockTrips = [
  { id: 1, date: '2023-06-15', location: 'Main Bay', water: 'Lake Taupo' },
  { id: 2, date: '2023-06-16', location: 'East Bay', water: 'Lake Rotorua' },
];
const mockFishCaught = [
  // No image
  { id: '1', tripId: 1, species: 'Snapper', length: '50', weight: '2', time: '12:00' },
  // Valid image
  { id: '2', tripId: 2, species: 'Trout', length: '60', weight: '3', time: '14:00', photo: 'data:image/png;base64,abc123' },
];

const mockDbService = {
  getAllTrips: vi.fn().mockResolvedValue(mockTrips),
  getAllFishCaught: vi.fn().mockResolvedValue(mockFishCaught),
};

function renderWithDbContext(ui: React.ReactElement) {
  return render(
    <DatabaseContext.Provider value={{ db: null, isReady: true, error: null, dataReady: true, dataReadyTimestamp: Date.now() }}>
      {/* Patch useDatabaseService to return our mockDbService */}
      {ui}
    </DatabaseContext.Provider>
  );
}

describe('GalleryModal no-photo scenario', () => {
  let originalUseDatabaseService: any;

  beforeAll(() => {
    originalUseDatabaseService = require('../contexts/DatabaseContext').useDatabaseService;
    require('../contexts/DatabaseContext').useDatabaseService = () => mockDbService;
  });

  afterAll(() => {
    require('../contexts/DatabaseContext').useDatabaseService = originalUseDatabaseService;
  });

  afterEach(() => {
    // Ensure document cleanup between scenarios
    document.body.innerHTML = '';
  });

  it('shows no photos found when all catches lack images', async () => {
    // Only catches with no image
    mockDbService.getAllFishCaught.mockResolvedValueOnce([
      { id: '1', tripId: 1, species: 'Snapper', length: '50', weight: '2', time: '12:00' },
    ]);
    renderWithDbContext(
      <GalleryModal
        isOpen={true}
        onClose={() => {}}
        selectedMonth={5}
        selectedYear={2023}
      />
    );
    expect(await screen.findByText(/No photos found/i)).toBeInTheDocument();
    expect(screen.queryByAltText(/Snapper/)).toBeNull();
  });

  it('renders real image when catch has photo', async () => {
    // Only catches with image
    mockDbService.getAllFishCaught.mockResolvedValueOnce([
      { id: '2', tripId: 2, species: 'Trout', length: '60', weight: '3', time: '14:00', photo: 'data:image/png;base64,abc123' },
    ]);
    renderWithDbContext(
      <GalleryModal
        isOpen={true}
        onClose={() => {}}
        selectedMonth={5}
        selectedYear={2023}
      />
    );
    expect(await screen.findByAltText(/Trout/)).toBeInTheDocument();
    expect(screen.queryByText(/No photos found/i)).toBeNull();
  });

  it('excludes catches without image and includes those with image', async () => {
    // Mixed catches
    mockDbService.getAllFishCaught.mockResolvedValueOnce([
      { id: '1', tripId: 1, species: 'Snapper', length: '50', weight: '2', time: '12:00' },
      { id: '2', tripId: 2, species: 'Trout', length: '60', weight: '3', time: '14:00', photo: 'data:image/png;base64,abc123' },
    ]);
    renderWithDbContext(
      <GalleryModal
        isOpen={true}
        onClose={() => {}}
        selectedMonth={5}
        selectedYear={2023}
      />
    );
    expect(await screen.findByAltText(/Trout/)).toBeInTheDocument();
    expect(screen.queryByAltText(/Snapper/)).toBeNull();
  });
});
