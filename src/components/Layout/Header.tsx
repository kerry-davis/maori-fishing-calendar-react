import type { FC } from 'react';
import { useState, useEffect, useRef } from 'react';
import { useThemeContext } from '../../contexts';
import { AuthButton } from '../Auth/AuthButton';
import { Container } from '../UI';

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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Debug initial state
  console.log('Header initialized, menu open:', isMobileMenuOpen);
  const headerRef = useRef<HTMLDivElement>(null);

  // Debug logging for theme toggle
  const handleThemeToggle = () => {
    console.log('Header: Theme toggle clicked, current isDark:', isDark);
    console.log('Header: Calling toggleTheme function');
    toggleTheme();
    console.log('Header: toggleTheme function called');
  };

  const toggleMobileMenu = () => {
    console.log('Toggle menu clicked, current state:', isMobileMenuOpen);
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    console.log('Closing menu');
    setIsMobileMenuOpen(false);
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) {
        closeMobileMenu();
      }
    };

    if (isMobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMobileMenuOpen]);

  return (
    <div ref={headerRef} className="sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-white/70 bg-white/90 dark:bg-gray-900/70 ring-1 ring-gray-200/60 dark:ring-white/10 rounded-b-2xl shadow-sm mb-0" style={{ backgroundColor: 'var(--card-background)' }}>
      <Container className="py-2 sm:py-4 px-1 sm:px-4">
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
            <button onClick={onGalleryClick} className="icon-btn p-1 sm:p-1.5" title="Gallery">
              <i className="fas fa-images text-xs sm:text-sm" />
            </button>
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
            <AuthButton />
          </div>

          {/* Mobile hamburger menu */}
          <div className="flex sm:hidden items-center flex-shrink-0">
            <button
              onClick={toggleMobileMenu}
              className="icon-btn p-2"
              title="Menu"
              aria-expanded={isMobileMenuOpen}
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
        <div className={`sm:hidden overflow-hidden transition-all duration-300 ease-in-out ${isMobileMenuOpen ? 'max-h-32 opacity-100 mt-0.5' : 'max-h-0 opacity-0'}`} style={{ display: isMobileMenuOpen ? 'block' : 'none' }}>
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
            <button onClick={() => { closeMobileMenu(); onGalleryClick(); }} className="icon-btn flex flex-col items-center justify-center p-0 min-h-[24px] min-w-[60px]" title="Gallery">
              <i className="fas fa-images text-base mb-0" />
              <span className="text-[8px] font-medium leading-none">Photos</span>
            </button>
            <button
              type="button"
              onClick={() => { closeMobileMenu(); handleThemeToggle(); }}
              className="icon-btn flex flex-col items-center justify-center p-0 min-h-[24px] min-w-[60px]"
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              <i className={`fas ${isDark ? 'fa-sun' : 'fa-moon'} text-base mb-0`} />
              <span className="text-[8px] font-medium leading-none">Theme</span>
            </button>
            <div className="min-w-[60px] flex justify-center">
              <AuthButton mobile={true} onMobileMenuClose={closeMobileMenu} />
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
};

export default Header;