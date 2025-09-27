import React, { useState, useEffect } from 'react';
import type { TackleItem } from '../../types';

interface GearFormProps {
  gear?: TackleItem | null;
  gearTypes: string[];
  onSave: (gearData: Omit<TackleItem, 'id'> | TackleItem) => void;
  onDelete?: () => void;
  onCancel: () => void;
}

/**
 * GearForm Component
 * 
 * Provides gear creation and editing form with validation.
 * Features:
 * - Gear type selection and custom properties (name, brand, color)
 * - Form validation with error handling
 * - Gear deletion functionality with confirmation
 * - Support for both creating new gear and editing existing gear
 * 
 * Requirements: 1.1, 5.1, 3.2
 */
export const GearForm: React.FC<GearFormProps> = ({
  gear,
  gearTypes,
  onSave,
  onDelete,
  onCancel
}) => {
  const [formData, setFormData] = useState({
    name: '',
    brand: '',
    type: '',
    colour: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditing = !!gear;

  // Initialize form data when gear prop changes
  useEffect(() => {
    if (gear) {
      setFormData({
        name: gear.name,
        brand: gear.brand,
        type: gear.type,
        colour: gear.colour
      });
    } else {
      setFormData({
        name: '',
        brand: '',
        type: gearTypes[0] || '',
        colour: ''
      });
    }
    setErrors({});
  }, [gear, gearTypes]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.type) {
      newErrors.type = 'Gear type is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const gearData = {
        name: formData.name.trim(),
        brand: formData.brand.trim(),
        type: formData.type,
        colour: formData.colour.trim()
      };

      if (isEditing && gear) {
        await onSave({ ...gearData, id: gear.id });
      } else {
        await onSave(gearData);
      }
    } catch (error) {
      console.error('Error saving gear:', error);
      setErrors({ submit: 'Failed to save gear. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (onDelete && gear) {
      onDelete();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h4 className="text-xl font-semibold mb-4" style={{ color: 'var(--primary-text)' }}>
        {isEditing ? 'Edit Gear' : 'Add New Gear'}
      </h4>

      {errors.submit && (
        <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-md text-sm">
          {errors.submit}
        </div>
      )}

      <div>
        <label
          htmlFor="gear-name"
          className="block text-sm font-medium mb-1"
          style={{ color: 'var(--primary-text)' }}
        >
          Name *
        </label>
        <input
          type="text"
          id="gear-name"
          value={formData.name}
          onChange={(e) => handleInputChange('name', e.target.value)}
          placeholder="Enter gear name"
          className={`w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.name ? 'border-red-500' : ''
          }`}
          style={{
            backgroundColor: 'var(--input-background)',
            border: `1px solid ${errors.name ? 'var(--error-border)' : 'var(--border-color)'}`,
            color: 'var(--primary-text)'
          }}
          disabled={isSubmitting}
        />
        {errors.name && (
          <p className="text-red-500 text-sm mt-1">{errors.name}</p>
        )}
      </div>

      <div>
        <label
          htmlFor="gear-brand"
          className="block text-sm font-medium mb-1"
          style={{ color: 'var(--primary-text)' }}
        >
          Brand
        </label>
        <input
          type="text"
          id="gear-brand"
          value={formData.brand}
          onChange={(e) => handleInputChange('brand', e.target.value)}
          placeholder="Enter brand name"
          className="w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          style={{
            backgroundColor: 'var(--input-background)',
            border: '1px solid var(--border-color)',
            color: 'var(--primary-text)'
          }}
          disabled={isSubmitting}
        />
      </div>

      <div>
        <label
          htmlFor="gear-type"
          className="block text-sm font-medium mb-1"
          style={{ color: 'var(--primary-text)' }}
        >
          Gear Type *
        </label>
        <select
          id="gear-type"
          value={formData.type}
          onChange={(e) => handleInputChange('type', e.target.value)}
          className={`w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.type ? 'border-red-500' : ''
          }`}
          style={{
            backgroundColor: 'var(--input-background)',
            border: `1px solid ${errors.type ? 'var(--error-border)' : 'var(--border-color)'}`,
            color: 'var(--primary-text)'
          }}
          disabled={isSubmitting}
        >
          <option value="">Select gear type</option>
          {gearTypes.map(type => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
        {errors.type && (
          <p className="text-red-500 text-sm mt-1">{errors.type}</p>
        )}
      </div>

      <div>
        <label
          htmlFor="gear-colour"
          className="block text-sm font-medium mb-1"
          style={{ color: 'var(--primary-text)' }}
        >
          Colour
        </label>
        <input
          type="text"
          id="gear-colour"
          value={formData.colour}
          onChange={(e) => handleInputChange('colour', e.target.value)}
          placeholder="Enter colour"
          className="w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          style={{
            backgroundColor: 'var(--input-background)',
            border: '1px solid var(--border-color)',
            color: 'var(--primary-text)'
          }}
          disabled={isSubmitting}
        />
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="btn btn-secondary px-4 py-2"
        >
          Cancel
        </button>

        {isEditing && onDelete && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isSubmitting}
            className="btn btn-danger px-4 py-2"
          >
            Delete
          </button>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="btn btn-primary px-4 py-2"
        >
          {isEditing ? 'Update' : 'Save'}
        </button>
      </div>
    </form>
  );
};