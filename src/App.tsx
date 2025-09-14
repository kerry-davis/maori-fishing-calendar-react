import { useState, useCallback } from "react";
import {
  AppProviders,
  useThemeContext,
  useLocationContext,
  useDatabaseContext,
} from "./contexts";
import ErrorBoundary from "./components/ErrorBoundary";
import { Header, Footer } from "./components/Layout";
import { Calendar } from "./components/Calendar";
import { CurrentMoonInfo } from "./components/MoonInfo";
import { Legend } from "./components/Legend";
import {
  TackleBoxModal,
  AnalyticsModal,
  SettingsModal,
  SearchModal,
  GalleryModal,
  LunarModal,
} from "./components/Modals";
import {
  PWAInstallPrompt,
  PWAUpdateNotification,
  OfflineIndicator,
} from "./components/PWA";

// Modal state type for routing different modal views
type ModalState =
  | "none"
  | "lunar"
  | "tripLog"
  | "tripDetails"
  | "tackleBox"
  | "analytics"
  | "settings"
  | "search"
  | "gallery";

function AppContent() {
  const { isDark } = useThemeContext();
  const { userLocation } = useLocationContext();
  const { isReady, error } = useDatabaseContext();

  // Modal state management for routing between different views
  const [currentModal, setCurrentModal] = useState<ModalState>("none");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Modal handlers
  const handleSearchClick = useCallback(() => {
    setCurrentModal("search");
  }, []);

  const handleAnalyticsClick = useCallback(() => {
    setCurrentModal("analytics");
  }, []);

  const handleSettingsClick = useCallback(() => {
    setCurrentModal("settings");
  }, []);

  const handleTackleBoxClick = useCallback(() => {
    setCurrentModal("tackleBox");
  }, []);

  const handleGalleryClick = useCallback(() => {
    setCurrentModal("gallery");
  }, []);

  // Calendar handlers
  const handleDateSelect = useCallback((date: Date) => {
    setSelectedDate(date);
    setCurrentModal("lunar");
  }, []);

  // These handlers will be implemented when modal components are fixed
  // const handleTripLogOpen = useCallback((date?: Date) => {
  //   if (date) {
  //     setSelectedDate(date);
  //   }
  //   setCurrentModal('tripLog');
  // }, []);

  // const handleTripDetailsOpen = useCallback((date?: Date) => {
  //   if (date) {
  //     setSelectedDate(date);
  //   }
  //   setCurrentModal('tripDetails');
  // }, []);

  const handleCloseModal = useCallback(() => {
    setCurrentModal("none");
    setSelectedDate(null);
  }, []);

  // Show loading state while database is initializing
  if (!isReady && !error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">
            Initializing application...
          </p>
        </div>
      </div>
    );
  }

  // Show error state if database failed to initialize
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 max-w-md w-full">
          <div className="text-center">
            <div className="text-red-500 text-4xl mb-4">
              <i className="fas fa-database"></i>
            </div>
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-2">
              Database Error
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Failed to initialize the database: {error}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200`}
    >
      <div className="responsive-container container mx-auto px-4 py-8 max-w-6xl">
        <Header
          onSearchClick={handleSearchClick}
          onAnalyticsClick={handleAnalyticsClick}
          onSettingsClick={handleSettingsClick}
          onTackleBoxClick={handleTackleBoxClick}
          onGalleryClick={handleGalleryClick}
        />

        <main>
          {/* Calendar Component */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
            <Calendar onDateSelect={handleDateSelect} />
          </div>

          {/* Legend Component */}
          <Legend />

          {/* Current Moon Info */}
          <CurrentMoonInfo />

          {/* Modal state indicator for development */}
          {currentModal !== "none" && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 mb-6">
              <p className="text-yellow-700 dark:text-yellow-300">
                <i className="fas fa-eye mr-2"></i>
                Modal State: {currentModal}
                {selectedDate && ` (Date: ${selectedDate.toDateString()})`}
              </p>
              <button
                onClick={handleCloseModal}
                className="mt-2 px-3 py-1 bg-yellow-500 text-white rounded text-sm hover:bg-yellow-600 transition"
              >
                Close Modal
              </button>
            </div>
          )}
        </main>

        <Footer />

        {/* Modal components - Basic integration for UAT */}
        <TackleBoxModal
          isOpen={currentModal === "tackleBox"}
          onClose={handleCloseModal}
        />

        <AnalyticsModal
          isOpen={currentModal === "analytics"}
          onClose={handleCloseModal}
        />

        <SettingsModal
          isOpen={currentModal === "settings"}
          onClose={handleCloseModal}
        />

        <SearchModal
          isOpen={currentModal === "search"}
          onClose={handleCloseModal}
        />

        <GalleryModal
          isOpen={currentModal === "gallery"}
          onClose={handleCloseModal}
        />

        <LunarModal
          isOpen={currentModal === "lunar"}
          onClose={handleCloseModal}
          selectedDate={selectedDate}
        />

        {/* PWA Components */}
        <OfflineIndicator />
        <PWAInstallPrompt />
        <PWAUpdateNotification />
      </div>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AppProviders>
        <AppContent />
      </AppProviders>
    </ErrorBoundary>
  );
}

export default App;
