import React, { useState, useEffect } from 'react';
import { MONTH_NAMES } from '../../types';
import { CalendarGrid } from './CalendarGrid';

interface CalendarProps {
  onDateSelect: (date: Date) => void;
}

export const Calendar: React.FC<CalendarProps> = ({ onDateSelect }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(currentDate.getMonth());
  const [currentYear, setCurrentYear] = useState(currentDate.getFullYear());

  // Update current date when month/year changes
  useEffect(() => {
    const newDate = new Date(currentYear, currentMonth, 1);
    setCurrentDate(newDate);
  }, [currentMonth, currentYear]);

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
        <button
          id="prevMonth"
          onClick={handlePrevMonth}
          className="p-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          aria-label="Previous month"
        >
          <i className="fas fa-chevron-left text-gray-700 dark:text-gray-300"></i>
        </button>
        
        <h2 
          id="currentMonth"
          className="text-xl font-semibold text-gray-800 dark:text-gray-200"
        >
          {MONTH_NAMES[currentMonth]} {currentYear}
        </h2>
        
        <button
          id="nextMonth"
          onClick={handleNextMonth}
          className="p-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          aria-label="Next month"
        >
          <i className="fas fa-chevron-right text-gray-700 dark:text-gray-300"></i>
        </button>
      </div>

      {/* Calendar Grid */}
      <CalendarGrid
        currentMonth={currentMonth}
        currentYear={currentYear}
        onDateSelect={handleDateSelect}
      />
    </div>
  );
};