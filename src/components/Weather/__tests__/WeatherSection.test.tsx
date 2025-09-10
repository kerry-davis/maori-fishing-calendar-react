/**
 * Tests for WeatherSection Component
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { WeatherSection } from '../WeatherSection';

// Mock the WeatherForecast component
vi.mock('../WeatherForecast', () => ({
  WeatherForecast: ({ date, className }: { date: Date; className: string }) => (
    <div data-testid="weather-forecast" data-date={date.toISOString()} className={className}>
      Mocked WeatherForecast
    </div>
  )
}));

describe('WeatherSection', () => {
  it('should render weather section with correct structure', () => {
    const testDate = new Date('2024-01-15');
    
    render(<WeatherSection date={testDate} />);

    // Check for section header
    expect(screen.getByText('Weather Forecast')).toBeInTheDocument();
    
    // Check header styling
    const header = screen.getByText('Weather Forecast');
    expect(header).toHaveClass('font-semibold', 'text-lg', 'mb-3', 'dark:text-gray-100');

    // Check for WeatherForecast component
    expect(screen.getByTestId('weather-forecast')).toBeInTheDocument();
  });

  it('should pass correct date to WeatherForecast', () => {
    const testDate = new Date('2024-01-15');
    
    render(<WeatherSection date={testDate} />);

    const weatherForecast = screen.getByTestId('weather-forecast');
    expect(weatherForecast).toHaveAttribute('data-date', testDate.toISOString());
  });

  it('should apply correct styling classes', () => {
    const testDate = new Date('2024-01-15');
    
    const { container } = render(<WeatherSection date={testDate} />);

    // Check container styling
    const section = container.firstChild as HTMLElement;
    expect(section).toHaveClass('border-t', 'dark:border-gray-700', 'pt-4', 'mb-4');
  });

  it('should apply custom className', () => {
    const testDate = new Date('2024-01-15');
    
    const { container } = render(
      <WeatherSection date={testDate} className="custom-class" />
    );

    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('should pass text-sm className to WeatherForecast', () => {
    const testDate = new Date('2024-01-15');
    
    render(<WeatherSection date={testDate} />);

    const weatherForecast = screen.getByTestId('weather-forecast');
    expect(weatherForecast).toHaveClass('text-sm');
  });

  it('should maintain existing HTML structure for styling compatibility', () => {
    const testDate = new Date('2024-01-15');
    
    render(<WeatherSection date={testDate} />);

    // Check that the structure matches the original HTML:
    // <div class="border-t dark:border-gray-700 pt-4 mb-4">
    //   <h4 class="font-semibold text-lg mb-3 dark:text-gray-100">Weather Forecast</h4>
    //   <div class="text-sm">...</div>
    // </div>

    const section = screen.getByText('Weather Forecast').closest('div');
    expect(section).toHaveClass('border-t', 'dark:border-gray-700', 'pt-4', 'mb-4');

    const header = screen.getByText('Weather Forecast');
    expect(header.tagName).toBe('H4');
    expect(header).toHaveClass('font-semibold', 'text-lg', 'mb-3', 'dark:text-gray-100');
  });

  it('should handle different date formats', () => {
    const dates = [
      new Date('2024-01-01'),
      new Date('2024-12-31'),
      new Date('2023-06-15'),
      new Date() // Current date
    ];

    dates.forEach(date => {
      const { unmount } = render(<WeatherSection date={date} />);
      
      const weatherForecast = screen.getByTestId('weather-forecast');
      expect(weatherForecast).toHaveAttribute('data-date', date.toISOString());
      
      unmount();
    });
  });

  it('should combine custom className with default classes', () => {
    const testDate = new Date('2024-01-15');
    
    const { container } = render(
      <WeatherSection date={testDate} className="extra-class another-class" />
    );

    const section = container.firstChild as HTMLElement;
    expect(section).toHaveClass(
      'border-t', 
      'dark:border-gray-700', 
      'pt-4', 
      'mb-4',
      'extra-class',
      'another-class'
    );
  });
});