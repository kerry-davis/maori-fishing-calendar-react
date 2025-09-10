import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useModal, useSingleModal, useModalBackdrop } from '../useModal';
import type { ModalType } from '../../types';

// Mock timers for animation testing
vi.useFakeTimers();

describe('useModal', () => {
  beforeEach(() => {
    // Reset document body styles
    document.body.style.overflow = '';
    
    // Clear any existing event listeners
    document.removeEventListener('keydown', vi.fn());
  });

  afterEach(() => {
    vi.clearAllTimers();
    document.body.style.overflow = '';
  });

  describe('basic modal operations', () => {
    it('should initialize with no modals open', () => {
      const { result } = renderHook(() => useModal());

      expect(result.current.currentModal).toBeNull();
      expect(result.current.modalStack).toHaveLength(0);
      expect(result.current.isAnimating).toBe(false);
    });

    it('should open a modal', () => {
      const { result } = renderHook(() => useModal());

      act(() => {
        const modalId = result.current.openModal('lunar', { date: '2024-01-01' });
        expect(modalId).toBeTruthy();
      });

      expect(result.current.currentModal).not.toBeNull();
      expect(result.current.currentModal?.type).toBe('lunar');
      expect(result.current.currentModal?.data).toEqual({ date: '2024-01-01' });
      expect(result.current.modalStack).toHaveLength(1);
      expect(result.current.isAnimating).toBe(true);
    });

    it('should close a modal', () => {
      const { result } = renderHook(() => useModal());

      let modalId: string;
      act(() => {
        modalId = result.current.openModal('lunar');
      });

      act(() => {
        result.current.closeModal(modalId);
      });

      expect(result.current.modalStack[0].isExiting).toBe(true);
      expect(result.current.isAnimating).toBe(true);

      // Fast-forward animation
      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(result.current.currentModal).toBeNull();
      expect(result.current.modalStack).toHaveLength(0);
      expect(result.current.isAnimating).toBe(false);
    });

    it('should close the top modal when no ID is provided', () => {
      const { result } = renderHook(() => useModal());

      act(() => {
        result.current.openModal('lunar');
        result.current.openModal('tripLog');
      });

      expect(result.current.modalStack).toHaveLength(2);
      expect(result.current.currentModal?.type).toBe('tripLog');

      act(() => {
        result.current.closeModal(); // No ID provided
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(result.current.modalStack).toHaveLength(1);
      expect(result.current.currentModal?.type).toBe('lunar');
    });
  });

  describe('modal stack management', () => {
    it('should handle multiple modals in stack', () => {
      const { result } = renderHook(() => useModal());

      act(() => {
        result.current.openModal('lunar');
        result.current.openModal('tripLog');
        result.current.openModal('tackleBox');
      });

      expect(result.current.modalStack).toHaveLength(3);
      expect(result.current.currentModal?.type).toBe('tackleBox');
    });

    it('should close all modals with staggered animation', () => {
      const { result } = renderHook(() => useModal());

      act(() => {
        result.current.openModal('lunar');
        result.current.openModal('tripLog');
        result.current.openModal('tackleBox');
      });

      act(() => {
        result.current.closeAllModals();
      });

      expect(result.current.isAnimating).toBe(true);

      // Fast-forward all animations
      act(() => {
        vi.advanceTimersByTime(500); // Animation duration + stagger delays
      });

      expect(result.current.modalStack).toHaveLength(0);
      expect(result.current.currentModal).toBeNull();
      expect(result.current.isAnimating).toBe(false);
    });

    it('should check if specific modal type is open', () => {
      const { result } = renderHook(() => useModal());

      act(() => {
        result.current.openModal('lunar');
        result.current.openModal('tripLog');
      });

      expect(result.current.isModalOpen('lunar')).toBe(true);
      expect(result.current.isModalOpen('tripLog')).toBe(true);
      expect(result.current.isModalOpen('tackleBox')).toBe(false);
    });

    it('should get modal data for specific type', () => {
      const { result } = renderHook(() => useModal());

      const lunarData = { date: '2024-01-01' };
      const tripData = { tripId: 123 };

      act(() => {
        result.current.openModal('lunar', lunarData);
        result.current.openModal('tripLog', tripData);
      });

      expect(result.current.getModalData('lunar')).toEqual(lunarData);
      expect(result.current.getModalData('tripLog')).toEqual(tripData);
      expect(result.current.getModalData('tackleBox')).toBeUndefined();
    });

    it('should return data from topmost instance of modal type', () => {
      const { result } = renderHook(() => useModal());

      const firstData = { id: 1 };
      const secondData = { id: 2 };

      act(() => {
        result.current.openModal('lunar', firstData);
        result.current.openModal('lunar', secondData);
      });

      expect(result.current.getModalData('lunar')).toEqual(secondData);
    });
  });

  describe('animation handling', () => {
    it('should handle entering animation state', () => {
      const { result } = renderHook(() => useModal());

      act(() => {
        result.current.openModal('lunar');
      });

      expect(result.current.isAnimating).toBe(true);
      expect(result.current.modalStack[0].isEntering).toBe(true);

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(result.current.isAnimating).toBe(false);
      expect(result.current.modalStack[0].isEntering).toBe(false);
    });

    it('should handle exiting animation state', () => {
      const { result } = renderHook(() => useModal());

      let modalId: string;
      act(() => {
        modalId = result.current.openModal('lunar');
        vi.advanceTimersByTime(300); // Complete entering animation
      });

      act(() => {
        result.current.closeModal(modalId);
      });

      expect(result.current.isAnimating).toBe(true);
      expect(result.current.modalStack[0].isExiting).toBe(true);
    });
  });

  describe('keyboard and accessibility', () => {
    it('should close modal on Escape key', () => {
      const { result } = renderHook(() => useModal());

      act(() => {
        result.current.openModal('lunar');
        vi.advanceTimersByTime(300); // Complete animation
      });

      expect(result.current.currentModal).not.toBeNull();

      // Simulate Escape key press
      act(() => {
        const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
        document.dispatchEvent(escapeEvent);
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(result.current.currentModal).toBeNull();
    });

    it('should not close modal on Escape when animating', () => {
      const { result } = renderHook(() => useModal());

      act(() => {
        result.current.openModal('lunar');
        // Don't advance timers - modal is still animating
      });

      expect(result.current.isAnimating).toBe(true);

      // Simulate Escape key press while animating
      act(() => {
        const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
        document.dispatchEvent(escapeEvent);
      });

      expect(result.current.currentModal).not.toBeNull();
    });

    it('should prevent body scroll when modals are open', () => {
      const { result } = renderHook(() => useModal());

      expect(document.body.style.overflow).toBe('');

      act(() => {
        result.current.openModal('lunar');
      });

      expect(document.body.style.overflow).toBe('hidden');

      act(() => {
        result.current.closeModal();
        vi.advanceTimersByTime(300);
      });

      expect(document.body.style.overflow).toBe('');
    });
  });
});

describe('useSingleModal', () => {
  it('should manage a single modal type', () => {
    const { result } = renderHook(() => useSingleModal('lunar'));

    expect(result.current.isOpen).toBe(false);
    expect(result.current.data).toBeUndefined();

    const testData = { date: '2024-01-01' };
    act(() => {
      result.current.open(testData);
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.data).toEqual(testData);

    act(() => {
      result.current.close();
      vi.advanceTimersByTime(300);
    });

    expect(result.current.isOpen).toBe(false);
  });

  it('should only close its own modal type', () => {
    const { result: lunarResult } = renderHook(() => useSingleModal('lunar'));
    const { result: tripResult } = renderHook(() => useSingleModal('tripLog'));

    act(() => {
      lunarResult.current.open();
      tripResult.current.open();
    });

    expect(lunarResult.current.isOpen).toBe(true);
    expect(tripResult.current.isOpen).toBe(true);

    act(() => {
      lunarResult.current.close();
      vi.advanceTimersByTime(300);
    });

    // Only the trip modal should remain open
    expect(lunarResult.current.isOpen).toBe(false);
    expect(tripResult.current.isOpen).toBe(true);
  });
});

describe('useModalBackdrop', () => {
  it('should handle backdrop visibility', () => {
    const { result: modalResult } = renderHook(() => useModal());
    const { result: backdropResult } = renderHook(() => useModalBackdrop(modalResult.current));

    expect(backdropResult.current.isVisible).toBe(false);

    act(() => {
      modalResult.current.openModal('lunar');
    });

    // Re-render backdrop hook with updated modal state
    const { result: updatedBackdropResult } = renderHook(() => useModalBackdrop(modalResult.current));
    expect(updatedBackdropResult.current.isVisible).toBe(true);
  });

  it('should handle backdrop clicks', () => {
    const { result: modalResult } = renderHook(() => useModal());

    act(() => {
      modalResult.current.openModal('lunar');
      vi.advanceTimersByTime(300); // Complete animation
    });

    const { result: backdropResult } = renderHook(() => useModalBackdrop(modalResult.current));

    // Mock event that targets the backdrop itself
    const mockEvent = {
      target: document.createElement('div'),
      currentTarget: document.createElement('div'),
      preventDefault: vi.fn(),
      stopPropagation: vi.fn()
    } as unknown as React.MouseEvent;

    // Make target and currentTarget the same (backdrop click)
    mockEvent.target = mockEvent.currentTarget;

    act(() => {
      backdropResult.current.handleBackdropClick(mockEvent);
      vi.advanceTimersByTime(300);
    });

    expect(modalResult.current.currentModal).toBeNull();
  });

  it('should not close on backdrop click when animating', () => {
    const { result: modalResult } = renderHook(() => useModal());

    act(() => {
      modalResult.current.openModal('lunar');
      // Don't advance timers - modal is still animating
    });

    const { result: backdropResult } = renderHook(() => useModalBackdrop(modalResult.current));

    const mockEvent = {
      target: document.createElement('div'),
      currentTarget: document.createElement('div'),
      preventDefault: vi.fn(),
      stopPropagation: vi.fn()
    } as unknown as React.MouseEvent;

    mockEvent.target = mockEvent.currentTarget;

    act(() => {
      backdropResult.current.handleBackdropClick(mockEvent);
    });

    expect(modalResult.current.currentModal).not.toBeNull();
  });
});