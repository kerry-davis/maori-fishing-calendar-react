import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PWAUpdateNotification } from '../PWAUpdateNotification';
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

describe('PWAUpdateNotification', () => {
  const mockUpdateServiceWorker = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not render when no update is needed and not offline ready', () => {
    mockUsePWA.mockReturnValue({
      canInstall: false,
      showInstallPrompt: vi.fn(),
      needRefresh: false,
      offlineReady: false,
      updateServiceWorker: mockUpdateServiceWorker,
      isOnline: true,
    });

    const { container } = render(<PWAUpdateNotification />);
    expect(container.firstChild).toBeNull();
  });

  it('should render update notification when needRefresh is true', () => {
    mockUsePWA.mockReturnValue({
      canInstall: false,
      showInstallPrompt: vi.fn(),
      needRefresh: true,
      offlineReady: false,
      updateServiceWorker: mockUpdateServiceWorker,
      isOnline: true,
    });

    render(<PWAUpdateNotification />);
    
    expect(screen.getByText('Update Available')).toBeInTheDocument();
    expect(screen.getByText('A new version of the app is available. Click reload to update.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Later' })).toBeInTheDocument();
  });

  it('should render offline ready notification when offlineReady is true', () => {
    mockUsePWA.mockReturnValue({
      canInstall: false,
      showInstallPrompt: vi.fn(),
      needRefresh: false,
      offlineReady: true,
      updateServiceWorker: mockUpdateServiceWorker,
      isOnline: true,
    });

    render(<PWAUpdateNotification />);
    
    expect(screen.getByText('App Ready')).toBeInTheDocument();
    expect(screen.getByText('App is ready to work offline.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reload' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'OK' })).toBeInTheDocument();
  });

  it('should call updateServiceWorker when reload button is clicked', async () => {
    mockUpdateServiceWorker.mockResolvedValue(undefined);
    
    mockUsePWA.mockReturnValue({
      canInstall: false,
      showInstallPrompt: vi.fn(),
      needRefresh: true,
      offlineReady: false,
      updateServiceWorker: mockUpdateServiceWorker,
      isOnline: true,
    });

    render(<PWAUpdateNotification />);
    
    const reloadButton = screen.getByRole('button', { name: 'Reload' });
    fireEvent.click(reloadButton);
    
    await waitFor(() => {
      expect(mockUpdateServiceWorker).toHaveBeenCalledWith(true);
    });
  });

  it('should hide notification when dismissed', () => {
    mockUsePWA.mockReturnValue({
      canInstall: false,
      showInstallPrompt: vi.fn(),
      needRefresh: true,
      offlineReady: false,
      updateServiceWorker: mockUpdateServiceWorker,
      isOnline: true,
    });

    render(<PWAUpdateNotification />);
    
    const laterButton = screen.getByRole('button', { name: 'Later' });
    fireEvent.click(laterButton);
    
    expect(screen.queryByText('Update Available')).not.toBeInTheDocument();
  });
});