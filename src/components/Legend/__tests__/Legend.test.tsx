import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Legend } from '../Legend';

describe('Legend', () => {
  it('renders the legend title', () => {
    render(<Legend />);
    
    expect(screen.getByText('Fishing Quality Legend')).toBeInTheDocument();
  });

  it('renders all fishing quality indicators', () => {
    render(<Legend />);
    
    // Check that all quality levels are displayed
    expect(screen.getByText('Excellent')).toBeInTheDocument();
    expect(screen.getByText('Good')).toBeInTheDocument();
    expect(screen.getByText('Average')).toBeInTheDocument();
    expect(screen.getByText('Poor')).toBeInTheDocument();
  });

  it('renders quality indicators with correct colors', () => {
    render(<Legend />);
    
    const container = screen.getByText('Fishing Quality Legend').closest('div');
    
    // Check that quality indicator elements exist with correct classes
    const excellentIndicator = container?.querySelector('.quality-excellent');
    const goodIndicator = container?.querySelector('.quality-good');
    const averageIndicator = container?.querySelector('.quality-average');
    const poorIndicator = container?.querySelector('.quality-poor');
    
    expect(excellentIndicator).toBeInTheDocument();
    expect(goodIndicator).toBeInTheDocument();
    expect(averageIndicator).toBeInTheDocument();
    expect(poorIndicator).toBeInTheDocument();
    
    // Check inline styles for colors
    expect(excellentIndicator).toHaveStyle('background-color: #10b981');
    expect(goodIndicator).toHaveStyle('background-color: #3b82f6');
    expect(averageIndicator).toHaveStyle('background-color: #f59e0b');
    expect(poorIndicator).toHaveStyle('background-color: #ef4444');
  });

  it('renders helper text', () => {
    render(<Legend />);
    
    expect(screen.getByText('Hover over any day to see the fishing quality. Click for more details.')).toBeInTheDocument();
  });

  it('has proper responsive grid layout classes', () => {
    render(<Legend />);
    
    const gridContainer = screen.getByText('Excellent').closest('.grid');
    
    expect(gridContainer).toHaveClass('grid', 'grid-cols-2', 'md:grid-cols-4', 'gap-2');
  });

  it('has proper dark mode classes', () => {
    render(<Legend />);
    
    const container = screen.getByText('Fishing Quality Legend').closest('div');
    const title = screen.getByText('Fishing Quality Legend');
    const helperText = screen.getByText('Hover over any day to see the fishing quality. Click for more details.');
    const gridContainer = screen.getByText('Excellent').closest('.grid');
    
    // Check dark mode classes
    expect(container).toHaveClass('dark:bg-gray-800');
    expect(title).toHaveClass('dark:text-gray-100');
    expect(helperText).toHaveClass('dark:text-gray-400');
    expect(gridContainer).toHaveClass('dark:text-gray-300');
  });

  it('renders with proper accessibility attributes', () => {
    render(<Legend />);
    
    // Check that color indicators have aria-hidden since they're decorative
    const indicators = screen.getAllByRole('generic').filter(el => 
      el.classList.contains('w-4') && el.classList.contains('h-4')
    );
    
    indicators.forEach(indicator => {
      expect(indicator).toHaveAttribute('aria-hidden', 'true');
    });
  });
});