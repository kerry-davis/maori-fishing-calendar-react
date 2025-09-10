import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import SearchModal from '../SearchModal';
import { databaseService } from '../../../services/databaseService';
import { Trip, FishCaught } from '../../../types';

// Mock the database service
vi.mock('../../../services/databaseService', () => ({
  databaseService: {
    getAllTrips: vi.fn(),
    getAllFishCaught: vi.fn()
  }
}));

// Mock data
const mockTrips: Trip[] = [
  {
    id: 1,
    date: '2024-01-15',
    water: 'Lake Taupo',
    location: 'Western Bays',
    hours: 4,
    companions: 'John Smith',
    notes: 'Great day fishing with light winds'
  },
  {
    id: 2,
    date: '2024-01-20',
    water: 'Rotorua Lakes',
    location: 'Blue Lake',
    hours: 6,
    companions: '',
    notes: 'Solo trip, caught several rainbow trout'
  }
];

const mockFishCaught: FishCaught[] = [
  {
    id: 1,
    tripId: 1,
    species: 'Rainbow Trout',
    length: '45cm',
    weight: '2.1kg',
    time: '10:30',
    gear: ['Spinning Rod', 'Rapala Lure'],
    details: 'Beautiful rainbow caught on spinner'
  },
  {
    id: 2,
    tripId: 2,
    species: 'Brown Trout',
    length: '38cm',
    weight: '1.8kg',
    time: '14:15',
    gear: ['Fly Rod', 'Nymph'],
    details: 'Nice brown on nymph pattern'
  }
];

