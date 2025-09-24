import React from 'react';

interface ContextualConfirmationProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'warning' | 'info';
  position?: 'center' | 'top-right';
}

const ContextualConfirmation: React.FC<ContextualConfirmationProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'danger',
  position = 'center'
}) => {
  if (!isOpen) return null;

  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          iconBg: 'bg-red-100 dark:bg-red-900',
          iconColor: 'text-red-600 dark:text-red-400',
          confirmButton: 'btn btn-danger',
          icon: '🗑️'
        };
      case 'warning':
        return {
          iconBg: 'bg-yellow-100 dark:bg-yellow-900',
          iconColor: 'text-yellow-600 dark:text-yellow-400',
          confirmButton: 'btn btn-warning',
          icon: '⚠️'
        };
      case 'info':
        return {
          iconBg: 'bg-blue-100 dark:bg-blue-900',
          iconColor: 'text-blue-600 dark:text-blue-400',
          confirmButton: 'btn btn-primary',
          icon: 'ℹ️'
        };
      default:
        return {
          iconBg: 'bg-red-100 dark:bg-red-900',
          iconColor: 'text-red-600 dark:text-red-400',
          confirmButton: 'btn btn-danger',
          icon: '🗑️'
        };
    }
  };

  const styles = getVariantStyles();

  const positionClasses = position === 'top-right' 
    ? 'absolute top-12 right-0 z-50' 
    : 'fixed inset-0 z-50 flex items-center justify-center p-4';

  const containerClasses = position === 'top-right'
    ? 'bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-4 min-w-80 max-w-sm'
    : 'relative bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-4 max-w-sm w-full';

  return (
    <div className={positionClasses}>
      {position === 'center' && (
        <div 
          className="fixed inset-0 bg-gray-900 bg-opacity-20 transition-opacity"
          onClick={onCancel}
        />
      )}
      
      <div className={containerClasses}>
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <div className={`w-8 h-8 ${styles.iconBg} rounded-full flex items-center justify-center`}>
              <span className={`${styles.iconColor} text-sm`}>{styles.icon}</span>
            </div>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
              {title}
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
              {message}
            </p>
            <div className="flex space-x-2">
              <button
                onClick={onCancel}
                className="btn btn-ghost px-3 py-1.5 text-xs"
              >
                {cancelText}
              </button>
              <button
                onClick={onConfirm}
                className={`${styles.confirmButton} px-3 py-1.5 text-xs`}
              >
                {confirmText}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContextualConfirmation;