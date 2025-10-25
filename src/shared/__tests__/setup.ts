import { vi } from 'vitest';
import '@testing-library/jest-dom';

vi.mock('virtual:pwa-register/react', () => {
  return {
    useRegisterSW: () => ({
      needRefresh: [false, () => {}],
      offlineReady: [false, () => {}],
      updateServiceWorker: () => {},
    }),
  };
});

// Provide a minimal runtime shim for CommonJS require-based tests that reference TS modules
try {
  const originalRequire: any = (globalThis as any).require;
  (globalThis as any).require = (id: string) => {
    if (id === '@shared/services/firebase' || /\/shared\/services\/firebase$/.test(id)) {
      return {
        auth: {
          onAuthStateChanged: vi.fn(() => () => {}),
          signOut: vi.fn(async () => {})
        }
      } as any;
    }
    if (/\/features\/encryption\/services\/firebaseDataService$/.test(id) || /\/shared\/services\/firebaseDataService$/.test(id)) {
      // Defer to ESM import via Vitest transform if available
      // Tests that use vi.doMock will override before calling require
      return originalRequire ? originalRequire('/src/shared/services/firebaseDataService') : {};
    }
    return originalRequire ? originalRequire(id) : {};
  };
} catch {
  // ignore
}
