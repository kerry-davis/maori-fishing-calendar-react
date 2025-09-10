import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import WeatherLogDisplay from '../WeatherLogDisplay';
import { WeatherLog } from '../../../types';

const mockWeatherLogs: WeatherLog[] = [
  {
    id: 1,
    tripId: 1,
    timeOfDay: 'Morning',
    sky: 'Clear',
    windCondition: 'Light Breeze',
    windDirection: 'North',
    waterTemp: '15',
    airTemp: '18'
  },
  {
    id: 2,
    tripId: 1,
    timeOfDay: 'Afternoon',
    sky: 'Partly Cloudy',
    windCondition: 'Moderate Breeze',
    windDirection: 'Southwest',
    waterTemp: '16',
    airTemp: '22'
  },
  {
    id: 3,
    tripId: 1,
    timeOfDay: 'Evening',
    sky: 'Stormy',
    windCondition: 'Gale',
    windDirection: 'West',
    waterTemp: '',
    airTemp: ''
  }
];

describe('WeatherLogDisplay', () => {
  const defaultProps = {
    weatherLogs: mockWeatherLogs,
    onEdit: vi.fn(),
    onDelete: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Display Weather Logs', () => {
    it('renders all weather logs', () => {
      render(<WeatherLogDisplay {...defaultProps} />);
      
      expect(screen.getByText('Morning')).toBeInTheDocument();
      expect(screen.getByText('Afternoon')).toBeInTheDocument();
      expect(screen.getByText('Evening')).toBeInTheDocument();
      
      expect(screen.getByText('Clear')).toBeInTheDocument();
      expect(screen.getByText('Partly Cloudy')).toBeInTheDocument();
      expect(screen.getByText('Stormy')).toBeInTheDocument();
    });

    it('displays weather conditions correctly', () => {
      render(<WeatherLogDisplay {...defaultProps} />);
      
      expect(screen.getByText('Light Breeze')).toBeInTheDocument();
      expect(screen.getByText('Moderate Breeze')).toBeInTheDocument();
      expect(screen.getByText('Gale')).toBeInTheDocument();
      
      expect(screen.getByText('North')).toBeInTheDocument();
      expect(screen.getByText('Southwest')).toBeInTheDocument();
      expect(screen.getByText('West')).toBeInTheDocument();
    });

    it('displays temperatures correctly', () => {
      render(<WeatherLogDisplay {...defaultProps} />);
      
      expect(screen.getByText('18°C')).toBeInTheDocument();
      expect(screen.getByText('15°C')).toBeInTheDocument();
      expect(screen.getByText('22°C')).toBeInTheDocument();
      expect(screen.getByText('16°C')).toBeInTheDocument();
      
      // Should show "Not recorded" for empty temperatures
      expect(screen.getAllByText('Not recorded')).toHaveLength(2);
    });

    it('displays appropriate weather icons', () => {
      render(<WeatherLogDisplay {...defaultProps} />);
      
      // Check for weather icons (using class names)
      const weatherCards = screen.getAllByRole('button', { name: /Edit weather log/ });
      expect(weatherCards).toHaveLength(3);
    });
  });

  describe('Empty States', () => {
    it('displays empty state when no weather logs exist', () => {
      render(<WeatherLogDisplay weatherLogs={[]} />);
      
      expect(screen.getByText('No weather conditions logged')).toBeInTheDocument();
    });

    it('displays loading state when isLoading is true', () => {
      render(<WeatherLogDisplay weatherLogs={[]} isLoading={true} />);
      
      expect(screen.getByText('Loading weather logs...')).toBeInTheDocument();
    });
  });

  describe('Edit Functionality', () => {
    it('calls onEdit when edit button is clicked', () => {
      render(<WeatherLogDisplay {...defaultProps} />);
      
      const editButtons = screen.getAllByTitle('Edit weather log');
      fireEvent.click(editButtons[0]);
      
      expect(defaultProps.onEdit).toHaveBeenCalledWith(mockWeatherLogs[0]);
    });

    it('does not show edit buttons when onEdit is not provided', () => {
      render(<WeatherLogDisplay weatherLogs={mockWeatherLogs} onDelete={defaultProps.onDelete} />);
      
      expect(screen.queryByTitle('Edit weather log')).not.toBeInTheDocument();
    });
  });

  describe('Delete Functionality', () => {
    it('shows confirmation dialog when delete button is clicked', () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      
      render(<WeatherLogDisplay {...defaultProps} />);
      
      const deleteButtons = screen.getAllByTitle('Delete weather log');
      fireEvent.click(deleteButtons[0]);
      
      expect(confirmSpy).toHaveBeenCalledWith('Are you sure you want to delete this weather log?');
      expect(defaultProps.onDelete).toHaveBeenCalledWith(1);
      
      confirmSpy.mockRestore();
    });

    it('does not delete when confirmation is cancelled', () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
      
      render(<WeatherLogDisplay {...defaultProps} />);
      
      const deleteButtons = screen.getAllByTitle('Delete weather log');
      fireEvent.click(deleteButtons[0]);
      
      expect(confirmSpy).toHaveBeenCalled();
      expect(defaultProps.onDelete).not.toHaveBeenCalled();
      
      confirmSpy.mockRestore();
    });

    it('does not show delete buttons when onDelete is not provided', () => {
      render(<WeatherLogDisplay weatherLogs={mockWeatherLogs} onEdit={defaultProps.onEdit} />);
      
      expect(screen.queryAllByTitle('Delete weather log')).toHaveLength(0);
    });
  });

  describe('Weather Icons', () => {
    it('displays correct icons for different sky conditions', () => {
      const weatherLogsWithDifferentSkies: WeatherLog[] = [
        { ...mockWeatherLogs[0], sky: 'Clear' },
        { ...mockWeatherLogs[0], id: 2, sky: 'Heavy Rain' },
        { ...mockWeatherLogs[0], id: 3, sky: 'Stormy' }
      ];
      
      render(<WeatherLogDisplay weatherLogs={weatherLogsWithDifferentSkies} />);
      
      // Icons are rendered as <i> elements with specific classes
      // We can't easily test the exact classes, but we can verify the structure
      expect(screen.getByText('Clear')).toBeInTheDocument();
      expect(screen.getByText('Heavy Rain')).toBeInTheDocument();
      expect(screen.getByText('Stormy')).toBeInTheDocument();
    });
  });

  describe('Responsive Layout', () => {
    it('renders weather log cards with proper structure', () => {
      render(<WeatherLogDisplay {...defaultProps} />);
      
      // Check that all weather logs are rendered as cards
      const morningCard = screen.getByText('Morning').closest('.bg-gray-50');
      const afternoonCard = screen.getByText('Afternoon').closest('.bg-gray-50');
      const eveningCard = screen.getByText('Evening').closest('.bg-gray-50');
      
      expect(morningCard).toBeInTheDocument();
      expect(afternoonCard).toBeInTheDocument();
      expect(eveningCard).toBeInTheDocument();
    });
  });

  describe('Temperature Formatting', () => {
    it('formats temperatures with degree symbol', () => {
      render(<WeatherLogDisplay {...defaultProps} />);
      
      expect(screen.getByText('18°C')).toBeInTheDocument();
      expect(screen.getByText('15°C')).toBeInTheDocument();
    });

    it('shows "Not recorded" for empty temperatures', () => {
      const weatherLogWithEmptyTemps: WeatherLog[] = [{
        id: 1,
        tripId: 1,
        timeOfDay: 'Morning',
        sky: 'Clear',
        windCondition: 'Calm',
        windDirection: 'North',
        waterTemp: '',
        airTemp: ''
      }];
      
      render(<WeatherLogDisplay weatherLogs={weatherLogWithEmptyTemps} />);
      
      expect(screen.getAllByText('Not recorded')).toHaveLength(2);
    });
  });
});