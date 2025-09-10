import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import AnalyticsModal from '../AnalyticsModal';
import { useIndexedDB } from '../../../hooks/useIndexedDB';
import type { Trip, WeatherLog, FishCaught } from '../../../types';

// Mock the hooks
vi.mock('../../../hooks/useIndexedDB');
vi.mock('../../../services/lunarService', () => ({
  getMoonPhaseData: vi.fn(() => ({ phaseIndex: 0, moonAge: 0, illumination: 0 }))
}));

// Mock Chart.js components
vi.mock('react-chartjs-2', () => ({
  Bar: vi.fn(() => <div data-testid="bar-chart">Bar Chart</div>),
  Pie: vi.fn(() => <div data-testid="pie-chart">Pie Chart</div>)
}));

// Mock Chart.js registration
vi.mock('chart.js', () => ({
  Chart: {
    register: vi.fn()
  },
  CategoryScale: {},
  LinearScale: {},
  BarElement: {},
  ArcElement: {},
  Title: {},
  Tooltip: {},
  Legend: {}
}));

const mockUseIndexedDB = useIndexedDB as ReturnType<typeof vi.fn>;

describe('AnalyticsModal', () => {
  const mockTrips: Trip[] = [
    {
      id: 1,
      date: '2024-01-15',
      water: 'Lake Taupo',
      location: 'Taupo Bay',
      hours: 4,
      companions: 'John',
      notes: 'Great day fishing'
    },
    {
      id: 2,
      date: '2024-02-20',
      water: 'Hauraki Gulf',
      location: 'Rangitoto Island',
      hours: 6,
      companions: 'Sarah',
      notes: 'Windy conditions'
    }
  ];

  const mockWeatherLogs: WeatherLog[] = [
    {
      id: 1,
      tripId: 1,
      timeOfDay: 'AM',
      sky: 'Sunny',
      windCondition: 'Light Winds',
      windDirection: 'NE',
      waterTemp: '18',
      airTemp: '22'
    },
    {
      id: 2,
      tripId: 2,
      timeOfDay: 'PM',
      sky: 'Overcast',
      windCondition: 'Mod Winds',
      windDirection: 'SW',
      waterTemp: '16',
      airTemp: '19'
    }
  ];

  const mockFishCaught: FishCaught[] = [
    {
      id: 1,
      tripId: 1,
      species: 'Snapper',
      length: '35',
      weight: '2.5',
      time: '10:30',
      gear: ['Rod', 'Reel'],
      details: 'Nice fish'
    },
    {
      id: 2,
      tripId: 1,
      species: 'Kahawai',
      length: '28',
      weight: '1.8',
      time: '11:15',
      gear: ['Lure'],
      details: 'Good fight'
    },
    {
      id: 3,
      tripId: 2,
      species: 'Snapper',
      length: '42',
      weight: '3.2',
      time: '14:20',
      gear: ['Rod', 'Reel'],
      details: 'Personal best'
    }
  ];

  const mockDb = {
    isReady: true,
    trips: {
      getAll: vi.fn().mockResolvedValue(mockTrips)
    },
    weather: {
      getAll: vi.fn().mockResolvedValue(mockWeatherLogs)
    },
    fish: {
      getAll: vi.fn().mockResolvedValue(mockFishCaught)
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseIndexedDB.mockReturnValue(mockDb);
  });

  it('renders analytics modal when open', async () => {
    render(
      <AnalyticsModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Total Fish Caught: 0')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <AnalyticsModal
        isOpen={false}
        onClose={vi.fn()}
      />
    );

    expect(screen.queryByText('Analytics Dashboard')).not.toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    render(
      <AnalyticsModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('Loading analytics...')).toBeInTheDocument();
  });

  it('loads and displays analytics data', async () => {
    render(
      <AnalyticsModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(mockDb.trips.getAll).toHaveBeenCalled();
      expect(mockDb.weather.getAll).toHaveBeenCalled();
      expect(mockDb.fish.getAll).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText('Total Fish Caught: 3')).toBeInTheDocument();
    });

    expect(screen.getByText('Catch Breakdown')).toBeInTheDocument();
    expect(screen.getByText('Personal Bests')).toBeInTheDocument();
  });

  it('shows error when no fish data available', async () => {
    const emptyDb = {
      ...mockDb,
      fish: {
        getAll: vi.fn().mockResolvedValue([])
      }
    };
    mockUseIndexedDB.mockReturnValue(emptyDb);

    render(
      <AnalyticsModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('No fish have been logged. Analytics requires catch data to be displayed.')).toBeInTheDocument();
    });
  });

  it('handles database errors gracefully', async () => {
    const errorDb = {
      ...mockDb,
      trips: {
        getAll: vi.fn().mockRejectedValue(new Error('Database error'))
      }
    };
    mockUseIndexedDB.mockReturnValue(errorDb);

    render(
      <AnalyticsModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Failed to load analytics data. Please try again.')).toBeInTheDocument();
    });
  });

  it('displays data filters', async () => {
    render(
      <AnalyticsModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Data Filters')).toBeInTheDocument();
    });

    expect(screen.getByLabelText('Filter by Species')).toBeInTheDocument();
    expect(screen.getByLabelText('Filter by Gear Type')).toBeInTheDocument();
  });

  it('displays charts when data is available', async () => {
    render(
      <AnalyticsModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      const pieCharts = screen.getAllByTestId('pie-chart');
      expect(pieCharts.length).toBeGreaterThan(0);
    });

    // Check that charts are rendered
    const barCharts = screen.getAllByTestId('bar-chart');
    const pieCharts = screen.getAllByTestId('pie-chart');
    expect(barCharts.length).toBeGreaterThan(0);
    expect(pieCharts.length).toBeGreaterThan(0);
  });

  it('displays personal bests correctly', async () => {
    render(
      <AnalyticsModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Heaviest Fish')).toBeInTheDocument();
    });

    expect(screen.getByText('Longest Fish')).toBeInTheDocument();
    expect(screen.getByText('Most Fish in a Trip')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn();
    
    render(
      <AnalyticsModal
        isOpen={true}
        onClose={onClose}
      />
    );

    const closeButton = screen.getByRole('button', { name: /close modal/i });
    closeButton.click();

    expect(onClose).toHaveBeenCalled();
  });

  it('does not load data when modal is closed', () => {
    render(
      <AnalyticsModal
        isOpen={false}
        onClose={vi.fn()}
      />
    );

    expect(mockDb.trips.getAll).not.toHaveBeenCalled();
    expect(mockDb.weather.getAll).not.toHaveBeenCalled();
    expect(mockDb.fish.getAll).not.toHaveBeenCalled();
  });

  it('does not load data when database is not ready', () => {
    const notReadyDb = {
      ...mockDb,
      isReady: false
    };
    mockUseIndexedDB.mockReturnValue(notReadyDb);

    render(
      <AnalyticsModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    expect(mockDb.trips.getAll).not.toHaveBeenCalled();
    expect(mockDb.weather.getAll).not.toHaveBeenCalled();
    expect(mockDb.fish.getAll).not.toHaveBeenCalled();
  });
});