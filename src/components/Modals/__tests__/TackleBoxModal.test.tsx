import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TackleBoxModal } from '../TackleBoxModal';
import type { TackleItem } from '../../../types';

// Mock the localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

// Mock the useTackleBoxStorage hook
vi.mock('../../../hooks/useLocalStorage', () => ({
  useTackleBoxStorage: () => {
    const mockTacklebox: TackleItem[] = [
      { id: 1, name: 'Test Lure', brand: 'Test Brand', type: 'Lure', colour: 'Red' },
      { id: 2, name: 'Test Rod', brand: 'Another Brand', type: 'Rod', colour: 'Black' }
    ];
    return [mockTacklebox, vi.fn(), vi.fn(), null];
  }
}));

// Mock window.confirm
const mockConfirm = vi.fn();
Object.defineProperty(window, 'confirm', {
  value: mockConfirm,
});

describe('TackleBoxModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(['Lure', 'Rod', 'Reel']));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal when open', () => {
    render(<TackleBoxModal {...defaultProps} />);
    
    expect(screen.getByText('My Tackle Box')).toBeInTheDocument();
    expect(screen.getByText('Edit Existing Gear')).toBeInTheDocument();
    expect(screen.getByText('Edit Existing Gear Type')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<TackleBoxModal {...defaultProps} isOpen={false} />);
    
    expect(screen.queryByText('My Tackle Box')).not.toBeInTheDocument();
  });

  it('displays gear items in dropdown', () => {
    render(<TackleBoxModal {...defaultProps} />);
    
    const gearSelect = screen.getByLabelText('Edit Existing Gear');
    expect(gearSelect).toBeInTheDocument();
    
    // Check if gear options are present
    expect(screen.getByText('Test Lure')).toBeInTheDocument();
    expect(screen.getByText('Test Rod')).toBeInTheDocument();
  });

  it('displays gear types in dropdown', () => {
    render(<TackleBoxModal {...defaultProps} />);
    
    const gearTypeSelect = screen.getByLabelText('Edit Existing Gear Type');
    expect(gearTypeSelect).toBeInTheDocument();
  });

  it('shows placeholder when no form is active', () => {
    render(<TackleBoxModal {...defaultProps} />);
    
    expect(screen.getByText('Select an item or type to view details, or add a new one.')).toBeInTheDocument();
  });

  it('shows gear form when selecting a gear item', async () => {
    render(<TackleBoxModal {...defaultProps} />);
    
    const gearSelect = screen.getByLabelText('Edit Existing Gear');
    fireEvent.change(gearSelect, { target: { value: '1' } });
    
    await waitFor(() => {
      expect(screen.getByText('Edit Gear')).toBeInTheDocument();
    });
  });

  it('shows gear form when clicking Add New Gear', async () => {
    render(<TackleBoxModal {...defaultProps} />);
    
    const addGearBtn = screen.getByRole('button', { name: 'Add New Gear' });
    fireEvent.click(addGearBtn);
    
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Add New Gear' })).toBeInTheDocument();
    });
  });

  it('shows gear type form when selecting a gear type', async () => {
    render(<TackleBoxModal {...defaultProps} />);
    
    const gearTypeSelect = screen.getByLabelText('Edit Existing Gear Type');
    fireEvent.change(gearTypeSelect, { target: { value: 'Lure' } });
    
    await waitFor(() => {
      expect(screen.getByText('Edit Gear Type')).toBeInTheDocument();
    });
  });

  it('shows gear type form when clicking Add New Type', async () => {
    render(<TackleBoxModal {...defaultProps} />);
    
    const addTypeBtn = screen.getByText('Add New Type');
    fireEvent.click(addTypeBtn);
    
    await waitFor(() => {
      expect(screen.getByText('Add New Gear Type')).toBeInTheDocument();
    });
  });

  it('resets form state when modal opens', () => {
    const { rerender } = render(<TackleBoxModal {...defaultProps} isOpen={false} />);
    
    rerender(<TackleBoxModal {...defaultProps} isOpen={true} />);
    
    expect(screen.getByText('Select an item or type to view details, or add a new one.')).toBeInTheDocument();
  });

  it('calls onClose when modal is closed', () => {
    const mockOnClose = vi.fn();
    render(<TackleBoxModal {...defaultProps} onClose={mockOnClose} />);
    
    // Simulate clicking outside the modal (backdrop click)
    const modal = screen.getByRole('dialog');
    const backdrop = modal.parentElement;
    if (backdrop) {
      fireEvent.click(backdrop);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    }
  });

  it('loads gear types from localStorage on mount', () => {
    render(<TackleBoxModal {...defaultProps} />);
    
    expect(mockLocalStorage.getItem).toHaveBeenCalledWith('gearTypes');
  });

  it('saves default gear types if none exist in localStorage', () => {
    mockLocalStorage.getItem.mockReturnValue(null);
    
    render(<TackleBoxModal {...defaultProps} />);
    
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      'gearTypes', 
      JSON.stringify(['Lure', 'Rod', 'Reel'])
    );
  });

  it('handles localStorage errors gracefully', () => {
    mockLocalStorage.getItem.mockImplementation(() => {
      throw new Error('localStorage error');
    });
    
    // Should not throw an error
    expect(() => {
      render(<TackleBoxModal {...defaultProps} />);
    }).not.toThrow();
  });
});