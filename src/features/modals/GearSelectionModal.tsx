import React, { useState, useEffect, useCallback } from "react";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "./Modal";
import { Button } from "@shared/components/Button";
import { useFirebaseTackleBox, useFirebaseGearTypes } from "@shared/hooks/useFirebaseTackleBox";
import type { TackleItem } from "@shared/types";

export interface GearSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedGear: string[];
  onGearSelected: (gear: string[]) => void;
}

/**
 * GearSelectionModal component for selecting fishing gear
 * Features:
 * - Display tackle box items organized by type
 * - Custom gear entry functionality
 * - Multi-select capability
 * - Integration with localStorage tackle box
 */
export const GearSelectionModal: React.FC<GearSelectionModalProps> = ({
  isOpen,
  onClose,
  selectedGear,
  onGearSelected,
}) => {
  const [tackleBox] = useFirebaseTackleBox();
  const [gearTypes] = useFirebaseGearTypes();
  const [customGear, setCustomGear] = useState("");
  const [selectedGearItems, setSelectedGearItems] = useState<string[]>(selectedGear);
  const [activeTab, setActiveTab] = useState("tacklebox");

  // Reset selection when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedGearItems(selectedGear);
    }
  }, [isOpen, selectedGear]);

  const handleGearToggle = useCallback((gearName: string) => {
    setSelectedGearItems(prev => {
      if (prev.includes(gearName)) {
        return prev.filter(item => item !== gearName);
      } else {
        return [...prev, gearName];
      }
    });
  }, []);

  const handleCustomGearAdd = useCallback(() => {
    if (customGear.trim()) {
      const newGearName = customGear.trim();
      if (!selectedGearItems.includes(newGearName)) {
        setSelectedGearItems(prev => [...prev, newGearName]);
      }
      setCustomGear("");
    }
  }, [customGear, selectedGearItems]);

  const handleSave = useCallback(() => {
    onGearSelected(selectedGearItems);
    onClose();
  }, [selectedGearItems, onGearSelected, onClose]);

  const handleCancel = useCallback(() => {
    setSelectedGearItems(selectedGear);
    onClose();
  }, [selectedGear, onClose]);

  // Group tackle box items by type
  const groupedTackleItems = gearTypes.reduce((acc, type) => {
    acc[type] = tackleBox.filter(item => item.type === type);
    return acc;
  }, {} as Record<string, TackleItem[]>);

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="lg">
      <ModalHeader
        title="Select Gear"
        subtitle="Choose gear from your tackle box or add custom items"
        onClose={onClose}
      />

      <ModalBody className="max-h-96 overflow-y-auto">
        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 mb-4">
          <button
            onClick={() => setActiveTab("tacklebox")}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === "tacklebox"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            Tackle Box
          </button>
          <button
            onClick={() => setActiveTab("custom")}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === "custom"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            Custom Gear
          </button>
        </div>

        {/* Tackle Box Tab */}
        {activeTab === "tacklebox" && (
          <div className="space-y-4">
            {gearTypes.map(type => {
              const items = groupedTackleItems[type];
              if (items.length === 0) return null;

              return (
                <div key={type} className="border border-gray-200 dark:border-gray-600 rounded-lg p-3">
                  <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-2 capitalize">
                    {type}s
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {items.map(item => (
                      <label
                        key={item.id}
                        className="flex items-center p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedGearItems.includes(item.name)}
                          onChange={() => handleGearToggle(item.name)}
                          className="mr-2 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
                            {item.name}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {item.brand} • {item.colour}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}

            {tackleBox.length === 0 && (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <i className="fas fa-toolbox text-3xl mb-2"></i>
                <p>Your tackle box is empty</p>
                <p className="text-sm">Add gear items to get started</p>
              </div>
            )}
          </div>
        )}

        {/* Custom Gear Tab */}
        {activeTab === "custom" && (
          <div className="space-y-4">
            <div>
              <label htmlFor="customGear" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Add Custom Gear or Bait
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  id="customGear"
                  value={customGear}
                  onChange={(e) => setCustomGear(e.target.value)}
                  placeholder="e.g., Worms, Custom Lure"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleCustomGearAdd();
                    }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleCustomGearAdd}
                  disabled={!customGear.trim()}
                  leftIcon={<i className="fas fa-plus"></i>}
                >
                  Add
                </Button>
              </div>
            </div>

            {/* Selected Custom Gear */}
            {selectedGearItems.filter(gear => !tackleBox.some(item => item.name === gear)).length > 0 && (
              <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-3">
                <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-2">
                  Selected Custom Gear
                </h4>
                <div className="flex flex-wrap gap-2">
                  {selectedGearItems
                    .filter(gear => !tackleBox.some(item => item.name === gear))
                    .map((gearItem, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
                      >
                        {gearItem}
                        <button
                          type="button"
                          onClick={() => handleGearToggle(gearItem)}
                          className="ml-1 text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200"
                        >
                          <i className="fas fa-times"></i>
                        </button>
                      </span>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </ModalBody>

      <ModalFooter>
        <div className="flex justify-between items-center w-full">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {selectedGearItems.length} item{selectedGearItems.length !== 1 ? 's' : ''} selected
          </div>
          <div className="flex space-x-3">
            <Button
              type="button"
              variant="secondary"
              onClick={handleCancel}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
            >
              Done
            </Button>
          </div>
        </div>
      </ModalFooter>
    </Modal>
  );
};

export default GearSelectionModal;