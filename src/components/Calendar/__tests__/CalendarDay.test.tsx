import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { CalendarDay } from '../CalendarDay';
import * as lunarService from '../../../services/lunarService';
import * as useIndexedDB from '../../../hooks/useIndexedDB';

// Mock the lunar service
vi.mock('../../../services/lunarService', () => ({
  getLunarPhase: vi.fn()
}));

// Mock the useIndexedDB hook
vi.mock('../../../hooks/useIndexedDB', () => ({
  useIndexedDB: vi.fn()
}));

const mockLunarPhase = {
  name: 'Hoata',
  quality: 'Excellent' as const,
  description: 'A very good day for eeling and crayfishing.',
  biteQualities: ['good', 'excellent', 'good', 'average'] as const
};

const mockUseIndexedDB = {
  trips: {
    getByDate: vi.fn()
  },
  weather: {},
  fish: {},
  clearAllData: vi.fn(),
  initialize: vi.fn(),
  isLoading: false,
  error: null,
  isReady: true
};

describe('CalendarDay', () => {
  const mockDate = new Date(2024, 0, 15); // January 15, 2024
  const mockOnDateSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(lunarService.getLunarPhase).mockReturnValue(mockLunarPhase);
    vi.mocked(useIndexedDB.useIndexedDB).mockReturnValue(mockUseIndexedDB);
    mockUseIndexedDB.trips.getByDate.mockResolvedValue([]);
  });

  it('renders day number correctly', async () => {
    render(
      <CalendarDay
        date={mockDate}
        dayNumber={15}
        isCurrentMonth={true}
        onDateSelect={mockOnDateSelect}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('15')).toBeInTheDocument();
    });
  });

  it('displays fishing quality indicator', async () => {
    render(
      <CalendarDay
        date={mockDate}
        dayNumber={15}
        isCurrentMonth={true}
        onDateSelect={mockOnDateSelect}
      />
    );

    await waitFor(() => {
      const qualityIndicator = document.querySelector('.quality-indicator');
      expect(qualityIndicator).toBeInTheDocument();
      expect(qualityIndicator).toHaveClass('quality-excellent');
    });
  });

  it('shows trip indicator when trips exist', async () => {
    mockUseIndexedDB.trips.getByDate.mockResolvedValue([{ id: 1, date: '2024-01-15' }]);

    render(
      <CalendarDay
        date={mockDate}
        dayNumber={15}
        isCurrentMonth={true}
        onDateSelect={mockOnDateSelect}
      />
    );

    await waitFor(() => {
      const tripIndicator = document.querySelector('.log-indicator');
      expect(tripIndicator).toBeInTheDocument();
      expect(tripIndicator?.querySelector('.fa-fish')).toBeInTheDocument();
    });
  });

  it('does not show trip indicator when no trips exist', async () => {
    mockUseIndexedDB.trips.getByDate.mockResolvedValue([]);

    render(
      <CalendarDay
        date={mockDate}
        dayNumber={15}
        isCurrentMonth={true}
        onDateSelect={mockOnDateSelect}
      />
    );

    await waitFor(() => {
      const tripIndicator = document.querySelector('.log-indicator');
      expect(tripIndicator).not.toBeInTheDocument();
    });
  });

  it('calls onDateSelect when clicked', async () => {
    render(
      <CalendarDay
        date={mockDate}
        dayNumber={15}
        isCurrentMonth={true}
        onDateSelect={mockOnDateSelect}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('15')).toBeInTheDocument();
    });

    const dayElement = screen.getByRole('button');
    fireEvent.click(dayElement);

    expect(mockOnDateSelect).toHaveBeenCalledWith(mockDate);
  });

  it('calls onDateSelect when Enter key is pressed', async () => {
    render(
      <CalendarDay
        date={mockDate}
        dayNumber={15}
        isCurrentMonth={true}
        onDateSelect={mockOnDateSelect}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('15')).toBeInTheDocument();
    });

    const dayElement = screen.getByRole('button');
    fireEvent.keyDown(dayElement, { key: 'Enter' });

    expect(mockOnDateSelect).toHaveBeenCalledWith(mockDate);
  });

  it('calls onDateSelect when Space key is pressed', async () => {
    render(
      <CalendarDay
        date={mockDate}
        dayNumber={15}
        isCurrentMonth={true}
        onDateSelect={mockOnDateSelect}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('15')).toBeInTheDocument();
    });

    const dayElement = screen.getByRole('button');
    fireEvent.keyDown(dayElement, { key: ' ' });

    expect(mockOnDateSelect).toHaveBeenCalledWith(mockDate);
  });

  it('applies opacity for non-current month days', async () => {
    render(
      <CalendarDay
        date={mockDate}
        dayNumber={15}
        isCurrentMonth={false}
        onDateSelect={mockOnDateSelect}
      />
    );

    await waitFor(() => {
      const dayElement = screen.getByRole('button');
      expect(dayElement).toHaveClass('opacity-50');
    });
  });

  it('displays correct quality colors for different fishing qualities', async () => {
    const qualities = [
      { quality: 'Excellent' as const, expectedClass: 'quality-excellent', expectedColor: '#10b981' },
      { quality: 'Good' as const, expectedClass: 'quality-good', expectedColor: '#3b82f6' },
      { quality: 'Average' as const, expectedClass: 'quality-average', expectedColor: '#f59e0b' },
      { quality: 'Poor' as const, expectedClass: 'quality-poor', expectedColor: '#ef4444' }
    ];

    for (const { quality, expectedClass, expectedColor } of qualities) {
      vi.mocked(lunarService.getLunarPhase).mockReturnValue({
        ...mockLunarPhase,
        quality
      });

      const { unmount } = render(
        <CalendarDay
          date={mockDate}
          dayNumber={15}
          isCurrentMonth={true}
          onDateSelect={mockOnDateSelect}
        />
      );

      await waitFor(() => {
        const qualityIndicator = document.querySelector('.quality-indicator');
        expect(qualityIndicator).toHaveClass(expectedClass);
        expect(qualityIndicator).toHaveStyle(`background-color: ${expectedColor}`);
      });

      unmount();
    }
  });

  it('handles error when checking trips gracefully', async () => {
    mockUseIndexedDB.trips.getByDate.mockRejectedValue(new Error('Database error'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <CalendarDay
        date={mockDate}
        dayNumber={15}
        isCurrentMonth={true}
        onDateSelect={mockOnDateSelect}
      />
    );

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Error checking trips for date:', expect.any(Error));
    });

    // Should not show trip indicator on error
    const tripIndicator = document.querySelector('.log-indicator');
    expect(tripIndicator).not.toBeInTheDocument();

    consoleSpy.mockRestore();
  });
});