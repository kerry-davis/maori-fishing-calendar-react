import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { LoginModal } from './LoginModal';
import ContextualConfirmation from '../UI/ContextualConfirmation';

export const AuthButton: React.FC = () => {
  const { user, logout, forceLogout, isFirebaseConfigured } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogout = async () => {
    console.log('=== LOGOUT BUTTON CLICKED ===');
    console.log('Firebase configured:', isFirebaseConfigured);
    console.log('User object:', user);
    console.log('Current time:', new Date().toISOString());

    // Show modern confirmation dialog
    setShowLogoutConfirm(true);
  };

  const handleLogoutConfirm = async () => {
    console.log('=== LOGOUT CONFIRMATION ===');
    console.log('User confirmed logout, proceeding...');
    
    setShowLogoutConfirm(false);

    try {
      if (isFirebaseConfigured) {
        console.log('Using Firebase logout...');
        await logout();
        console.log('✅ Firebase logout completed successfully');
      } else {
        console.log('Firebase not configured, using force logout');
        forceLogout();
        console.log('✅ Force logout completed successfully');
      }
    } catch (error) {
      console.error('❌ Logout error:', error);
      // If Firebase logout fails, try force logout as fallback
      console.log('Firebase logout failed, trying force logout as fallback');
      try {
        forceLogout();
        console.log('✅ Force logout fallback completed successfully');
      } catch (fallbackError) {
        console.error('❌ Force logout also failed:', fallbackError);
        alert(`Logout failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  };

  const handleLogoutCancel = () => {
    console.log('User cancelled logout confirmation');
    setShowLogoutConfirm(false);
  };

  if (user) {
    return (
      <div className="relative">
        <button
          onClick={() => {
            console.log('=== BUTTON CLICK DETECTED ===');
            handleLogout();
          }}
          className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-full w-10 h-10 flex items-center justify-center shadow-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors duration-200"
          title="Logout"
        >
          <i className="fas fa-sign-out-alt text-gray-800 dark:text-gray-200"></i>
        </button>

        {/* Standardized Logout Confirmation */}
        <ContextualConfirmation
          isOpen={showLogoutConfirm}
          title="Sign Out"
          message="Your data will be safely backed up before signing out."
          confirmText="Sign Out"
          cancelText="Stay Signed In"
          onConfirm={handleLogoutConfirm}
          onCancel={handleLogoutCancel}
          variant="warning"
          position="top-right"
        />

        <LoginModal
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
        />
      </div>
    );
  }

  if (!isFirebaseConfigured) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => alert('Firebase authentication is not configured. Please set up your Firebase environment variables.')}
          className="bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 rounded-full w-10 h-10 flex items-center justify-center shadow-md hover:bg-yellow-300 dark:hover:bg-yellow-700 transition"
          title="Auth not configured - Click for details"
        >
          <i className="fas fa-exclamation-triangle text-yellow-800 dark:text-yellow-200"></i>
        </button>
        <button
          onClick={() => {
            console.log('Force logout button clicked');
            forceLogout();
          }}
          className="bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200 rounded-full w-10 h-10 flex items-center justify-center shadow-md hover:bg-red-300 dark:hover:bg-red-700 transition"
          title="Force Logout (Debug)"
        >
          <i className="fas fa-sign-out-alt text-red-800 dark:text-red-200"></i>
        </button>
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