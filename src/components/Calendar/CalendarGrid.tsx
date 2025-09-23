import React, { useMemo } from "react";
import { DAY_NAMES } from "../../types";
import { CalendarDay } from "./CalendarDay";
import { getLunarPhase } from "../../services/lunarService";
// import { useIndexedDB } from '../../hooks/useIndexedDB';

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

  // Get days from previous month to fill the grid
  const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
  const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

  // Get days from next month to fill the grid
  const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
  const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;

  // Calculate total cells needed (6 rows × 7 days = 42 cells)
  const totalCells = 42;
  const daysFromNextMonth = totalCells - startingDayOfWeek - daysInMonth;

  // Create array of all days to display
  const calendarDays = [];

  // Add empty cells for days before the first day of the month
  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarDays.push({
      date: null,
      isCurrentMonth: false,
      dayNumber: null,
      isEmpty: true,
    });
  }

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
    const date = new Date(currentYear, currentMonth, day);
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

  // Add empty cells for remaining days to complete the grid if needed
  const remainingCells = totalCells - calendarDays.length;
  for (let i = 0; i < remainingCells; i++) {
    calendarDays.push({
      date: null,
      isCurrentMonth: false,
      dayNumber: null,
      isEmpty: true,
    });
  }

  return (
    <div className="calendar-grid">
      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {DAY_NAMES.map((dayName) => (
          <div
            key={dayName}
            className="text-center text-sm font-semibold text-gray-600 dark:text-gray-400 py-2"
          >
            {dayName}
          </div>
        ))}
      </div>

      {/* Calendar days grid */}
      <div id="calendarDays" className="grid grid-cols-7 gap-1">
        {calendarDays.map((dayData, index) => {
          // Render empty cell for non-current month days
          if (dayData.isEmpty || !dayData.date) {
            return (
              <div
                key={`empty-${index}`}
                className="calendar-day-empty min-h-[80px] rounded-lg"
              />
            );
          }

          const dayKey = `${dayData.date.getFullYear()}-${dayData.date.getMonth()}-${dayData.date.getDate()}`;
          const hasTrips = daysWithTrips.has(dayKey);

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
            />
          );
        })}
      </div>
    </div>
  );
};
