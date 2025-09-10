import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import FishCaughtForm from '../FishCaughtForm';
import { FishCaught } from '../../../types';

const mockFishCaught: FishCaught = {
  id: 1,
  tripId: 1,
  species: 'Trout',
  length: '35',
  weight: '1.5',
  time: '14:30',
  gear: ['Spinning Rod', 'Soft Bait'],
  details: 'Beautiful rainbow trout',
  photo: undefined
};

describe('FishCaughtForm', () => {
  const defaultProps = {
    tripId: 1,
    onSave: vi.fn(),
    onCancel: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('New Fish Catch Mode', () => {
    it('renders form with default values', () => {
      render(<FishCaughtForm {...defaultProps} />);
      
      expect(screen.getByLabelText('Species *')).toHaveValue('');
      expect(screen.getByLabelText('Length (cm)')).toHaveValue(null);
      expect(screen.getByLabelText('Weight (kg)')).toHaveValue(null);
      expect(screen.getByLabelText('Time Caught')).toHaveValue('');
      expect(screen.getByText('Save Catch')).toBeInTheDocument();
    });

    it('creates new fish catch when form is submitted', async () => {
      render(<FishCaughtForm {...defaultProps} />);
      
      // Fill out form
      fireEvent.change(screen.getByLabelText('Species *'), {
        target: { value: 'Snapper' }
      });
      fireEvent.change(screen.getByLabelText('Length (cm)'), {
        target: { value: '40' }
      });
      fireEvent.change(screen.getByLabelText('Weight (kg)'), {
        target: { value: '2.1' }
      });
      fireEvent.change(screen.getByLabelText('Time Caught'), {
        target: { value: '15:45' }
      });
      
      // Submit form
      fireEvent.click(screen.getByText('Save Catch'));
      
      await waitFor(() => {
        expect(defaultProps.onSave).toHaveBeenCalledWith({
          tripId: 1,
          species: 'Snapper',
          length: '40',
          weight: '2.1',
          time: '15:45',
          gear: [],
          details: '',
          photo: undefined
        });
      });
    });

    it('allows quick species selection', () => {
      render(<FishCaughtForm {...defaultProps} />);
      
      // Click on a quick species button
      fireEvent.click(screen.getByText('Trout'));
      
      expect(screen.getByLabelText('Species *')).toHaveValue('Trout');
    });
  });

  describe('Edit Fish Catch Mode', () => {
    const editProps = {
      ...defaultProps,
      fishCaught: mockFishCaught
    };

    it('loads existing fish catch data', () => {
      render(<FishCaughtForm {...editProps} />);
      
      expect(screen.getByLabelText('Species *')).toHaveValue('Trout');
      expect(screen.getByLabelText('Length (cm)')).toHaveValue(35);
      expect(screen.getByLabelText('Weight (kg)')).toHaveValue(1.5);
      expect(screen.getByLabelText('Time Caught')).toHaveValue('14:30');
      expect(screen.getByDisplayValue('Beautiful rainbow trout')).toBeInTheDocument();
      expect(screen.getByText('Update Catch')).toBeInTheDocument();
    });

    it('loads existing gear selection', () => {
      render(<FishCaughtForm {...editProps} />);
      
      // Check that gear checkboxes are selected
      const spinningRodCheckbox = screen.getByLabelText('Spinning Rod');
      const softBaitCheckbox = screen.getByLabelText('Soft Bait');
      
      expect(spinningRodCheckbox).toBeChecked();
      expect(softBaitCheckbox).toBeChecked();
    });

    it('updates existing fish catch when form is submitted', async () => {
      render(<FishCaughtForm {...editProps} />);
      
      // Modify form
      fireEvent.change(screen.getByLabelText('Species *'), {
        target: { value: 'Brown Trout' }
      });
      
      // Submit form
      fireEvent.click(screen.getByText('Update Catch'));
      
      await waitFor(() => {
        expect(defaultProps.onSave).toHaveBeenCalledWith({
          tripId: 1,
          species: 'Brown Trout',
          length: '35',
          weight: '1.5',
          time: '14:30',
          gear: ['Spinning Rod', 'Soft Bait'],
          details: 'Beautiful rainbow trout',
          photo: undefined
        });
      });
    });
  });

  describe('Form Validation', () => {
    it('shows validation error for required species field', async () => {
      render(<FishCaughtForm {...defaultProps} />);
      
      // Submit form without filling species
      fireEvent.click(screen.getByText('Save Catch'));
      
      await waitFor(() => {
        expect(screen.getByText('Species is required')).toBeInTheDocument();
      });
      
      expect(defaultProps.onSave).not.toHaveBeenCalled();
    });

    it('validates length as positive number', async () => {
      render(<FishCaughtForm {...defaultProps} />);
      
      // Fill species and invalid length
      fireEvent.change(screen.getByLabelText('Species *'), {
        target: { value: 'Trout' }
      });
      fireEvent.change(screen.getByLabelText('Length (cm)'), {
        target: { value: '-5' }
      });
      
      // Submit form
      fireEvent.click(screen.getByText('Save Catch'));
      
      await waitFor(() => {
        expect(screen.getByText('Length must be a positive number')).toBeInTheDocument();
      });
      
      expect(defaultProps.onSave).not.toHaveBeenCalled();
    });

    it('validates weight as positive number', async () => {
      render(<FishCaughtForm {...defaultProps} />);
      
      // Fill species and invalid weight
      fireEvent.change(screen.getByLabelText('Species *'), {
        target: { value: 'Trout' }
      });
      fireEvent.change(screen.getByLabelText('Weight (kg)'), {
        target: { value: '0' }
      });
      
      // Submit form
      fireEvent.click(screen.getByText('Save Catch'));
      
      await waitFor(() => {
        expect(screen.getByText('Weight must be a positive number')).toBeInTheDocument();
      });
      
      expect(defaultProps.onSave).not.toHaveBeenCalled();
    });

    it('accepts valid time format', async () => {
      render(<FishCaughtForm {...defaultProps} />);
      
      // Fill species and valid time
      fireEvent.change(screen.getByLabelText('Species *'), {
        target: { value: 'Trout' }
      });
      fireEvent.change(screen.getByLabelText('Time Caught'), {
        target: { value: '14:30' }
      });
      
      // Submit form
      fireEvent.click(screen.getByText('Save Catch'));
      
      await waitFor(() => {
        expect(defaultProps.onSave).toHaveBeenCalledWith(
          expect.objectContaining({
            time: '14:30'
          })
        );
      });
    });

    it('allows empty optional fields', async () => {
      render(<FishCaughtForm {...defaultProps} />);
      
      // Fill only required field
      fireEvent.change(screen.getByLabelText('Species *'), {
        target: { value: 'Trout' }
      });
      
      // Submit form
      fireEvent.click(screen.getByText('Save Catch'));
      
      await waitFor(() => {
        expect(defaultProps.onSave).toHaveBeenCalledWith({
          tripId: 1,
          species: 'Trout',
          length: '',
          weight: '',
          time: '',
          gear: [],
          details: '',
          photo: undefined
        });
      });
    });

    it('clears validation errors when fields are corrected', async () => {
      render(<FishCaughtForm {...defaultProps} />);
      
      // Submit form to trigger validation error
      fireEvent.click(screen.getByText('Save Catch'));
      
      await waitFor(() => {
        expect(screen.getByText('Species is required')).toBeInTheDocument();
      });
      
      // Fix the species field
      fireEvent.change(screen.getByLabelText('Species *'), {
        target: { value: 'Trout' }
      });
      
      // Error should be cleared
      expect(screen.queryByText('Species is required')).not.toBeInTheDocument();
    });
  });

  describe('Gear Selection', () => {
    it('handles gear checkbox selection', () => {
      render(<FishCaughtForm {...defaultProps} />);
      
      const spinningRodCheckbox = screen.getByLabelText('Spinning Rod');
      const softBaitCheckbox = screen.getByLabelText('Soft Bait');
      
      // Initially unchecked
      expect(spinningRodCheckbox).not.toBeChecked();
      expect(softBaitCheckbox).not.toBeChecked();
      
      // Check gear
      fireEvent.click(spinningRodCheckbox);
      fireEvent.click(softBaitCheckbox);
      
      expect(spinningRodCheckbox).toBeChecked();
      expect(softBaitCheckbox).toBeChecked();
    });

    it('handles gear deselection', () => {
      render(<FishCaughtForm {...defaultProps} />);
      
      const spinningRodCheckbox = screen.getByLabelText('Spinning Rod');
      
      // Check then uncheck
      fireEvent.click(spinningRodCheckbox);
      expect(spinningRodCheckbox).toBeChecked();
      
      fireEvent.click(spinningRodCheckbox);
      expect(spinningRodCheckbox).not.toBeChecked();
    });

    it('includes selected gear in form submission', async () => {
      render(<FishCaughtForm {...defaultProps} />);
      
      // Fill species and select gear
      fireEvent.change(screen.getByLabelText('Species *'), {
        target: { value: 'Trout' }
      });
      fireEvent.click(screen.getByLabelText('Spinning Rod'));
      fireEvent.click(screen.getByLabelText('Fly'));
      
      // Submit form
      fireEvent.click(screen.getByText('Save Catch'));
      
      await waitFor(() => {
        expect(defaultProps.onSave).toHaveBeenCalledWith(
          expect.objectContaining({
            gear: ['Spinning Rod', 'Fly']
          })
        );
      });
    });
  });

  describe('Form Controls', () => {
    it('calls onCancel when cancel button is clicked', () => {
      render(<FishCaughtForm {...defaultProps} />);
      
      fireEvent.click(screen.getByText('Cancel'));
      
      expect(defaultProps.onCancel).toHaveBeenCalled();
    });

    it('disables buttons during saving', async () => {
      const onSave = vi.fn().mockImplementation(() => new Promise(() => {})); // Never resolves
      
      render(<FishCaughtForm {...defaultProps} onSave={onSave} />);
      
      // Fill species and submit
      fireEvent.change(screen.getByLabelText('Species *'), {
        target: { value: 'Trout' }
      });
      fireEvent.click(screen.getByText('Save Catch'));
      
      await waitFor(() => {
        const cancelButton = screen.getByText('Cancel');
        const submitButton = screen.getByText('Save Catch');
        
        expect(cancelButton).toBeDisabled();
        expect(submitButton).toBeDisabled();
      });
    });

    it('disables buttons when isLoading prop is true', () => {
      render(<FishCaughtForm {...defaultProps} isLoading={true} />);
      
      const cancelButton = screen.getByText('Cancel');
      const submitButton = screen.getByText('Save Catch');
      
      expect(cancelButton).toBeDisabled();
      expect(submitButton).toBeDisabled();
    });
  });

  describe('Placeholder Features', () => {
    it('displays gear selection placeholder note', () => {
      render(<FishCaughtForm {...defaultProps} />);
      
      expect(screen.getByText('Note: Gear selection will be integrated with tackle box in a future update')).toBeInTheDocument();
    });

    it('displays photo upload placeholder', () => {
      render(<FishCaughtForm {...defaultProps} />);
      
      expect(screen.getByText('Photo upload functionality will be available in a future update')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('handles save errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const onSave = vi.fn().mockRejectedValue(new Error('Save failed'));
      
      render(<FishCaughtForm {...defaultProps} onSave={onSave} />);
      
      // Fill species and submit
      fireEvent.change(screen.getByLabelText('Species *'), {
        target: { value: 'Trout' }
      });
      fireEvent.click(screen.getByText('Save Catch'));
      
      await waitFor(() => {
        expect(onSave).toHaveBeenCalled();
      });
      
      // Should not crash and should re-enable buttons
      await waitFor(() => {
        const submitButton = screen.getByText('Save Catch');
        expect(submitButton).not.toBeDisabled();
      });
      
      consoleErrorSpy.mockRestore();
    });
  });
});