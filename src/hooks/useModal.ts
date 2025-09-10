import { useState, useCallback, useRef, useEffect } from 'react';
import type { ModalType } from '../types';

// Modal state interface for individual modals
export interface ModalState {
  id: string;
  type: ModalType;
  isOpen: boolean;
  isAnimating: boolean;
  data?: any;
}

// Modal stack entry with animation state
interface ModalStackEntry {
  id: string;
  type: ModalType;
  data?: any;
  isEntering: boolean;
  isExiting: boolean;
}

// Hook return type
interface UseModalReturn {
  // Current modal state
  currentModal: ModalState | null;
  modalStack: ModalStackEntry[];
  
  // Modal actions
  openModal: (type: ModalType, data?: any) => string;
  closeModal: (id?: string) => void;
  closeAllModals: () => void;
  
  // Modal stack management
  isModalOpen: (type: ModalType) => boolean;
  getModalData: (type: ModalType) => any;
  
  // Animation helpers
  isAnimating: boolean;
}

// Animation timing constants
const ANIMATION_DURATION = 300; // ms
const ANIMATION_DELAY = 50; // ms between stacked modal animations

// Generate unique modal ID
function generateModalId(): string {
  return `modal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Custom hook for managing modal state with animation support and modal stacking
 * 
 * Features:
 * - Modal stack management for nested modals
 * - Animation state tracking for smooth transitions
 * - Typed modal identifiers and data
 * - Automatic cleanup and memory management
 */
export function useModal(): UseModalReturn {
  const [modalStack, setModalStack] = useState<ModalStackEntry[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);
  
  // Refs for managing timeouts and preventing memory leaks
  const animationTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const stackTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Get current (top) modal from stack
  const currentModal: ModalState | null = modalStack.length > 0 
    ? {
        id: modalStack[modalStack.length - 1].id,
        type: modalStack[modalStack.length - 1].type,
        isOpen: true,
        isAnimating: modalStack[modalStack.length - 1].isEntering || modalStack[modalStack.length - 1].isExiting,
        data: modalStack[modalStack.length - 1].data
      }
    : null;

  // Open a new modal with optional data
  const openModal = useCallback((type: ModalType, data?: any): string => {
    const id = generateModalId();
    
    setIsAnimating(true);
    
    // Add new modal to stack with entering animation
    setModalStack(prev => [
      ...prev,
      {
        id,
        type,
        data,
        isEntering: true,
        isExiting: false
      }
    ]);

    // Set timeout to complete entering animation
    const enterTimeout = setTimeout(() => {
      setModalStack(prev => 
        prev.map(modal => 
          modal.id === id 
            ? { ...modal, isEntering: false }
            : modal
        )
      );
      setIsAnimating(false);
    }, ANIMATION_DURATION);

    animationTimeouts.current.set(id, enterTimeout);
    
    return id;
  }, []);

  // Close modal by ID (defaults to top modal)
  const closeModal = useCallback((id?: string) => {
    const targetId = id || (modalStack.length > 0 ? modalStack[modalStack.length - 1].id : null);
    
    if (!targetId) return;

    setIsAnimating(true);

    // Start exit animation
    setModalStack(prev => 
      prev.map(modal => 
        modal.id === targetId 
          ? { ...modal, isExiting: true, isEntering: false }
          : modal
      )
    );

    // Set timeout to remove modal after exit animation
    const exitTimeout = setTimeout(() => {
      setModalStack(prev => prev.filter(modal => modal.id !== targetId));
      setIsAnimating(false);
      
      // Clean up timeouts for this modal
      const timeout = animationTimeouts.current.get(targetId);
      if (timeout) {
        clearTimeout(timeout);
        animationTimeouts.current.delete(targetId);
      }
      
      const stackTimeout = stackTimeouts.current.get(targetId);
      if (stackTimeout) {
        clearTimeout(stackTimeout);
        stackTimeouts.current.delete(targetId);
      }
    }, ANIMATION_DURATION);

    animationTimeouts.current.set(targetId, exitTimeout);
  }, [modalStack]);

  // Close all modals with staggered animation
  const closeAllModals = useCallback(() => {
    if (modalStack.length === 0) return;

    setIsAnimating(true);

    // Start exit animations for all modals with staggered timing
    modalStack.forEach((modal, index) => {
      const delay = index * ANIMATION_DELAY;
      
      const stackTimeout = setTimeout(() => {
        setModalStack(prev => 
          prev.map(m => 
            m.id === modal.id 
              ? { ...m, isExiting: true, isEntering: false }
              : m
          )
        );
      }, delay);

      stackTimeouts.current.set(modal.id, stackTimeout);
    });

    // Clear all modals after animations complete
    const clearAllTimeout = setTimeout(() => {
      setModalStack([]);
      setIsAnimating(false);
      
      // Clean up all timeouts
      animationTimeouts.current.forEach(timeout => clearTimeout(timeout));
      stackTimeouts.current.forEach(timeout => clearTimeout(timeout));
      animationTimeouts.current.clear();
      stackTimeouts.current.clear();
    }, ANIMATION_DURATION + (modalStack.length * ANIMATION_DELAY));

    animationTimeouts.current.set('clear-all', clearAllTimeout);
  }, [modalStack]);

  // Check if a specific modal type is open
  const isModalOpen = useCallback((type: ModalType): boolean => {
    return modalStack.some(modal => modal.type === type);
  }, [modalStack]);

  // Get data for a specific modal type (returns data from topmost instance)
  const getModalData = useCallback((type: ModalType): any => {
    // Find the topmost modal of the specified type
    for (let i = modalStack.length - 1; i >= 0; i--) {
      if (modalStack[i].type === type) {
        return modalStack[i].data;
      }
    }
    return undefined;
  }, [modalStack]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      animationTimeouts.current.forEach(timeout => clearTimeout(timeout));
      stackTimeouts.current.forEach(timeout => clearTimeout(timeout));
      animationTimeouts.current.clear();
      stackTimeouts.current.clear();
    };
  }, []);

  // Handle escape key to close top modal
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && modalStack.length > 0 && !isAnimating) {
        closeModal();
      }
    };

    if (modalStack.length > 0) {
      document.addEventListener('keydown', handleEscapeKey);
      return () => document.removeEventListener('keydown', handleEscapeKey);
    }
  }, [modalStack.length, isAnimating, closeModal]);

  // Prevent body scroll when modals are open
  useEffect(() => {
    if (modalStack.length > 0) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [modalStack.length]);

  return {
    currentModal,
    modalStack,
    openModal,
    closeModal,
    closeAllModals,
    isModalOpen,
    getModalData,
    isAnimating
  };
}

// Convenience hook for managing a single modal type
export function useSingleModal(type: ModalType) {
  const { 
    openModal, 
    closeModal, 
    isModalOpen, 
    getModalData, 
    currentModal,
    isAnimating 
  } = useModal();

  const isOpen = isModalOpen(type);
  const data = getModalData(type);
  const isCurrentModal = currentModal?.type === type;

  const open = useCallback((modalData?: any) => {
    return openModal(type, modalData);
  }, [openModal, type]);

  const close = useCallback(() => {
    if (isCurrentModal && currentModal) {
      closeModal(currentModal.id);
    }
  }, [closeModal, isCurrentModal, currentModal]);

  return {
    isOpen,
    data,
    open,
    close,
    isAnimating: isAnimating && isCurrentModal
  };
}

// Hook for modal backdrop and overlay management
export function useModalBackdrop(modalState: UseModalReturn) {
  const { currentModal, closeModal, isAnimating } = modalState;

  const handleBackdropClick = useCallback((event: React.MouseEvent) => {
    // Only close if clicking the backdrop itself, not child elements
    if (event.target === event.currentTarget && !isAnimating) {
      closeModal();
    }
  }, [closeModal, isAnimating]);

  return {
    isVisible: !!currentModal,
    handleBackdropClick,
    isAnimating
  };
}