import type { FC } from 'react';
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

  // Debug logging for theme toggle
  const handleThemeToggle = () => {
    console.log('Header: Theme toggle clicked, current isDark:', isDark);
    console.log('Header: Calling toggleTheme function');
    toggleTheme();
    console.log('Header: toggleTheme function called');
  };

  return (
    <div className="sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-white/70 bg-white/90 dark:bg-gray-900/70 ring-1 ring-gray-200/60 dark:ring-white/10 rounded-b-2xl shadow-sm mb-8" style={{ backgroundColor: 'var(--card-background)' }}>
      <Container className="py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="text-left">
            <h1 className="responsive-title text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight" style={{ color: 'var(--primary-text)' }}>
              Māori Fishing Calendar
            </h1>
            <p className="hidden sm:block text-sm" style={{ color: 'var(--secondary-text)' }}>
              Find the best fishing days based on the Māori lunar calendar
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onSearchClick} className="icon-btn" title="Search Logs">
              <i className="fas fa-search" />
            </button>
            <button onClick={onAnalyticsClick} className="icon-btn" title="Analytics">
              <i className="fas fa-chart-line" />
            </button>
            <button onClick={onSettingsClick} className="icon-btn" title="Settings">
              <i className="fas fa-cog" />
            </button>
            <button onClick={onTackleBoxClick} className="icon-btn" title="Tackle Box">
              <i className="fas fa-box" />
            </button>
            <button onClick={onGalleryClick} className="icon-btn" title="Gallery">
              <i className="fas fa-images" />
            </button>
            <button
              type="button"
              onClick={handleThemeToggle}
              className="icon-btn"
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--accent-color)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--primary-text)';
              }}
              aria-pressed={isDark}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              <i className={`fas ${isDark ? 'fa-sun' : 'fa-moon'}`} />
            </button>
            <AuthButton />
          </div>
        </div>
      </Container>
    </div>
  );
};

export default Header;