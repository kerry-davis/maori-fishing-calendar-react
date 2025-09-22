import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { LoginModal } from './LoginModal';

export const AuthButton: React.FC = () => {
  const { user, logout, isFirebaseConfigured } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);

  const handleLogout = async () => {
    // Show confirmation dialog
    const confirmed = window.confirm('Are you sure you want to sign out?');

    if (confirmed) {
      try {
        await logout();
      } catch (error) {
        console.error('Logout error:', error);
      }
    }
  };

  if (user) {
    return (
      <>
        <button
          onClick={handleLogout}
          className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-full w-10 h-10 flex items-center justify-center shadow-md hover:bg-red-300 dark:hover:bg-red-600 transition"
          title="Logout"
        >
          <i className="fas fa-sign-out-alt text-gray-800 dark:text-gray-200"></i>
        </button>

        <LoginModal
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
        />
      </>
    );
  }

  if (!isFirebaseConfigured) {
    return (
      <div className="flex items-center gap-2">
        <div className="bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 rounded-full w-10 h-10 flex items-center justify-center shadow-md">
          <i className="fas fa-exclamation-triangle text-yellow-800 dark:text-yellow-200"></i>
        </div>
        <div className="hidden md:block text-sm text-gray-600 dark:text-gray-400">
          Auth not configured
        </div>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowLoginModal(true)}
        className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-full w-10 h-10 flex items-center justify-center shadow-md hover:bg-gray-300 dark:hover:bg-gray-600 transition"
        title="Sign In"
      >
        <i className="fas fa-user text-gray-800 dark:text-gray-200"></i>
      </button>

      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />
    </>
  );
};