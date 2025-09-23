import type { FC } from 'react';
import { useThemeContext } from '../../contexts';
import { AuthButton } from '../Auth/AuthButton';

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

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center mb-8">
      <div className="hidden md:block"></div>
      <header className="text-center md:col-span-2">
        <h1 className="responsive-title text-3xl md:text-4xl font-bold text-gray-800 dark:text-gray-100 mb-2">
          Māori Fishing Calendar
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Find the best fishing days based on the Māori lunar calendar
        </p>
      </header>
      <div className="flex space-x-2 justify-center md:justify-end">
        <button 
          onClick={onSearchClick}
          className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-full w-10 h-10 flex items-center justify-center shadow-md hover:bg-gray-300 dark:hover:bg-gray-600 transition"
          title="Search Logs"
        >
          <i className="fas fa-search"></i>
        </button>
        <button 
          onClick={onAnalyticsClick}
          className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-full w-10 h-10 flex items-center justify-center shadow-md hover:bg-gray-300 dark:hover:bg-gray-600 transition"
          title="Analytics"
        >
          <i className="fas fa-chart-line"></i>
        </button>
        <button 
          onClick={onSettingsClick}
          className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-full w-10 h-10 flex items-center justify-center shadow-md hover:bg-gray-300 dark:hover:bg-gray-600 transition"
          title="Settings"
        >
          <i className="fas fa-cog"></i>
        </button>
        <button 
          onClick={onTackleBoxClick}
          className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-full w-10 h-10 flex items-center justify-center shadow-md hover:bg-gray-300 dark:hover:bg-gray-600 transition"
          title="Tackle Box"
        >
          <i className="fas fa-box"></i>
        </button>
        <button
          onClick={onGalleryClick}
          className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-full w-10 h-10 flex items-center justify-center shadow-md hover:bg-gray-300 dark:hover:bg-gray-600 transition"
          title="Gallery"
        >
          <i className="fas fa-images"></i>
        </button>

        <button
          onClick={() => console.log('Test button clicked - UI is responsive!')}
          className="bg-green-200 dark:bg-green-700 text-green-800 dark:text-green-200 rounded-full w-10 h-10 flex items-center justify-center shadow-md hover:bg-green-300 dark:hover:bg-green-600 transition"
          title="Test Button"
        >
          <i className="fas fa-check"></i>
        </button>
        <button
          onClick={toggleTheme}
          className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-full w-10 h-10 flex items-center justify-center shadow-md hover:bg-gray-300 dark:hover:bg-gray-600 transition"
          title="Toggle Theme"
        >
          <i className={`fas ${isDark ? 'fa-sun' : 'fa-moon'}`}></i>
        </button>
        <AuthButton />
      </div>
    </div>
  );
};

export default Header;