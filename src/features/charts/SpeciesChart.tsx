import React from 'react';
import { Pie } from 'react-chartjs-2';
import type { ChartData } from '../../shared/types';

export interface SpeciesChartProps {
  data: ChartData;
  className?: string;
}

/**
 * SpeciesChart component displays catch breakdown by species
 * Shows pie chart of different fish species caught
 */
export const SpeciesChart: React.FC<SpeciesChartProps> = ({
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
        text: 'Catch Breakdown by Species'
      }
    },
  };

  return (
    <div className={`species-chart ${className}`}>
      <Pie data={data} options={options} />
    </div>
  );
};

export default SpeciesChart;