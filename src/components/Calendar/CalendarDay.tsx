import React, { useState, useEffect } from 'react';
import { getLunarPhase } from '../../services/lunarService';
import { useIndexedDB } from '../../hooks/useIndexedDB';
import type { LunarPhase, FishingQuality } from '../../types';

interface CalendarDayProps {
  date: Date;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday?: boolean;
  onDateSelect: (date: Date) => void;
}

export const CalendarDay: React.FC<CalendarDayProps> = ({
  date,
  dayNumber,
  isCurrentMonth,
  isToday = false,
  onDateSelect
}) => {
  const [lunarPhase, setLunarPhase] = useState<LunarPhase | null>(null);
  const [hasTrips, setHasTrips] = useState(false);
  const { trips } = useIndexedDB();

  // Calculate lunar phase for this date
  useEffect(() => {
    const phase = getLunarPhase(date);
    setLunarPhase(phase);
  }, [date]);

  // Check if this date has any trips
  useEffect(() => {
    const checkTrips = async () => {
      try {
        const dateStr = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
        const tripsForDate = await trips.getByDate(dateStr);
        setHasTrips(tripsForDate.length > 0);
      } catch (error) {
        console.error('Error checking trips for date:', error);
        setHasTrips(false);
      }
    };

    checkTrips();
  }, [date, trips.getByDate]);

  const handleClick = () => {
    onDateSelect(date);
  };

  const getQualityClass = (quality: FishingQuality): string => {
    switch (quality) {
      case 'Excellent':
        return 'quality-excellent';
      case 'Good':
        return 'quality-good';
      case 'Average':
        return 'quality-average';
      case 'Poor':
        return 'quality-poor';
      default:
        return 'quality-poor';
    }
  };



  if (!lunarPhase) {
    return (
      <div className="calendar-day bg-gray-100 dark:bg-gray-800 rounded-lg p-2 min-h-[80px] flex flex-col items-center justify-center">
        <span className="day-number text-gray-400">Loading...</span>
      </div>
    );
  }

  return (
    <div
      className={`calendar-day bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 relative ${
        !isCurrentMonth ? 'opacity-50' : ''
      } ${isToday ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-600' : ''}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      aria-label={`${lunarPhase.name} - ${lunarPhase.quality} fishing day, ${date.toDateString()}${isToday ? ' (Today)' : ''}`}
    >
      {/* Day number */}
      <div className="day-number text-gray-800 dark:text-gray-200 mb-1">
        {dayNumber}
      </div>

      {/* Fishing quality indicator */}
      <div
        className={`quality-indicator ${getQualityClass(lunarPhase.quality)}`}
        title={`${lunarPhase.quality} fishing quality`}
      />

      {/* Quality text (shows on hover) */}
      <div className="quality-text text-gray-600 dark:text-gray-400">
        {lunarPhase.quality}
      </div>

      {/* Trip indicator */}
      {hasTrips && (
        <div className="log-indicator">
          <i className="fas fa-fish" title="Has logged trips"></i>
        </div>
      )}
    </div>
  );
};