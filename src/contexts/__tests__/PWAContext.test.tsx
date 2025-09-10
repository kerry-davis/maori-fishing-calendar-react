import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PWAProvider, usePWA } from '../PWAContext';

// Mock the PWA register hook
vi.mock('../../hooks/usePWARegister', () => ({
  usePWARegister: vi.fn(() => ({
    needRefresh: [false, vi.fn()],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: vi.fn(),
  })),
}));

// Test component that uses the PWA context
function TestComponent() {
  const { canInstall, showInstallPrompt, needRefresh, offlineReady, isOnline } = usePWA();
  
  return (
    <div>
      <div data-testid="can-install">{canInstall.toString()}</div>
      <div data-testid="need-refresh">{needRefresh.toString()}</div>
      <div data-testid="offline-ready">{offlineReady.toString()}</div>
      <div data-testid="is-online">{isOnline.toString()}</div>
      <button onClick={showInstallPrompt}>Install</button>
    </div>
  );
}

describe('PWAContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
    });
  });

  it('should provide PWA context values', () => {
    render(
      <PWAProvider>
        <TestComponent />
      </PWAProvider>
    );

    expect(screen.getByTestId('can-install')).toHaveTextContent('false');
    expect(screen.getByTestId('need-refresh')).toHaveTextContent('false');
    expect(screen.getByTestId('offline-ready')).toHaveTextContent('false');
    expect(screen.getByTestId('is-online')).toHaveTextContent('true');
  });

  it('should handle offline state', () => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false,
    });

    render(
      <PWAProvider>
        <TestComponent />
      </PWAProvider>
    );

    expect(screen.getByTestId('is-online')).toHaveTextContent('false');
  });

  it('should handle beforeinstallprompt event', async () => {
    const mockEvent = {
      preventDefault: vi.fn(),
      prompt: vi.fn(),
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    };

    render(
      <PWAProvider>
        <TestComponent />
      </PWAProvider>
    );

    // Simulate beforeinstallprompt event
    fireEvent(window, new CustomEvent('beforeinstallprompt', { detail: mockEvent }));

    await waitFor(() => {
      expect(screen.getByTestId('can-install')).toHaveTextContent('true');
    });
  });

  it('should throw error when used outside provider', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    expect(() => {
      render(<TestComponent />);
    }).toThrow('usePWA must be used within a PWAProvider');
    
    consoleSpy.mockRestore();
  });
});