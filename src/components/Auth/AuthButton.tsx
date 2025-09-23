import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { LoginModal } from './LoginModal';

export const AuthButton: React.FC = () => {
  const { user, logout, forceLogout, clearSyncQueue, isFirebaseConfigured } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogout = async () => {
    console.log('=== LOGOUT BUTTON CLICKED ===');
    console.log('Firebase configured:', isFirebaseConfigured);
    console.log('User object:', user);
    console.log('Current time:', new Date().toISOString());

    // Show custom inline confirmation instead of browser dialog
    setShowLogoutConfirm(true);
  };

  const handleLogoutConfirm = async (confirmed: boolean) => {
    console.log('=== LOGOUT CONFIRMATION ===');
    console.log('User clicked:', confirmed ? 'Sign Out' : 'Cancel');
    console.log('Modal state before:', showLogoutConfirm);

    setShowLogoutConfirm(false);

    console.log('Modal state after:', showLogoutConfirm);

    if (!confirmed) {
      console.log('User cancelled logout confirmation');
      return;
    }

    console.log('User confirmed logout, proceeding...');
    try {
      if (isFirebaseConfigured) {
        console.log('Using Firebase logout...');
        await logout();
        console.log('✅ Firebase logout completed successfully');
        console.log('✅ Sync queue should be cleared automatically');
      } else {
        console.log('Firebase not configured, using force logout');
        forceLogout();
        console.log('✅ Force logout completed successfully');
        console.log('✅ Sync queue should be cleared automatically');
      }
    } catch (error) {
      console.error('❌ Logout error:', error);
      // If Firebase logout fails, try force logout as fallback
      console.log('Firebase logout failed, trying force logout as fallback');
      try {
        forceLogout();
        console.log('✅ Force logout fallback completed successfully');
        console.log('✅ Sync queue should be cleared automatically');
      } catch (fallbackError) {
        console.error('❌ Force logout also failed:', fallbackError);
        alert(`Logout failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  };

  if (user) {
    return (
      <>
        <button
          onClick={() => {
            console.log('=== BUTTON CLICK DETECTED ===');
            handleLogout();
          }}
          className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-full w-10 h-10 flex items-center justify-center shadow-md hover:bg-red-300 dark:hover:bg-red-600 transition"
          title="Logout"
        >
          <i className="fas fa-sign-out-alt text-gray-800 dark:text-gray-200"></i>
        </button>

        {/* Custom Logout Confirmation Modal */}
        {showLogoutConfirm && (
          <div className="absolute top-12 right-0 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-3 z-50 min-w-48">
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-3 text-center">
              Sign out?
            </p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => handleLogoutConfirm(false)}
                className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleLogoutConfirm(true)}
                className="px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition"
              >
                Sign Out
              </button>
            </div>
          </div>
        )}

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