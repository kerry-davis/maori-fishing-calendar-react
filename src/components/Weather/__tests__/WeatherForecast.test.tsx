/**
 * Tests for WeatherForecast Component
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WeatherForecast } from '../WeatherForecast';
import * as weatherService from '../../../services/weatherService';
import * as LocationContext from '../../../contexts/LocationContext';
import type { UserLocation } from '../../../types';

// Mock the weather service
vi.mock('../../../services/weatherService', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    fetchWeatherForLocation: vi.fn(),
    getWeatherErrorMessage: vi.fn(),
    isWeatherAvailable: vi.fn()
  };
});

// Mock the location context
vi.mock('../../../contexts/LocationContext', () => ({
  useLocation: vi.fn()
}));

describe('WeatherForecast', () => {
  const mockLocation: UserLocation = {
    lat: -36.8485,
    lon: 174.7633,
    name: 'Auckland, New Zealand'
  };

  const mockWeatherData = {
    date: '2024-01-15',
    temperatureMax: 25,
    temperatureMin: 15,
    windSpeed: 12,
    windDirection: 225,
    windDirectionCardinal: 'SW'
  };

  const mockUseLocation = vi.mocked(LocationContext.useLocation);
  const mockFetchWeatherForLocation = vi.mocked(weatherService.fetchWeatherForLocation);
  const mockGetWeatherErrorMessage = vi.mocked(weatherService.getWeatherErrorMessage);
  const mockIsWeatherAvailable = vi.mocked(weatherService.isWeatherAvailable);

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mocks
    mockUseLocation.mockReturnValue({
      userLocation: mockLocation,
      setLocation: vi.fn(),
      requestLocation: vi.fn()
    });
    
    mockIsWeatherAvailable.mockReturnValue(true);
    mockGetWeatherErrorMessage.mockReturnValue('Weather service error');
  });

  it('should fetch and display weather data successfully', async () => {
    mockFetchWeatherForLocation.mockResolvedValue(mockWeatherData);

    render(<WeatherForecast date={new Date('2024-01-15')} />);

    // Should show loading initially
    expect(screen.getByText('Loading weather...')).toBeInTheDocument();

    // Wait for weather data to load
    await waitFor(() => {
      expect(screen.getByText('15°C - 25°C')).toBeInTheDocument();
    });

    expect(screen.getByText('12 km/h (SW)')).toBeInTheDocument();
    expect(mockFetchWeatherForLocation).toHaveBeenCalledWith(mockLocation, new Date('2024-01-15'));
  });

  it('should handle missing location', async () => {
    mockUseLocation.mockReturnValue({
      userLocation: null,
      setLocation: vi.fn(),
      requestLocation: vi.fn()
    });

    render(<WeatherForecast date={new Date('2024-01-15')} />);

    await waitFor(() => {
      expect(screen.getByText('Could not load weather forecast.')).toBeInTheDocument();
    });

    expect(mockFetchWeatherForLocation).not.toHaveBeenCalled();
  });

  it('should handle unavailable weather dates', async () => {
    mockIsWeatherAvailable.mockReturnValue(false);

    render(<WeatherForecast date={new Date('2024-01-15')} />);

    await waitFor(() => {
      expect(screen.getByText('Could not load weather forecast.')).toBeInTheDocument();
    });

    expect(mockFetchWeatherForLocation).not.toHaveBeenCalled();
  });

  it('should handle weather service errors', async () => {
    const weatherError = {
      type: 'network' as const,
      message: 'Network error'
    };
    
    mockFetchWeatherForLocation.mockRejectedValue(weatherError);
    mockGetWeatherErrorMessage.mockReturnValue('Unable to connect to weather service');

    render(<WeatherForecast date={new Date('2024-01-15')} />);

    await waitFor(() => {
      expect(screen.getByText('Could not load weather forecast.')).toBeInTheDocument();
    });

    expect(mockGetWeatherErrorMessage).toHaveBeenCalledWith(weatherError);
  });

  it('should show retry button on error', async () => {
    mockFetchWeatherForLocation.mockRejectedValue(new Error('Network error'));

    render(<WeatherForecast date={new Date('2024-01-15')} />);

    await waitFor(() => {
      expect(screen.getByText('Try again')).toBeInTheDocument();
    });

    const retryButton = screen.getByText('Try again');
    expect(retryButton).toHaveClass('text-blue-600', 'dark:text-blue-400', 'hover:underline');
  });

  it('should retry fetching weather when retry button is clicked', async () => {
    mockFetchWeatherForLocation
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(mockWeatherData);

    render(<WeatherForecast date={new Date('2024-01-15')} />);

    // Wait for error state
    await waitFor(() => {
      expect(screen.getByText('Try again')).toBeInTheDocument();
    });

    // Click retry button
    fireEvent.click(screen.getByText('Try again'));

    // Should show loading again
    expect(screen.getByText('Loading weather...')).toBeInTheDocument();

    // Wait for successful data load
    await waitFor(() => {
      expect(screen.getByText('15°C - 25°C')).toBeInTheDocument();
    });

    expect(mockFetchWeatherForLocation).toHaveBeenCalledTimes(2);
  });

  it('should call onWeatherLoad callback with weather data', async () => {
    const onWeatherLoad = vi.fn();
    mockFetchWeatherForLocation.mockResolvedValue(mockWeatherData);

    render(
      <WeatherForecast 
        date={new Date('2024-01-15')} 
        onWeatherLoad={onWeatherLoad}
      />
    );

    await waitFor(() => {
      expect(onWeatherLoad).toHaveBeenCalledWith(mockWeatherData);
    });
  });

  it('should call onWeatherLoad callback with null on error', async () => {
    const onWeatherLoad = vi.fn();
    mockFetchWeatherForLocation.mockRejectedValue(new Error('Network error'));

    render(
      <WeatherForecast 
        date={new Date('2024-01-15')} 
        onWeatherLoad={onWeatherLoad}
      />
    );

    await waitFor(() => {
      expect(onWeatherLoad).toHaveBeenCalledWith(null);
    });
  });

  it('should refetch weather when date changes', async () => {
    mockFetchWeatherForLocation.mockResolvedValue(mockWeatherData);

    const { rerender } = render(<WeatherForecast date={new Date('2024-01-15')} />);

    await waitFor(() => {
      expect(mockFetchWeatherForLocation).toHaveBeenCalledWith(mockLocation, new Date('2024-01-15'));
    });

    // Change date
    rerender(<WeatherForecast date={new Date('2024-01-16')} />);

    await waitFor(() => {
      expect(mockFetchWeatherForLocation).toHaveBeenCalledWith(mockLocation, new Date('2024-01-16'));
    });

    expect(mockFetchWeatherForLocation).toHaveBeenCalledTimes(2);
  });

  it('should refetch weather when location changes', async () => {
    mockFetchWeatherForLocation.mockResolvedValue(mockWeatherData);

    const { rerender } = render(<WeatherForecast date={new Date('2024-01-15')} />);

    await waitFor(() => {
      expect(mockFetchWeatherForLocation).toHaveBeenCalledWith(mockLocation, new Date('2024-01-15'));
    });

    // Change location
    const newLocation: UserLocation = {
      lat: 51.5074,
      lon: -0.1278,
      name: 'London, UK'
    };

    mockUseLocation.mockReturnValue({
      userLocation: newLocation,
      setLocation: vi.fn(),
      requestLocation: vi.fn()
    });

    rerender(<WeatherForecast date={new Date('2024-01-15')} />);

    await waitFor(() => {
      expect(mockFetchWeatherForLocation).toHaveBeenCalledWith(newLocation, new Date('2024-01-15'));
    });

    expect(mockFetchWeatherForLocation).toHaveBeenCalledTimes(2);
  });

  it('should apply custom className', () => {
    const { container } = render(
      <WeatherForecast date={new Date('2024-01-15')} className="custom-class" />
    );

    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('should not show retry button when loading', async () => {
    // Mock a slow response to keep loading state
    mockFetchWeatherForLocation.mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve(mockWeatherData), 1000))
    );

    render(<WeatherForecast date={new Date('2024-01-15')} />);

    expect(screen.getByText('Loading weather...')).toBeInTheDocument();
    expect(screen.queryByText('Try again')).not.toBeInTheDocument();
  });
});