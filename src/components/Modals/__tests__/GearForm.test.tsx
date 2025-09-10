import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { GearForm } from '../GearForm';
import type { TackleItem } from '../../../types';

describe('GearForm', () => {
  const mockGearTypes = ['Lure', 'Rod', 'Reel'];
  const mockGear: TackleItem = {
    id: 1,
    name: 'Test Lure',
    brand: 'Test Brand',
    type: 'Lure',
    colour: 'Red'
  };

  const defaultProps = {
    gearTypes: mockGearTypes,
    onSave: vi.fn(),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders add form when no gear provided', () => {
    render(<GearForm {...defaultProps} />);
    
    expect(screen.getByText('Add New Gear')).toBeInTheDocument();
    expect(screen.getByLabelText('Name *')).toBeInTheDocument();
    expect(screen.getByLabelText('Brand')).toBeInTheDocument();
    expect(screen.getByLabelText('Gear Type *')).toBeInTheDocument();
    expect(screen.getByLabelText('Colour')).toBeInTheDocument();
  });

  it('renders edit form when gear provided', () => {
    render(<GearForm {...defaultProps} gear={mockGear} />);
    
    expect(screen.getByText('Edit Gear')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Test Lure')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Test Brand')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Red')).toBeInTheDocument();
  });

  it('shows delete button only when editing', () => {
    const { rerender } = render(<GearForm {...defaultProps} />);
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
    
    rerender(<GearForm {...defaultProps} gear={mockGear} onDelete={vi.fn()} />);
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('populates gear types in dropdown', () => {
    render(<GearForm {...defaultProps} />);
    
    const typeSelect = screen.getByLabelText('Gear Type *');
    mockGearTypes.forEach(type => {
      expect(screen.getByRole('option', { name: type })).toBeInTheDocument();
    });
  });

  it('validates required fields', async () => {
    render(<GearForm {...defaultProps} />);
    
    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(screen.getByText('Name is required')).toBeInTheDocument();
    });
  });

  it('validates gear type selection', async () => {
    render(<GearForm {...defaultProps} />);
    
    // Fill name but leave type empty
    const nameInput = screen.getByLabelText('Name *');
    fireEvent.change(nameInput, { target: { value: 'Test Gear' } });
    
    const typeSelect = screen.getByLabelText('Gear Type *');
    fireEvent.change(typeSelect, { target: { value: '' } });
    
    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(screen.getByText('Gear type is required')).toBeInTheDocument();
    });
  });

  it('clears validation errors when user types', async () => {
    render(<GearForm {...defaultProps} />);
    
    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(screen.getByText('Name is required')).toBeInTheDocument();
    });
    
    const nameInput = screen.getByLabelText('Name *');
    fireEvent.change(nameInput, { target: { value: 'Test' } });
    
    expect(screen.queryByText('Name is required')).not.toBeInTheDocument();
  });

  it('calls onSave with correct data for new gear', async () => {
    const mockOnSave = vi.fn();
    render(<GearForm {...defaultProps} onSave={mockOnSave} />);
    
    // Fill form
    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'New Gear' } });
    fireEvent.change(screen.getByLabelText('Brand'), { target: { value: 'New Brand' } });
    fireEvent.change(screen.getByLabelText('Gear Type *'), { target: { value: 'Lure' } });
    fireEvent.change(screen.getByLabelText('Colour'), { target: { value: 'Blue' } });
    
    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith({
        name: 'New Gear',
        brand: 'New Brand',
        type: 'Lure',
        colour: 'Blue'
      });
    });
  });

  it('calls onSave with correct data for existing gear', async () => {
    const mockOnSave = vi.fn();
    render(<GearForm {...defaultProps} gear={mockGear} onSave={mockOnSave} />);
    
    // Modify name
    const nameInput = screen.getByDisplayValue('Test Lure');
    fireEvent.change(nameInput, { target: { value: 'Modified Lure' } });
    
    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith({
        id: 1,
        name: 'Modified Lure',
        brand: 'Test Brand',
        type: 'Lure',
        colour: 'Red'
      });
    });
  });

  it('calls onDelete when delete button clicked', () => {
    const mockOnDelete = vi.fn();
    render(<GearForm {...defaultProps} gear={mockGear} onDelete={mockOnDelete} />);
    
    const deleteButton = screen.getByText('Delete');
    fireEvent.click(deleteButton);
    
    expect(mockOnDelete).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when cancel button clicked', () => {
    const mockOnCancel = vi.fn();
    render(<GearForm {...defaultProps} onCancel={mockOnCancel} />);
    
    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);
    
    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it('trims whitespace from input values', async () => {
    const mockOnSave = vi.fn();
    render(<GearForm {...defaultProps} onSave={mockOnSave} />);
    
    // Fill form with whitespace
    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: '  Spaced Gear  ' } });
    fireEvent.change(screen.getByLabelText('Brand'), { target: { value: '  Spaced Brand  ' } });
    fireEvent.change(screen.getByLabelText('Gear Type *'), { target: { value: 'Lure' } });
    fireEvent.change(screen.getByLabelText('Colour'), { target: { value: '  Spaced Color  ' } });
    
    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith({
        name: 'Spaced Gear',
        brand: 'Spaced Brand',
        type: 'Lure',
        colour: 'Spaced Color'
      });
    });
  });

  it('disables form during submission', async () => {
    const mockOnSave = vi.fn(() => new Promise(resolve => setTimeout(resolve, 100)));
    render(<GearForm {...defaultProps} onSave={mockOnSave} />);
    
    // Fill required fields
    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'Test Gear' } });
    fireEvent.change(screen.getByLabelText('Gear Type *'), { target: { value: 'Lure' } });
    
    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);
    
    // Check that button shows loading state
    expect(screen.getByText('Saving...')).toBeInTheDocument();
    expect(screen.getByLabelText('Name *')).toBeDisabled();
  });

  it('initializes with first gear type when adding new gear', () => {
    render(<GearForm {...defaultProps} />);
    
    const typeSelect = screen.getByLabelText('Gear Type *') as HTMLSelectElement;
    expect(typeSelect.value).toBe('Lure');
  });

  it('resets form when gear prop changes', () => {
    const { rerender } = render(<GearForm {...defaultProps} />);
    
    // Fill form
    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'Test' } });
    
    // Change to edit mode
    rerender(<GearForm {...defaultProps} gear={mockGear} />);
    
    expect(screen.getByDisplayValue('Test Lure')).toBeInTheDocument();
  });
});