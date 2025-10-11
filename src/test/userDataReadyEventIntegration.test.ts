import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('UserDataReady Event Integration Tests', () => {
  let addEventListenerSpy: ReturnType<typeof vi.spyOn>;
  let removeEventListenerSpy: ReturnType<typeof vi.spyOn>;
  let dispatchEventSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup window event spies
    addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
    dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');
  });

  afterEach(() => {
    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
    dispatchEventSpy.mockRestore();
  });

  it('should allow manual dispatching of userDataReady events', () => {
    const mockListener = vi.fn();
    
    // Add event listener
    window.addEventListener('userDataReady', mockListener);
    
    // Dispatch event
    const event = new CustomEvent('userDataReady', {
      detail: { userId: 'test-user-123' }
    });
    
    window.dispatchEvent(event);
    
    // Verify event was dispatched and listener was called
    expect(mockListener).toHaveBeenCalledWith(event);
    expect(mockListener).toHaveBeenCalledTimes(1);
    
    // Clean up
    window.removeEventListener('userDataReady', mockListener);
  });

  it('should pass correct data in userDataReady event payload', () => {
    const mockListener = vi.fn();
    
    window.addEventListener('userDataReady', mockListener);
    
    const eventData = {
      userId: 'test-user-456',
      isGuest: false
    };
    
    const event = new CustomEvent('userDataReady', {
      detail: eventData
    });
    
    window.dispatchEvent(event);
    
    expect(mockListener).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'userDataReady',
        detail: eventData
      })
    );
    
    window.removeEventListener('userDataReady', mockListener);
  });

  it('should handle userDataReady events with error context', () => {
    const mockListener = vi.fn();
    
    window.addEventListener('userDataReady', mockListener);
    
    const eventData = {
      userId: 'test-user-789',
      error: new Error('Background operation failed')
    };
    
    const event = new CustomEvent('userDataReady', {
      detail: eventData
    });
    
    window.dispatchEvent(event);
    
    expect(mockListener).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'userDataReady',
        detail: expect.objectContaining({
          userId: 'test-user-789',
          error: expect.any(Error)
        })
      })
    );
    
    window.removeEventListener('userDataReady', mockListener);
  });

  it('should handle guest mode userDataReady events', () => {
    const mockListener = vi.fn();
    
    window.addEventListener('userDataReady', mockListener);
    
    const eventData = {
      userId: null,
      isGuest: true
    };
    
    const event = new CustomEvent('userDataReady', {
      detail: eventData
    });
    
    window.dispatchEvent(event);
    
    expect(mockListener).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'userDataReady',
        detail: eventData
      })
    );
    
    window.removeEventListener('userDataReady', mockListener);
  });

  it('should support multiple listeners for userDataReady events', () => {
    const mockListener1 = vi.fn();
    const mockListener2 = vi.fn();
    
    // Add multiple listeners
    window.addEventListener('userDataReady', mockListener1);
    window.addEventListener('userDataReady', mockListener2);
    
    const event = new CustomEvent('userDataReady', {
      detail: { userId: 'test-user-multiple' }
    });
    
    window.dispatchEvent(event);
    
    // Both listeners should be called
    expect(mockListener1).toHaveBeenCalledWith(event);
    expect(mockListener2).toHaveBeenCalledWith(event);
    expect(mockListener1).toHaveBeenCalledTimes(1);
    expect(mockListener2).toHaveBeenCalledTimes(1);
    
    // Clean up
    window.removeEventListener('userDataReady', mockListener1);
    window.removeEventListener('userDataReady', mockListener2);
  });

  it('should properly clean up userDataReady event listeners', () => {
    const mockListener = vi.fn();
    
    // Add listener
    window.addEventListener('userDataReady', mockListener);
    
    // Remove listener
    window.removeEventListener('userDataReady', mockListener);
    
    // Dispatch event after removal
    const event = new CustomEvent('userDataReady', {
      detail: { userId: 'test-user-cleanup' }
    });
    
    window.dispatchEvent(event);
    
    // Listener should not be called after removal
    expect(mockListener).not.toHaveBeenCalled();
  });
});
