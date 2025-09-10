import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import MoonPhaseChart from '../MoonPhaseChart';
import type { ChartData } from '../../../types';

// Mock react-chartjs-2
vi.mock('react-chartjs-2', () => ({
  Bar: vi.fn(({ data, options }) => (
    <div data-testid="moon-phase-bar-chart">
      <div data-testid="chart-title">{options?.plugins?.title?.text}</div>
      <div data-testid="chart-data">{JSON.stringify(data)}</div>
    </div>
  ))
}));

describe('MoonPhaseChart', () => {
  const mockData: ChartData = {
    labels: ['Whiro', 'Tirea', 'Hoata'],
    datasets: [{
      label: '# Fish Caught',
      data: [2, 5, 8],
      backgroundColor: 'rgba(54, 162, 235, 0.6)',
      borderColor: 'rgba(54, 162, 235, 1)'
    }]
  };

  it('renders moon phase chart with data', () => {
    render(<MoonPhaseChart data={mockData} />);

    expect(screen.getByTestId('moon-phase-bar-chart')).toBeInTheDocument();
    expect(screen.getByTestId('chart-title')).toHaveTextContent('Fish Caught by Moon Phase');
  });

  it('passes data to chart component', () => {
    render(<MoonPhaseChart data={mockData} />);

    const chartData = screen.getByTestId('chart-data');
    expect(chartData).toHaveTextContent('Whiro');
    expect(chartData).toHaveTextContent('Tirea');
    expect(chartData).toHaveTextContent('Hoata');
  });

  it('applies custom className', () => {
    const { container } = render(
      <MoonPhaseChart data={mockData} className="custom-class" />
    );

    expect(container.firstChild).toHaveClass('moon-phase-chart', 'custom-class');
  });

  it('renders with empty data', () => {
    const emptyData: ChartData = {
      labels: [],
      datasets: [{
        label: '# Fish Caught',
        data: []
      }]
    };

    render(<MoonPhaseChart data={emptyData} />);

    expect(screen.getByTestId('moon-phase-bar-chart')).toBeInTheDocument();
  });
});