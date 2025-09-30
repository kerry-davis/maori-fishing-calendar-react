import React from 'react';

interface ConfirmationDialogProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel: () => void;
    variant?: 'danger' | 'warning' | 'info';
    overlayStyle?: 'default' | 'blur' | 'none';
    children?: React.ReactNode;
    confirmDisabled?: boolean;
    cancelDisabled?: boolean;
}

const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
    isOpen,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    onConfirm,
    onCancel,
    variant = 'danger',
    overlayStyle = 'blur',
    children,
    confirmDisabled = false,
    cancelDisabled = false
}) => {
    if (!isOpen) return null;

    const getVariantStyles = () => {
        switch (variant) {
            case 'danger':
                return {
                    confirmButton: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
                    icon: '⚠️'
                };
            case 'warning':
                return {
                    confirmButton: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500',
                    icon: '⚠️'
                };
            case 'info':
                return {
                    confirmButton: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
                    icon: 'ℹ️'
                };
            default:
                return {
                    confirmButton: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
                    icon: '⚠️'
                };
        }
    };

    const styles = getVariantStyles();

    const overlayClasses = overlayStyle === 'none'
        ? 'pointer-events-none'
        : overlayStyle === 'blur'
            ? 'backdrop-blur-sm bg-black/30'
            : 'bg-gray-500/75';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Background overlay */}
            {overlayStyle !== 'none' && (
              <div
                className={`fixed inset-0 transition-opacity ${overlayClasses}`}
                onClick={onCancel}
              />
            )}

            {/* Modal panel */}
            <div className="relative bg-white dark:bg-gray-800 rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all max-w-lg w-full sm:p-6">
                <div className="sm:flex sm:items-start">
                    <div className={`mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full sm:mx-0 sm:h-10 sm:w-10 ${variant === 'warning' ? 'bg-yellow-100 dark:bg-yellow-900' :
                        variant === 'info' ? 'bg-blue-100 dark:bg-blue-900' :
                            'bg-red-100 dark:bg-red-900'
                        }`}>
                        <span className="text-xl">{styles.icon}</span>
                    </div>
                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                        <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-gray-100">
                            {title}
                        </h3>
                        <div className="mt-2">
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                {message}
                            </p>
                            {children && (
                              <div className="mt-3">
                                {children}
                              </div>
                            )}
                        </div>
                    </div>
                </div>
                <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                    <button
                        type="button"
                        className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm ${styles.confirmButton} ${confirmDisabled ? 'opacity-70 cursor-not-allowed' : ''}`}
                        onClick={onConfirm}
                        disabled={confirmDisabled}
                    >
                        {confirmText}
                    </button>
                    <button
                        type="button"
                        className={`mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-700 text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm ${cancelDisabled ? 'opacity-70 cursor-not-allowed' : ''}`}
                        onClick={onCancel}
                        disabled={cancelDisabled}
                    >
                        {cancelText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmationDialog;