import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Footer from '../Footer';

describe('Footer', () => {
  it('renders the footer text correctly', () => {
    render(<Footer />);
    
    expect(screen.getByText('Māori Fishing Calendar • Based on traditional Māori lunar knowledge')).toBeInTheDocument();
  });

  it('has the correct CSS classes for styling', () => {
    const { container } = render(<Footer />);
    const footer = container.querySelector('footer');
    
    expect(footer).toHaveClass('mt-8', 'text-center', 'text-gray-600', 'dark:text-gray-400', 'text-sm');
  });
});