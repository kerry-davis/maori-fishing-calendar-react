import { describe, it, expect, beforeEach } from 'vitest';
import {
  getOrCreateGuestSessionId,
  getGuestSessionRecord,
  resetGuestSessionState,
  markGuestSessionMergedForUser,
  hasGuestSessionMergedForUser,
  getUnmergedGuestSessionIds
} from '../services/guestSessionService';

const createLocalStorageMock = () => {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => {
      store.clear();
    },
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, value);
    }
  } as unknown as Storage;
};

describe('guestSessionService', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      value: createLocalStorageMock(),
      configurable: true
    });
    resetGuestSessionState();
  });

  it('creates and persists a guest session id', () => {
    const sessionId = getOrCreateGuestSessionId();
    expect(typeof sessionId).toBe('string');

    const sameSessionId = getOrCreateGuestSessionId();
    expect(sameSessionId).toBe(sessionId);

    const record = getGuestSessionRecord(sessionId);
    expect(record).not.toBeNull();
    expect(record?.id).toBe(sessionId);
  });

  it('rotates session when expired', () => {
    const sessionId = getOrCreateGuestSessionId();
    const stateRaw = window.localStorage.getItem('guestSessionState');
    expect(stateRaw).not.toBeNull();

    if (stateRaw) {
      const state = JSON.parse(stateRaw);
      state.sessions[sessionId].expiresAt = Date.now() - 1000;
      window.localStorage.setItem('guestSessionState', JSON.stringify(state));
    }

    const newSessionId = getOrCreateGuestSessionId();
    expect(newSessionId).not.toBe(sessionId);
  });

  it('marks sessions as merged per user', () => {
    const sessionId = getOrCreateGuestSessionId();
    expect(hasGuestSessionMergedForUser(sessionId, 'user-1')).toBe(false);

    markGuestSessionMergedForUser(sessionId, 'user-1');
    expect(hasGuestSessionMergedForUser(sessionId, 'user-1')).toBe(true);
    expect(hasGuestSessionMergedForUser(sessionId, 'user-2')).toBe(false);
  });

  it('lists unmerged sessions by user', () => {
    const sessionIdA = getOrCreateGuestSessionId();

    markGuestSessionMergedForUser(sessionIdA, 'user-1');
    const stateRaw = window.localStorage.getItem('guestSessionState');
    if (stateRaw) {
      const state = JSON.parse(stateRaw);
      state.sessions[sessionIdA].expiresAt = Date.now() - 1000;
      window.localStorage.setItem('guestSessionState', JSON.stringify(state));
    }

    const sessionIdB = getOrCreateGuestSessionId();

    const unmergedForUser1 = getUnmergedGuestSessionIds('user-1');
    expect(unmergedForUser1).not.toContain(sessionIdA);
    expect(unmergedForUser1).toContain(sessionIdB);

    const unmergedForUser2 = getUnmergedGuestSessionIds('user-2');
    expect(unmergedForUser2).toEqual(expect.arrayContaining([sessionIdA, sessionIdB]));
  });
});
