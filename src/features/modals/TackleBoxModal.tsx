import React, { useState, useEffect, useRef } from 'react';
import { Modal, ModalHeader, ModalBody } from './Modal';
import { Button } from '@shared/components/Button';
import { GearForm } from './GearForm';
import { GearTypeForm } from './GearTypeForm';
import { useFirebaseTackleBox, useFirebaseGearTypes } from '@shared/hooks/useFirebaseTackleBox';
import { enqueueGearItemRename, enqueueGearTypeRename, subscribeGearMaintenance } from '@shared/services/gearLabelMaintenanceService';
import type { ModalProps, TackleItem } from '../../shared/types';
import ConfirmationDialog from '@shared/components/ConfirmationDialog';

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
  const [showConfirm, setShowConfirm] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void } | null>(null);
  const [gearMaintenanceQueueSize, setGearMaintenanceQueueSize] = useState(0);
  const [gearMaintenanceProgress, setGearMaintenanceProgress] = useState<{ label: string; processed: number; total: number } | null>(null);
  const [gearMaintenanceMessage, setGearMaintenanceMessage] = useState<string | null>(null);
  const maintenanceMessageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const normalize = (value?: string) => (value ?? '').trim();
  const normalizeLower = (value?: string) => normalize(value).toLowerCase();

  console.log('TackleBoxModal rendered - tacklebox items:', tacklebox.length, 'gearTypes:', gearTypes.length);

  useEffect(() => {
    const unsubscribe = subscribeGearMaintenance(event => {
      if (event.type === 'queue-size') {
        setGearMaintenanceQueueSize(event.size);
      } else if (event.type === 'task-start') {
        setGearMaintenanceProgress({ label: event.label, processed: 0, total: event.total });
      } else if (event.type === 'task-progress') {
        setGearMaintenanceProgress({ label: event.label, processed: event.processed, total: event.total });
      } else if (event.type === 'task-complete') {
        setGearMaintenanceProgress(null);
        const message = `${event.label} complete (${event.processed} catch${event.processed === 1 ? '' : 'es'} updated)`;
        setGearMaintenanceMessage(message);
        if (maintenanceMessageTimeoutRef.current) {
          clearTimeout(maintenanceMessageTimeoutRef.current);
        }
        maintenanceMessageTimeoutRef.current = setTimeout(() => {
          setGearMaintenanceMessage(null);
          maintenanceMessageTimeoutRef.current = null;
        }, 5000);
      } else if (event.type === 'task-error') {
        setGearMaintenanceProgress(null);
        const message = `${event.label} failed. Check console for details.`;
        setGearMaintenanceMessage(message);
        if (maintenanceMessageTimeoutRef.current) {
          clearTimeout(maintenanceMessageTimeoutRef.current);
        }
        maintenanceMessageTimeoutRef.current = setTimeout(() => {
          setGearMaintenanceMessage(null);
          maintenanceMessageTimeoutRef.current = null;
        }, 7000);
      }
    });

    return () => {
      unsubscribe();
      if (maintenanceMessageTimeoutRef.current) {
        clearTimeout(maintenanceMessageTimeoutRef.current);
        maintenanceMessageTimeoutRef.current = null;
      }
    };
  }, []);

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
      // Helpers to build composite keys consistently with selection UI
      const buildKey = (it: { type: string; brand: string; name: string; colour: string }) => {
        const parts = [normalize(it.type), normalize(it.brand), normalize(it.name), normalize(it.colour)];
        const canonical = parts.join('|');
        const lower = parts.map(part => part.toLowerCase()).join('|');
        return { canonical, lower };
      };

      if ('id' in gearData) {
        // Update existing gear
        const previous = editingGear || undefined;
        await updateTackleBox(prev => prev.map(item =>
          item.id === gearData.id ? (gearData as TackleItem) : item
        ));

        // If name/brand/type/colour changed, update catch records' denormalized gear labels
        if (previous) {
          const oldKey = buildKey(previous);
          const newKey = buildKey(gearData as TackleItem);
          const oldNameLc = normalizeLower(previous.name);
          if (oldKey.lower !== newKey.lower || oldNameLc !== normalizeLower((gearData as TackleItem).name)) {
            // Process both cloud and guest seamlessly via data service
            const description = `Gear rename: ${previous.name || 'Unnamed'} → ${(gearData as TackleItem).name || 'Unnamed'}`;
            enqueueGearItemRename(oldKey.lower, oldNameLc, newKey.canonical, newKey.lower, description);
            console.log('Queued gear label maintenance task (item rename).');
          }
        }
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
    setShowConfirm({
      open: true,
      title: 'Delete Gear Item',
      message: 'This will permanently delete this gear item from your tackle box.',
      onConfirm: () => {
        updateTackleBox(prev => prev.filter(item => item.id !== gearId));
        resetFormState();
        setShowConfirm(null);
      }
    });
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

        // Also update catch records' denormalized gear composite labels for this type
        const oldPrefixLower = `${normalizeLower(oldTypeName)}|`;
        const newPrefixCanonical = normalize(newTypeName);
        const newPrefixLower = normalizeLower(newTypeName);
        const description = `Gear type rename: ${oldTypeName} → ${newTypeName}`;
        enqueueGearTypeRename(oldPrefixLower, newPrefixCanonical, newPrefixLower, description);
        console.log('Queued gear label maintenance task (type rename).');
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
    const message = gearUsingType.length > 0
      ? `This will also remove ${gearUsingType.length} gear item(s) of this type.`
      : 'This will permanently delete this gear type.';

    setShowConfirm({
      open: true,
      title: `Delete "${gearType}" Type`,
      message,
      onConfirm: () => {
        updateGearTypes(prev => prev.filter(type => type !== gearType));
        updateTackleBox(prev => prev.filter(item => item.type !== gearType));
        resetFormState();
        setShowConfirm(null);
      }
    });
  };

  // Sort gear items and types for display
  const sortedGear = [...tacklebox].sort((a, b) => a.name.localeCompare(b.name));
  const sortedGearTypes = [...gearTypes].sort();
  const groupedGearForSelect = React.useMemo(() => {
    const groups: Record<string, TackleItem[]> = {};
    for (const item of sortedGear) {
      const t = item.type || 'Other';
      if (!groups[t]) groups[t] = [];
      groups[t].push(item);
    }
    Object.keys(groups).forEach(t => {
      groups[t].sort((a, b) => a.name.localeCompare(b.name) || (a.brand || '').localeCompare(b.brand || ''));
    });
    return Object.fromEntries(Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)));
  }, [sortedGear]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-5xl">
      <ModalHeader title="My Tackle Box" onClose={onClose} />

      <ModalBody className="overflow-y-auto max-h-[75vh]">
        {(gearMaintenanceProgress || gearMaintenanceMessage || gearMaintenanceQueueSize > 0) && (
          <div className="mb-4 space-y-2">
            {gearMaintenanceProgress && (
              <div
                className="rounded-md border p-3"
                style={{ backgroundColor: 'var(--secondary-background)', borderColor: 'var(--border-color)' }}
              >
                <div className="flex items-center justify-between text-sm">
                  <span style={{ color: 'var(--primary-text)' }}>
                    Updating catch records: {gearMaintenanceProgress.label}
                  </span>
                  <span style={{ color: 'var(--secondary-text)' }}>
                    {gearMaintenanceProgress.processed}/{gearMaintenanceProgress.total}
                  </span>
                </div>
                <div className="mt-2 h-2 rounded bg-gray-200 dark:bg-gray-700">
                  <div
                    className="h-2 rounded"
                    style={{
                      width: `${gearMaintenanceProgress.total ? Math.min(100, (gearMaintenanceProgress.processed / gearMaintenanceProgress.total) * 100) : 0}%`,
                      backgroundColor: 'var(--button-primary)'
                    }}
                  ></div>
                </div>
              </div>
            )}

            {gearMaintenanceMessage && (
              <div
                className="rounded-md border p-3 text-sm"
                style={{ backgroundColor: 'var(--card-background)', borderColor: 'var(--border-color)', color: 'var(--primary-text)' }}
              >
                {gearMaintenanceMessage}
              </div>
            )}

            {gearMaintenanceQueueSize > 0 && !gearMaintenanceProgress && (
              <div className="text-xs" style={{ color: 'var(--secondary-text)' }}>
                Queued catch updates: {gearMaintenanceQueueSize}
              </div>
            )}
          </div>
        )}

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
                  {Object.entries(groupedGearForSelect).map(([type, items]) => (
                    <optgroup key={type} label={`${type}s`}>
                      {items.map(item => (
                        <option key={item.id} value={item.id}>
                          {item.name}{item.brand ? ` - ${item.brand}` : ''}
                        </option>
                      ))}
                    </optgroup>
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

      {/* Standardized confirmation dialog */}
      <ConfirmationDialog
        isOpen={!!showConfirm?.open}
        title={showConfirm?.title || ''}
        message={showConfirm?.message || ''}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={() => showConfirm?.onConfirm()}
        onCancel={() => setShowConfirm(null)}
        variant="danger"
        overlayStyle="blur"
      />
    </Modal>
  );
};
