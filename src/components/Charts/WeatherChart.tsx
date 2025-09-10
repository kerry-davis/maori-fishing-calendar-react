import React from 'react';
import { Bar } from 'react-chartjs-2';
import type { ChartData } from '../../types';

export interface WeatherChartProps {
  data: ChartData;
  className?: string;
}

/**
 * WeatherChart component displays fishing performance by weather conditions
 * Shows bar chart of fish caught during different weather conditions
 */
export const WeatherChart: React.FC<WeatherChartProps> = ({
  data,
  className = ''
}) => {
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Fish Caught by Weather Condition'
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1
        }
      },
    },
  };

  return (
    <div className={`weather-chart ${className}`}>
      <Bar data={data} options={options} />
    </div>
  );
};

export default WeatherChart;