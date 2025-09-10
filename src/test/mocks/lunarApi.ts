import { vi } from 'vitest';

// Mock SunCalc responses
export const mockMoonIllumination = {
  fraction: 0.5, // 50% illuminated
  phase: 0.25, // First quarter
  angle: 1.5708, // 90 degrees
};

export const mockMoonPosition = {
  azimuth: 1.2, // 68.75 degrees
  altitude: 0.3, // 17.19 degrees
  distance: 384400, // km
  parallacticAngle: 0.1,
};

export const mockMoonTimes = {
  rise: new Date('2024-01-15T18:30:00Z'),
  set: new Date('2024-01-16T06:30:00Z'),
  alwaysUp: false,
  alwaysDown: false,
};

export const mockSunTimes = {
  sunrise: new Date('2024-01-15T06:30:00Z'),
  sunset: new Date('2024-01-15T18:30:00Z'),
  solarNoon: new Date('2024-01-15T12:30:00Z'),
  nadir: new Date('2024-01-15T00:30:00Z'),
  sunriseEnd: new Date('2024-01-15T06:33:00Z'),
  sunsetStart: new Date('2024-01-15T18:27:00Z'),
  dawn: new Date('2024-01-15T06:00:00Z'),
  dusk: new Date('2024-01-15T19:00:00Z'),
  nauticalDawn: new Date('2024-01-15T05:30:00Z'),
  nauticalDusk: new Date('2024-01-15T19:30:00Z'),
  nightEnd: new Date('2024-01-15T05:00:00Z'),
  night: new Date('2024-01-15T20:00:00Z'),
  goldenHourEnd: new Date('2024-01-15T07:00:00Z'),
  goldenHour: new Date('2024-01-15T18:00:00Z'),
};

// Different moon phases for testing
export const mockMoonPhases = {
  newMoon: {
    fraction: 0.0,
    phase: 0.0,
    angle: 0,
  },
  waxingCrescent: {
    fraction: 0.25,
    phase: 0.125,
    angle: 0.785,
  },
  firstQuarter: {
    fraction: 0.5,
    phase: 0.25,
    angle: 1.571,
  },
  waxingGibbous: {
    fraction: 0.75,
    phase: 0.375,
    angle: 2.356,
  },
  fullMoon: {
    fraction: 1.0,
    phase: 0.5,
    angle: 3.142,
  },
  waningGibbous: {
    fraction: 0.75,
    phase: 0.625,
    angle: 3.927,
  },
  lastQuarter: {
    fraction: 0.5,
    phase: 0.75,
    angle: 4.712,
  },
  waningCrescent: {
    fraction: 0.25,
    phase: 0.875,
    angle: 5.498,
  },
};

export const createSunCalcMock = (phase: keyof typeof mockMoonPhases = 'firstQuarter') => {
  return {
    getMoonIllumination: vi.fn(() => mockMoonPhases[phase]),
    getMoonPosition: vi.fn(() => mockMoonPosition),
    getMoonTimes: vi.fn(() => mockMoonTimes),
    getTimes: vi.fn(() => mockSunTimes),
  };
};

// Mock bite times calculation
export const mockBiteTimes = {
  major: [
    { start: '06:30', end: '08:30', quality: 'excellent' as const },
    { start: '18:30', end: '20:30', quality: 'excellent' as const },
  ],
  minor: [
    { start: '00:30', end: '01:30', quality: 'good' as const },
    { start: '12:30', end: '13:30', quality: 'good' as const },
  ],
};

export const mockLunarData = {
  phase: 'First Quarter',
  illumination: 50,
  age: 7.4,
  quality: 'Good' as const,
  biteTimes: mockBiteTimes,
  moonrise: '18:30',
  moonset: '06:30',
  sunrise: '06:30',
  sunset: '18:30',
};