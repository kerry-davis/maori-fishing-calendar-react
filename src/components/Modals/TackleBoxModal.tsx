import React, { useState, useEffect } from 'react';
import { Modal, ModalHeader, ModalBody } from './Modal';
import { Button } from '../UI';
import { GearForm } from './GearForm';
import { GearTypeForm } from './GearTypeForm';
import { useFirebaseTackleBox, useFirebaseGearTypes } from '../../hooks/useFirebaseTackleBox';
import type { ModalProps, TackleItem } from '../../types';

/**
 * TackleBoxModal Component
 * 
 * Provides tackle box management interface with gear and gear type management.
 * Features:
 * - Gear type and individual gear item selection dropdowns
 * - Add new gear and gear type functionality
 * - Edit existing gear and gear types
 * - Delete gear and gear types with confirmation
 * 
 * Requirements: 1.1, 5.1
 */
export const TackleBoxModal: React.FC<ModalProps> = ({ isOpen, onClose }) => {
  const [tacklebox, updateTackleBox] = useFirebaseTackleBox();
  const [gearTypes, updateGearTypes] = useFirebaseGearTypes();
  const [selectedGearId, setSelectedGearId] = useState<string>('');
  const [selectedGearType, setSelectedGearType] = useState<string>('');
  const [activeForm, setActiveForm] = useState<'gear' | 'gearType' | null>(null);
  const [editingGear, setEditingGear] = useState<TackleItem | null>(null);
  const [editingGearType, setEditingGearType] = useState<string>('');

  console.log('TackleBoxModal rendered - tacklebox items:', tacklebox.length, 'gearTypes:', gearTypes.length);

  // Reset form state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      resetFormState();
    }
  }, [isOpen]);

  const resetFormState = () => {
    setSelectedGearId('');
    setSelectedGearType('');
    setActiveForm(null);
    setEditingGear(null);
    setEditingGearType('');
  };

  const handleGearSelect = (gearId: string) => {
    setSelectedGearId(gearId);
    setSelectedGearType('');
    
    if (gearId) {
      const gear = tacklebox.find(item => item.id === parseInt(gearId));
      if (gear) {
        setEditingGear(gear);
        setActiveForm('gear');
      }
    } else {
      resetFormState();
    }
  };

  const handleGearTypeSelect = (gearType: string) => {
    setSelectedGearType(gearType);
    setSelectedGearId('');
    
    if (gearType) {
      setEditingGearType(gearType);
      setActiveForm('gearType');
    } else {
      resetFormState();
    }
  };

  const handleAddNewGear = () => {
    setSelectedGearId('');
    setSelectedGearType('');
    setEditingGear(null);
    setActiveForm('gear');
  };

  const handleAddNewGearType = () => {
    setSelectedGearId('');
    setSelectedGearType('');
    setEditingGearType('');
    setActiveForm('gearType');
  };

  const handleGearSave = async (gearData: Omit<TackleItem, 'id'> | TackleItem) => {
    try {
      if ('id' in gearData) {
        // Update existing gear
        await updateTackleBox(prev => prev.map(item =>
          item.id === gearData.id ? gearData : item
        ));
      } else {
        // Add new gear
        const newGear: TackleItem = {
          ...gearData,
          id: Date.now()
        };
        await updateTackleBox(prev => [...prev, newGear]);
      }

      // Only reset form after successful save
      resetFormState();
    } catch (error) {
      console.error('Error saving gear:', error);
      // Keep form open on error so user can retry
    }
  };

  const handleGearDelete = (gearId: number) => {
    if (window.confirm('Are you sure you want to delete this gear item?')) {
      updateTackleBox(prev => prev.filter(item => item.id !== gearId));
      resetFormState();
    }
  };

  const handleGearTypeSave = async (newTypeName: string, oldTypeName?: string) => {
    try {
      if (oldTypeName && oldTypeName !== newTypeName) {
        // Update existing gear type
        updateGearTypes(prev => prev.map(type => type === oldTypeName ? newTypeName : type));
        // Update all gear items that use this type
        updateTackleBox(prev => prev.map(item =>
          item.type === oldTypeName ? { ...item, type: newTypeName } : item
        ));
      } else if (!oldTypeName && !gearTypes.includes(newTypeName)) {
        // Add new gear type
        updateGearTypes(prev => [...prev, newTypeName]);
      }

      // Only reset form after successful save
      resetFormState();
    } catch (error) {
      console.error('Error saving gear type:', error);
      // Keep form open on error so user can retry
    }
  };

  const handleGearTypeDelete = (gearType: string) => {
    const gearUsingType = tacklebox.filter(item => item.type === gearType);
    const confirmMessage = gearUsingType.length > 0
      ? `Are you sure you want to delete the "${gearType}" type? This will also remove ${gearUsingType.length} gear item(s) of this type.`
      : `Are you sure you want to delete the "${gearType}" type?`;

    if (window.confirm(confirmMessage)) {
      updateGearTypes(prev => prev.filter(type => type !== gearType));
      updateTackleBox(prev => prev.filter(item => item.type !== gearType));
      resetFormState();
    }
  };

  // Sort gear items and types for display
  const sortedGear = [...tacklebox].sort((a, b) => a.name.localeCompare(b.name));
  const sortedGearTypes = [...gearTypes].sort();

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-5xl">
      <ModalHeader title="My Tackle Box" onClose={onClose} />

      <ModalBody className="overflow-y-auto max-h-[75vh]">
        {/* Main Content Area */}
        <div className="space-y-6">
          {/* Selection and Action Controls */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Selection Controls */}
            <div className="lg:col-span-1 space-y-4">
              <div>
                <label
                  htmlFor="gear-item-select"
                  className="block text-sm font-medium mb-2"
                  style={{ color: 'var(--primary-text)' }}
                >
                  Edit Existing Gear
                </label>
                <select
                  key={tacklebox.length}
                  id="gear-item-select"
                  value={selectedGearId}
                  onChange={(e) => handleGearSelect(e.target.value)}
                  className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                  style={{
                    backgroundColor: 'var(--input-background)',
                    borderColor: 'var(--input-border)',
                    color: 'var(--primary-text)'
                  }}
                >
                  <option value="">Select Gear...</option>
                  {sortedGear.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="gear-type-select"
                  className="block text-sm font-medium mb-2"
                  style={{ color: 'var(--primary-text)' }}
                >
                  Edit Existing Gear Type
                </label>
                <select
                  id="gear-type-select"
                  value={selectedGearType}
                  onChange={(e) => handleGearTypeSelect(e.target.value)}
                  className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                  style={{
                    backgroundColor: 'var(--input-background)',
                    borderColor: 'var(--input-border)',
                    color: 'var(--primary-text)'
                  }}
                >
                  <option value="">Select Type...</option>
                  {sortedGearTypes.map(type => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <Button onClick={handleAddNewGear} className="w-full justify-center py-3">
                  <i className="fas fa-plus mr-2"></i>
                  Add New Gear
                </Button>
                <Button onClick={handleAddNewGearType} variant="secondary" className="w-full justify-center py-3">
                  <i className="fas fa-plus mr-2"></i>
                  Add New Type
                </Button>
              </div>
            </div>

            {/* Right Columns: Form Area (spans 2 columns on large screens) */}
            <div className="lg:col-span-2">
              {activeForm ? (
                <div className="bg-white dark:bg-gray-800 rounded-lg border p-6" style={{ backgroundColor: 'var(--card-background)', borderColor: 'var(--border-color)' }}>
                  {activeForm === 'gear' && (
                    <GearForm
                      gear={editingGear}
                      gearTypes={gearTypes}
                      onSave={handleGearSave}
                      onDelete={editingGear ? () => handleGearDelete(editingGear.id) : undefined}
                      onCancel={resetFormState}
                    />
                  )}

                  {activeForm === 'gearType' && (
                    <GearTypeForm
                      gearType={editingGearType}
                      onSave={handleGearTypeSave}
                      onDelete={editingGearType ? () => handleGearTypeDelete(editingGearType) : undefined}
                      onCancel={resetFormState}
                    />
                  )}
                </div>
              ) : (
                <div className="bg-white dark:bg-gray-800 rounded-lg border p-8 text-center" style={{ backgroundColor: 'var(--card-background)', borderColor: 'var(--border-color)' }}>
                  <div className="max-w-md mx-auto">
                    <i className="fas fa-toolbox text-4xl mb-4" style={{ color: 'var(--secondary-text)' }}></i>
                    <h3 className="text-lg font-medium mb-2" style={{ color: 'var(--primary-text)' }}>
                      Manage Your Tackle Box
                    </h3>
                    <p className="text-sm" style={{ color: 'var(--secondary-text)' }}>
                      Select an existing gear item or type to edit, or create something new to get started.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </ModalBody>
    </Modal>
  );
};
