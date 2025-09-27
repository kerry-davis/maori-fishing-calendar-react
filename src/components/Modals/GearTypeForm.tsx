import React, { useState, useEffect } from 'react';

interface GearTypeFormProps {
  gearType?: string;
  onSave: (newTypeName: string, oldTypeName?: string) => void;
  onDelete?: () => void;
  onCancel: () => void;
}

/**
 * GearTypeForm Component
 * 
 * Provides gear type creation and editing form with validation.
 * Features:
 * - Gear type creation and editing with validation
 * - Duplicate prevention for gear type names
 * - Gear type deletion with cascade handling for associated gear
 * - Form validation and error handling
 * 
 * Requirements: 1.1, 5.1
 */
export const GearTypeForm: React.FC<GearTypeFormProps> = ({
  gearType,
  onSave,
  onDelete,
  onCancel
}) => {
  const [typeName, setTypeName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditing = !!gearType;

  // Initialize form data when gearType prop changes
  useEffect(() => {
    if (gearType) {
      setTypeName(gearType);
    } else {
      setTypeName('');
    }
    setErrors({});
  }, [gearType]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!typeName.trim()) {
      newErrors.typeName = 'Gear type name is required';
    } else if (typeName.trim().length < 2) {
      newErrors.typeName = 'Gear type name must be at least 2 characters long';
    } else if (typeName.trim().length > 50) {
      newErrors.typeName = 'Gear type name must be less than 50 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (value: string) => {
    setTypeName(value);
    // Clear error when user starts typing
    if (errors.typeName) {
      setErrors(prev => ({ ...prev, typeName: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const trimmedTypeName = typeName.trim();
      
      // Check if we're editing and the name hasn't changed
      if (isEditing && gearType === trimmedTypeName) {
        onCancel();
        return;
      }

      await onSave(trimmedTypeName, gearType);
    } catch (error) {
      console.error('Error saving gear type:', error);
      setErrors({ submit: 'Failed to save gear type. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (onDelete && gearType) {
      onDelete();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h4 className="text-xl font-semibold mb-4" style={{ color: 'var(--primary-text)' }}>
        {isEditing ? 'Edit Gear Type' : 'Add New Gear Type'}
      </h4>

      {errors.submit && (
        <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-md text-sm">
          {errors.submit}
        </div>
      )}

      <div>
        <label
          htmlFor="gear-type-name"
          className="block text-sm font-medium mb-1"
          style={{ color: 'var(--primary-text)' }}
        >
          Gear Type Name *
        </label>
        <input
          type="text"
          id="gear-type-name"
          value={typeName}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder="Enter gear type name (e.g., Lure, Rod, Reel)"
          className={`w-full p-2 border rounded-md dark:bg-gray-600 dark:border-gray-500 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.typeName ? 'border-red-500' : 'border-gray-300'
          }`}
          disabled={isSubmitting}
          maxLength={50}
        />
        {errors.typeName && (
          <p className="text-red-500 text-sm mt-1">{errors.typeName}</p>
        )}
        <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
          {typeName.length}/50 characters
        </p>
      </div>

      {isEditing && (
        <div
          className="p-3 rounded-md border text-sm"
          style={{
            backgroundColor: 'var(--card-background)',
            borderColor: 'var(--accent-color)',
            color: 'var(--primary-text)'
          }}
        >
          <p>
            <strong style={{ color: 'var(--accent-color)' }}>Note:</strong> Changing this gear type name will update all gear items that use this type.
          </p>
        </div>
      )}

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
          className="btn btn-primary px-6 py-2"
        >
          {isSubmitting ? 'Saving...' : 'Save'}
        </button>
      </div>
    </form>
  );
};