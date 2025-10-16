import React, { useState, useEffect, useCallback } from "react";
import { MONTH_NAMES } from "../../types";
import type { Trip } from "../../types";
import { CalendarGrid } from "./CalendarGrid";
import { useAuth } from "../../contexts/AuthContext";
import { useDatabaseService } from "../../contexts/DatabaseContext";
import { databaseService } from "../../services/databaseService";
import { DEV_LOG, PROD_ERROR } from '../../utils/loggingHelpers';

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
  
  // Track immediate refresh state for instant UI updates
  const [immediateRefresh, setImmediateRefresh] = useState(0);

  // Touch/swipe handling for mobile
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // Load trips for the current month with robust error handling
  const loadTripsForMonth = useCallback(async () => {
    // Load trips for both authenticated and guest users
    DEV_LOG('Loading trips for month, user:', user ? 'authenticated' : 'guest');

    try {
      // Get trips from appropriate source (Firebase for authenticated, local for guest)
      const allTrips = await db.getAllTrips();
      DEV_LOG(`Calendar: Found ${allTrips.length} trips`);

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
      PROD_ERROR('Trip loading failed, trying local fallback:', error);
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
        PROD_ERROR('Local fallback also failed:', localError);
        setDaysWithTrips(new Set());
      }
    }
  }, [currentMonth, currentYear, db, user]);

  // Update current date when month/year changes
  useEffect(() => {
    const newDate = new Date(currentYear, currentMonth, 1);
    setCurrentDate(newDate);
  }, [currentMonth, currentYear]);

  // Load trips when month/year changes or user becomes available
  useEffect(() => {
    // Load trips for both authenticated and guest users
    loadTripsForMonth();
  }, [loadTripsForMonth]);

  // Listen for force refresh events
  useEffect(() => {
    const handleForceRefresh = () => {
      DEV_LOG('Calendar: Force refresh triggered');
      loadTripsForMonth();
    };

    window.addEventListener('forceCalendarRefresh', handleForceRefresh);
    return () => window.removeEventListener('forceCalendarRefresh', handleForceRefresh);
  }, [loadTripsForMonth]);

  // Listen for user data ready events (triggered after login when user-specific data is available)
  useEffect(() => {
    const handleUserDataReady = (event: Event) => {
      const customEvent = event as CustomEvent;
      DEV_LOG('Calendar: User data ready event received', customEvent.detail);
      DEV_LOG('Calendar: user context:', user ? user.email : 'none');
      DEV_LOG('Calendar: current month/year:', `${currentMonth}/${currentYear}`);
      DEV_LOG('Calendar: Refreshing trip indicators to show user-specific data');
      loadTripsForMonth();
    };

    window.addEventListener('userDataReady', handleUserDataReady);
    return () => window.removeEventListener('userDataReady', handleUserDataReady);
  }, [currentMonth, currentYear, loadTripsForMonth, user]);

  // Listen for immediate auth state changes for instant indicator updates
  useEffect(() => {
    const handleAuthStateChanged = (event: Event) => {
      const customEvent = event as CustomEvent;
      DEV_LOG('Calendar: Immediate auth state change detected', customEvent.detail);
      DEV_LOG('Calendar: Triggering immediate indicator update');
      DEV_LOG('Calendar: user context:', user ? user.email : 'none');
      DEV_LOG('Calendar: current month/year:', `${currentMonth}/${currentYear}`);
      
      // Trigger immediate refresh while data loads in background
      setImmediateRefresh(prev => prev + 1);
      loadTripsForMonth();
    };

    window.addEventListener('authStateChanged', handleAuthStateChanged);
    return () => window.removeEventListener('authStateChanged', handleAuthStateChanged);
  }, [currentMonth, currentYear, loadTripsForMonth, user]);

  // Listen for database data readiness signals without navigation
  useEffect(() => {
    const handleDatabaseDataReady = (event: Event) => {
      const customEvent = event as CustomEvent;
      DEV_LOG('Calendar: Database data ready signal received', customEvent.detail);
      DEV_LOG('Calendar: Performing final indicator refresh with actual data');
      
      // Perform final refresh with accurate data
      loadTripsForMonth();
    };

    window.addEventListener('databaseDataReady', handleDatabaseDataReady);
    return () => window.removeEventListener('databaseDataReady', handleDatabaseDataReady);
  }, [currentMonth, currentYear, loadTripsForMonth, user]);

  // React to immediate refresh state changes for immediate UI updates
  useEffect(() => {
    if (immediateRefresh > 0) {
      DEV_LOG('Calendar: Performing immediate refresh for instant UI update');
      loadTripsForMonth();
    }
  }, [immediateRefresh, loadTripsForMonth]);

  // Reload trips when refreshTrigger changes (e.g., when new trip is created)
  useEffect(() => {
    if (refreshTrigger > 0) {
      DEV_LOG('Calendar: Refreshing trip data due to refreshTrigger change');
      loadTripsForMonth();
    }
  }, [loadTripsForMonth, refreshTrigger]);

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
      // Swipe left - go to next month (forwards in time)
      handleNextMonth();
    } else if (isRightSwipe) {
      // Swipe right - go to previous month (backwards in time)
      handlePrevMonth();
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
