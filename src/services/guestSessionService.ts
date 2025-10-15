const STORAGE_KEY = 'guestSessionState';
const SESSION_ID_KEY = 'activeGuestSessionId';
const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export interface GuestSessionRecord {
  id: string;
  createdAt: number;
  expiresAt: number;
  mergedUsers: Record<string, number>;
}

interface GuestSessionState {
  currentId: string | null;
  sessions: Record<string, GuestSessionRecord>;
}

const isStorageAvailable = (): boolean => {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch (error) {
    console.warn('[guestSession] localStorage unavailable:', error);
    return false;
  }
};

const readState = (): GuestSessionState => {
  if (!isStorageAvailable()) {
    return { currentId: null, sessions: {} };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { currentId: null, sessions: {} };
    }

    const parsed = JSON.parse(raw) as GuestSessionState;
    if (!parsed || typeof parsed !== 'object') {
      return { currentId: null, sessions: {} };
    }

    return {
      currentId: parsed.currentId ?? null,
      sessions: parsed.sessions ?? {},
    };
  } catch (error) {
    console.warn('[guestSession] Failed to parse session state:', error);
    return { currentId: null, sessions: {} };
  }
};

const writeState = (state: GuestSessionState): void => {
  if (!isStorageAvailable()) return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (state.currentId) {
      window.localStorage.setItem(SESSION_ID_KEY, state.currentId);
    } else {
      window.localStorage.removeItem(SESSION_ID_KEY);
    }
  } catch (error) {
    console.warn('[guestSession] Failed to persist session state:', error);
  }
};

const generateSessionId = (): string => {
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `gs_${Date.now().toString(36)}_${randomPart}`;
};

const createRecord = (now: number): GuestSessionRecord => ({
  id: generateSessionId(),
  createdAt: now,
  expiresAt: now + DEFAULT_TTL_MS,
  mergedUsers: {},
});

const getNow = (): number => Date.now();

const isExpired = (record: GuestSessionRecord, now = getNow()): boolean => record.expiresAt <= now;

const ensureActiveRecord = (state: GuestSessionState, now = getNow()): GuestSessionRecord => {
  if (state.currentId) {
    const existing = state.sessions[state.currentId];
    if (existing && !isExpired(existing, now)) {
      return existing;
    }
  }

  const record = createRecord(now);
  state.currentId = record.id;
  state.sessions[record.id] = record;
  writeState(state);
  return record;
};

export const getOrCreateGuestSessionId = (): string => {
  const state = readState();
  const record = ensureActiveRecord(state);
  return record.id;
};

export const getActiveGuestSession = (): GuestSessionRecord => {
  const state = readState();
  return ensureActiveRecord(state);
};

export const getGuestSessionRecord = (sessionId?: string): GuestSessionRecord | null => {
  const state = readState();
  if (!sessionId) {
    if (!state.currentId) return null;
    sessionId = state.currentId;
  }
  return state.sessions[sessionId] ?? null;
};

export const isGuestSessionExpired = (sessionId: string, now = getNow()): boolean => {
  const record = getGuestSessionRecord(sessionId);
  if (!record) return true;
  return isExpired(record, now);
};

export const hasGuestSessionMergedForUser = (sessionId: string, userId: string): boolean => {
  const record = getGuestSessionRecord(sessionId);
  if (!record) return false;
  return Boolean(record.mergedUsers[userId]);
};

export const markGuestSessionMergedForUser = (sessionId: string, userId: string, timestamp = getNow()): void => {
  const state = readState();
  const record = state.sessions[sessionId];
  if (!record) {
    return;
  }

  record.mergedUsers[userId] = timestamp;
  state.sessions[sessionId] = record;

  writeState(state);
};

export const getUnmergedGuestSessionIds = (userId: string): string[] => {
  const state = readState();
  return Object.values(state.sessions)
    .filter((record) => !record.mergedUsers[userId])
    .map((record) => record.id);
};

export const resetGuestSessionState = (): void => {
  if (!isStorageAvailable()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(SESSION_ID_KEY);
  } catch (error) {
    console.warn('[guestSession] Failed to reset session state:', error);
  }
};

export const getAllGuestSessionRecords = (): GuestSessionRecord[] => {
  const state = readState();
  return Object.values(state.sessions);
};
