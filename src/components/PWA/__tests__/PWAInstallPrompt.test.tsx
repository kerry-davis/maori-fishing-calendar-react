import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PWAInstallPrompt } from '../PWAInstallPrompt';
import { usePWA } from '../../../contexts/PWAContext';

// Mock the PWA register hook
vi.mock('../../../hooks/usePWARegister', () => ({
  usePWARegister: vi.fn(() => ({
    needRefresh: [false, vi.fn()],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: vi.fn(),
  })),
}));

// Mock the PWA context
vi.mock('../../../contexts/PWAContext', () => ({
  usePWA: vi.fn(),
}));

const mockUsePWA = vi.mocked(usePWA);

describe('PWAInstallPrompt', () => {
  const mockShowInstallPrompt = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not render when canInstall is false', () => {
    mockUsePWA.mockReturnValue({
      canInstall: false,
      showInstallPrompt: mockShowInstallPrompt,
      needRefresh: false,
      offlineReady: false,
      updateServiceWorker: vi.fn(),
      isOnline: true,
    });

    const { container } = render(<PWAInstallPrompt />);
    expect(container.firstChild).toBeNull();
  });

  it('should render install prompt when canInstall is true', () => {
    mockUsePWA.mockReturnValue({
      canInstall: true,
      showInstallPrompt: mockShowInstallPrompt,
      needRefresh: false,
      offlineReady: false,
      updateServiceWorker: vi.fn(),
      isOnline: true,
    });

    render(<PWAInstallPrompt />);
    
    expect(screen.getByText('Install App')).toBeInTheDocument();
    expect(screen.getByText('Install the Māori Fishing Calendar for quick access and offline use.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Install' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Not now' })).toBeInTheDocument();
  });

  it('should call showInstallPrompt when install button is clicked', () => {
    mockUsePWA.mockReturnValue({
      canInstall: true,
      showInstallPrompt: mockShowInstallPrompt,
      needRefresh: false,
      offlineReady: false,
      updateServiceWorker: vi.fn(),
      isOnline: true,
    });

    render(<PWAInstallPrompt />);
    
    const installButton = screen.getByRole('button', { name: 'Install' });
    fireEvent.click(installButton);
    
    expect(mockShowInstallPrompt).toHaveBeenCalledTimes(1);
  });

  it('should hide prompt when dismissed', () => {
    mockUsePWA.mockReturnValue({
      canInstall: true,
      showInstallPrompt: mockShowInstallPrompt,
      needRefresh: false,
      offlineReady: false,
      updateServiceWorker: vi.fn(),
      isOnline: true,
    });

    render(<PWAInstallPrompt />);
    
    const dismissButton = screen.getByRole('button', { name: 'Not now' });
    fireEvent.click(dismissButton);
    
    expect(screen.queryByText('Install App')).not.toBeInTheDocument();
  });

  it('should hide prompt when close button is clicked', () => {
    mockUsePWA.mockReturnValue({
      canInstall: true,
      showInstallPrompt: mockShowInstallPrompt,
      needRefresh: false,
      offlineReady: false,
      updateServiceWorker: vi.fn(),
      isOnline: true,
    });

    render(<PWAInstallPrompt />);
    
    const closeButton = screen.getByRole('button', { name: 'Close' });
    fireEvent.click(closeButton);
    
    expect(screen.queryByText('Install App')).not.toBeInTheDocument();
  });
});