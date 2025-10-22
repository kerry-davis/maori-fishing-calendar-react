import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Guest Mode Validation', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('allows guest writes only when explicit guest tokens are used', async () => {
    const { validateUserContext } = await import('../utils/userStateCleared');
    let operationCalled = false;

    const result = validateUserContext(
      null,
      () => {
        operationCalled = true;
        return 'success';
      },
      undefined,
      'guest-createTrip'
    );

    expect(operationCalled).toBe(true);
    expect(result).toBe('success');

    expect(() => {
      validateUserContext(null, () => 'should fail', undefined, 'createTrip');
    }).toThrow('Require authenticated user context. Write operations require authenticated state.');
  });

  it('should still block invalid operations for authenticated users', async () => {
    vi.doMock('../services/firebase', async () => {
      const actual = await vi.importActual<typeof import('../services/firebase')>('../services/firebase');
      return {
        ...actual,
        auth: { currentUser: { uid: 'wrong-user-id' } }
      };
    });

    const { validateUserContext } = await import('../utils/userStateCleared');
    
    expect(() => {
      validateUserContext(
        'correct-user-id',
        () => 'should not be called',
        undefined,
        'createTrip'
      );
    }).toThrow('User context mismatch');
  });
});