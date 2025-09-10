/**
 * Unit tests for Weather Service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchWeatherForecast,
  fetchWeatherForLocation,
  getCardinalDirection,
  formatTemperatureRange,
  formatWindInfo,
  isWeatherAvailable,
  getWeatherErrorMessage,
  type WeatherError
} from '../weatherService';
import type { UserLocation } from '../../types';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('weatherService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetchWeatherForecast', () => {
    const mockApiResponse = {
      daily: {
        time: ['2024-01-15'],
        temperature_2m_max: [25.5],
        temperature_2m_min: [15.2],
        windspeed_10m_max: [12.8],
        winddirection_10m_dominant: [225]
      }
    };

    it('should fetch weather data successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponse)
      });

      const result = await fetchWeatherForecast(-36.8485, 174.7633, new Date('2024-01-15'));

      expect(result).toEqual({
        date: '2024-01-15',
        temperatureMax: 26,
        temperatureMin: 15,
        windSpeed: 13,
        windDirection: 225,
        windDirectionCardinal: 'SW'
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('https://api.open-meteo.com/v1/forecast')
      );
    });

    it('should format date correctly for API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponse)
      });

      await fetchWeatherForecast(-36.8485, 174.7633, new Date('2024-01-15'));

      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('start_date=2024-01-15');
      expect(calledUrl).toContain('end_date=2024-01-15');
    });

    it('should include all required API parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponse)
      });

      await fetchWeatherForecast(-36.8485, 174.7633, new Date('2024-01-15'));

      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('latitude=-36.8485');
      expect(calledUrl).toContain('longitude=174.7633');
      // URL encoded version of the daily parameters
      expect(calledUrl).toContain('daily=temperature_2m_max%2Ctemperature_2m_min%2Cwindspeed_10m_max%2Cwinddirection_10m_dominant');
      expect(calledUrl).toContain('timezone=auto');
    });

    it('should handle HTTP errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404
      });

      await expect(
        fetchWeatherForecast(-36.8485, 174.7633, new Date('2024-01-15'))
      ).rejects.toMatchObject({
        type: 'api',
        message: 'HTTP error! status: 404',
        status: 404
      });
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      await expect(
        fetchWeatherForecast(-36.8485, 174.7633, new Date('2024-01-15'))
      ).rejects.toMatchObject({
        type: 'network',
        message: 'Network error: Unable to fetch weather data'
      });
    });

    it('should handle JSON parsing errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new SyntaxError('Unexpected token'))
      });

      await expect(
        fetchWeatherForecast(-36.8485, 174.7633, new Date('2024-01-15'))
      ).rejects.toMatchObject({
        type: 'parsing',
        message: 'Failed to parse weather API response'
      });
    });

    it('should handle missing daily data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({})
      });

      await expect(
        fetchWeatherForecast(-36.8485, 174.7633, new Date('2024-01-15'))
      ).rejects.toMatchObject({
        type: 'validation',
        message: 'Weather data is not available for this day'
      });
    });

    it('should handle incomplete weather data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          daily: {
            time: ['2024-01-15'],
            temperature_2m_max: [25.5]
            // Missing other required fields
          }
        })
      });

      await expect(
        fetchWeatherForecast(-36.8485, 174.7633, new Date('2024-01-15'))
      ).rejects.toMatchObject({
        type: 'validation',
        message: 'Incomplete weather data received from API'
      });
    });

    it('should handle invalid numeric values', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          daily: {
            time: ['2024-01-15'],
            temperature_2m_max: ['invalid'],
            temperature_2m_min: [15.2],
            windspeed_10m_max: [12.8],
            winddirection_10m_dominant: [225]
          }
        })
      });

      await expect(
        fetchWeatherForecast(-36.8485, 174.7633, new Date('2024-01-15'))
      ).rejects.toMatchObject({
        type: 'validation',
        message: 'Invalid weather data values received'
      });
    });
  });

  describe('fetchWeatherForLocation', () => {
    it('should fetch weather using UserLocation object', async () => {
      const mockApiResponse = {
        daily: {
          time: ['2024-01-15'],
          temperature_2m_max: [25.5],
          temperature_2m_min: [15.2],
          windspeed_10m_max: [12.8],
          winddirection_10m_dominant: [225]
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponse)
      });

      const location: UserLocation = {
        lat: -36.8485,
        lon: 174.7633,
        name: 'Auckland, New Zealand'
      };

      const result = await fetchWeatherForLocation(location, new Date('2024-01-15'));

      expect(result).toEqual({
        date: '2024-01-15',
        temperatureMax: 26,
        temperatureMin: 15,
        windSpeed: 13,
        windDirection: 225,
        windDirectionCardinal: 'SW'
      });
    });
  });

  describe('getCardinalDirection', () => {
    it('should convert degrees to cardinal directions correctly', () => {
      expect(getCardinalDirection(0)).toBe('N');
      expect(getCardinalDirection(45)).toBe('NE');
      expect(getCardinalDirection(90)).toBe('E');
      expect(getCardinalDirection(135)).toBe('SE');
      expect(getCardinalDirection(180)).toBe('S');
      expect(getCardinalDirection(225)).toBe('SW');
      expect(getCardinalDirection(270)).toBe('W');
      expect(getCardinalDirection(315)).toBe('NW');
      expect(getCardinalDirection(360)).toBe('N');
    });

    it('should handle edge cases', () => {
      expect(getCardinalDirection(22)).toBe('N');
      expect(getCardinalDirection(23)).toBe('NE');
      expect(getCardinalDirection(67)).toBe('NE');
      expect(getCardinalDirection(68)).toBe('E');
    });
  });

  describe('formatTemperatureRange', () => {
    it('should format temperature range correctly', () => {
      expect(formatTemperatureRange(15, 25)).toBe('15°C - 25°C');
      expect(formatTemperatureRange(-5, 10)).toBe('-5°C - 10°C');
      expect(formatTemperatureRange(0, 0)).toBe('0°C - 0°C');
    });
  });

  describe('formatWindInfo', () => {
    it('should format wind information correctly', () => {
      expect(formatWindInfo(12, 'SW')).toBe('12 km/h (SW)');
      expect(formatWindInfo(0, 'N')).toBe('0 km/h (N)');
      expect(formatWindInfo(25, 'NE')).toBe('25 km/h (NE)');
    });
  });

  describe('isWeatherAvailable', () => {
    beforeEach(() => {
      // Mock current date to 2024-01-15
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return true for dates within forecast range', () => {
      // Today
      expect(isWeatherAvailable(new Date('2024-01-15'))).toBe(true);
      
      // 7 days in future
      expect(isWeatherAvailable(new Date('2024-01-22'))).toBe(true);
      
      // 14 days in future (max forecast)
      expect(isWeatherAvailable(new Date('2024-01-29'))).toBe(true);
      
      // Historical data (30 days ago)
      expect(isWeatherAvailable(new Date('2023-12-16'))).toBe(true);
    });

    it('should return false for dates outside forecast range', () => {
      // Too far in future (15 days)
      expect(isWeatherAvailable(new Date('2024-01-30'))).toBe(false);
      
      // Too far in past (over 1 year)
      expect(isWeatherAvailable(new Date('2022-12-15'))).toBe(false);
    });
  });

  describe('getWeatherErrorMessage', () => {
    it('should return appropriate messages for different error types', () => {
      const networkError: WeatherError = {
        type: 'network',
        message: 'Network error'
      };
      expect(getWeatherErrorMessage(networkError)).toBe(
        'Unable to connect to weather service. Please check your internet connection.'
      );

      const apiError: WeatherError = {
        type: 'api',
        message: 'API error',
        status: 500
      };
      expect(getWeatherErrorMessage(apiError)).toBe(
        'Weather service is experiencing issues. Please try again later.'
      );

      const rateLimitError: WeatherError = {
        type: 'api',
        message: 'Rate limited',
        status: 429
      };
      expect(getWeatherErrorMessage(rateLimitError)).toBe(
        'Weather service is temporarily unavailable. Please try again later.'
      );

      const parsingError: WeatherError = {
        type: 'parsing',
        message: 'Parse error'
      };
      expect(getWeatherErrorMessage(parsingError)).toBe(
        'Unable to process weather data. Please try again.'
      );

      const validationError: WeatherError = {
        type: 'validation',
        message: 'Custom validation message'
      };
      expect(getWeatherErrorMessage(validationError)).toBe('Custom validation message');
    });

    it('should return generic message for unknown error types', () => {
      const unknownError = {
        type: 'unknown',
        message: 'Unknown error'
      } as WeatherError;
      
      expect(getWeatherErrorMessage(unknownError)).toBe(
        'Unable to load weather forecast. Please try again.'
      );
    });
  });
});