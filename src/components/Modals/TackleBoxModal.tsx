import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { GearForm } from './GearForm';
import { GearTypeForm } from './GearTypeForm';
import { useFirebaseTackleBox, useFirebaseGearTypes } from '../../hooks/useFirebaseTackleBox';
import type { ModalProps, TackleItem } from '../../types';
import { DEFAULT_GEAR_TYPES } from '../../types';

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
  const [tacklebox, setTacklebox, , tackleboxError, tackleboxLoading] = useFirebaseTackleBox();
  const [gearTypes, setGearTypes, , gearTypesError, gearTypesLoading] = useFirebaseGearTypes();
  const [selectedGearId, setSelectedGearId] = useState<string>('');
  const [selectedGearType, setSelectedGearType] = useState<string>('');
  const [activeForm, setActiveForm] = useState<'gear' | 'gearType' | null>(null);
  const [editingGear, setEditingGear] = useState<TackleItem | null>(null);
  const [editingGearType, setEditingGearType] = useState<string>('');

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

  const handleGearSave = (gearData: Omit<TackleItem, 'id'> | TackleItem) => {
    if ('id' in gearData) {
      // Update existing gear
      setTacklebox(prev => prev.map(item => 
        item.id === gearData.id ? gearData : item
      ));
    } else {
      // Add new gear
      const newGear: TackleItem = {
        ...gearData,
        id: Date.now()
      };
      setTacklebox(prev => [...prev, newGear]);
    }
    resetFormState();
  };

  const handleGearDelete = (gearId: number) => {
    if (window.confirm('Are you sure you want to delete this gear item?')) {
      setTacklebox(prev => prev.filter(item => item.id !== gearId));
      resetFormState();
    }
  };

  const handleGearTypeSave = (newTypeName: string, oldTypeName?: string) => {
    if (oldTypeName && oldTypeName !== newTypeName) {
      // Update existing gear type
      setGearTypes(prev => prev.map(type => type === oldTypeName ? newTypeName : type));
      // Update all gear items that use this type
      setTacklebox(prev => prev.map(item => 
        item.type === oldTypeName ? { ...item, type: newTypeName } : item
      ));
    } else if (!oldTypeName && !gearTypes.includes(newTypeName)) {
      // Add new gear type
      setGearTypes(prev => [...prev, newTypeName]);
    }
    resetFormState();
  };

  const handleGearTypeDelete = (gearType: string) => {
    const gearUsingType = tacklebox.filter(item => item.type === gearType);
    const confirmMessage = gearUsingType.length > 0
      ? `Are you sure you want to delete the "${gearType}" type? This will also remove ${gearUsingType.length} gear item(s) of this type.`
      : `Are you sure you want to delete the "${gearType}" type?`;

    if (window.confirm(confirmMessage)) {
      setGearTypes(prev => prev.filter(type => type !== gearType));
      setTacklebox(prev => prev.filter(item => item.type !== gearType));
      resetFormState();
    }
  };

  // Sort gear items and types for display
  const sortedGear = [...tacklebox].sort((a, b) => a.name.localeCompare(b.name));
  const sortedGearTypes = [...gearTypes].sort();

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-4xl">
      <div className="p-6 border-b dark:border-gray-700">
        <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
          My Tackle Box
        </h3>
      </div>
      
      <div className="p-6 overflow-y-auto max-h-[70vh]">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left side: Dropdowns and Add buttons */}
          <div>
            <div className="mb-4">
              <label 
                htmlFor="gear-item-select" 
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Edit Existing Gear
              </label>
              <select
                id="gear-item-select"
                value={selectedGearId}
                onChange={(e) => handleGearSelect(e.target.value)}
                className="w-full p-2 border rounded-md dark:bg-gray-600 dark:border-gray-500 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Gear...</option>
                {sortedGear.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label 
                htmlFor="gear-type-select" 
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Edit Existing Gear Type
              </label>
              <select
                id="gear-type-select"
                value={selectedGearType}
                onChange={(e) => handleGearTypeSelect(e.target.value)}
                className="w-full p-2 border rounded-md dark:bg-gray-600 dark:border-gray-500 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Type...</option>
                {sortedGearTypes.map(type => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex space-x-2">
              <button
                onClick={handleAddNewGear}
                className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Add New Gear
              </button>
              <button
                onClick={handleAddNewGearType}
                className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Add New Type
              </button>
            </div>
          </div>

          {/* Right side: Details and Forms */}
          <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg">
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
            
            {!activeForm && (
              <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                <p>Select an item or type to view details, or add a new one.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};