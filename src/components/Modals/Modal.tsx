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
  maxHeight = '90vh',
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
          relative bg-white dark:bg-gray-800 rounded-lg shadow-xl 
          ${getMaxWidthClass()} w-full mx-4 
          ${className}
        `}
        style={{ maxHeight }}
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
  return (
    <div className={`p-6 border-b dark:border-gray-700 ${className}`}>
      <div className="flex justify-between items-center">
        <div className="flex-1">
          <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
            {title}
          </h3>
          {subtitle && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {subtitle}
            </p>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {children}
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
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
    <div className={`p-6 ${scrollable ? 'overflow-y-auto' : ''} ${className}`}>
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
    <div className={`p-6 border-t dark:border-gray-700 ${className}`}>
      {children}
    </div>
  );
};

export default Modal;