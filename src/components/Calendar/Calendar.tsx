import React, { useState, useEffect } from "react";
import { MONTH_NAMES } from "../../types";
import type { Trip } from "../../types";
import { CalendarGrid } from "./CalendarGrid";
import { useAuth } from "../../contexts/AuthContext";
import { useDatabaseService } from "../../contexts/DatabaseContext";
import { databaseService } from "../../services/databaseService";

interface CalendarProps {
  onDateSelect: (date: Date) => void;
  refreshTrigger?: number;
}

export const Calendar: React.FC<CalendarProps> = ({ onDateSelect, refreshTrigger = 0 }) => {
  const { user } = useAuth();
  const db = useDatabaseService();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(currentDate.getMonth());
  const [currentYear, setCurrentYear] = useState(currentDate.getFullYear());
  const [daysWithTrips, setDaysWithTrips] = useState<Set<string>>(new Set());

  // Touch/swipe handling for mobile
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // Load trips for the current month with robust error handling
  const loadTripsForMonth = async () => {
    // Load trips for both authenticated and guest users
    console.log('Loading trips for month, user:', user ? 'authenticated' : 'guest');

    try {
      // Get trips from appropriate source (Firebase for authenticated, local for guest)
      const allTrips = await db.getAllTrips();
      console.log(`Calendar: Found ${allTrips.length} trips`);

      // Filter trips for the current month
      const daysWithTripsSet = new Set<string>();
      allTrips.forEach((trip: Trip) => {
        const tripDate = new Date(trip.date);
        if (tripDate.getMonth() === currentMonth && tripDate.getFullYear() === currentYear) {
          const dayKey = `${tripDate.getFullYear()}-${tripDate.getMonth()}-${tripDate.getDate()}`;
          daysWithTripsSet.add(dayKey);
        }
      });

      setDaysWithTrips(daysWithTripsSet);
    } catch (error: any) {
      console.error('Trip loading failed, trying local fallback:', error);
      try {
        // Fallback to local IndexedDB
        const localTrips = await databaseService.getAllTrips();

        // Filter trips for the current month
        const daysWithTripsSet = new Set<string>();
        localTrips.forEach((trip: Trip) => {
          const tripDate = new Date(trip.date);
          if (tripDate.getMonth() === currentMonth && tripDate.getFullYear() === currentYear) {
            const dayKey = `${tripDate.getFullYear()}-${tripDate.getMonth()}-${tripDate.getDate()}`;
            daysWithTripsSet.add(dayKey);
          }
        });

        setDaysWithTrips(daysWithTripsSet);
      } catch (localError) {
        console.error('Local fallback also failed:', localError);
        setDaysWithTrips(new Set());
      }
    }
  };

  // Update current date when month/year changes
  useEffect(() => {
    const newDate = new Date(currentYear, currentMonth, 1);
    setCurrentDate(newDate);
  }, [currentMonth, currentYear]);

  // Load trips when month/year changes or user becomes available
  useEffect(() => {
    // Load trips for both authenticated and guest users
    loadTripsForMonth();
  }, [currentMonth, currentYear, user]);

  // Listen for force refresh events
  useEffect(() => {
    const handleForceRefresh = () => {
      console.log('Calendar: Force refresh triggered');
      loadTripsForMonth();
    };

    window.addEventListener('forceCalendarRefresh', handleForceRefresh);
    return () => window.removeEventListener('forceCalendarRefresh', handleForceRefresh);
  }, []);

  // Reload trips when refreshTrigger changes (e.g., when new trip is created)
  useEffect(() => {
    if (refreshTrigger > 0) {
      console.log('Calendar: Refreshing trip data due to refreshTrigger change');
      loadTripsForMonth();
    }
  }, [refreshTrigger]);

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const handleDateSelect = (date: Date) => {
    onDateSelect(date);
  };

  // Touch handlers for swipe navigation
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe) {
      // Swipe left - go to previous month (backwards in time)
      handlePrevMonth();
    } else if (isRightSwipe) {
      // Swipe right - go to next month (forwards in time)
      handleNextMonth();
    }
  };

  return (
    <div
      className="calendar-container"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Calendar Header with Navigation */}
      <div className="flex items-center justify-between mb-4">
        <h2
          id="currentMonth"
          className="text-xl font-semibold"
          style={{ color: 'var(--primary-text)' }}
        >
          {MONTH_NAMES[currentMonth]} {currentYear}
        </h2>

        <div className="flex space-x-2">
          <button
            id="prevMonth"
            onClick={handlePrevMonth}
            className="icon-btn"
            aria-label="Previous month"
          >
            <i className="fas fa-chevron-left"></i>
          </button>

          <button
            id="nextMonth"
            onClick={handleNextMonth}
            className="icon-btn"
            aria-label="Next month"
          >
            <i className="fas fa-chevron-right"></i>
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <CalendarGrid
        currentMonth={currentMonth}
        currentYear={currentYear}
        onDateSelect={handleDateSelect}
        daysWithTrips={daysWithTrips}
      />
    </div>
  );
};
