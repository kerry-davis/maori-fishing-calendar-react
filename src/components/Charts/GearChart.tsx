import React from 'react';
import { Pie } from 'react-chartjs-2';
import type { ChartData } from '../../types';

export interface GearChartProps {
  data: ChartData;
  className?: string;
}

/**
 * GearChart component displays gear effectiveness breakdown
 * Shows pie chart of fish caught using different gear types
 */
export const GearChart: React.FC<GearChartProps> = ({
  data,
  className = ''
}) => {
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
      },
      title: {
        display: true,
        text: 'Gear Effectiveness'
      }
    },
  };

  return (
    <div className={`gear-chart ${className}`}>
      <Pie data={data} options={options} />
    </div>
  );
};

export default GearChart;