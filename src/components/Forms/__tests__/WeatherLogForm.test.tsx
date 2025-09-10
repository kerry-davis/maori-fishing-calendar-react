import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import WeatherLogForm from '../WeatherLogForm';
import { WeatherLog } from '../../../types';

const mockWeatherLog: WeatherLog = {
  id: 1,
  tripId: 1,
  timeOfDay: 'Morning',
  sky: 'Clear',
  windCondition: 'Light Breeze',
  windDirection: 'North',
  waterTemp: '15',
  airTemp: '18'
};

describe('WeatherLogForm', () => {
  const defaultProps = {
    tripId: 1,
    onSave: vi.fn(),
    onCancel: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('New Weather Log Mode', () => {
    it('renders form with default values', () => {
      render(<WeatherLogForm {...defaultProps} />);
      
      expect(screen.getByLabelText('Time of Day')).toHaveValue('Morning');
      expect(screen.getByLabelText('Sky Conditions')).toHaveValue('Clear');
      expect(screen.getByLabelText('Wind Condition')).toHaveValue('Calm');
      expect(screen.getByLabelText('Wind Direction')).toHaveValue('North');
      expect(screen.getByText('Save Weather')).toBeInTheDocument();
    });

    it('creates new weather log when form is submitted', async () => {
      render(<WeatherLogForm {...defaultProps} />);
      
      // Fill out form
      fireEvent.change(screen.getByLabelText('Time of Day'), {
        target: { value: 'Afternoon' }
      });
      fireEvent.change(screen.getByLabelText('Sky Conditions'), {
        target: { value: 'Partly Cloudy' }
      });
      fireEvent.change(screen.getByLabelText('Air Temperature (°C)'), {
        target: { value: '20' }
      });
      fireEvent.change(screen.getByLabelText('Water Temperature (°C)'), {
        target: { value: '16' }
      });
      
      // Submit form
      fireEvent.click(screen.getByText('Save Weather'));
      
      await waitFor(() => {
        expect(defaultProps.onSave).toHaveBeenCalledWith({
          tripId: 1,
          timeOfDay: 'Afternoon',
          sky: 'Partly Cloudy',
          windCondition: 'Calm',
          windDirection: 'North',
          waterTemp: '16',
          airTemp: '20'
        });
      });
    });
  });

  describe('Edit Weather Log Mode', () => {
    const editProps = {
      ...defaultProps,
      weatherLog: mockWeatherLog
    };

    it('loads existing weather log data', () => {
      render(<WeatherLogForm {...editProps} />);
      
      expect(screen.getByLabelText('Time of Day')).toHaveValue('Morning');
      expect(screen.getByLabelText('Sky Conditions')).toHaveValue('Clear');
      expect(screen.getByLabelText('Wind Condition')).toHaveValue('Light Breeze');
      expect(screen.getByLabelText('Wind Direction')).toHaveValue('North');
      expect(screen.getByLabelText('Air Temperature (°C)')).toHaveValue(18);
      expect(screen.getByLabelText('Water Temperature (°C)')).toHaveValue(15);
      expect(screen.getByText('Update Weather')).toBeInTheDocument();
    });

    it('updates existing weather log when form is submitted', async () => {
      render(<WeatherLogForm {...editProps} />);
      
      // Modify form
      fireEvent.change(screen.getByLabelText('Sky Conditions'), {
        target: { value: 'Cloudy' }
      });
      
      // Submit form
      fireEvent.click(screen.getByText('Update Weather'));
      
      await waitFor(() => {
        expect(defaultProps.onSave).toHaveBeenCalledWith({
          tripId: 1,
          timeOfDay: 'Morning',
          sky: 'Cloudy',
          windCondition: 'Light Breeze',
          windDirection: 'North',
          waterTemp: '15',
          airTemp: '18'
        });
      });
    });
  });

  describe('Form Validation', () => {
    it('validates air temperature range', async () => {
      render(<WeatherLogForm {...defaultProps} />);
      
      // Set invalid air temperature
      fireEvent.change(screen.getByLabelText('Air Temperature (°C)'), {
        target: { value: '70' }
      });
      
      // Submit form
      fireEvent.click(screen.getByText('Save Weather'));
      
      await waitFor(() => {
        expect(screen.getByText('Air temperature must be between -50°C and 60°C')).toBeInTheDocument();
      });
      
      expect(defaultProps.onSave).not.toHaveBeenCalled();
    });

    it('validates water temperature range', async () => {
      render(<WeatherLogForm {...defaultProps} />);
      
      // Set invalid water temperature
      fireEvent.change(screen.getByLabelText('Water Temperature (°C)'), {
        target: { value: '-10' }
      });
      
      // Submit form
      fireEvent.click(screen.getByText('Save Weather'));
      
      await waitFor(() => {
        expect(screen.getByText('Water temperature must be between -5°C and 40°C')).toBeInTheDocument();
      });
      
      expect(defaultProps.onSave).not.toHaveBeenCalled();
    });

    it('allows empty temperature values', async () => {
      render(<WeatherLogForm {...defaultProps} />);
      
      // Leave temperatures empty
      fireEvent.change(screen.getByLabelText('Air Temperature (°C)'), {
        target: { value: '' }
      });
      fireEvent.change(screen.getByLabelText('Water Temperature (°C)'), {
        target: { value: '' }
      });
      
      // Submit form
      fireEvent.click(screen.getByText('Save Weather'));
      
      await waitFor(() => {
        expect(defaultProps.onSave).toHaveBeenCalledWith({
          tripId: 1,
          timeOfDay: 'Morning',
          sky: 'Clear',
          windCondition: 'Calm',
          windDirection: 'North',
          waterTemp: '',
          airTemp: ''
        });
      });
    });

    it('clears validation errors when fields are corrected', async () => {
      render(<WeatherLogForm {...defaultProps} />);
      
      // Set invalid temperature to trigger validation error
      fireEvent.change(screen.getByLabelText('Air Temperature (°C)'), {
        target: { value: '70' }
      });
      
      // Submit form to trigger validation
      fireEvent.click(screen.getByText('Save Weather'));
      
      await waitFor(() => {
        expect(screen.getByText('Air temperature must be between -50°C and 60°C')).toBeInTheDocument();
      });
      
      // Fix the temperature
      fireEvent.change(screen.getByLabelText('Air Temperature (°C)'), {
        target: { value: '20' }
      });
      
      // Error should be cleared
      expect(screen.queryByText('Air temperature must be between -50°C and 60°C')).not.toBeInTheDocument();
    });
  });

  describe('Form Interactions', () => {
    it('handles all select field changes correctly', () => {
      render(<WeatherLogForm {...defaultProps} />);
      
      const timeSelect = screen.getByLabelText('Time of Day');
      const skySelect = screen.getByLabelText('Sky Conditions');
      const windSelect = screen.getByLabelText('Wind Condition');
      const directionSelect = screen.getByLabelText('Wind Direction');
      
      fireEvent.change(timeSelect, { target: { value: 'Evening' } });
      fireEvent.change(skySelect, { target: { value: 'Stormy' } });
      fireEvent.change(windSelect, { target: { value: 'Gale' } });
      fireEvent.change(directionSelect, { target: { value: 'Southwest' } });
      
      expect(timeSelect).toHaveValue('Evening');
      expect(skySelect).toHaveValue('Stormy');
      expect(windSelect).toHaveValue('Gale');
      expect(directionSelect).toHaveValue('Southwest');
    });

    it('handles temperature input changes correctly', () => {
      render(<WeatherLogForm {...defaultProps} />);
      
      const airTempInput = screen.getByLabelText('Air Temperature (°C)') as HTMLInputElement;
      const waterTempInput = screen.getByLabelText('Water Temperature (°C)') as HTMLInputElement;
      
      fireEvent.change(airTempInput, { target: { value: '22' } });
      fireEvent.change(waterTempInput, { target: { value: '18' } });
      
      expect(airTempInput.value).toBe('22');
      expect(waterTempInput.value).toBe('18');
    });
  });

  describe('Form Controls', () => {
    it('calls onCancel when cancel button is clicked', () => {
      render(<WeatherLogForm {...defaultProps} />);
      
      fireEvent.click(screen.getByText('Cancel'));
      
      expect(defaultProps.onCancel).toHaveBeenCalled();
    });

    it('disables buttons during saving', async () => {
      const onSave = vi.fn().mockImplementation(() => new Promise(() => {})); // Never resolves
      
      render(<WeatherLogForm {...defaultProps} onSave={onSave} />);
      
      // Submit form
      fireEvent.click(screen.getByText('Save Weather'));
      
      await waitFor(() => {
        const cancelButton = screen.getByText('Cancel');
        const submitButton = screen.getByText('Save Weather');
        
        expect(cancelButton).toBeDisabled();
        expect(submitButton).toBeDisabled();
      });
    });

    it('disables buttons when isLoading prop is true', () => {
      render(<WeatherLogForm {...defaultProps} isLoading={true} />);
      
      const cancelButton = screen.getByText('Cancel');
      const submitButton = screen.getByText('Save Weather');
      
      expect(cancelButton).toBeDisabled();
      expect(submitButton).toBeDisabled();
    });
  });

  describe('Error Handling', () => {
    it('handles save errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const onSave = vi.fn().mockRejectedValue(new Error('Save failed'));
      
      render(<WeatherLogForm {...defaultProps} onSave={onSave} />);
      
      // Submit form
      fireEvent.click(screen.getByText('Save Weather'));
      
      await waitFor(() => {
        expect(onSave).toHaveBeenCalled();
      });
      
      // Should not crash and should re-enable buttons
      await waitFor(() => {
        const submitButton = screen.getByText('Save Weather');
        expect(submitButton).not.toBeDisabled();
      });
      
      consoleErrorSpy.mockRestore();
    });
  });
});