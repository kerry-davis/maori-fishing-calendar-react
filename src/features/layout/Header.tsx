import type { FC, KeyboardEvent, ReactNode } from 'react';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useThemeContext, useAuth } from '@app/providers';
import { LoginModal } from '@features/auth';
import { Container } from '@shared/components';
import ContextualConfirmation from '@shared/components/ContextualConfirmation';
import { useLogoutGuard } from '@shared/hooks/useLogoutGuard';

interface HeaderProps {
  onSearchClick: () => void;
  onAnalyticsClick: () => void;
  onSettingsClick: () => void;
  onTackleBoxClick: () => void;
  onGalleryClick: () => void;
}

const Header: FC<HeaderProps> = ({
  onSearchClick,
  onAnalyticsClick,
  onSettingsClick,
  onTackleBoxClick,
  onGalleryClick
}) => {
  const { isDark, toggleTheme } = useThemeContext();
  const { user, isFirebaseConfigured } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAuthDropdownOpen, setIsAuthDropdownOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);
  const authDropdownRef = useRef<HTMLDivElement>(null);
  const authTriggerRef = useRef<HTMLButtonElement>(null);
  const dropdownContentRef = useRef<HTMLDivElement>(null);
  const previousUserRef = useRef(user);

  const closeAuthDropdown = useCallback(
    ({ returnFocus = true }: { returnFocus?: boolean } = {}) => {
      setIsAuthDropdownOpen(prev => {
        if (!prev) {
          return prev;
        }

        if (returnFocus) {
          if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
            window.requestAnimationFrame(() => {
              const trigger = authTriggerRef.current;
              if (trigger?.isConnected) {
                trigger.focus();
              }
            });
          } else {
            const trigger = authTriggerRef.current;
            if (trigger?.isConnected) {
              trigger.focus();
            }
          }
        }

        return false;
      });
    },
    []
  );

  const handleThemeToggle = () => {
    toggleTheme();
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(prev => !prev);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const logoutGuard = useLogoutGuard({
    onAfterLogout: () => {
      closeAuthDropdown({ returnFocus: false });
      closeMobileMenu();
    }
  });

  const determineConfirmationPosition = useCallback((): 'center' | 'top-right' => (
    isAuthDropdownOpen ? 'top-right' : 'center'
  ), [isAuthDropdownOpen]);

  const [confirmationPosition, setConfirmationPosition] = useState<'center' | 'top-right'>(determineConfirmationPosition());

  const {
    detailLines,
    canRetry,
    retryWait,
    isDialogOpen,
    statusMessage,
    confirmText,
    confirmDisabled,
    handleConfirm,
    handleCancel,
    openDialog
  } = logoutGuard;

  const confirmationExtraContent = useMemo(() => {
    const content: ReactNode[] = [];

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

  const toggleAuthDropdown = () => {
    if (isAuthDropdownOpen) {
      closeAuthDropdown();
    } else {
      setIsAuthDropdownOpen(true);
    }
  };

  const getDropdownItems = () => {
    if (!dropdownContentRef.current) {
      return [] as HTMLElement[];
    }
    return Array.from(
      dropdownContentRef.current.querySelectorAll<HTMLElement>('[data-auth-dropdown-item="true"]')
    );
  };

  const focusMenuItemAtIndex = (index: number) => {
    const items = getDropdownItems();
    if (!items.length) {
      return;
    }
    const normalizedIndex = (index + items.length) % items.length;
    items[normalizedIndex]?.focus();
  };

  const handleDropdownKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case 'Escape':
        closeAuthDropdown();
        break;
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault();
        const items = getDropdownItems();
        if (!items.length) {
          return;
        }
        const activeElement = document.activeElement as HTMLElement | null;
        const currentIndex = activeElement ? items.indexOf(activeElement) : -1;
        const delta = event.key === 'ArrowDown' ? 1 : -1;
        const nextIndex = currentIndex === -1 ? (delta === 1 ? 0 : items.length - 1) : currentIndex + delta;
        focusMenuItemAtIndex(nextIndex);
        break;
      }
      case 'Home':
        event.preventDefault();
        focusMenuItemAtIndex(0);
        break;
      case 'End':
        event.preventDefault();
        focusMenuItemAtIndex(getDropdownItems().length - 1);
        break;
      default:
        break;
    }
  };

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleAuthDropdown();
    }
  };

  const handleSignInClick = () => {
    closeAuthDropdown({ returnFocus: false });
    closeMobileMenu();
    setShowLoginModal(true);
  };

  const getFullUserIdentity = () => {
    if (!user) return 'Guest';
    return user.displayName || user.email || 'User';
  };

  // Close dropdown/menu/modal when user becomes authenticated (not when already authenticated)
  useEffect(() => {
    const previousUser = previousUserRef.current;
    const userJustLoggedIn = !previousUser && user;
    
    if (userJustLoggedIn) {
      if (isAuthDropdownOpen) {
        closeAuthDropdown();
      }
      if (isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
      }
      if (showLoginModal) {
        setShowLoginModal(false);
      }
    }
    
    // Update ref for next render
    previousUserRef.current = user;
  }, [user, isAuthDropdownOpen, isMobileMenuOpen, showLoginModal, closeAuthDropdown]);

  // Focus management for dropdown
  useEffect(() => {
    if (isAuthDropdownOpen && dropdownContentRef.current) {
      const firstItem = dropdownContentRef.current.querySelector<HTMLElement>('[data-auth-dropdown-item="true"]');
      firstItem?.focus();
    }
  }, [isAuthDropdownOpen]);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) {
        if (isMobileMenuOpen) {
          setIsMobileMenuOpen(false);
        }
      }
      if (authDropdownRef.current && !authDropdownRef.current.contains(event.target as Node)) {
        if (isAuthDropdownOpen) {
          closeAuthDropdown();
        }
      }
    };

    if (isMobileMenuOpen || isAuthDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMobileMenuOpen, isAuthDropdownOpen, closeAuthDropdown]);

  return (
    <div ref={headerRef} className="sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-white/70 bg-white/90 dark:bg-gray-900/70 ring-1 ring-gray-200/60 dark:ring-white/10 rounded-b-2xl shadow-sm mb-0" style={{ backgroundColor: 'var(--card-background)' }}>
      <Container className="py-4 sm:py-8 px-2 sm:px-8">
        <div className="flex items-center justify-between gap-1 sm:gap-2">
          <div className="text-left min-w-0 flex-1 pr-1 sm:pr-2">
            <div className="flex items-center gap-2">
              <h1 className="responsive-title text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight" style={{ color: 'var(--primary-text)' }}>
                <span className="sm:hidden">Māori Fishing Calendar</span>
                <span className="hidden sm:inline">Māori Fishing Calendar</span>
              </h1>
              <img src="/icons/icon-192x192.png" alt="Māori Fishing Calendar" className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg flex-shrink-0" />
            </div>
            <p className="block text-xs md:text-sm truncate mt-1" style={{ color: 'var(--secondary-text)' }}>
              Find the best fishing days based on the Māori lunar calendar
            </p>
          </div>

          {/* Desktop buttons */}
          <div className="hidden sm:flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
            <button onClick={onSearchClick} className="icon-btn p-1 sm:p-1.5" title="Search Logs">
              <i className="fas fa-search text-xs sm:text-sm" />
            </button>
            <button onClick={onAnalyticsClick} className="icon-btn p-1 sm:p-1.5" title="Analytics">
              <i className="fas fa-chart-line text-xs sm:text-sm" />
            </button>
            <button onClick={onSettingsClick} className="icon-btn p-1 sm:p-1.5" title="Settings">
              <i className="fas fa-cog text-xs sm:text-sm" />
            </button>
            <button onClick={onTackleBoxClick} className="icon-btn p-1 sm:p-1.5" title="Tackle Box">
              <i className="fas fa-box text-xs sm:text-sm" />
            </button>
            {user && (
              <button onClick={onGalleryClick} className="icon-btn p-1 sm:p-1.5" title="Gallery">
                <i className="fas fa-images text-xs sm:text-sm" />
              </button>
            )}
            <button
              type="button"
              onClick={handleThemeToggle}
              className="icon-btn p-1 sm:p-1.5"
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--accent-color)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--primary-text)';
              }}
              aria-pressed={isDark}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              <i className={`fas ${isDark ? 'fa-sun' : 'fa-moon'} text-xs sm:text-sm`} />
            </button>
            <div className="relative" ref={authDropdownRef}>
              <button
                ref={authTriggerRef}
                id="auth-dropdown-trigger"
                onClick={toggleAuthDropdown}
                onKeyDown={handleTriggerKeyDown}
                className="icon-btn p-1 sm:p-1.5"
                title={user ? 'Account menu' : 'Sign in'}
                aria-haspopup="menu"
                aria-expanded={isAuthDropdownOpen}
                aria-controls="auth-dropdown-menu"
              >
                <i className="fas fa-user text-xs sm:text-sm" />
              </button>
              
              {/* Desktop Auth Dropdown */}
              {isAuthDropdownOpen && (
                <div
                  ref={dropdownContentRef}
                  id="auth-dropdown-menu"
                  role="menu"
                  aria-label="Account options"
                  aria-labelledby="auth-dropdown-trigger"
                  onKeyDown={handleDropdownKeyDown}
                  className="absolute right-0 mt-2 w-64 rounded-lg shadow-lg z-50"
                  style={{ backgroundColor: 'var(--card-background)', border: '1px solid var(--border-color)' }}
                >
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-3 pb-3" style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <i className="fas fa-user-circle text-2xl" style={{ color: 'var(--accent-color)' }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate" style={{ color: 'var(--primary-text)' }} title={getFullUserIdentity()}>
                          {getFullUserIdentity()}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--secondary-text)' }}>
                          {user ? 'Signed in' : 'Not signed in'}
                        </div>
                      </div>
                    </div>
                    
                    {user ? (
                      <button
                        onClick={() => {
                          setConfirmationPosition(determineConfirmationPosition());
                          openDialog();
                        }}
                        role="menuitem"
                        data-auth-dropdown-item="true"
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md transition-colors"
                        style={{ backgroundColor: 'var(--button-primary)', color: 'white' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--button-primary-hover)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--button-primary)';
                        }}
                      >
                        <i className="fas fa-sign-out-alt" />
                        <span className="text-sm font-medium">Sign Out</span>
                      </button>
                    ) : (
                      <div>
                        {isFirebaseConfigured ? (
                          <button
                            onClick={handleSignInClick}
                            role="menuitem"
                            data-auth-dropdown-item="true"
                            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md transition-colors"
                            style={{ backgroundColor: 'var(--button-primary)', color: 'white' }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'var(--button-primary-hover)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'var(--button-primary)';
                            }}
                          >
                            <i className="fas fa-sign-in-alt" />
                            <span className="text-sm font-medium">Sign In</span>
                          </button>
                        ) : (
                          <div className="text-xs text-center py-2 px-3 rounded" style={{ backgroundColor: 'var(--secondary-background)', color: 'var(--secondary-text)' }}>
                            <i className="fas fa-info-circle mb-1" />
                            <p>Authentication is not configured.</p>
                            <p className="mt-1 text-[10px]">Please configure Firebase credentials to enable sign-in.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Mobile hamburger menu */}
          <div className="flex sm:hidden items-center flex-shrink-0">
            <button
              onClick={toggleMobileMenu}
              className="icon-btn p-2"
              title="Menu"
              aria-label="Toggle mobile menu"
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-menu"
            >
              <div className="flex flex-col items-center justify-center w-5 h-4 space-y-1">
                <div className={`w-5 h-0.5 bg-current transition-all duration-300 ${isMobileMenuOpen ? 'rotate-45 translate-y-1.5' : ''}`}></div>
                <div className={`w-5 h-0.5 bg-current transition-all duration-300 ${isMobileMenuOpen ? 'opacity-0 scale-0' : ''}`}></div>
                <div className={`w-5 h-0.5 bg-current transition-all duration-300 ${isMobileMenuOpen ? '-rotate-45 -translate-y-1.5' : ''}`}></div>
              </div>
            </button>
          </div>
        </div>

        {/* Mobile collapsible menu */}
        <div
          id="mobile-menu"
          role="navigation"
          aria-label="Mobile navigation menu"
          className={`sm:hidden overflow-hidden transition-all duration-300 ease-in-out ${isMobileMenuOpen ? 'max-h-96 opacity-100 mt-3' : 'max-h-0 opacity-0'}`}
        >
          <div className="space-y-3">
            {/* Navigation Icons */}
            <div className="flex flex-wrap gap-0.5 pt-2 pb-2 px-0.5 mx-0 rounded-sm border shadow-sm justify-center" style={{ backgroundColor: 'var(--secondary-background)', borderColor: 'var(--border-color)' }}>
              <button onClick={() => { closeMobileMenu(); onSearchClick(); }} className="icon-btn flex flex-col items-center justify-center p-0 min-h-[24px] min-w-[60px]" title="Search Logs">
                <i className="fas fa-search text-base mb-0" />
                <span className="text-[8px] font-medium leading-none">Search</span>
              </button>
              <button onClick={() => { closeMobileMenu(); onAnalyticsClick(); }} className="icon-btn flex flex-col items-center justify-center p-0 min-h-[24px] min-w-[60px]" title="Analytics">
                <i className="fas fa-chart-line text-base mb-0" />
                <span className="text-[8px] font-medium leading-none">Stats</span>
              </button>
              <button onClick={() => { closeMobileMenu(); onSettingsClick(); }} className="icon-btn flex flex-col items-center justify-center p-0 min-h-[24px] min-w-[60px]" title="Settings">
                <i className="fas fa-cog text-base mb-0" />
                <span className="text-[8px] font-medium leading-none">Settings</span>
              </button>
              <button onClick={() => { closeMobileMenu(); onTackleBoxClick(); }} className="icon-btn flex flex-col items-center justify-center p-0 min-h-[24px] min-w-[60px]" title="Tackle Box">
                <i className="fas fa-box text-base mb-0" />
                <span className="text-[8px] font-medium leading-none">Gear</span>
              </button>
              {user && (
                <button onClick={() => { closeMobileMenu(); onGalleryClick(); }} className="icon-btn flex flex-col items-center justify-center p-0 min-h-[24px] min-w-[60px]" title="Gallery">
                  <i className="fas fa-images text-base mb-0" />
                  <span className="text-[8px] font-medium leading-none">Photos</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => { closeMobileMenu(); handleThemeToggle(); }}
                className="icon-btn flex flex-col items-center justify-center p-0 min-h-[24px] min-w-[60px]"
                title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                <i className={`fas ${isDark ? 'fa-sun' : 'fa-moon'} text-base mb-0`} />
                <span className="text-[8px] font-medium leading-none">Theme</span>
              </button>
            </div>

            {/* Authentication Section */}
            <div className="px-2">
              <div className="flex items-center gap-2 p-2 mb-2 rounded-md" style={{ backgroundColor: 'var(--secondary-background)', borderLeft: '3px solid var(--accent-color)' }}>
                <i className="fas fa-user-circle text-lg" style={{ color: 'var(--accent-color)' }} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate" style={{ color: 'var(--primary-text)' }} title={getFullUserIdentity()}>
                    {getFullUserIdentity()}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--secondary-text)' }}>
                    {user ? 'Signed in' : 'Not signed in'}
                  </div>
                </div>
              </div>
              
              {user ? (
                <button
                  onClick={() => {
                    setConfirmationPosition(determineConfirmationPosition());
                    openDialog();
                  }}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md transition-colors"
                  style={{ backgroundColor: 'var(--button-primary)', color: 'white' }}
                  onTouchStart={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--button-primary-hover)';
                  }}
                  onTouchEnd={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--button-primary)';
                  }}
                >
                  <i className="fas fa-sign-out-alt" />
                  <span className="text-sm font-medium">Sign Out</span>
                </button>
              ) : isFirebaseConfigured ? (
                <button
                  onClick={handleSignInClick}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md transition-colors"
                  style={{ backgroundColor: 'var(--button-primary)', color: 'white' }}
                  onTouchStart={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--button-primary-hover)';
                  }}
                  onTouchEnd={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--button-primary)';
                  }}
                >
                  <i className="fas fa-sign-in-alt" />
                  <span className="text-sm font-medium">Sign In</span>
                </button>
              ) : (
                <div className="text-xs text-center py-2 px-3 rounded" style={{ backgroundColor: 'var(--secondary-background)', color: 'var(--secondary-text)' }}>
                  <i className="fas fa-info-circle mb-1" />
                  <p>Authentication is not configured.</p>
                  <p className="mt-1 text-[10px]">Please configure Firebase credentials to enable sign-in.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </Container>

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
        extraContent={confirmationExtraContent}
      />
      
      {/* Login Modal - only render when Firebase is configured */}
      {isFirebaseConfigured && showLoginModal && (
        <LoginModal
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
          onMobileMenuClose={closeMobileMenu}
        />
      )}
    </div>
  );
};

export default Header;