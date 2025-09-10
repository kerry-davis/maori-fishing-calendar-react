import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LunarModal } from '../LunarModal';
import { useLocationContext } from '../../../contexts/LocationContext';
import { useSingleModal } from '../../../hooks/useModal';
import * as lunarService from '../../../services/lunarService';
import * as weatherService from '../../../services/weatherService';

// Mock dependencies
vi.mock('../../../contexts/LocationContext');
vi.mock('../../../hooks/useModal');
vi.mock('../../../services/lunarService');
vi.mock('../../../services/weatherService');
vi.mock('react-dom', async () => {
  const actual = await vi.importActual('react-dom');
  return {
    ...actual,
    createPortal: (children: React.ReactNode) => children,
  };
});

const mockUseLocationContext = vi.mocked(useLocationContext);
const mockUseSingleModal = vi.mocked(useSingleModal);
const mockLunarService = vi.mocked(lunarService);
const mockWeatherService = vi.mocked(weatherService);

describe('LunarModal', () => {
  const mockLocation = {
    lat: -36.8485,
    lon: 174.7633,
    name: 'Auckland, New Zealand'
  };

  const mockLunarPhase = {
    name: 'Whiro',
    quality: 'Poor' as const,
    description: 'The new moon. An unfavourable day for fishing.',
    biteQualities: ['poor', 'poor', 'poor', 'poor'] as const
  };

  const mockPhaseData = {
    phaseIndex: 0,
    moonAge: 0.5,
    illumination: 0.02
  };

  const mockBiteTimes = {
    major: [
      { start: '06:00', end: '08:00', quality: 'poor' as const },
      { start: '18:00', end: '20:00', quality: 'poor' as const }
    ],
    minor: [
      { start: '12:00', end: '13:00', quality: 'poor' as const }
    ]
  };

  const mockSunMoonTimes = {
    sunrise: '06:30',
    sunset: '19:30',
    moonrise: '05:45',
    moonset: '18:15'
  };

  const mockWeatherData = {
    date: '2024-01-15',
    temperatureMax: 22,
    temperatureMin: 15,
    windSpeed: 12,
    windDirection: 180,
    windDirectionCardinal: 'S'
  };

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup default mock implementations
    mockUseLocationContext.mockReturnValue({
      userLocation: mockLocation,
      setLocation: vi.fn(),
      requestLocation: vi.fn().mockResolvedValue(undefined)
    });

    mockUseSingleModal.mockReturnValue({
      isOpen: true,
      data: {
        selectedDate: new Date('2024-01-15'),
        onTripLogOpen: vi.fn()
      },
      open: vi.fn(),
      close: vi.fn(),
      isAnimating: false
    });

    mockLunarService.getLunarPhase.mockReturnValue(mockLunarPhase);
    mockLunarService.getMoonPhaseData.mockReturnValue(mockPhaseData);
    mockLunarService.calculateBiteTimes.mockReturnValue(mockBiteTimes);
    mockLunarService.getSunMoonTimes.mockReturnValue(mockSunMoonTimes);

    mockWeatherService.isWeatherAvailable.mockReturnValue(true);
    mockWeatherService.fetchWeatherForLocation.mockResolvedValue(mockWeatherData);
    mockWeatherService.formatTemperatureRange.mockReturnValue('15°C - 22°C');
    mockWeatherService.formatWindInfo.mockReturnValue('12 km/h (S)');
  });

  afterEach(() => {
    document.body.style.overflow = '';
    document.body.classList.remove('modal-open');
  });

  it('renders modal when open', () => {
    render(<LunarModal />);

    expect(screen.getByText('Whiro')).toBeInTheDocument();
    expect(screen.getByText(/Monday, 15 January 2024/)).toBeInTheDocument();
    expect(screen.getByText('The new moon. An unfavourable day for fishing.')).toBeInTheDocument();
  });

  it('does not render when modal is closed', () => {
    mockUseSingleModal.mockReturnValue({
      isOpen: false,
      data: null,
      open: vi.fn(),
      close: vi.fn(),
      isAnimating: false
    });

    render(<LunarModal />);

    expect(screen.queryByText('Whiro')).not.toBeInTheDocument();
  });

  it('displays moon phase information correctly', () => {
    render(<LunarModal />);

    // Check for the quality badge (first occurrence of "Poor")
    const poorElements = screen.getAllByText('Poor');
    expect(poorElements).toHaveLength(2); // One in badge, one in legend
    expect(poorElements[0]).toHaveClass('bg-red-500'); // Quality badge
    
    expect(screen.getByText('Moon age: 0.5 days')).toBeInTheDocument();
    expect(screen.getByText('Illumination: 2%')).toBeInTheDocument();
  });

  it('displays bite times when location is available', () => {
    render(<LunarModal />);

    expect(screen.getByText('Major Bites')).toBeInTheDocument();
    expect(screen.getByText('Minor Bites')).toBeInTheDocument();
    expect(screen.getByText('06:00 - 08:00')).toBeInTheDocument();
    expect(screen.getByText('18:00 - 20:00')).toBeInTheDocument();
    expect(screen.getByText('12:00 - 13:00')).toBeInTheDocument();
  });

  it('displays location prompt when no location is set', () => {
    mockUseLocationContext.mockReturnValue({
      userLocation: null,
      setLocation: vi.fn(),
      requestLocation: vi.fn()
    });

    render(<LunarModal />);

    expect(screen.getByText('Set a location to see bite times')).toBeInTheDocument();
    expect(screen.getByText('Set a location to see weather forecast')).toBeInTheDocument();
    expect(screen.getByText('Set a location to see sun and moon times')).toBeInTheDocument();
  });

  it('displays weather information when available', async () => {
    render(<LunarModal />);

    await waitFor(() => {
      expect(screen.getByText('Weather Forecast')).toBeInTheDocument();
    });

    expect(mockWeatherService.fetchWeatherForLocation).toHaveBeenCalledWith(
      mockLocation,
      expect.any(Date)
    );
  });

  it('displays sun and moon times when location is available', () => {
    render(<LunarModal />);

    expect(screen.getByText('Sun & Moon')).toBeInTheDocument();
    expect(screen.getByText('Sunrise:')).toBeInTheDocument();
    expect(screen.getByText('06:30')).toBeInTheDocument();
    expect(screen.getByText('Sunset:')).toBeInTheDocument();
    expect(screen.getByText('19:30')).toBeInTheDocument();
    expect(screen.getByText('Moonrise:')).toBeInTheDocument();
    expect(screen.getByText('05:45')).toBeInTheDocument();
    expect(screen.getByText('Moonset:')).toBeInTheDocument();
    expect(screen.getByText('18:15')).toBeInTheDocument();
  });

  it('handles day navigation', () => {
    render(<LunarModal />);

    const prevButton = screen.getByLabelText('Previous day');
    const nextButton = screen.getByLabelText('Next day');

    expect(prevButton).toBeInTheDocument();
    expect(nextButton).toBeInTheDocument();

    fireEvent.click(nextButton);
    // The component should update the internal date state
    // We can't easily test the internal state change without exposing it
    // but we can verify the buttons are clickable
    expect(nextButton).not.toBeDisabled();

    fireEvent.click(prevButton);
    expect(prevButton).not.toBeDisabled();
  });

  it('handles location request', async () => {
    const mockRequestLocation = vi.fn().mockResolvedValue(undefined);
    mockUseLocationContext.mockReturnValue({
      userLocation: null,
      setLocation: vi.fn(),
      requestLocation: mockRequestLocation
    });

    render(<LunarModal />);

    const locationButton = screen.getByTitle('Use current location');
    fireEvent.click(locationButton);

    expect(mockRequestLocation).toHaveBeenCalled();
  });

  it('handles trip log button click', () => {
    const mockOnTripLogOpen = vi.fn();
    mockUseSingleModal.mockReturnValue({
      isOpen: true,
      data: {
        selectedDate: new Date('2024-01-15'),
        onTripLogOpen: mockOnTripLogOpen
      },
      open: vi.fn(),
      close: vi.fn(),
      isAnimating: false
    });

    render(<LunarModal />);

    const tripLogButton = screen.getByText('View / Manage Trip Log');
    fireEvent.click(tripLogButton);

    expect(mockOnTripLogOpen).toHaveBeenCalledWith(expect.any(Date));
  });

  it('displays bite time quality legend', () => {
    render(<LunarModal />);

    expect(screen.getByText('Bite Time Quality Legend')).toBeInTheDocument();
    expect(screen.getByText('Excellent')).toBeInTheDocument();
    expect(screen.getByText('Good')).toBeInTheDocument();
    expect(screen.getByText('Average')).toBeInTheDocument();
    expect(screen.getByText('Fair')).toBeInTheDocument();
    
    // Check that there are multiple "Poor" elements (quality badge + legend)
    const poorElements = screen.getAllByText('Poor');
    expect(poorElements).toHaveLength(2);
  });

  it('handles weather loading state', () => {
    // Mock a pending promise to simulate loading
    mockWeatherService.fetchWeatherForLocation.mockReturnValue(
      new Promise(() => {}) // Never resolves to keep loading state
    );

    render(<LunarModal />);

    expect(screen.getByText('Loading weather...')).toBeInTheDocument();
  });

  it('handles weather error state', async () => {
    const mockError = {
      type: 'network' as const,
      message: 'Network error'
    };
    
    mockWeatherService.fetchWeatherForLocation.mockRejectedValue(mockError);
    mockWeatherService.getWeatherErrorMessage.mockReturnValue('Unable to connect to weather service');

    render(<LunarModal />);

    await waitFor(() => {
      expect(screen.getByText('Unable to connect to weather service')).toBeInTheDocument();
    });
  });

  it('handles location input changes', () => {
    render(<LunarModal />);

    const locationInput = screen.getByPlaceholderText('Enter a location');
    fireEvent.change(locationInput, { target: { value: 'Wellington' } });

    expect(locationInput).toHaveValue('Wellington');
  });

  it('closes modal when close button is clicked', () => {
    const mockClose = vi.fn();
    mockUseSingleModal.mockReturnValue({
      isOpen: true,
      data: {
        selectedDate: new Date('2024-01-15'),
        onTripLogOpen: vi.fn()
      },
      open: vi.fn(),
      close: mockClose,
      isAnimating: false
    });

    render(<LunarModal />);

    const closeButton = screen.getByLabelText('Close modal');
    fireEvent.click(closeButton);

    expect(mockClose).toHaveBeenCalled();
  });
});