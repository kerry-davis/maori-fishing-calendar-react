import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { CalendarGrid } from '../CalendarGrid';
import { DAY_NAMES } from '../../../types';
import * as useIndexedDB from '../../../hooks/useIndexedDB';

// Mock the useIndexedDB hook
vi.mock('../../../hooks/useIndexedDB', () => ({
  useIndexedDB: vi.fn()
}));

// Mock CalendarDay component
vi.mock('../CalendarDay', () => ({
  CalendarDay: ({ date, dayNumber, isCurrentMonth, onDateSelect }: any) => (
    <div
      data-testid="calendar-day"
      data-date={date.toISOString()}
      data-day-number={dayNumber}
      data-is-current-month={isCurrentMonth}
      onClick={() => onDateSelect(date)}
    >
      {dayNumber}
    </div>
  )
}));

const mockUseIndexedDB = {
  trips: {},
  weather: {},
  fish: {},
  clearAllData: vi.fn(),
  initialize: vi.fn(),
  isLoading: false,
  error: null,
  isReady: true
};

describe('CalendarGrid', () => {
  const mockOnDateSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useIndexedDB.useIndexedDB).mockReturnValue(mockUseIndexedDB);
    // No trips methods needed for CalendarGrid currently
  });

  it('renders day headers correctly', () => {
    render(
      <CalendarGrid
        currentMonth={0} // January
        currentYear={2024}
        onDateSelect={mockOnDateSelect}
      />
    );

    DAY_NAMES.forEach(dayName => {
      expect(screen.getByText(dayName)).toBeInTheDocument();
    });
  });

  it('renders correct number of calendar days (42 total)', () => {
    render(
      <CalendarGrid
        currentMonth={0} // January 2024
        currentYear={2024}
        onDateSelect={mockOnDateSelect}
      />
    );

    const calendarDays = screen.getAllByTestId('calendar-day');
    expect(calendarDays).toHaveLength(42); // 6 rows × 7 days
  });

  it('renders days from current month correctly', () => {
    render(
      <CalendarGrid
        currentMonth={0} // January 2024
        currentYear={2024}
        onDateSelect={mockOnDateSelect}
      />
    );

    // January 2024 has 31 days
    const currentMonthDays = screen.getAllByTestId('calendar-day')
      .filter(day => day.getAttribute('data-is-current-month') === 'true');
    
    expect(currentMonthDays).toHaveLength(31);

    // Check that days 1-31 are present
    for (let i = 1; i <= 31; i++) {
      const dayElement = currentMonthDays.find(day => 
        day.getAttribute('data-day-number') === i.toString()
      );
      expect(dayElement).toBeDefined();
    }
  });

  it('includes days from previous month to fill the grid', () => {
    render(
      <CalendarGrid
        currentMonth={0} // January 2024 (starts on Monday)
        currentYear={2024}
        onDateSelect={mockOnDateSelect}
      />
    );

    const allDays = screen.getAllByTestId('calendar-day');
    const prevMonthDays = allDays.filter(day => 
      day.getAttribute('data-is-current-month') === 'false' &&
      new Date(day.getAttribute('data-date')!).getMonth() === 11 // December
    );

    // January 1, 2024 is a Monday, so we should have 1 day from previous month (Sunday)
    expect(prevMonthDays.length).toBeGreaterThan(0);
  });

  it('includes days from next month to fill the grid', () => {
    render(
      <CalendarGrid
        currentMonth={0} // January 2024
        currentYear={2024}
        onDateSelect={mockOnDateSelect}
      />
    );

    const allDays = screen.getAllByTestId('calendar-day');
    const nextMonthDays = allDays.filter(day => 
      day.getAttribute('data-is-current-month') === 'false' &&
      new Date(day.getAttribute('data-date')!).getMonth() === 1 // February
    );

    expect(nextMonthDays.length).toBeGreaterThan(0);
  });

  it('handles year boundary correctly (December to January)', () => {
    render(
      <CalendarGrid
        currentMonth={11} // December
        currentYear={2023}
        onDateSelect={mockOnDateSelect}
      />
    );

    const allDays = screen.getAllByTestId('calendar-day');
    
    // Check for days from next year (January 2024)
    const nextYearDays = allDays.filter(day => {
      const date = new Date(day.getAttribute('data-date')!);
      return date.getFullYear() === 2024 && date.getMonth() === 0;
    });

    expect(nextYearDays.length).toBeGreaterThan(0);
  });

  it('handles year boundary correctly (January to December)', () => {
    render(
      <CalendarGrid
        currentMonth={0} // January
        currentYear={2024}
        onDateSelect={mockOnDateSelect}
      />
    );

    const allDays = screen.getAllByTestId('calendar-day');
    
    // Check for days from previous year (December 2023)
    const prevYearDays = allDays.filter(day => {
      const date = new Date(day.getAttribute('data-date')!);
      return date.getFullYear() === 2023 && date.getMonth() === 11;
    });

    expect(prevYearDays.length).toBeGreaterThan(0);
  });

  it('passes correct props to CalendarDay components', () => {
    render(
      <CalendarGrid
        currentMonth={0} // January 2024
        currentYear={2024}
        onDateSelect={mockOnDateSelect}
      />
    );

    const calendarDays = screen.getAllByTestId('calendar-day');
    
    // Check first day of current month
    const firstCurrentMonthDay = calendarDays.find(day => 
      day.getAttribute('data-is-current-month') === 'true' &&
      day.getAttribute('data-day-number') === '1'
    );

    expect(firstCurrentMonthDay).toBeDefined();
    expect(firstCurrentMonthDay?.getAttribute('data-date')).toBe(
      new Date(2024, 0, 1).toISOString()
    );
  });

  it('creates unique keys for each calendar day', () => {
    const { container } = render(
      <CalendarGrid
        currentMonth={0} // January 2024
        currentYear={2024}
        onDateSelect={mockOnDateSelect}
      />
    );

    const calendarDays = container.querySelectorAll('[data-testid="calendar-day"]');
    const keys = Array.from(calendarDays).map((_, index) => 
      // In a real scenario, React would use the key prop, but we can't directly test that
      // Instead, we verify that each day has unique date attributes
      calendarDays[index].getAttribute('data-date')
    );

    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(keys.length); // All keys should be unique
  });

  it('renders calendar grid with correct CSS classes', () => {
    render(
      <CalendarGrid
        currentMonth={0}
        currentYear={2024}
        onDateSelect={mockOnDateSelect}
      />
    );

    // Check day headers container
    const dayHeadersContainer = screen.getByText('Sun').closest('.grid');
    expect(dayHeadersContainer).toHaveClass('grid', 'grid-cols-7', 'gap-1', 'mb-2');

    // Check calendar days container
    const calendarDaysContainer = document.getElementById('calendarDays');
    expect(calendarDaysContainer).toHaveClass('grid', 'grid-cols-7', 'gap-1');
  });
});