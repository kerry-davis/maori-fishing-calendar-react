import { vi } from 'vitest';

export const mockWeatherApiResponse = {
  daily: {
    time: ['2024-01-15', '2024-01-16', '2024-01-17'],
    temperature_2m_max: [22.5, 24.1, 21.8],
    temperature_2m_min: [12.3, 14.2, 11.9],
    windspeed_10m_max: [15.2, 20.1, 12.8],
    winddirection_10m_dominant: [180, 200, 160],
    weathercode: [1, 2, 3],
  },
  daily_units: {
    temperature_2m_max: '°C',
    temperature_2m_min: '°C',
    windspeed_10m_max: 'km/h',
    winddirection_10m_dominant: '°',
  },
};

export const mockWeatherApiError = {
  error: true,
  reason: 'Invalid coordinates',
};

export const createWeatherApiMock = (shouldFail = false) => {
  return vi.fn(() => {
    if (shouldFail) {
      return Promise.reject(new Error('Weather API error'));
    }
    
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(mockWeatherApiResponse),
    });
  });
};

// Mock different weather conditions
export const mockWeatherConditions = {
  clear: {
    daily: {
      ...mockWeatherApiResponse.daily,
      weathercode: [0, 1, 2],
    },
  },
  cloudy: {
    daily: {
      ...mockWeatherApiResponse.daily,
      weathercode: [3, 45, 48],
    },
  },
  rainy: {
    daily: {
      ...mockWeatherApiResponse.daily,
      weathercode: [51, 53, 55],
    },
  },
  stormy: {
    daily: {
      ...mockWeatherApiResponse.daily,
      weathercode: [95, 96, 99],
    },
  },
};

export const mockGeolocationResponse = {
  coords: {
    latitude: -38.7372,
    longitude: 176.0851,
    accuracy: 10,
    altitude: null,
    altitudeAccuracy: null,
    heading: null,
    speed: null,
  },
  timestamp: Date.now(),
};

export const createGeolocationMock = (shouldFail = false) => {
  return {
    getCurrentPosition: vi.fn((success, error) => {
      if (shouldFail) {
        error({
          code: 1,
          message: 'User denied geolocation',
        });
      } else {
        success(mockGeolocationResponse);
      }
    }),
    watchPosition: vi.fn(),
    clearWatch: vi.fn(),
  };
};