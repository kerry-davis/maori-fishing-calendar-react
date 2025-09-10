import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import TripDetailsModal from '../TripDetailsModal';
import { Trip } from '../../../types';

// Mock the useIndexedDB hook
const mockTripsOperations = {
  getById: vi.fn(),
  create: vi.fn(),
  update: vi.fn()
};

vi.mock('../../../hooks/useIndexedDB', () => ({
  useIndexedDB: () => ({
    isReady: true,
    trips: mockTripsOperations
  })
}));

const mockTrip: Trip = {
  id: 1,
  date: '2024-01-15',
  water: 'Lake Taupo',
  location: 'Western Bays',
  hours: 4,
  companions: 'John, Sarah',
  notes: 'Great day on the water'
};

describe('TripDetailsModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    selectedDate: new Date('2024-01-15')
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('New Trip Mode', () => {
    it('renders modal with correct title for new trip', () => {
      render(<TripDetailsModal {...defaultProps} />);
      
      expect(screen.getByText('New Trip')).toBeInTheDocument();
      expect(screen.getByText('Log a new fishing trip')).toBeInTheDocument();
    });

    it('initializes form with selected date', () => {
      render(<TripDetailsModal {...defaultProps} />);
      
      const dateInput = screen.getByLabelText('Date *') as HTMLInputElement;
      expect(dateInput.value).toBe('2024-01-15');
    });

    it('creates new trip when form is submitted', async () => {
      mockTripsOperations.create.mockResolvedValue(1);
      
      render(<TripDetailsModal {...defaultProps} />);
      
      // Fill out form
      fireEvent.change(screen.getByLabelText('Water Body *'), {
        target: { value: 'Lake Taupo' }
      });
      fireEvent.change(screen.getByLabelText('Specific Location *'), {
        target: { value: 'Western Bays' }
      });
      fireEvent.change(screen.getByLabelText('Duration (hours) *'), {
        target: { value: '4' }
      });
      
      // Submit form
      fireEvent.click(screen.getByText('Create Trip'));
      
      await waitFor(() => {
        expect(mockTripsOperations.create).toHaveBeenCalledWith({
          date: '2024-01-15',
          water: 'Lake Taupo',
          location: 'Western Bays',
          hours: 4,
          companions: '',
          notes: ''
        });
      });
      
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  describe('Edit Trip Mode', () => {
    const editProps = {
      ...defaultProps,
      tripId: 1
    };

    it('renders modal with correct title for editing', async () => {
      mockTripsOperations.getById.mockResolvedValue(mockTrip);
      
      render(<TripDetailsModal {...editProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Edit Trip')).toBeInTheDocument();
        expect(screen.getByText('Update trip details')).toBeInTheDocument();
      });
    });

    it('loads existing trip data', async () => {
      mockTripsOperations.getById.mockResolvedValue(mockTrip);
      
      render(<TripDetailsModal {...editProps} />);
      
      await waitFor(() => {
        expect(mockTripsOperations.getById).toHaveBeenCalledWith(1);
      });

      await waitFor(() => {
        const waterInput = screen.getByLabelText('Water Body *') as HTMLInputElement;
        const locationInput = screen.getByLabelText('Specific Location *') as HTMLInputElement;
        const hoursInput = screen.getByLabelText('Duration (hours) *') as HTMLInputElement;
        const companionsInput = screen.getByLabelText('Companions') as HTMLInputElement;
        const notesInput = screen.getByLabelText('Notes') as HTMLTextAreaElement;
        
        expect(waterInput.value).toBe('Lake Taupo');
        expect(locationInput.value).toBe('Western Bays');
        expect(hoursInput.value).toBe('4');
        expect(companionsInput.value).toBe('John, Sarah');
        expect(notesInput.value).toBe('Great day on the water');
      });
    });

    it('updates existing trip when form is submitted', async () => {
      mockTripsOperations.getById.mockResolvedValue(mockTrip);
      mockTripsOperations.update.mockResolvedValue(undefined);
      
      render(<TripDetailsModal {...editProps} />);
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('Lake Taupo')).toBeInTheDocument();
      });
      
      // Modify form
      fireEvent.change(screen.getByLabelText('Water Body *'), {
        target: { value: 'Lake Rotorua' }
      });
      
      // Submit form
      fireEvent.click(screen.getByText('Update Trip'));
      
      await waitFor(() => {
        expect(mockTripsOperations.update).toHaveBeenCalledWith({
          id: 1,
          date: '2024-01-15',
          water: 'Lake Rotorua',
          location: 'Western Bays',
          hours: 4,
          companions: 'John, Sarah',
          notes: 'Great day on the water'
        });
      });
      
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('handles trip not found error', async () => {
      mockTripsOperations.getById.mockResolvedValue(null);
      
      render(<TripDetailsModal {...editProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Trip not found')).toBeInTheDocument();
      });
    });
  });

  describe('Form Validation', () => {
    it('shows validation errors for required fields', async () => {
      render(<TripDetailsModal {...defaultProps} />);
      
      // Submit form without filling required fields
      fireEvent.click(screen.getByText('Create Trip'));
      
      await waitFor(() => {
        expect(screen.getByText('Water body is required')).toBeInTheDocument();
        expect(screen.getByText('Location is required')).toBeInTheDocument();
      });
      
      expect(mockTripsOperations.create).not.toHaveBeenCalled();
    });

    it('validates hours range', async () => {
      render(<TripDetailsModal {...defaultProps} />);
      
      // Set invalid hours
      fireEvent.change(screen.getByLabelText('Duration (hours) *'), {
        target: { value: '25' }
      });
      
      // Fill other required fields
      fireEvent.change(screen.getByLabelText('Water Body *'), {
        target: { value: 'Lake Taupo' }
      });
      fireEvent.change(screen.getByLabelText('Specific Location *'), {
        target: { value: 'Western Bays' }
      });
      
      // Submit form
      fireEvent.click(screen.getByText('Create Trip'));
      
      await waitFor(() => {
        expect(screen.getByText('Hours must be between 0.5 and 24')).toBeInTheDocument();
      });
      
      expect(mockTripsOperations.create).not.toHaveBeenCalled();
    });

    it('clears validation errors when fields are corrected', async () => {
      render(<TripDetailsModal {...defaultProps} />);
      
      // Submit form to trigger validation errors
      fireEvent.click(screen.getByText('Create Trip'));
      
      await waitFor(() => {
        expect(screen.getByText('Water body is required')).toBeInTheDocument();
      });
      
      // Fix the water field
      fireEvent.change(screen.getByLabelText('Water Body *'), {
        target: { value: 'Lake Taupo' }
      });
      
      // Error should be cleared
      expect(screen.queryByText('Water body is required')).not.toBeInTheDocument();
    });
  });

  describe('Form Interactions', () => {
    it('handles input changes correctly', () => {
      render(<TripDetailsModal {...defaultProps} />);
      
      const waterInput = screen.getByLabelText('Water Body *') as HTMLInputElement;
      const locationInput = screen.getByLabelText('Specific Location *') as HTMLInputElement;
      const companionsInput = screen.getByLabelText('Companions') as HTMLInputElement;
      const notesInput = screen.getByLabelText('Notes') as HTMLTextAreaElement;
      
      fireEvent.change(waterInput, { target: { value: 'Lake Taupo' } });
      fireEvent.change(locationInput, { target: { value: 'Western Bays' } });
      fireEvent.change(companionsInput, { target: { value: 'John' } });
      fireEvent.change(notesInput, { target: { value: 'Great fishing' } });
      
      expect(waterInput.value).toBe('Lake Taupo');
      expect(locationInput.value).toBe('Western Bays');
      expect(companionsInput.value).toBe('John');
      expect(notesInput.value).toBe('Great fishing');
    });

    it('handles hours input with decimal values', () => {
      render(<TripDetailsModal {...defaultProps} />);
      
      const hoursInput = screen.getByLabelText('Duration (hours) *') as HTMLInputElement;
      
      fireEvent.change(hoursInput, { target: { value: '2.5' } });
      
      expect(hoursInput.value).toBe('2.5');
    });
  });

  describe('Error Handling', () => {
    it('handles database errors during creation', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockTripsOperations.create.mockRejectedValue(new Error('Database error'));
      
      render(<TripDetailsModal {...defaultProps} />);
      
      // Fill out form
      fireEvent.change(screen.getByLabelText('Water Body *'), {
        target: { value: 'Lake Taupo' }
      });
      fireEvent.change(screen.getByLabelText('Specific Location *'), {
        target: { value: 'Western Bays' }
      });
      
      // Submit form
      fireEvent.click(screen.getByText('Create Trip'));
      
      await waitFor(() => {
        expect(screen.getByText('Failed to save trip. Please try again.')).toBeInTheDocument();
      });
      
      consoleErrorSpy.mockRestore();
    });

    it('handles database errors during loading', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockTripsOperations.getById.mockRejectedValue(new Error('Database error'));
      
      render(<TripDetailsModal {...defaultProps} tripId={1} />);
      
      await waitFor(() => {
        expect(screen.getByText('Failed to load trip data')).toBeInTheDocument();
      });
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Modal Controls', () => {
    it('calls onClose when cancel button is clicked', () => {
      render(<TripDetailsModal {...defaultProps} />);
      
      fireEvent.click(screen.getByText('Cancel'));
      
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('calls onClose when close button is clicked', () => {
      render(<TripDetailsModal {...defaultProps} />);
      
      const closeButton = screen.getByLabelText('Close modal');
      fireEvent.click(closeButton);
      
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('disables buttons during saving', async () => {
      mockTripsOperations.create.mockImplementation(() => new Promise(() => {})); // Never resolves
      
      render(<TripDetailsModal {...defaultProps} />);
      
      // Fill out form
      fireEvent.change(screen.getByLabelText('Water Body *'), {
        target: { value: 'Lake Taupo' }
      });
      fireEvent.change(screen.getByLabelText('Specific Location *'), {
        target: { value: 'Western Bays' }
      });
      
      // Submit form
      fireEvent.click(screen.getByText('Create Trip'));
      
      await waitFor(() => {
        const cancelButton = screen.getByText('Cancel');
        const submitButton = screen.getByText('Create Trip');
        
        expect(cancelButton).toBeDisabled();
        expect(submitButton).toBeDisabled();
      });
    });

    it('does not render when modal is closed', () => {
      render(<TripDetailsModal {...defaultProps} isOpen={false} />);
      
      expect(screen.queryByText('New Trip')).not.toBeInTheDocument();
    });
  });

  describe('Placeholder Sections', () => {
    it('displays weather and fish catch placeholder sections', () => {
      render(<TripDetailsModal {...defaultProps} />);
      
      expect(screen.getByText('Weather Conditions')).toBeInTheDocument();
      expect(screen.getByText('Fish Caught')).toBeInTheDocument();
      expect(screen.getByText('Weather logging will be available in a future update')).toBeInTheDocument();
      expect(screen.getByText('Fish catch logging will be available in a future update')).toBeInTheDocument();
    });
  });
});