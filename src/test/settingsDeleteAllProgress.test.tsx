import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { SettingsModal } from '../components/Modals/SettingsModal';
import type { ImportProgress } from '../types';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'user-123', email: 'user@example.com' } })
}));

vi.mock('../services/firebaseDataService', () => ({
  firebaseDataService: {
    clearFirestoreUserData: vi.fn()
  }
}));

vi.mock('../services/dataExportService', () => ({
  dataExportService: {
    exportDataAsZip: vi.fn(),
    downloadBlob: vi.fn(),
    exportDataAsCSV: vi.fn(),
    importData: vi.fn()
  }
}));

vi.mock('../services/browserZipImportService', () => ({
  browserZipImportService: {
    processZipFile: vi.fn()
  }
}));

vi.mock('../services/databaseService', () => ({
  databaseService: {
    clearAllData: vi.fn()
  }
}));

import { firebaseDataService } from '../services/firebaseDataService';

const originalLocalStorage = window.localStorage;
const originalLocation = window.location;

describe('SettingsModal delete-all progress', () => {
  let reloadSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(firebaseDataService.clearFirestoreUserData).mockReset();

    const localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn()
    };
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      configurable: true
    });

    reloadSpy = vi.fn();
    const locationMock = {
      assign: vi.fn(),
      replace: vi.fn(),
      reload: reloadSpy,
      ancestorOrigins: originalLocation.ancestorOrigins,
      hash: originalLocation.hash,
      host: originalLocation.host,
      hostname: originalLocation.hostname,
      href: originalLocation.href,
      origin: originalLocation.origin,
      pathname: originalLocation.pathname,
      port: originalLocation.port,
      protocol: originalLocation.protocol,
      search: originalLocation.search,
      toString: () => originalLocation.toString()
    } as unknown as Location;
    Object.defineProperty(window, 'location', {
      value: locationMock,
      configurable: true
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    reloadSpy.mockReset();
    Object.defineProperty(window, 'localStorage', {
      value: originalLocalStorage,
      configurable: true
    });
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      configurable: true
    });
  });

  it('displays progress updates and disables controls during destructive wipe', async () => {
    vi.mocked(firebaseDataService.clearFirestoreUserData).mockImplementation(async (callback?: (progress: ImportProgress) => void) => {
      const updates = [
        { phase: 'preparing', current: 0, total: 6, percent: 0, message: 'Preparing data wipe…' },
        { phase: 'storage-inventory', current: 1, total: 6, percent: 16, message: 'Found 2 storage object(s) to remove' },
        { phase: 'complete', current: 6, total: 6, percent: 100, message: 'Firestore user data wipe complete' }
      ];
      updates.forEach((update) => callback?.(update));
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const onClose = vi.fn();
    render(<SettingsModal isOpen={true} onClose={onClose} />);

    fireEvent.click(screen.getByText(/Delete All Data/i));

    const confirmButton = screen.getByText('Delete Everything');
    const cancelButton = screen.getByText('Cancel');

    fireEvent.click(confirmButton);

    expect(firebaseDataService.clearFirestoreUserData).toHaveBeenCalledTimes(1);

    expect(confirmButton.hasAttribute('disabled')).toBe(true);
    expect(cancelButton.hasAttribute('disabled')).toBe(true);
    const progressBar = screen.queryByRole('progressbar');
    expect(progressBar).not.toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(100);
      await Promise.resolve();
    });

    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.queryByText('Delete Everything')).toBeNull();

    expect(window.localStorage.removeItem).toHaveBeenCalledWith('tacklebox');
    expect(window.localStorage.removeItem).toHaveBeenCalledWith('gearTypes');

    await act(async () => {
      vi.advanceTimersByTime(1500);
      await Promise.resolve();
    });

    expect(reloadSpy).toHaveBeenCalled();
    expect(screen.queryByText('All data has been deleted. The page will reload.')).not.toBeNull();
  });
});
