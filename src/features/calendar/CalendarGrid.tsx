import React, { useMemo } from "react";
import { DAY_NAMES } from "@shared/types";
import { CalendarDay } from "./CalendarDay";
import { getLunarPhase } from "@shared/services/lunarService";
// import { useIndexedDB } from '@shared/hooks/useIndexedDB';

interface CalendarGridProps {
  currentMonth: number;
  currentYear: number;
  onDateSelect: (date: Date) => void;
  daysWithTrips: Set<string>;
}

export const CalendarGrid: React.FC<CalendarGridProps> = ({
  currentMonth,
  currentYear,
  onDateSelect,
  daysWithTrips,
}) => {
  // Note: getTripsForMonth will be used in future enhancements for performance optimization

  // Get current date for highlighting today
  const today = new Date();
  const todayString = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;

  // Get the first day of the month and how many days are in the month
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
  const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();
  const startingDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7; // 0 = Monday, 1 = Tuesday, etc.


  // Create array of all days to display
  const calendarDays = [];


  // Pre-calculate lunar phases for all days in the month to avoid loading states
  const lunarPhases = useMemo(() => {
    const phases = new Map();
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentYear, currentMonth, day);
      const phase = getLunarPhase(date);
      phases.set(day, phase);
    }
    return phases;
  }, [currentYear, currentMonth, daysInMonth]);

  // Add days from current month only
  for (let day = 1; day <= daysInMonth; day++) {
    // Create date at UTC midnight to avoid timezone issues with tide services
    // This represents the calendar date (year/month/day) rather than a specific moment
    const date = new Date(Date.UTC(currentYear, currentMonth, day, 0, 0, 0, 0));
    const dateString = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    calendarDays.push({
      date,
      isCurrentMonth: true,
      dayNumber: day,
      isToday: dateString === todayString,
      isEmpty: false,
      lunarPhase: lunarPhases.get(day),
    });
  }


  return (
    <div className="calendar-grid">
      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {DAY_NAMES.map((dayName) => (
          <div
            key={dayName}
            className="text-center text-sm font-semibold py-2"
            style={{ color: 'var(--secondary-text)' }}
          >
            {dayName}
          </div>
        ))}
      </div>

      {/* Calendar days grid */}
      <div id="calendarDays" className="grid grid-cols-7 gap-1">
        {calendarDays.map((dayData, index) => {
          const dayKey = `${dayData.date.getFullYear()}-${dayData.date.getMonth()}-${dayData.date.getDate()}`;
          const hasTrips = daysWithTrips.has(dayKey);

          // Calculate grid column start position for the first day of the month
          const gridColumnStart = index === 0 ? startingDayOfWeek + 1 : 'auto';

          return (
            <CalendarDay
              key={dayKey}
              date={dayData.date}
              dayNumber={dayData.dayNumber}
              isCurrentMonth={dayData.isCurrentMonth}
              isToday={dayData.isToday}
              hasTrips={hasTrips}
              onDateSelect={onDateSelect}
              lunarPhase={dayData.lunarPhase}
              style={index === 0 ? { gridColumnStart } : undefined}
            />
          );
        })}
      </div>
    </div>
  );
};
