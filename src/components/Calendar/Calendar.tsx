import React, { useState, useEffect } from "react";
import { MONTH_NAMES } from "../../types";
import type { Trip } from "../../types";
import { CalendarGrid } from "./CalendarGrid";
import { useAuth } from "../../contexts/AuthContext";
import { useDatabaseContext } from "../../contexts/DatabaseContext";
import { firebaseDataService } from "../../services/firebaseDataService";
import { databaseService } from "../../services/databaseService";

interface CalendarProps {
  onDateSelect: (date: Date) => void;
}

export const Calendar: React.FC<CalendarProps> = ({ onDateSelect }) => {
  const { user } = useAuth();
  const { isReady: dbReady } = useDatabaseContext();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(currentDate.getMonth());
  const [currentYear, setCurrentYear] = useState(currentDate.getFullYear());
  const [daysWithTrips, setDaysWithTrips] = useState<Set<string>>(new Set());
  const [loadingTrips, setLoadingTrips] = useState(false);

  // Load trips for the current month with robust error handling
  const loadTripsForMonth = async (retryCount = 0) => {
    if (!user) {
      setDaysWithTrips(new Set());
      return;
    }

    setLoadingTrips(true);
    const maxRetries = 3;
    const retryDelay = 500; // 500ms

    try {
      // Try Firebase first
      const allTrips = await firebaseDataService.getAllTrips();

      // Filter trips for the current month
      const daysWithTripsSet = new Set<string>();
      allTrips.forEach(trip => {
        const tripDate = new Date(trip.date);
        if (tripDate.getMonth() === currentMonth && tripDate.getFullYear() === currentYear) {
          const dayKey = `${tripDate.getFullYear()}-${tripDate.getMonth()}-${tripDate.getDate()}`;
          daysWithTripsSet.add(dayKey);
        }
      });

      setDaysWithTrips(daysWithTripsSet);
    } catch (error: any) {
      // If Firebase service not initialized and we haven't exceeded retries, wait and retry
      if (error.message === 'Service not initialized' && retryCount < maxRetries) {
        console.log(`Firebase service not ready, retrying in ${retryDelay}ms (attempt ${retryCount + 1}/${maxRetries})`);
        setTimeout(() => loadTripsForMonth(retryCount + 1), retryDelay);
        return;
      }

      console.error('Firebase trip loading failed, trying local fallback:', error);
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
    } finally {
      setLoadingTrips(false);
    }
  };

  // Update current date when month/year changes
  useEffect(() => {
    const newDate = new Date(currentYear, currentMonth, 1);
    setCurrentDate(newDate);
  }, [currentMonth, currentYear]);

  // Load trips when month/year changes or user becomes available
  useEffect(() => {
    if (user) {
      loadTripsForMonth();
    } else {
      setDaysWithTrips(new Set());
    }
  }, [currentMonth, currentYear, user]);

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

  return (
    <div className="calendar-container">
      {/* Calendar Header with Navigation */}
      <div className="flex items-center justify-between mb-4">
        <h2
          id="currentMonth"
          className="text-xl font-semibold text-gray-800 dark:text-gray-200"
        >
          {MONTH_NAMES[currentMonth]} {currentYear}
        </h2>

        <div className="flex space-x-2">
          <button
            id="prevMonth"
            onClick={handlePrevMonth}
            className="p-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            aria-label="Previous month"
          >
            <i className="fas fa-chevron-left text-gray-700 dark:text-gray-300"></i>
          </button>

          <button
            id="nextMonth"
            onClick={handleNextMonth}
            className="p-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            aria-label="Next month"
          >
            <i className="fas fa-chevron-right text-gray-700 dark:text-gray-300"></i>
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
