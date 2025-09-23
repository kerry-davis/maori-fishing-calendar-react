import React from 'react';
import type { LunarPhase, FishingQuality } from '../../types';

interface CalendarDayProps {
  date: Date;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday?: boolean;
  hasTrips?: boolean;
  onDateSelect: (date: Date) => void;
  lunarPhase: LunarPhase;
}

export const CalendarDay: React.FC<CalendarDayProps> = ({
  date,
  dayNumber,
  isCurrentMonth,
  isToday = false,
  hasTrips = false,
  onDateSelect,
  lunarPhase
}) => {


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