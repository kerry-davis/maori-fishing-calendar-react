import React, { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  maxHeight?: string;
  closeOnBackdropClick?: boolean;
  closeOnEscape?: boolean;
  zIndex?: number;
}

/**
 * Base Modal component with animation support, backdrop handling, and keyboard navigation
 * 
 * Features:
 * - Smooth fade-in/fade-out animations
 * - Backdrop click handling (configurable)
 * - Escape key support (configurable)
 * - Focus management and accessibility
 * - Portal rendering for proper z-index stacking
 * - Dark mode support
 * - Responsive sizing options
 */
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  children,
  className = '',
  maxWidth = 'lg',
  maxHeight = '85vh',
  closeOnBackdropClick = true,
  closeOnEscape = true,
  zIndex = 50
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Handle escape key press
  const handleEscapeKey = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape' && closeOnEscape && isOpen) {
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
      onClose();
    }
  }, [closeOnBackdropClick, isOpen, onClose]);

  // Focus management
  useEffect(() => {
    if (isOpen) {
      // Store the currently focused element
      previousActiveElement.current = document.activeElement as HTMLElement;
      
      // Focus the modal container
      if (modalRef.current) {
        modalRef.current.focus();
      }
      
      // Prevent body scroll
      document.body.style.overflow = 'hidden';
      document.body.classList.add('modal-open');
    } else {
      // Restore focus to the previously focused element
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
      
      // Restore body scroll
      document.body.style.overflow = '';
      document.body.classList.remove('modal-open');
    }

    return () => {
      // Cleanup on unmount
      document.body.style.overflow = '';
      document.body.classList.remove('modal-open');
    };
  }, [isOpen]);

  // Add/remove escape key listener
  useEffect(() => {
    if (isOpen && closeOnEscape) {
      document.addEventListener('keydown', handleEscapeKey);
      return () => document.removeEventListener('keydown', handleEscapeKey);
    }
  }, [isOpen, closeOnEscape, handleEscapeKey]);

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
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );

  // Render modal in a portal to ensure proper z-index stacking
  return createPortal(modalContent, document.body);
};

// Modal header component for consistent styling
export interface ModalHeaderProps {
  title: string;
  subtitle?: string;
  onClose?: () => void;
  children?: React.ReactNode;
  className?: string;
}

export const ModalHeader: React.FC<ModalHeaderProps> = ({
  title,
  subtitle,
  onClose,
  children,
  className = ''
}) => {
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
    >
      <div className="flex justify-between items-center">
        <div className="flex-1 text-center">
          <h3 className="text-2xl font-bold" style={{ color: 'var(--primary-text)' }}>
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
              onClick={onClose}
              className="transition-colors"
              style={{ color: 'var(--secondary-text)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--primary-text)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--secondary-text)';
              }}
              aria-label="Close modal"
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
export interface ModalBodyProps {
  children: React.ReactNode;
  className?: string;
  scrollable?: boolean;
}

export const ModalBody: React.FC<ModalBodyProps> = ({
  children,
  className = '',
  scrollable = true
}) => {
  return (
    <div
      className={`p-6 flex-1 ${scrollable ? 'overflow-y-auto' : ''} ${className}`}
      style={scrollable ? { minHeight: 0 } : {}}
    >
      {children}
    </div>
  );
};

// Modal footer component for consistent button layout
export interface ModalFooterProps {
  children: React.ReactNode;
  className?: string;
}

export const ModalFooter: React.FC<ModalFooterProps> = ({
  children,
  className = ''
}) => {
  return (
    <div className={`p-6 flex-shrink-0 ${className}`} style={{ borderTop: '1px solid var(--border-color)' }}>
      {children}
    </div>
  );
};

export default Modal;