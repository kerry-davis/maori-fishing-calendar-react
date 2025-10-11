import React, { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { persistenceInstrumentation } from '../../utils/persistenceInstrumentation';

export interface ModalWithCleanupProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  maxHeight?: string;
  closeOnBackdropClick?: boolean;
  closeOnEscape?: boolean;
  zIndex?: number;
  cleanupOnLogout?: boolean; // Enhanced cleanup behavior
}

/**
 * Enhanced Modal component with comprehensive清理 hooks and state management
 * 
 * Features:
 * - All base Modal features
 * - Automatic cleanup on logout/user context changes
 * - Modal state persistence tracking
 * - Deterministic rehydration after logout
 * - Cross-user contamination prevention
 */
export const ModalWithCleanup: React.FC<ModalWithCleanupProps> = ({
  isOpen,
  onClose,
  children,
  className = '',
  maxWidth = 'lg',
  maxHeight = '85vh',
  closeOnBackdropClick = true,
  closeOnEscape = true,
  zIndex = 50,
  cleanupOnLogout = true
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const modalIdRef = useRef<string>(`modal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const cleanupTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Track modal state for instrumentation
  const trackModalState = useCallback((state: 'open' | 'closed') => {
    if (typeof window !== 'undefined') {
      const userId = localStorage.getItem('lastActiveUser') || 'guest';
      persistenceInstrumentation.registerArtifact(
        'memory',
        `modal.${modalIdRef.current}.state`,
        { state, timestamp: Date.now() },
        state === 'open' ? 'MEDIUM' : 'LOW',
        'ModalWithCleanup',
        userId
      );
    }
  }, []);

  // Clean up modal state on logout/user context changes
  const cleanupModalState = useCallback(() => {
    console.log('🧹 Cleaning up modal state for:', modalIdRef.current);
    
    try {
      // Clear any modal-related localStorage
      const modalKeys = [
        `modal.${modalIdRef.current}.state`,
        `pendingModal`,
        `settingsModalOpen`,
        'intendedModal',
        'modalState'
      ];
      
      modalKeys.forEach(key => {
        try {
          if (localStorage.getItem(key)) {
            console.log(`Removing modal-related key: ${key}`);
            localStorage.removeItem(key);
          }
        } catch (error) {
          console.warn(`Failed to remove modal key ${key}:`, error);
        }
      });

      // Clear URL hash if it contains modal state
      if (window.location.hash && window.location.hash.includes('modal')) {
        console.log('Clearing modal URL hash:', window.location.hash);
        window.history.replaceState(null, '', window.location.pathname);
      }

      // Track cleanup completion
      if (typeof window !== 'undefined') {
        const userId = localStorage.getItem('lastActiveUser') || 'guest';
        persistenceInstrumentation.registerArtifact(
          'memory',
          `modal.${modalIdRef.current}.cleanup`,
          { timestamp: Date.now(), source: 'deterministic_cleanup' },
          'LOW',
          'ModalWithCleanup',
          userId
        );
      }
    } catch (error) {
      console.warn('Modal cleanup failed:', error);
    }
  }, []);

  // Setup logout monitoring
  useEffect(() => {
    if (!cleanupOnLogout || typeof window === 'undefined') return;

    const handleUserContextChange = () => {
      console.log('🔄 Modal detected user context change, cleaning up:', modalIdRef.current);
      cleanupModalState();
      
      // Close modal if open
      if (isOpen) {
        onClose();
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'lastActiveUser' && e.newValue !== e.oldValue) {
        handleUserContextChange();
      }
    };

    const handleLogoutEvent = (e: CustomEvent) => {
      console.log('🔐 Modal detected logout event:', e.detail);
      cleanupModalState();
    };

    // Listen for storage changes (logout detection)
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('userContextCleared', handleLogoutEvent as EventListener);
    
    // Listen for custom logout events
    window.addEventListener('logout', handleLogoutEvent as EventListener);
    window.addEventListener('authStateChanged', handleUserContextChange as EventListener);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('userContextCleared', handleLogoutEvent as EventListener);
      window.removeEventListener('logout', handleLogoutEvent as EventListener);
      window.removeEventListener('authStateChanged', handleUserContextChange as EventListener);
    };
  }, [cleanupOnLogout, isOpen, onClose, cleanupModalState]);

  // Handle escape key press
  const handleEscapeKey = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape' && closeOnEscape && isOpen) {
      console.log('Escape key pressed, closing modal:', modalIdRef.current);
      onClose();
    }
  }, [closeOnEscape, isOpen, onClose]);

  // Handle backdrop click
  const handleBackdropClick = useCallback((event: React.MouseEvent) => {
    if (
      closeOnBackdropClick && 
      event.target === backdropRef.current &&
      isOpen
    ) {
      console.log('Backdrop clicked, closing modal:', modalIdRef.current);
      onClose();
    }
  }, [closeOnBackdropClick, isOpen, onClose]);

  // Focus management and tracking
  useEffect(() => {
    if (isOpen) {
      console.log('Opening modal:', modalIdRef.current);
      
      // Store the currently focused element
      previousActiveElement.current = document.activeElement as HTMLElement;
      
      // Track modal open state
      trackModalState('open');
      
      // Focus the modal container
      if (modalRef.current) {
        modalRef.current.focus();
      }
      
      // Prevent body scroll and add modal open class
      document.body.style.overflow = 'hidden';
      document.body.classList.add('modal-open');
      
      // Persist minimal state for deterministic rehydration
      try {
        const state = {
          modalId: modalIdRef.current,
          isOpen: true,
          timestamp: Date.now()
        };
        localStorage.setItem(`modal.${modalIdRef.current}.state`, JSON.stringify(state));
      } catch (error) {
        console.warn('Failed to persist modal state:', error);
      }
    } else {
      console.log('Closing modal:', modalIdRef.current);
      
      // Track modal close state
      trackModalState('closed');
      
      // Restore focus to the previously focused element
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
      
      // Restore body scroll
      document.body.style.overflow = '';
      document.body.classList.remove('modal-open');
      
      // Clear persisted state
      try {
        localStorage.removeItem(`modal.${modalIdRef.current}.state`);
      } catch (error) {
        console.warn('Failed to clear modal state:', error);
      }
    }

    return () => {
      // Cleanup on unmount
      document.body.style.overflow = '';
      document.body.classList.remove('modal-open');
      
      // Clear any pending cleanup timeout
      if (cleanupTimeoutRef.current) {
        clearTimeout(cleanupTimeoutRef.current);
        cleanupTimeoutRef.current = null;
      }
    };
  }, [isOpen, trackModalState]);

  // Add/remove escape key listener
  useEffect(() => {
    if (isOpen && closeOnEscape) {
      document.addEventListener('keydown', handleEscapeKey);
      return () => document.removeEventListener('keydown', handleEscapeKey);
    }
  }, [isOpen, closeOnEscape, handleEscapeKey]);

  // Setup periodic cleanup verification
  useEffect(() => {
    if (isOpen && cleanupOnLogout) {
      // Verify modal state integrity periodically
      const verificationInterval = setInterval(() => {
        try {
          const stored = localStorage.getItem(`modal.${modalIdRef.current}.state`);
          if (stored) {
            const state = JSON.parse(stored);
            if (!state.isOpen) {
              console.warn('Modal state inconsistency detected, correcting');
              const userId = localStorage.getItem('lastActiveUser') || 'guest';
              persistenceInstrumentation.registerArtifact(
                'memory',
                `modal.${modalIdRef.current}.state_inconsistency`,
                { detected: Date.now(), stored: state },
                'MEDIUM',
                'ModalWithCleanup',
                userId
              );
              onClose();
            }
          }
        } catch (error) {
          console.warn('Modal state verification failed:', error);
        }
      }, 5000); // Check every 5 seconds

      return () => clearInterval(verificationInterval);
    }
  }, [isOpen, cleanupOnLogout, onClose]);

  // Don't render anything if modal is not open
  if (!isOpen) {
    return null;
  }

  // Get max width class
  const getMaxWidthClass = () => {
    const widthClasses = {
      sm: 'max-w-sm',
      md: 'max-w-md',
      lg: 'max-w-lg',
      xl: 'max-w-xl',
      '2xl': 'max-w-2xl',
      '3xl': 'max-w-3xl'
    };
    return widthClasses[maxWidth];
  };

  const modalContent = (
    <div
      ref={backdropRef}
      className={`modal fixed inset-0 flex items-center justify-center z-${zIndex} ${isOpen ? 'is-visible' : ''}`}
      onClick={handleBackdropClick}
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      data-testid={`modal-${modalIdRef.current}`}
    >
      <div
        ref={modalRef}
        className={`
          relative rounded-lg shadow-xl flex flex-col
          ${getMaxWidthClass()} w-full mx-4
          ${className}
        `}
        style={{
          maxHeight,
          backgroundColor: 'var(--card-background)',
          border: '1px solid var(--border-color)'
        }}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`modal-title-${modalIdRef.current}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );

  // Render modal in a portal to ensure proper z-index stacking
  return createPortal(modalContent, document.body);
};

// Enhanced Modal Header with cleanup hooks
export interface ModalHeaderWithCleanupProps {
  title: string;
  subtitle?: string;
  onClose?: () => void;
  children?: React.ReactNode;
  className?: string;
  modalId?: string;
}

export const ModalHeaderWithCleanup: React.FC<ModalHeaderWithCleanupProps> = ({
  title,
  subtitle,
  onClose,
  children,
  className = '',
  modalId
}) => {
  // Handle cleanup on header close action
  const handleClose = useCallback(() => {
    console.log('Header close action triggered');
    if (onClose) {
      onClose();
    }
  }, [onClose]);

  // Use darker background in dark mode
  const getHeaderBackground = () => {
    if (typeof window !== 'undefined') {
      const isDark = document.documentElement.classList.contains('dark') ||
                    document.body.classList.contains('dark-theme');
      return isDark ? '#0f172a' : 'var(--card-background)';
    }
    return 'var(--card-background)';
  };

  return (
    <div
      className={`p-6 flex-shrink-0 ${className} modal-header`}
      style={{
        borderBottom: '1px solid var(--border-color)',
        backgroundColor: getHeaderBackground()
      }}
      data-modal-header="true"
      data-testid="modal-header"
    >
      <div className="flex justify-between items-center">
        <div className="flex-1 text-center">
          <h3 
            className="text-2xl font-bold" 
            style={{ color: 'var(--primary-text)' }}
            id={modalId ? `modal-title-${modalId}` : undefined}
          >
            {title}
          </h3>
          {subtitle && (
            <p className="text-sm mt-1" style={{ color: 'var(--secondary-text)' }}>
              {subtitle}
            </p>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {children}
          {onClose && (
            <button
              onClick={handleClose}
              className="transition-colors"
              style={{ color: 'var(--secondary-text)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--primary-text)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--secondary-text)';
              }}
              aria-label="Close modal"
              data-testid="modal-close-button"
            >
              <i className="fas fa-times text-xl"></i>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Modal body component for consistent padding and scrolling
export interface ModalBodyWithCleanupProps {
  children: React.ReactNode;
  className?: string;
  scrollable?: boolean;
}

export const ModalBodyWithCleanup: React.FC<ModalBodyWithCleanupProps> = ({
  children,
  className = '',
  scrollable = true
}) => {
  return (
    <div
      className={`p-6 flex-1 ${scrollable ? 'overflow-y-auto' : ''} ${className}`}
      style={scrollable ? { minHeight: 0 } : {}}
      data-testid="modal-body"
    >
      {children}
    </div>
  );
};

// Modal footer component for consistent button layout
export interface ModalFooterWithCleanupProps {
  children: React.ReactNode;
  className?: string;
}

export const ModalFooterWithCleanup: React.FC<ModalFooterWithCleanupProps> = ({
  children,
  className = ''
}) => {
  return (
    <div 
      className={`p-6 flex-shrink-0 ${className}`} 
      style={{ borderTop: '1px solid var(--border-color)' }}
      data-testid="modal-footer"
    >
      {children}
    </div>
  );
};

export default ModalWithCleanup;
