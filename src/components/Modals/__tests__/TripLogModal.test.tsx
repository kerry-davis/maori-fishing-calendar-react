import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import TripLogModal from '../TripLogModal';
import { Trip } from '../../../types';

// Mock the useIndexedDB hook
const mockTripsOperations = {
  getByDate: vi.fn(),
  delete: vi.fn()
};

vi.mock('../../../hooks/useIndexedDB', () => ({
  useIndexedDB: () => ({
    isReady: true,
    trips: mockTripsOperations
  })
}));

// Mock FontAwesome icons
vi.mock('@fortawesome/react-fontawesome', () => ({
  FontAwesomeIcon: ({ icon }: { icon: any }) => <i data-testid={`icon-${icon.iconName}`} />
}));

const mockTrips: Trip[] = [
  {
    id: 1,
    date: '2024-01-15',
    water: 'Lake Taupo',
    location: 'Western Bays',
    hours: 4,
    companions: 'John, Sarah',
    notes: 'Great day on the water'
  },
  {
    id: 2,
    date: '2024-01-15',
    water: 'Waikato River',
    location: 'Hamilton Gardens',
    hours: 2,
    companions: '',
    notes: ''
  }
];

describe('TripLogModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    selectedDate: new Date('2024-01-15'),
    onEditTrip: vi.fn(),
    onNewTrip: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockTripsOperations.getByDate.mockResolvedValue(mockTrips);
  });

  it('renders modal with correct title and date', async () => {
    render(<TripLogModal {...defaultProps} />);
    
    expect(screen.getByText('Trip Log')).toBeInTheDocument();
    expect(screen.getByText(/Monday, 15 January 2024/)).toBeInTheDocument();
  });

  it('displays loading state initially', () => {
    render(<TripLogModal {...defaultProps} />);
    
    expect(screen.getByText('Loading trips...')).toBeInTheDocument();
  });

  it('displays trips after loading', async () => {
    render(<TripLogModal {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Lake Taupo')).toBeInTheDocument();
      expect(screen.getByText('Waikato River')).toBeInTheDocument();
    });

    expect(screen.getByText('Western Bays')).toBeInTheDocument();
    expect(screen.getByText('Hamilton Gardens')).toBeInTheDocument();
    expect(screen.getByText('4 hours')).toBeInTheDocument();
    expect(screen.getByText('2 hours')).toBeInTheDocument();
  });

  it('displays companions when present', async () => {
    render(<TripLogModal {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('John, Sarah')).toBeInTheDocument();
    });
  });

  it('displays notes when present', async () => {
    render(<TripLogModal {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Great day on the water')).toBeInTheDocument();
    });
  });

  it('displays no trips message when no trips exist', async () => {
    mockTripsOperations.getByDate.mockResolvedValue([]);
    
    render(<TripLogModal {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('No trips logged for this date')).toBeInTheDocument();
    });
  });

  it('calls onNewTrip when New Trip button is clicked', async () => {
    render(<TripLogModal {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Lake Taupo')).toBeInTheDocument();
    });

    const newTripButton = screen.getByText('New Trip');
    fireEvent.click(newTripButton);
    
    expect(defaultProps.onNewTrip).toHaveBeenCalledTimes(1);
  });

  it('calls onEditTrip when edit button is clicked', async () => {
    render(<TripLogModal {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Lake Taupo')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByTitle('Edit trip');
    fireEvent.click(editButtons[0]);
    
    expect(defaultProps.onEditTrip).toHaveBeenCalledWith(1);
  });

  it('shows confirmation dialog when delete button is clicked', async () => {
    // Mock window.confirm
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    
    render(<TripLogModal {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Lake Taupo')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTitle('Delete trip');
    fireEvent.click(deleteButtons[0]);
    
    expect(confirmSpy).toHaveBeenCalledWith(
      'Are you sure you want to delete this trip? This will also delete all associated weather logs and fish catches.'
    );
    
    confirmSpy.mockRestore();
  });

  it('deletes trip when confirmed', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    mockTripsOperations.delete.mockResolvedValue(undefined);
    
    render(<TripLogModal {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Lake Taupo')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTitle('Delete trip');
    fireEvent.click(deleteButtons[0]);
    
    await waitFor(() => {
      expect(mockTripsOperations.delete).toHaveBeenCalledWith(1);
    });
    
    confirmSpy.mockRestore();
  });

  it('does not delete trip when cancelled', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    
    render(<TripLogModal {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Lake Taupo')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTitle('Delete trip');
    fireEvent.click(deleteButtons[0]);
    
    expect(mockTripsOperations.delete).not.toHaveBeenCalled();
    
    confirmSpy.mockRestore();
  });

  it('calls onClose when close button is clicked', async () => {
    render(<TripLogModal {...defaultProps} />);
    
    const closeButton = screen.getByText('Close');
    fireEvent.click(closeButton);
    
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('handles database errors gracefully', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockTripsOperations.getByDate.mockRejectedValue(new Error('Database error'));
    
    render(<TripLogModal {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Failed to load trips. Please try again.')).toBeInTheDocument();
    });
    
    consoleErrorSpy.mockRestore();
  });

  it('formats single hour correctly', async () => {
    const singleHourTrip: Trip[] = [{
      id: 3,
      date: '2024-01-15',
      water: 'Test Lake',
      location: 'Test Location',
      hours: 1,
      companions: '',
      notes: ''
    }];
    
    mockTripsOperations.getByDate.mockResolvedValue(singleHourTrip);
    
    render(<TripLogModal {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('1 hour')).toBeInTheDocument();
    });
  });

  it('does not render when modal is closed', () => {
    render(<TripLogModal {...defaultProps} isOpen={false} />);
    
    expect(screen.queryByText('Trip Log')).not.toBeInTheDocument();
  });
});