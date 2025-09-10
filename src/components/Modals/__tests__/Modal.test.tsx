import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../Modal';

// Mock createPortal to render in the same container
vi.mock('react-dom', async () => {
  const actual = await vi.importActual('react-dom');
  return {
    ...actual,
    createPortal: (children: React.ReactNode) => children,
  };
});

describe('Modal', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
    // Reset body styles
    document.body.style.overflow = '';
    document.body.classList.remove('modal-open');
  });

  afterEach(() => {
    // Cleanup after each test
    document.body.style.overflow = '';
    document.body.classList.remove('modal-open');
  });

  it('renders modal when isOpen is true', () => {
    render(
      <Modal isOpen={true} onClose={mockOnClose}>
        <div>Modal Content</div>
      </Modal>
    );

    expect(screen.getByText('Modal Content')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('does not render modal when isOpen is false', () => {
    render(
      <Modal isOpen={false} onClose={mockOnClose}>
        <div>Modal Content</div>
      </Modal>
    );

    expect(screen.queryByText('Modal Content')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('calls onClose when escape key is pressed', () => {
    render(
      <Modal isOpen={true} onClose={mockOnClose}>
        <div>Modal Content</div>
      </Modal>
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when escape key is pressed and closeOnEscape is false', () => {
    render(
      <Modal isOpen={true} onClose={mockOnClose} closeOnEscape={false}>
        <div>Modal Content</div>
      </Modal>
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('calls onClose when backdrop is clicked', () => {
    render(
      <Modal isOpen={true} onClose={mockOnClose}>
        <div>Modal Content</div>
      </Modal>
    );

    const backdrop = screen.getByRole('dialog').parentElement;
    fireEvent.click(backdrop!);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when backdrop is clicked and closeOnBackdropClick is false', () => {
    render(
      <Modal isOpen={true} onClose={mockOnClose} closeOnBackdropClick={false}>
        <div>Modal Content</div>
      </Modal>
    );

    const backdrop = screen.getByRole('dialog').parentElement;
    fireEvent.click(backdrop!);
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('does not call onClose when modal content is clicked', () => {
    render(
      <Modal isOpen={true} onClose={mockOnClose}>
        <div>Modal Content</div>
      </Modal>
    );

    fireEvent.click(screen.getByText('Modal Content'));
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('applies custom className', () => {
    render(
      <Modal isOpen={true} onClose={mockOnClose} className="custom-class">
        <div>Modal Content</div>
      </Modal>
    );

    const modalContent = screen.getByRole('dialog');
    expect(modalContent).toHaveClass('custom-class');
  });

  it('applies correct max width class', () => {
    render(
      <Modal isOpen={true} onClose={mockOnClose} maxWidth="sm">
        <div>Modal Content</div>
      </Modal>
    );

    const modalContent = screen.getByRole('dialog');
    expect(modalContent).toHaveClass('max-w-sm');
  });

  it('sets body overflow to hidden when modal is open', () => {
    render(
      <Modal isOpen={true} onClose={mockOnClose}>
        <div>Modal Content</div>
      </Modal>
    );

    expect(document.body.style.overflow).toBe('hidden');
    expect(document.body.classList.contains('modal-open')).toBe(true);
  });

  it('restores body overflow when modal is closed', () => {
    const { rerender } = render(
      <Modal isOpen={true} onClose={mockOnClose}>
        <div>Modal Content</div>
      </Modal>
    );

    expect(document.body.style.overflow).toBe('hidden');

    rerender(
      <Modal isOpen={false} onClose={mockOnClose}>
        <div>Modal Content</div>
      </Modal>
    );

    expect(document.body.style.overflow).toBe('');
    expect(document.body.classList.contains('modal-open')).toBe(false);
  });

  it('has correct accessibility attributes', () => {
    render(
      <Modal isOpen={true} onClose={mockOnClose}>
        <div>Modal Content</div>
      </Modal>
    );

    const modal = screen.getByRole('dialog');
    expect(modal).toHaveAttribute('aria-modal', 'true');
    expect(modal).toHaveAttribute('tabIndex', '-1');
  });
});

describe('ModalHeader', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
  });

  it('renders title and subtitle', () => {
    render(
      <ModalHeader 
        title="Test Title" 
        subtitle="Test Subtitle" 
        onClose={mockOnClose} 
      />
    );

    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Test Subtitle')).toBeInTheDocument();
  });

  it('renders close button when onClose is provided', () => {
    render(
      <ModalHeader title="Test Title" onClose={mockOnClose} />
    );

    const closeButton = screen.getByLabelText('Close modal');
    expect(closeButton).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    render(
      <ModalHeader title="Test Title" onClose={mockOnClose} />
    );

    const closeButton = screen.getByLabelText('Close modal');
    fireEvent.click(closeButton);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('does not render close button when onClose is not provided', () => {
    render(<ModalHeader title="Test Title" />);

    expect(screen.queryByLabelText('Close modal')).not.toBeInTheDocument();
  });

  it('renders children in the header', () => {
    render(
      <ModalHeader title="Test Title" onClose={mockOnClose}>
        <button>Custom Button</button>
      </ModalHeader>
    );

    expect(screen.getByText('Custom Button')).toBeInTheDocument();
  });
});

describe('ModalBody', () => {
  it('renders children', () => {
    render(
      <ModalBody>
        <div>Body Content</div>
      </ModalBody>
    );

    expect(screen.getByText('Body Content')).toBeInTheDocument();
  });

  it('applies scrollable class by default', () => {
    render(
      <ModalBody>
        <div>Body Content</div>
      </ModalBody>
    );

    const body = screen.getByText('Body Content').parentElement;
    expect(body).toHaveClass('overflow-y-auto');
  });

  it('does not apply scrollable class when scrollable is false', () => {
    render(
      <ModalBody scrollable={false}>
        <div>Body Content</div>
      </ModalBody>
    );

    const body = screen.getByText('Body Content').parentElement;
    expect(body).not.toHaveClass('overflow-y-auto');
  });

  it('applies custom className', () => {
    render(
      <ModalBody className="custom-body-class">
        <div>Body Content</div>
      </ModalBody>
    );

    const body = screen.getByText('Body Content').parentElement;
    expect(body).toHaveClass('custom-body-class');
  });
});

describe('ModalFooter', () => {
  it('renders children', () => {
    render(
      <ModalFooter>
        <button>Footer Button</button>
      </ModalFooter>
    );

    expect(screen.getByText('Footer Button')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(
      <ModalFooter className="custom-footer-class">
        <button>Footer Button</button>
      </ModalFooter>
    );

    const footer = screen.getByText('Footer Button').parentElement;
    expect(footer).toHaveClass('custom-footer-class');
  });

  it('has border-t class for visual separation', () => {
    render(
      <ModalFooter>
        <button>Footer Button</button>
      </ModalFooter>
    );

    const footer = screen.getByText('Footer Button').parentElement;
    expect(footer).toHaveClass('border-t');
  });
});