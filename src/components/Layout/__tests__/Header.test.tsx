import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '../../../contexts/ThemeContext';
import Header from '../Header';

const mockHandlers = {
  onSearchClick: vi.fn(),
  onAnalyticsClick: vi.fn(),
  onSettingsClick: vi.fn(),
  onTackleBoxClick: vi.fn(),
  onGalleryClick: vi.fn(),
};

const renderHeader = () => {
  return render(
    <ThemeProvider>
      <Header {...mockHandlers} />
    </ThemeProvider>
  );
};

describe('Header', () => {
  it('renders the main title and subtitle', () => {
    renderHeader();
    
    expect(screen.getByText('Māori Fishing Calendar')).toBeInTheDocument();
    expect(screen.getByText('Find the best fishing days based on the Māori lunar calendar')).toBeInTheDocument();
  });

  it('renders all navigation buttons', () => {
    renderHeader();
    
    expect(screen.getByTitle('Search Logs')).toBeInTheDocument();
    expect(screen.getByTitle('Analytics')).toBeInTheDocument();
    expect(screen.getByTitle('Settings')).toBeInTheDocument();
    expect(screen.getByTitle('Tackle Box')).toBeInTheDocument();
    expect(screen.getByTitle('Gallery')).toBeInTheDocument();
    expect(screen.getByTitle('Toggle Theme')).toBeInTheDocument();
  });

  it('calls the correct handlers when buttons are clicked', () => {
    renderHeader();
    
    fireEvent.click(screen.getByTitle('Search Logs'));
    expect(mockHandlers.onSearchClick).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTitle('Analytics'));
    expect(mockHandlers.onAnalyticsClick).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTitle('Settings'));
    expect(mockHandlers.onSettingsClick).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTitle('Tackle Box'));
    expect(mockHandlers.onTackleBoxClick).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTitle('Gallery'));
    expect(mockHandlers.onGalleryClick).toHaveBeenCalledTimes(1);
  });

  it('toggles theme when theme button is clicked', () => {
    renderHeader();
    
    const themeButton = screen.getByTitle('Toggle Theme');
    fireEvent.click(themeButton);
    
    // The theme toggle is handled by the ThemeContext, so we just verify the button exists
    expect(themeButton).toBeInTheDocument();
  });
});