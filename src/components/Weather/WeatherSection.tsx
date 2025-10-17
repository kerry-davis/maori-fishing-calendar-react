/**
 * WeatherSection Component
 * Weather forecast section for the lunar modal, matching existing HTML structure
 */

import React from 'react';
import { WeatherForecast } from './WeatherForecast';

interface WeatherSectionProps {
  date: Date;
  className?: string;
}

export const WeatherSection: React.FC<WeatherSectionProps> = ({
  date,
  className = ''
}) => {
  return (
    <div className={`border-t dark:border-gray-700 pt-4 mb-4 ${className}`}>
      <h4 className="form-label text-lg mb-3">
        Weather Forecast
      </h4>
      <WeatherForecast 
        date={date}
        className="text-sm"
        showTideLabel={false}
      />
    </div>
  );
};

export default WeatherSection;