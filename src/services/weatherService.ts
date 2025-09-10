/**
 * Weather Service for Open-Meteo API Integration
 * Provides weather forecast fetching and data formatting utilities
 */

import { WeatherForecast, UserLocation } from '../types';

// Open-Meteo API base URL
const OPEN_METEO_BASE_URL = 'https://api.open-meteo.com/v1/forecast';

// Weather service error types
export interface WeatherError {
  type: 'network' | 'api' | 'parsing' | 'validation';
  message: string;
  status?: number;
}

// Open-Meteo API response interface
interface OpenMeteoResponse {
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    windspeed_10m_max: number[];
    winddirection_10m_dominant: number[];
  };
}

// Formatted weather data for display
export interface WeatherData {
  date: string;
  temperatureMax: number;
  temperatureMin: number;
  windSpeed: number;
  windDirection: number;
  windDirectionCardinal: string;
}

/**
 * Fetches weather forecast for a specific location and date
 * @param lat - Latitude
 * @param lon - Longitude  
 * @param date - Date for forecast
 * @returns Promise<WeatherData>
 */
export async function fetchWeatherForecast(
  lat: number, 
  lon: number, 
  date: Date
): Promise<WeatherData> {
  // Format date for API (YYYY-MM-DD)
  const dateStr = formatDateForAPI(date);
  
  // Build API URL with required parameters
  const apiUrl = buildWeatherApiUrl(lat, lon, dateStr);
  
  try {
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw createWeatherError('api', `HTTP error! status: ${response.status}`, response.status);
    }
    
    const data: OpenMeteoResponse = await response.json();
    
    // Validate and format the response data
    return formatWeatherData(data, dateStr);
    
  } catch (error) {
    if (error instanceof Error && error.name === 'WeatherError') {
      throw error;
    }
    
    // Handle network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw createWeatherError('network', 'Network error: Unable to fetch weather data');
    }
    
    // Handle JSON parsing errors
    if (error instanceof SyntaxError) {
      throw createWeatherError('parsing', 'Failed to parse weather API response');
    }
    
    // Generic error fallback
    throw createWeatherError('api', `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Fetches weather forecast using UserLocation object
 * @param location - User location object
 * @param date - Date for forecast
 * @returns Promise<WeatherData>
 */
export async function fetchWeatherForLocation(
  location: UserLocation, 
  date: Date
): Promise<WeatherData> {
  return fetchWeatherForecast(location.lat, location.lon, date);
}

/**
 * Formats date for Open-Meteo API (YYYY-MM-DD)
 * @param date - Date object
 * @returns Formatted date string
 */
function formatDateForAPI(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Builds the complete API URL for weather request
 * @param lat - Latitude
 * @param lon - Longitude
 * @param dateStr - Formatted date string
 * @returns Complete API URL
 */
function buildWeatherApiUrl(lat: number, lon: number, dateStr: string): string {
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    daily: 'temperature_2m_max,temperature_2m_min,windspeed_10m_max,winddirection_10m_dominant',
    timezone: 'auto',
    start_date: dateStr,
    end_date: dateStr
  });
  
  return `${OPEN_METEO_BASE_URL}?${params.toString()}`;
}

/**
 * Formats Open-Meteo API response into WeatherData
 * @param data - API response data
 * @param dateStr - Expected date string
 * @returns Formatted weather data
 */
function formatWeatherData(data: OpenMeteoResponse, dateStr: string): WeatherData {
  // Validate response structure
  if (!data.daily || !data.daily.time || data.daily.time.length === 0) {
    throw createWeatherError('validation', 'Weather data is not available for this day');
  }
  
  const daily = data.daily;
  
  // Validate all required fields are present
  if (!daily.temperature_2m_max || !daily.temperature_2m_min || 
      !daily.windspeed_10m_max || !daily.winddirection_10m_dominant) {
    throw createWeatherError('validation', 'Incomplete weather data received from API');
  }
  
  // Get data for the requested date (should be first/only item)
  const tempMax = daily.temperature_2m_max[0];
  const tempMin = daily.temperature_2m_min[0];
  const windSpeed = daily.windspeed_10m_max[0];
  const windDirection = daily.winddirection_10m_dominant[0];
  
  // Validate numeric values
  if (typeof tempMax !== 'number' || typeof tempMin !== 'number' || 
      typeof windSpeed !== 'number' || typeof windDirection !== 'number') {
    throw createWeatherError('validation', 'Invalid weather data values received');
  }
  
  return {
    date: dateStr,
    temperatureMax: Math.round(tempMax),
    temperatureMin: Math.round(tempMin),
    windSpeed: Math.round(windSpeed),
    windDirection: Math.round(windDirection),
    windDirectionCardinal: getCardinalDirection(windDirection)
  };
}

/**
 * Converts wind direction in degrees to cardinal direction
 * @param angle - Wind direction in degrees (0-360)
 * @returns Cardinal direction string
 */
export function getCardinalDirection(angle: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(angle / 45) % 8;
  return directions[index];
}

/**
 * Creates a standardized weather error
 * @param type - Error type
 * @param message - Error message
 * @param status - HTTP status code (optional)
 * @returns WeatherError
 */
function createWeatherError(type: WeatherError['type'], message: string, status?: number): WeatherError {
  const error = new Error(message) as Error & WeatherError;
  error.name = 'WeatherError';
  error.type = type;
  error.message = message;
  if (status) error.status = status;
  return error;
}

/**
 * Formats temperature range for display
 * @param min - Minimum temperature
 * @param max - Maximum temperature
 * @returns Formatted temperature string
 */
export function formatTemperatureRange(min: number, max: number): string {
  return `${min}°C - ${max}°C`;
}

/**
 * Formats wind information for display
 * @param speed - Wind speed in km/h
 * @param direction - Cardinal direction
 * @returns Formatted wind string
 */
export function formatWindInfo(speed: number, direction: string): string {
  return `${speed} km/h (${direction})`;
}

/**
 * Checks if weather data is available for a given date
 * @param date - Date to check
 * @returns True if date is within forecast range (typically 7-14 days)
 */
export function isWeatherAvailable(date: Date): boolean {
  const today = new Date();
  const diffTime = date.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  // Open-Meteo provides forecasts for up to 14 days in the future
  // and historical data for past dates
  return diffDays >= -365 && diffDays <= 14;
}

/**
 * Gets a user-friendly error message for weather errors
 * @param error - WeatherError object
 * @returns User-friendly error message
 */
export function getWeatherErrorMessage(error: WeatherError): string {
  switch (error.type) {
    case 'network':
      return 'Unable to connect to weather service. Please check your internet connection.';
    case 'api':
      if (error.status === 429) {
        return 'Weather service is temporarily unavailable. Please try again later.';
      }
      if (error.status && error.status >= 500) {
        return 'Weather service is experiencing issues. Please try again later.';
      }
      return 'Weather service error. Please try again.';
    case 'parsing':
      return 'Unable to process weather data. Please try again.';
    case 'validation':
      return error.message || 'Weather data is not available for this location or date.';
    default:
      return 'Unable to load weather forecast. Please try again.';
  }
}