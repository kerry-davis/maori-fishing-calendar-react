import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Calendar } from '../Calendar';
import { MONTH_NAMES } from '../../../types';

// Mock CalendarGrid component
vi.mock('../CalendarGrid', () => ({
  CalendarGrid: ({ currentMonth, currentYear, onDateSelect }: any) => (
    <div
      data-testid="calendar-grid"
      data-current-month={currentMonth}
      data-current-year={currentYear}
      onClick={() => onDateSelect(new Date(currentYear, currentMonth, 15))}
    >
      Calendar Grid for {MONTH_NAMES[currentMonth]} {currentYear}
    </div>
  )
}));

describe('Calendar', () => {
  const mockOnDateSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock current date to be consistent
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 0, 15)); // January 15, 2024
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders calendar with current month and year', () => {
    render(<Calendar onDateSelect={mockOnDateSelect} />);

    expect(screen.getByText('January 2024')).toBeInTheDocument();
    expect(screen.getByTestId('calendar-grid')).toBeInTheDocument();
  });

  it('renders navigation buttons', () => {
    render(<Calendar onDateSelect={mockOnDateSelect} />);

    const prevButton = screen.getByLabelText('Previous month');
    const nextButton = screen.getByLabelText('Next month');

    expect(prevButton).toBeInTheDocument();
    expect(nextButton).toBeInTheDocument();
    expect(prevButton.querySelector('.fa-chevron-left')).toBeInTheDocument();
    expect(nextButton.querySelector('.fa-chevron-right')).toBeInTheDocument();
  });

  it('navigates to previous month when prev button is clicked', () => {
    render(<Calendar onDateSelect={mockOnDateSelect} />);

    const prevButton = screen.getByLabelText('Previous month');
    fireEvent.click(prevButton);

    expect(screen.getByText('December 2023')).toBeInTheDocument();
    
    const calendarGrid = screen.getByTestId('calendar-grid');
    expect(calendarGrid.getAttribute('data-current-month')).toBe('11'); // December
    expect(calendarGrid.getAttribute('data-current-year')).toBe('2023');
  });

  it('navigates to next month when next button is clicked', () => {
    render(<Calendar onDateSelect={mockOnDateSelect} />);

    const nextButton = screen.getByLabelText('Next month');
    fireEvent.click(nextButton);

    expect(screen.getByText('February 2024')).toBeInTheDocument();
    
    const calendarGrid = screen.getByTestId('calendar-grid');
    expect(calendarGrid.getAttribute('data-current-month')).toBe('1'); // February
    expect(calendarGrid.getAttribute('data-current-year')).toBe('2024');
  });

  it('handles year boundary when navigating from January to December', () => {
    render(<Calendar onDateSelect={mockOnDateSelect} />);

    // Currently January 2024, go to previous month
    const prevButton = screen.getByLabelText('Previous month');
    fireEvent.click(prevButton);

    expect(screen.getByText('December 2023')).toBeInTheDocument();
    
    const calendarGrid = screen.getByTestId('calendar-grid');
    expect(calendarGrid.getAttribute('data-current-month')).toBe('11'); // December
    expect(calendarGrid.getAttribute('data-current-year')).toBe('2023');
  });

  it('handles year boundary when navigating from December to January', () => {
    // Start with December 2023
    vi.setSystemTime(new Date(2023, 11, 15)); // December 15, 2023
    
    render(<Calendar onDateSelect={mockOnDateSelect} />);

    expect(screen.getByText('December 2023')).toBeInTheDocument();

    // Navigate to next month
    const nextButton = screen.getByLabelText('Next month');
    fireEvent.click(nextButton);

    expect(screen.getByText('January 2024')).toBeInTheDocument();
    
    const calendarGrid = screen.getByTestId('calendar-grid');
    expect(calendarGrid.getAttribute('data-current-month')).toBe('0'); // January
    expect(calendarGrid.getAttribute('data-current-year')).toBe('2024');
  });

  it('passes onDateSelect callback to CalendarGrid', () => {
    render(<Calendar onDateSelect={mockOnDateSelect} />);

    const calendarGrid = screen.getByTestId('calendar-grid');
    fireEvent.click(calendarGrid);

    expect(mockOnDateSelect).toHaveBeenCalledWith(new Date(2024, 0, 15));
  });

  it('updates calendar grid when month changes', () => {
    render(<Calendar onDateSelect={mockOnDateSelect} />);

    // Initially January 2024
    let calendarGrid = screen.getByTestId('calendar-grid');
    expect(calendarGrid.getAttribute('data-current-month')).toBe('0');
    expect(calendarGrid.getAttribute('data-current-year')).toBe('2024');

    // Navigate to next month
    const nextButton = screen.getByLabelText('Next month');
    fireEvent.click(nextButton);

    // Should now be February 2024
    calendarGrid = screen.getByTestId('calendar-grid');
    expect(calendarGrid.getAttribute('data-current-month')).toBe('1');
    expect(calendarGrid.getAttribute('data-current-year')).toBe('2024');
  });

  it('multiple navigation clicks work correctly', () => {
    render(<Calendar onDateSelect={mockOnDateSelect} />);

    const nextButton = screen.getByLabelText('Next month');
    const prevButton = screen.getByLabelText('Previous month');

    // Navigate forward 3 months: Jan -> Feb -> Mar -> Apr
    fireEvent.click(nextButton);
    fireEvent.click(nextButton);
    fireEvent.click(nextButton);

    expect(screen.getByText('April 2024')).toBeInTheDocument();

    // Navigate back 2 months: Apr -> Mar -> Feb
    fireEvent.click(prevButton);
    fireEvent.click(prevButton);

    expect(screen.getByText('February 2024')).toBeInTheDocument();
  });

  it('has correct CSS classes for styling', () => {
    render(<Calendar onDateSelect={mockOnDateSelect} />);

    // Check header container
    const headerContainer = screen.getByText('January 2024').closest('.flex');
    expect(headerContainer).toHaveClass('flex', 'items-center', 'justify-between', 'mb-4');

    // Check month title
    const monthTitle = screen.getByText('January 2024');
    expect(monthTitle).toHaveClass('text-xl', 'font-semibold', 'text-gray-800', 'dark:text-gray-200');

    // Check navigation buttons
    const prevButton = screen.getByLabelText('Previous month');
    const nextButton = screen.getByLabelText('Next month');
    
    expect(prevButton).toHaveClass('p-2', 'rounded-lg', 'bg-gray-200', 'dark:bg-gray-700');
    expect(nextButton).toHaveClass('p-2', 'rounded-lg', 'bg-gray-200', 'dark:bg-gray-700');
  });

  it('has proper accessibility attributes', () => {
    render(<Calendar onDateSelect={mockOnDateSelect} />);

    const prevButton = screen.getByLabelText('Previous month');
    const nextButton = screen.getByLabelText('Next month');

    expect(prevButton).toHaveAttribute('aria-label', 'Previous month');
    expect(nextButton).toHaveAttribute('aria-label', 'Next month');
  });
});