import { vi } from 'vitest';

vi.mock('virtual:pwa-register/react', () => {
  return {
    useRegisterSW: () => ({
      needRefresh: [false, () => {}],
      offlineReady: [false, () => {}],
      updateServiceWorker: () => {},
    }),
  };
});
