import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OfflineIndicator } from '../OfflineIndicator';
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

describe('OfflineIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not render when online', () => {
    mockUsePWA.mockReturnValue({
      canInstall: false,
      showInstallPrompt: vi.fn(),
      needRefresh: false,
      offlineReady: false,
      updateServiceWorker: vi.fn(),
      isOnline: true,
    });

    const { container } = render(<OfflineIndicator />);
    expect(container.firstChild).toBeNull();
  });

  it('should render offline indicator when offline', () => {
    mockUsePWA.mockReturnValue({
      canInstall: false,
      showInstallPrompt: vi.fn(),
      needRefresh: false,
      offlineReady: false,
      updateServiceWorker: vi.fn(),
      isOnline: false,
    });

    render(<OfflineIndicator />);
    
    expect(screen.getByText("You're offline. Some features may be limited.")).toBeInTheDocument();
  });

  it('should have correct styling classes', () => {
    mockUsePWA.mockReturnValue({
      canInstall: false,
      showInstallPrompt: vi.fn(),
      needRefresh: false,
      offlineReady: false,
      updateServiceWorker: vi.fn(),
      isOnline: false,
    });

    const { container } = render(<OfflineIndicator />);
    const indicator = container.firstChild as HTMLElement;
    
    expect(indicator).toHaveClass('fixed', 'top-0', 'left-0', 'right-0', 'bg-yellow-500');
  });
});