import React, { useState } from 'react';

interface DataSafetyInfoProps {
  onClose?: () => void;
}

export const DataSafetyInfo: React.FC<DataSafetyInfoProps> = ({ onClose }) => {
  const [isVisible, setIsVisible] = useState(true);

  const handleClose = () => {
    setIsVisible(false);
    if (onClose) onClose();
  };

  if (!isVisible) return null;

  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4 mb-4">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <span className="text-blue-500 text-xl">🛡️</span>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
            Data Safety for Multi-Device Usage
          </h3>
          <div className="mt-2 text-sm text-blue-700 dark:text-blue-300">
            <p className="mb-2">
              Your fishing data is automatically protected when switching between devices:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong>Before logout:</strong> All local data is automatically backed up to the cloud</li>
              <li><strong>After login:</strong> Any guest data is merged with your account</li>
              <li><strong>Cross-device sync:</strong> Your data is available on all your devices</li>
              <li><strong>Offline safety:</strong> Data added offline will sync when you're back online</li>
            </ul>
            <p className="mt-2 text-xs opacity-90">
              💡 <strong>Tip:</strong> Stay logged in when possible for the best experience, but don't worry - your data is safe either way!
            </p>
          </div>
        </div>
        <div className="flex-shrink-0 ml-2">
          <button
            onClick={handleClose}
            className="text-blue-400 hover:text-blue-600 dark:text-blue-300 dark:hover:text-blue-100"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default DataSafetyInfo;