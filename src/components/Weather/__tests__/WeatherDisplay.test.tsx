/**
 * Tests for WeatherDisplay Component
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { WeatherDisplay } from '../WeatherDisplay';
import type { WeatherData } from '../../../services/weatherService';

describe('WeatherDisplay', () => {
  const mockWeatherData: WeatherData = {
    date: '2024-01-15',
    temperatureMax: 25,
    temperatureMin: 15,
    windSpeed: 12,
    windDirection: 225,
    windDirectionCardinal: 'SW'
  };

  it('should render weather data correctly', () => {
    render(<WeatherDisplay weather={mockWeatherData} />);

    expect(screen.getByText('Temperature:')).toBeInTheDocument();
    expect(screen.getByText('15°C - 25°C')).toBeInTheDocument();
    expect(screen.getByText('Wind:')).toBeInTheDocument();
    expect(screen.getByText('12 km/h (SW)')).toBeInTheDocument();
  });

  it('should render loading state', () => {
    render(<WeatherDisplay weather={null} loading={true} />);

    expect(screen.getByText('Loading weather...')).toBeInTheDocument();
  });

  it('should render error state', () => {
    render(<WeatherDisplay weather={null} error="Network error" />);

    expect(screen.getByText('Could not load weather forecast.')).toBeInTheDocument();
  });

  it('should render no data state', () => {
    render(<WeatherDisplay weather={null} />);

    expect(screen.getByText('Weather data is not available for this day.')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <WeatherDisplay weather={mockWeatherData} className="custom-class" />
    );

    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('should use grid layout for weather data', () => {
    render(<WeatherDisplay weather={mockWeatherData} />);

    const gridContainer = screen.getByText('Temperature:').closest('.grid');
    expect(gridContainer).toHaveClass('grid', 'grid-cols-2', 'gap-2');
  });

  it('should display temperature and wind labels as bold', () => {
    render(<WeatherDisplay weather={mockWeatherData} />);

    const tempLabel = screen.getByText('Temperature:');
    const windLabel = screen.getByText('Wind:');

    expect(tempLabel).toHaveClass('font-semibold');
    expect(windLabel).toHaveClass('font-semibold');
  });

  it('should handle extreme temperature values', () => {
    const extremeWeather: WeatherData = {
      date: '2024-01-15',
      temperatureMax: -10,
      temperatureMin: -20,
      windSpeed: 50,
      windDirection: 0,
      windDirectionCardinal: 'N'
    };

    render(<WeatherDisplay weather={extremeWeather} />);

    expect(screen.getByText('-20°C - -10°C')).toBeInTheDocument();
    expect(screen.getByText('50 km/h (N)')).toBeInTheDocument();
  });

  it('should handle zero wind speed', () => {
    const calmWeather: WeatherData = {
      date: '2024-01-15',
      temperatureMax: 20,
      temperatureMin: 10,
      windSpeed: 0,
      windDirection: 0,
      windDirectionCardinal: 'N'
    };

    render(<WeatherDisplay weather={calmWeather} />);

    expect(screen.getByText('0 km/h (N)')).toBeInTheDocument();
  });

  it('should prioritize loading state over error state', () => {
    render(<WeatherDisplay weather={null} loading={true} error="Some error" />);

    expect(screen.getByText('Loading weather...')).toBeInTheDocument();
    expect(screen.queryByText('Could not load weather forecast.')).not.toBeInTheDocument();
  });

  it('should prioritize error state over no data state', () => {
    render(<WeatherDisplay weather={null} error="Some error" />);

    expect(screen.getByText('Could not load weather forecast.')).toBeInTheDocument();
    expect(screen.queryByText('Weather data is not available for this day.')).not.toBeInTheDocument();
  });
});