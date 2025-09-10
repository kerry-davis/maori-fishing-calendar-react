import React from 'react';
import { vi } from 'vitest';

// Mock Chart.js components
export const MockBar = ({ data, options }: any) => (
  <div 
    data-testid="bar-chart" 
    data-chart-data={JSON.stringify(data)} 
    data-chart-options={JSON.stringify(options)}
  >
    Bar Chart
  </div>
);

export const MockDoughnut = ({ data, options }: any) => (
  <div 
    data-testid="doughnut-chart" 
    data-chart-data={JSON.stringify(data)} 
    data-chart-options={JSON.stringify(options)}
  >
    Doughnut Chart
  </div>
);

export const MockLine = ({ data, options }: any) => (
  <div 
    data-testid="line-chart" 
    data-chart-data={JSON.stringify(data)} 
    data-chart-options={JSON.stringify(options)}
  >
    Line Chart
  </div>
);

// Mock react-chartjs-2
vi.mock('react-chartjs-2', () => ({
  Bar: MockBar,
  Doughnut: MockDoughnut,
  Line: MockLine,
}));