import React from 'react';
import { Bar } from 'react-chartjs-2';
import type { ChartData } from '../../types';

export interface LocationChartProps {
  data: ChartData;
  className?: string;
}

/**
 * LocationChart component displays fishing performance by location
 * Shows bar chart of fish caught at different locations
 */
export const LocationChart: React.FC<LocationChartProps> = ({
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
        text: 'Fish Caught by Location'
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1
        }
      },
      x: {
        ticks: {
          maxRotation: 45,
          minRotation: 45
        }
      }
    },
  };

  return (
    <div className={`location-chart ${className}`}>
      <Bar data={data} options={options} />
    </div>
  );
};

export default LocationChart;