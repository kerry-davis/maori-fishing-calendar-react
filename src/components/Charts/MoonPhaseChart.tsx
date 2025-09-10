import React from 'react';
import { Bar } from 'react-chartjs-2';
import type { ChartData } from '../../types';

export interface MoonPhaseChartProps {
  data: ChartData;
  className?: string;
}

/**
 * MoonPhaseChart component displays fishing performance by moon phase
 * Shows bar chart of fish caught during different lunar phases
 */
export const MoonPhaseChart: React.FC<MoonPhaseChartProps> = ({
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
        text: 'Fish Caught by Moon Phase'
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
    <div className={`moon-phase-chart ${className}`}>
      <Bar data={data} options={options} />
    </div>
  );
};

export default MoonPhaseChart;