describe('SearchModal', () => {
  const mockOnClose = vi.fn();
  const mockOnTripSelect = vi.fn();
  const mockOnFishSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mock implementations
    vi.mocked(databaseService.getAllTrips).mockResolvedValue(mockTrips);
    vi.mocked(databaseService.getAllFishCaught).mockResolvedValue(mockFishCaught);
  });

  it('renders search modal when open', async () => {
    render(
      <SearchModal
        isOpen={true}
        onClose={mockOnClose}
        onTripSelect={mockOnTripSelect}
        onFishSelect={mockOnFishSelect}
      />
    );

    expect(screen.getByText('Search Trips & Catches')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search trips, locations, species/)).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <SearchModal
        isOpen={false}
        onClose={mockOnClose}
        onTripSelect={mockOnTripSelect}
        onFishSelect={mockOnFishSelect}
      />
    );

    expect(screen.queryByText('Search Trips & Catches')).not.toBeInTheDocument();
  });

  it('loads data when modal opens', async () => {
    render(
      <SearchModal
        isOpen={true}
        onClose={mockOnClose}
        onTripSelect={mockOnTripSelect}
        onFishSelect={mockOnFishSelect}
      />
    );

    await waitFor(() => {
      expect(databaseService.getAllTrips).toHaveBeenCalled();
      expect(databaseService.getAllFishCaught).toHaveBeenCalled();
    });
  });

  it('shows loading state while fetching data', async () => {
    // Make the database calls hang
    vi.mocked(databaseService.getAllTrips).mockImplementation(() => new Promise(() => {}));
    vi.mocked(databaseService.getAllFishCaught).mockImplementation(() => new Promise(() => {}));

    render(
      <SearchModal
        isOpen={true}
        onClose={mockOnClose}
        onTripSelect={mockOnTripSelect}
        onFishSelect={mockOnFishSelect}
      />
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows error state when data loading fails', async () => {
    vi.mocked(databaseService.getAllTrips).mockRejectedValue(new Error('Database error'));

    render(
      <SearchModal
        isOpen={true}
        onClose={mockOnClose}
        onTripSelect={mockOnTripSelect}
        onFishSelect={mockOnFishSelect}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Failed to load data for search')).toBeInTheDocument();
    });
  });

  it('shows empty state when no search query', async () => {
    render(
      <SearchModal
        isOpen={true}
        onClose={mockOnClose}
        onTripSelect={mockOnTripSelect}
        onFishSelect={mockOnFishSelect}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Enter a search term to find trips and catches')).toBeInTheDocument();
    });
  });

  it('filters and displays trip results', async () => {
    render(
      <SearchModal
        isOpen={true}
        onClose={mockOnClose}
        onTripSelect={mockOnTripSelect}
        onFishSelect={mockOnFishSelect}
      />
    );

    // Wait for data to load
    await waitFor(() => {
      expect(databaseService.getAllTrips).toHaveBeenCalled();
    });

    const searchInput = screen.getByPlaceholderText(/Search trips, locations, species/);
    fireEvent.change(searchInput, { target: { value: 'Taupo' } });

    await waitFor(() => {
      expect(screen.getByText((content, element) => {
        return element?.textContent === 'Lake Taupo - Western Bays';
      })).toBeInTheDocument();
      expect(screen.getByText('4 hours with John Smith')).toBeInTheDocument();
    });
  });

  it('filters and displays fish results', async () => {
    render(
      <SearchModal
        isOpen={true}
        onClose={mockOnClose}
        onTripSelect={mockOnTripSelect}
        onFishSelect={mockOnFishSelect}
      />
    );

    // Wait for data to load
    await waitFor(() => {
      expect(databaseService.getAllTrips).toHaveBeenCalled();
    });

    const searchInput = screen.getByPlaceholderText(/Search trips, locations, species/);
    fireEvent.change(searchInput, { target: { value: 'Rainbow' } });

    await waitFor(() => {
      expect(screen.getByText((content, element) => {
        return element?.textContent === 'Rainbow Trout - 45cm';
      })).toBeInTheDocument();
      expect(screen.getByText('2.1kg at 10:30')).toBeInTheDocument();
    });
  });

  it('shows no results message when search yields no matches', async () => {
    render(
      <SearchModal
        isOpen={true}
        onClose={mockOnClose}
        onTripSelect={mockOnTripSelect}
        onFishSelect={mockOnFishSelect}
      />
    );

    // Wait for data to load
    await waitFor(() => {
      expect(databaseService.getAllTrips).toHaveBeenCalled();
    });

    const searchInput = screen.getByPlaceholderText(/Search trips, locations, species/);
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

    await waitFor(() => {
      expect(screen.getByText('No results found for "nonexistent"')).toBeInTheDocument();
    });
  });

  it('highlights search terms in results', async () => {
    render(
      <SearchModal
        isOpen={true}
        onClose={mockOnClose}
        onTripSelect={mockOnTripSelect}
        onFishSelect={mockOnFishSelect}
      />
    );

    // Wait for data to load
    await waitFor(() => {
      expect(databaseService.getAllTrips).toHaveBeenCalled();
    });

    const searchInput = screen.getByPlaceholderText(/Search trips, locations, species/);
    fireEvent.change(searchInput, { target: { value: 'Taupo' } });

    await waitFor(() => {
      const highlightedText = screen.getByText('Taupo');
      expect(highlightedText.tagName).toBe('MARK');
    });
  });

  it('calls onTripSelect when trip result is clicked', async () => {
    render(
      <SearchModal
        isOpen={true}
        onClose={mockOnClose}
        onTripSelect={mockOnTripSelect}
        onFishSelect={mockOnFishSelect}
      />
    );

    // Wait for data to load
    await waitFor(() => {
      expect(databaseService.getAllTrips).toHaveBeenCalled();
    });

    const searchInput = screen.getByPlaceholderText(/Search trips, locations, species/);
    fireEvent.change(searchInput, { target: { value: 'Taupo' } });

    await waitFor(() => {
      const tripResult = screen.getByText((content, element) => {
        return element?.textContent === 'Lake Taupo - Western Bays';
      });
      fireEvent.click(tripResult.closest('div[class*="cursor-pointer"]') || tripResult);
    });

    expect(mockOnTripSelect).toHaveBeenCalledWith(1);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('calls onFishSelect when fish result is clicked', async () => {
    render(
      <SearchModal
        isOpen={true}
        onClose={mockOnClose}
        onTripSelect={mockOnTripSelect}
        onFishSelect={mockOnFishSelect}
      />
    );

    // Wait for data to load
    await waitFor(() => {
      expect(databaseService.getAllTrips).toHaveBeenCalled();
    });

    const searchInput = screen.getByPlaceholderText(/Search trips, locations, species/);
    fireEvent.change(searchInput, { target: { value: 'Rainbow' } });

    await waitFor(() => {
      const fishResult = screen.getByText((content, element) => {
        return element?.textContent === 'Rainbow Trout - 45cm';
      });
      fireEvent.click(fishResult.closest('div[class*="cursor-pointer"]') || fishResult);
    });

    expect(mockOnFishSelect).toHaveBeenCalledWith(1, 1);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('clears search input when clear button is clicked', async () => {
    render(
      <SearchModal
        isOpen={true}
        onClose={mockOnClose}
        onTripSelect={mockOnTripSelect}
        onFishSelect={mockOnFishSelect}
      />
    );

    const searchInput = screen.getByPlaceholderText(/Search trips, locations, species/) as HTMLInputElement;
    fireEvent.change(searchInput, { target: { value: 'test query' } });

    expect(searchInput.value).toBe('test query');

    // Wait for the clear button to appear (it only shows when there's text)
    await waitFor(() => {
      const clearButton = document.querySelector('.fa-times')?.closest('button');
      expect(clearButton).toBeInTheDocument();
    });

    const clearButton = document.querySelector('.fa-times')?.closest('button');
    if (clearButton) {
      fireEvent.click(clearButton);
      expect(searchInput.value).toBe('');
    }
  });

  it('clears search when modal is closed and reopened', async () => {
    const { rerender } = render(
      <SearchModal
        isOpen={true}
        onClose={mockOnClose}
        onTripSelect={mockOnTripSelect}
        onFishSelect={mockOnFishSelect}
      />
    );

    const searchInput = screen.getByPlaceholderText(/Search trips, locations, species/) as HTMLInputElement;
    fireEvent.change(searchInput, { target: { value: 'test query' } });

    // Close modal
    rerender(
      <SearchModal
        isOpen={false}
        onClose={mockOnClose}
        onTripSelect={mockOnTripSelect}
        onFishSelect={mockOnFishSelect}
      />
    );

    // Reopen modal
    rerender(
      <SearchModal
        isOpen={true}
        onClose={mockOnClose}
        onTripSelect={mockOnTripSelect}
        onFishSelect={mockOnFishSelect}
      />
    );

    await waitFor(() => {
      const newSearchInput = screen.getByPlaceholderText(/Search trips, locations, species/) as HTMLInputElement;
      expect(newSearchInput.value).toBe('');
    });
  });

  it('displays result count correctly', async () => {
    render(
      <SearchModal
        isOpen={true}
        onClose={mockOnClose}
        onTripSelect={mockOnTripSelect}
        onFishSelect={mockOnFishSelect}
      />
    );

    // Wait for data to load
    await waitFor(() => {
      expect(databaseService.getAllTrips).toHaveBeenCalled();
    });

    const searchInput = screen.getByPlaceholderText(/Search trips, locations, species/);
    fireEvent.change(searchInput, { target: { value: 'trout' } });

    await waitFor(() => {
      expect(screen.getByText(/Found \d+ results?/)).toBeInTheDocument();
    });
  });
});