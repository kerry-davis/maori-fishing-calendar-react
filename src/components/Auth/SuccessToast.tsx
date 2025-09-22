import React, { useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';

export const SuccessToast: React.FC = () => {
  const { successMessage, clearSuccessMessage } = useAuth();

  useEffect(() => {
    if (successMessage) {
      // Auto-clear the message after 3 seconds
      const timer = setTimeout(() => {
        clearSuccessMessage();
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [successMessage, clearSuccessMessage]);

  if (!successMessage) return null;

  return (
    <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2 duration-300">
      <div className="bg-green-500 dark:bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2">
        <i className="fas fa-check-circle"></i>
        <span>{successMessage}</span>
        <button
          onClick={clearSuccessMessage}
          className="ml-2 hover:text-green-200 transition-colors"
          aria-label="Close message"
        >
          <i className="fas fa-times"></i>
        </button>
      </div>
    </div>
  );
};