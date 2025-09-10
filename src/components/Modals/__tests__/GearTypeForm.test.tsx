import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { GearTypeForm } from '../GearTypeForm';

describe('GearTypeForm', () => {
  const defaultProps = {
    onSave: vi.fn(),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders add form when no gear type provided', () => {
    render(<GearTypeForm {...defaultProps} />);
    
    expect(screen.getByText('Add New Gear Type')).toBeInTheDocument();
    expect(screen.getByLabelText('Gear Type Name *')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter gear type name (e.g., Lure, Rod, Reel)')).toBeInTheDocument();
  });

  it('renders edit form when gear type provided', () => {
    render(<GearTypeForm {...defaultProps} gearType="Existing Type" />);
    
    expect(screen.getByText('Edit Gear Type')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Existing Type')).toBeInTheDocument();
  });

  it('shows delete button only when editing', () => {
    const { rerender } = render(<GearTypeForm {...defaultProps} />);
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
    
    rerender(<GearTypeForm {...defaultProps} gearType="Test Type" onDelete={vi.fn()} />);
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('shows warning message when editing', () => {
    render(<GearTypeForm {...defaultProps} gearType="Test Type" />);
    
    expect(screen.getByText(/Changing this gear type name will update all gear items/)).toBeInTheDocument();
  });

  it('does not show warning message when adding', () => {
    render(<GearTypeForm {...defaultProps} />);
    
    expect(screen.queryByText(/Changing this gear type name will update all gear items/)).not.toBeInTheDocument();
  });

  it('validates required field', async () => {
    render(<GearTypeForm {...defaultProps} />);
    
    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(screen.getByText('Gear type name is required')).toBeInTheDocument();
    });
  });

  it('validates minimum length', async () => {
    render(<GearTypeForm {...defaultProps} />);
    
    const nameInput = screen.getByLabelText('Gear Type Name *');
    fireEvent.change(nameInput, { target: { value: 'A' } });
    
    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(screen.getByText('Gear type name must be at least 2 characters long')).toBeInTheDocument();
    });
  });

  it('validates maximum length', async () => {
    render(<GearTypeForm {...defaultProps} />);
    
    const longName = 'A'.repeat(51);
    const nameInput = screen.getByLabelText('Gear Type Name *');
    fireEvent.change(nameInput, { target: { value: longName } });
    
    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(screen.getByText('Gear type name must be less than 50 characters')).toBeInTheDocument();
    });
  });

  it('shows character counter', () => {
    render(<GearTypeForm {...defaultProps} />);
    
    expect(screen.getByText('0/50 characters')).toBeInTheDocument();
    
    const nameInput = screen.getByLabelText('Gear Type Name *');
    fireEvent.change(nameInput, { target: { value: 'Test' } });
    
    expect(screen.getByText('4/50 characters')).toBeInTheDocument();
  });

  it('clears validation errors when user types', async () => {
    render(<GearTypeForm {...defaultProps} />);
    
    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(screen.getByText('Gear type name is required')).toBeInTheDocument();
    });
    
    const nameInput = screen.getByLabelText('Gear Type Name *');
    fireEvent.change(nameInput, { target: { value: 'Test' } });
    
    expect(screen.queryByText('Gear type name is required')).not.toBeInTheDocument();
  });

  it('calls onSave with correct data for new gear type', async () => {
    const mockOnSave = vi.fn();
    render(<GearTypeForm {...defaultProps} onSave={mockOnSave} />);
    
    const nameInput = screen.getByLabelText('Gear Type Name *');
    fireEvent.change(nameInput, { target: { value: 'New Type' } });
    
    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith('New Type', undefined);
    });
  });

  it('calls onSave with correct data for existing gear type', async () => {
    const mockOnSave = vi.fn();
    render(<GearTypeForm {...defaultProps} gearType="Old Type" onSave={mockOnSave} />);
    
    const nameInput = screen.getByDisplayValue('Old Type');
    fireEvent.change(nameInput, { target: { value: 'Modified Type' } });
    
    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith('Modified Type', 'Old Type');
    });
  });

  it('calls onCancel when name unchanged in edit mode', async () => {
    const mockOnCancel = vi.fn();
    render(<GearTypeForm {...defaultProps} gearType="Test Type" onCancel={mockOnCancel} />);
    
    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });
  });

  it('calls onDelete when delete button clicked', () => {
    const mockOnDelete = vi.fn();
    render(<GearTypeForm {...defaultProps} gearType="Test Type" onDelete={mockOnDelete} />);
    
    const deleteButton = screen.getByText('Delete');
    fireEvent.click(deleteButton);
    
    expect(mockOnDelete).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when cancel button clicked', () => {
    const mockOnCancel = vi.fn();
    render(<GearTypeForm {...defaultProps} onCancel={mockOnCancel} />);
    
    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);
    
    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it('trims whitespace from input value', async () => {
    const mockOnSave = vi.fn();
    render(<GearTypeForm {...defaultProps} onSave={mockOnSave} />);
    
    const nameInput = screen.getByLabelText('Gear Type Name *');
    fireEvent.change(nameInput, { target: { value: '  Spaced Type  ' } });
    
    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith('Spaced Type', undefined);
    });
  });

  it('disables form during submission', async () => {
    const mockOnSave = vi.fn(() => new Promise(resolve => setTimeout(resolve, 100)));
    render(<GearTypeForm {...defaultProps} onSave={mockOnSave} />);
    
    const nameInput = screen.getByLabelText('Gear Type Name *');
    fireEvent.change(nameInput, { target: { value: 'Test Type' } });
    
    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);
    
    // Check that button shows loading state
    expect(screen.getByText('Saving...')).toBeInTheDocument();
    expect(nameInput).toBeDisabled();
  });

  it('resets form when gearType prop changes', () => {
    const { rerender } = render(<GearTypeForm {...defaultProps} />);
    
    // Fill form
    const nameInput = screen.getByLabelText('Gear Type Name *');
    fireEvent.change(nameInput, { target: { value: 'Test' } });
    
    // Change to edit mode
    rerender(<GearTypeForm {...defaultProps} gearType="Existing Type" />);
    
    expect(screen.getByDisplayValue('Existing Type')).toBeInTheDocument();
  });

  it('enforces maxLength attribute on input', () => {
    render(<GearTypeForm {...defaultProps} />);
    
    const nameInput = screen.getByLabelText('Gear Type Name *') as HTMLInputElement;
    expect(nameInput.maxLength).toBe(50);
  });

  it('updates character counter as user types', () => {
    render(<GearTypeForm {...defaultProps} />);
    
    const nameInput = screen.getByLabelText('Gear Type Name *');
    fireEvent.change(nameInput, { target: { value: 'Testing' } });
    
    expect(screen.getByText('7/50 characters')).toBeInTheDocument();
  });
});