import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { LoginModal } from './LoginModal';
import ContextualConfirmation from '../UI/ContextualConfirmation';

interface AuthButtonProps {
  mobile?: boolean;
  onMobileMenuClose?: () => void;
}

export const AuthButton: React.FC<AuthButtonProps> = ({ mobile = false, onMobileMenuClose }) => {
  const { user, logout, forceLogout, isFirebaseConfigured } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Debug confirmation dialog state changes
  useEffect(() => {
    console.log('Confirmation dialog state changed:', showLogoutConfirm);
    if (showLogoutConfirm) {
      console.log('=== CONFIRMATION DIALOG SHOULD BE VISIBLE ===');
      console.log('Dialog props:', {
        isOpen: showLogoutConfirm,
        title: 'Sign Out',
        message: 'Your data will be safely backed up before signing out.',
        position: mobile ? 'center' : 'top-right'
      });
    }
  }, [showLogoutConfirm, mobile]);

  const handleLogout = async () => {
    console.log('=== LOGOUT BUTTON CLICKED ===');
    console.log('Firebase configured:', isFirebaseConfigured);
    console.log('User object:', user);
    console.log('Current time:', new Date().toISOString());
    console.log('Mobile mode:', mobile);
    console.log('onMobileMenuClose function available:', !!onMobileMenuClose);

    // Show modern confirmation dialog
    console.log('Setting showLogoutConfirm to true');
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
        console.log('User after logout:', user);
        // Show success feedback
        alert('Successfully signed out!');
        // Close mobile menu after successful logout
        if (onMobileMenuClose) {
          console.log('Closing mobile menu after logout');
          onMobileMenuClose();
        }
      } else {
        console.log('Firebase not configured, using force logout');
        forceLogout();
        console.log('✅ Force logout completed successfully');
        console.log('User after force logout:', user);
        // Show success feedback
        alert('Successfully signed out!');
        // Close mobile menu after successful logout
        if (onMobileMenuClose) {
          console.log('Closing mobile menu after force logout');
          onMobileMenuClose();
        }
      }
    } catch (error) {
      console.error('❌ Logout error:', error);
      console.log('Error details:', error instanceof Error ? error.message : error);
      // If Firebase logout fails, try force logout as fallback
      console.log('Firebase logout failed, trying force logout as fallback');
      try {
        forceLogout();
        console.log('✅ Force logout fallback completed successfully');
        console.log('User after fallback force logout:', user);
        // Show success feedback
        alert('Successfully signed out!');
        // Close mobile menu after successful logout
        if (onMobileMenuClose) {
          console.log('Closing mobile menu after fallback logout');
          onMobileMenuClose();
        }
      } catch (fallbackError) {
        console.error('❌ Force logout also failed:', fallbackError);
        console.log('Fallback error details:', fallbackError instanceof Error ? fallbackError.message : fallbackError);
        alert(`Logout failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  };

  const handleLogoutCancel = () => {
    console.log('User cancelled logout confirmation');
    setShowLogoutConfirm(false);

    // Close mobile menu when user cancels logout
    if (onMobileMenuClose) {
      console.log('Closing mobile menu after logout cancellation');
      onMobileMenuClose();
    }
  };

  if (user) {
    return (
      <div className="relative">
        <button
          onClick={() => {
            console.log('=== BUTTON CLICK DETECTED ===');
            handleLogout();
          }}
          className={mobile
            ? "icon-btn flex flex-col items-center justify-center p-0 min-h-[24px] min-w-[60px]"
            : "icon-btn p-1 sm:p-1.5"
          }
          onMouseEnter={(e) => {
            if (!mobile) {
              e.currentTarget.style.color = 'var(--accent-color)';
            }
          }}
          onMouseLeave={(e) => {
            if (!mobile) {
              e.currentTarget.style.color = 'var(--primary-text)';
            }
          }}
          title="Logout"
        >
          <i className={mobile
            ? "fas fa-sign-out-alt text-base mb-0"
            : "fas fa-sign-out-alt text-xs sm:text-sm"
          }></i>
          <span className={mobile
            ? "text-[8px] font-medium leading-none"
            : "text-[8px] font-medium leading-none sm:hidden"
          }>Logout</span>
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
          position={mobile ? "center" : "top-right"}
        />

        <LoginModal
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
          onMobileMenuClose={onMobileMenuClose}
        />
      </div>
    );
  }

  if (!isFirebaseConfigured) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => alert('Firebase authentication is not configured. Please set up your Firebase environment variables.')}
          className="icon-btn p-1 sm:p-1.5 text-yellow-700 dark:text-yellow-300"
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--accent-color)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--primary-text)';
          }}
          title="Auth not configured - Click for details"
        >
          <i className="fas fa-exclamation-triangle text-xs sm:text-sm"></i>
          <span className="text-[8px] font-medium leading-none sm:hidden">Setup</span>
        </button>
        <button
          onClick={() => {
            console.log('Force logout button clicked');
            forceLogout();
          }}
          className="icon-btn p-1 sm:p-1.5 text-red-700 dark:text-red-300"
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--accent-color)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--primary-text)';
          }}
          title="Force Logout (Debug)"
        >
          <i className="fas fa-sign-out-alt text-xs sm:text-sm"></i>
          <span className="text-[8px] font-medium leading-none sm:hidden">Debug</span>
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
        className={mobile
          ? "icon-btn flex flex-col items-center justify-center p-0 min-h-[24px] min-w-[60px]"
          : "icon-btn p-1 sm:p-1.5"
        }
        onMouseEnter={(e) => {
          if (!mobile) {
            e.currentTarget.style.color = 'var(--accent-color)';
          }
        }}
        onMouseLeave={(e) => {
          if (!mobile) {
            e.currentTarget.style.color = 'var(--primary-text)';
          }
        }}
        title="Sign In"
      >
        <i className={mobile
          ? "fas fa-user text-base mb-0"
          : "fas fa-user text-xs sm:text-sm"
        }></i>
        <span className={mobile
          ? "text-[8px] font-medium leading-none"
          : "text-[8px] font-medium leading-none sm:hidden"
        }>Login</span>
      </button>

      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onMobileMenuClose={onMobileMenuClose}
      />
    </>
  );
};