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
          className="icon-btn"
          title="Logout"
        >
          <i className="fas fa-sign-out-alt"></i>
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
          className="icon-btn text-yellow-700 dark:text-yellow-300"
          title="Auth not configured - Click for details"
        >
          <i className="fas fa-exclamation-triangle"></i>
        </button>
        <button
          onClick={() => {
            console.log('Force logout button clicked');
            forceLogout();
          }}
          className="icon-btn text-red-700 dark:text-red-300"
          title="Force Logout (Debug)"
        >
          <i className="fas fa-sign-out-alt"></i>
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
        className="icon-btn"
        title="Sign In"
      >
        <i className="fas fa-user"></i>
      </button>

      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />
    </>
  );
};