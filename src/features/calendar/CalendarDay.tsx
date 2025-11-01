import React from 'react';
import type { LunarPhase, FishingQuality } from "@shared/types";

interface CalendarDayProps {
   date: Date;
   dayNumber: number;
   isCurrentMonth: boolean;
   isToday?: boolean;
   hasTrips?: boolean;
   onDateSelect: (date: Date) => void;
   lunarPhase: LunarPhase;
   style?: React.CSSProperties;
 }

export const CalendarDay: React.FC<CalendarDayProps> = ({
   date,
   dayNumber,
   isCurrentMonth,
   isToday = false,
   hasTrips = false,
   onDateSelect,
   lunarPhase,
   style
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
      case 'Poor':
        return 'quality-poor';
      default:
        return 'quality-poor';
    }
  };





  return (
    <div
      className={`calendar-day rounded-lg border relative ${
        !isCurrentMonth ? 'opacity-50' : ''
      } ${isToday ? 'ring-2 border-blue-300' : ''}`}
      style={{
        backgroundColor: isToday ? 'var(--secondary-background)' : 'var(--card-background)',
        borderColor: isToday ? 'var(--accent-color)' : 'var(--card-border)',
        color: 'var(--primary-text)',
        ...style
      }}
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
      <div className="day-number mb-1" style={{ color: 'var(--primary-text)' }}>
        {dayNumber}
      </div>

      {/* Fishing quality indicator */}
      <div
        className={`quality-indicator ${getQualityClass(lunarPhase.quality)}`}
        title={`${lunarPhase.quality} fishing quality`}
      />

      {/* Quality text (shows on hover) */}
      <div className="quality-text" style={{ color: 'var(--secondary-text)' }}>
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