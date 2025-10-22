import React, { useMemo, useState } from 'react';
import { useAuth } from '@app/providers/AuthContext';
import { LoginModal } from './LoginModal';
import ContextualConfirmation from '@shared/components/ContextualConfirmation';
import { useLogoutGuard } from '@shared/hooks/useLogoutGuard';

interface AuthButtonProps {
  mobile?: boolean;
  onMobileMenuClose?: () => void;
}

export const AuthButton: React.FC<AuthButtonProps> = ({ mobile = false, onMobileMenuClose }) => {
  const { user, forceLogout, isFirebaseConfigured } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const basePosition = mobile ? 'center' : 'top-right';
  const [confirmationPosition, setConfirmationPosition] = useState<'center' | 'top-right'>(basePosition);

  const logoutGuard = useLogoutGuard({
    onAfterLogout: () => {
      if (onMobileMenuClose) {
        onMobileMenuClose();
      }
    },
    onCancel: () => {
      if (mobile && onMobileMenuClose) {
        onMobileMenuClose();
      }
    }
  });

  const { detailLines, canRetry, retryWait, isDialogOpen, statusMessage, confirmText, confirmDisabled, handleConfirm, handleCancel, openDialog } = logoutGuard;

  const extraContent = useMemo(() => {
    const content: React.ReactNode[] = [];

    if (detailLines.length > 0) {
      content.push(
        <ul key="details" className="list-disc list-inside space-y-1">
          {detailLines.map((detail, index) => (
            <li key={index}>{detail}</li>
          ))}
        </ul>
      );
    }

    if (canRetry) {
      content.push(
        <button
          key="retry"
          type="button"
          onClick={retryWait}
          className="text-xs font-medium text-blue-600 dark:text-blue-300 hover:underline"
        >
          Retry waiting for sync
        </button>
      );
    }

    return content.length > 0 ? <div className="space-y-2">{content}</div> : null;
  }, [canRetry, detailLines, retryWait]);

  if (user) {
    return (
      <div className="relative">
        <button
          onClick={() => {
            setConfirmationPosition(basePosition);
            openDialog();
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

        <ContextualConfirmation
          isOpen={isDialogOpen}
          title="Sign Out"
          message={statusMessage}
          confirmText={confirmText}
          cancelText="Stay Signed In"
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          variant="warning"
          position={confirmationPosition}
          confirmDisabled={confirmDisabled}
          extraContent={extraContent}
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