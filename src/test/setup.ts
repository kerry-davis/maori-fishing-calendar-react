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
