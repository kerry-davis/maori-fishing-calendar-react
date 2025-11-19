import { useState, useCallback, useEffect } from "react";
import {
  AppProviders,
  useDatabaseContext,
  useAuth,
} from "./providers";
import type { Trip, WeatherLog, FishCaught } from "@shared/types";
import "@shared/utils/cleanupDuplicates"; // Load cleanup utilities
import { ErrorBoundary } from "@shared/components";
import { Header, Footer } from "@features/layout";
import { Card, Container } from "@shared/components";
import { Calendar } from "@features/calendar";
import { CurrentMoonInfo } from "@features/moon";
import { Legend } from "@features/legend";
import {
  TackleBoxModal,
  AnalyticsModal,
  SettingsModal,
  SearchModal,
  GalleryModal,
  LunarModal,
  TripLogModal,
  TripFormModal,
  TripDetailsModal,
  WeatherLogModal,
  FishCatchModal,
} from "@features/modals";
import {
  PWAInstallPrompt,
  PWAUpdateNotification,
  OfflineIndicator,
  SyncToast,
} from "@features/pwa";
import { SuccessToast } from "@features/auth";
import { EncryptionMigrationStatus } from '@features/encryption';

// Modal state type for routing different modal views
type ModalState =
  | "none"
  | "lunar"
  | "tripLog"
  | "tripForm"
  | "tripDetails"
  | "tackleBox"
  | "analytics"
  | "settings"
  | "search"
  | "gallery"
  | "weatherLog"
  | "fishCatch";

// Tiny component to finalize timing once the DB/app is ready
function TimingOnReady() {
  useEffect(() => {
    try {
      if (typeof performance !== 'undefined') {
        performance.mark('app-ready');
        const total = performance.measure('app-reload-total', 'app-reload-start', 'app-ready');
        const totalMs = Math.round(total.duration);
        const w = typeof window !== 'undefined' ? (window as unknown as Record<string, boolean | undefined>) : {};
        // End the console timer if it was started, only once
        if (w.__reloadTimerActive) {
          try { console.timeEnd('[reload] total'); } catch { /* ignore errors */ }
          w.__reloadTimerActive = false;
        }
        if (!w.__reloadReadyLogged) {
          w.__reloadReadyLogged = true;
          console.info('[reload] ready:', totalMs, 'ms');
        }
      }
    } catch {}
  }, []);
  return null;
}

function AppContent() {
  const { isReady, error } = useDatabaseContext();
  const {
    isLocked,
    biometricsEnabled,
    biometricsAvailable,
    unlockWithBiometrics,
    logout,
  } = useAuth();


  // Timing: mark first render of AppContent
  useEffect(() => {
    try {
      if (typeof performance !== 'undefined') {
        performance.mark('app-first-render');
      }
    } catch { /* ignore errors */ }
  }, []);

  // Modal state management for routing between different views
  const [currentModal, setCurrentModal] = useState<ModalState>("none");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [editingTripId, setEditingTripId] = useState<number | null>(null);
  const [editingWeatherId, setEditingWeatherId] = useState<number | null>(null);
  const [tripLogRefreshTrigger, setTripLogRefreshTrigger] = useState(0);
  const [calendarRefreshTrigger, setCalendarRefreshTrigger] = useState(0);
  // Track explicit user intent to open Settings (prevents accidental openings)
  const [lastSettingsClickAt, setLastSettingsClickAt] = useState<number | null>(null);

  // Ensure modal state is clean on app initialization (especially for PWA)
  useEffect(() => {
    // Clear any modal-related URL parameters that might be preserved during PWA redirect
    if (window.location.hash && (window.location.hash.includes('settings') || window.location.hash.includes('modal'))) {
      window.history.replaceState(null, '', window.location.pathname);
    }

  // Force modal to none if it's in an unexpected state
  if (currentModal !== "none") {
      setCurrentModal("none");
    }
  }, []); // Only run on mount

  // Additional check for PWA redirect scenarios
  useEffect(() => {
    // Check if this is a PWA redirect scenario that might have preserved modal state
    const isPWA = window.matchMedia('(display-mode: standalone)').matches;
    const hasModalHash = window.location.hash && window.location.hash.includes('settings');

    if (isPWA && hasModalHash && currentModal === "settings") {
      setCurrentModal("none");
    }
  }, [currentModal]); // Run when modal state changes

  // ELEGANT: Prevent Settings modal during PWA authentication
  useEffect(() => {
    if (currentModal === "settings") {
      // Check if this might be during PWA authentication
      const lastAuthTime: number | undefined = (window as unknown as Record<string, number | undefined>).lastAuthTime;
      const timeSinceLastAuth = typeof lastAuthTime === 'number'
        ? Date.now() - lastAuthTime
        : Number.POSITIVE_INFINITY;
      const isRecentAuth = timeSinceLastAuth < 8000; // Within 8 seconds
      const userInitiated = typeof lastSettingsClickAt === 'number' && (Date.now() - lastSettingsClickAt) < 2000;

      if (isRecentAuth && !userInitiated) {
        // Don't force close - just log and return to none state smoothly
        setTimeout(() => {
          setCurrentModal("none");
        }, 100);
      }
    }
  }, [currentModal, lastSettingsClickAt]);

  // Modal handlers
  const handleSearchClick = useCallback(() => {
    setCurrentModal("search");
  }, []);

  const handleAnalyticsClick = useCallback(() => {
    setCurrentModal("analytics");
  }, []);

  const handleSettingsClick = useCallback(() => {
    setLastSettingsClickAt(Date.now());
    setCurrentModal("settings");
  }, []);

  // Legacy migration is handled via Settings workflows; migration modal removed.

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
  const handleTripLogOpen = useCallback((date: Date, hasTrips: boolean) => {
    setSelectedDate(date);
    if (hasTrips) {
      setCurrentModal("tripLog");
    } else {
      setCurrentModal("tripForm");
    }
  }, []);

  const handleNewTrip = useCallback(() => {
    setCurrentModal("tripForm");
  }, []);

  const handleEditTrip = useCallback((tripId: number) => {
    // Store the trip ID for editing and open the trip form modal
    setEditingTripId(tripId);
    setCurrentModal("tripDetails");
  }, []);


  const handleTripCreated = useCallback((_trip: Trip) => {
    // Close the trip form modal and refresh both trip log and calendar
    setCurrentModal("tripLog");
    setTripLogRefreshTrigger(prev => prev + 1); // Trigger trip log refresh
    setCalendarRefreshTrigger(prev => prev + 1); // Trigger calendar refresh
  }, [currentModal]);

  const handleTripDeleted = useCallback(() => {
    // Trigger calendar refresh when a trip is deleted
    setCalendarRefreshTrigger(prev => prev + 1);
  }, []);

  const handleWeatherLogged = useCallback((_weatherLog: WeatherLog) => {
    // Close the weather modal and refresh the trip log to show updated weather
    setCurrentModal("tripLog");
    setTripLogRefreshTrigger(prev => prev + 1); // Trigger refresh
  }, []);

  const handleFishCaught = useCallback((_fish: FishCaught) => {
    // Close the fish catch modal and refresh the trip log to show new catch
    setCurrentModal("tripLog");
    setTripLogRefreshTrigger(prev => prev + 1); // Trigger refresh
  }, []);

  // Migration complete handler removed along with migration modal.

  const handleTripUpdated = useCallback(() => {
    // Navigate back to the trip log modal after trip is updated
    setCurrentModal("tripLog");
    setTripLogRefreshTrigger(prev => prev + 1); // Trigger refresh
  }, []);

  const handleCancelEditTrip = useCallback(() => {
    // Navigate back to the trip log modal when canceling trip edit
    setCurrentModal("tripLog");
  }, []);

  // const handleTripDetailsOpen = useCallback((date?: Date) => {
  //   if (date) {
  //     setSelectedDate(date);
  //   }
  //   setCurrentModal('tripDetails');
  // }, []);

  const handleCloseModal = useCallback(() => {
    setCurrentModal("none");
    setSelectedDate(null);
    setEditingTripId(null);
    setEditingWeatherId(null);
  }, [currentModal]);

  // Data migration modal and check removed per requirements.

  // Show loading state while database is initializing
  if (!isReady && !error) {
    // Timing: report time-to-first-frame/loading
    try {
      if (typeof performance !== 'undefined') {
        performance.mark('app-loading-ui');
        const firstFrame = performance.measure('app-first-frame', 'app-reload-start', 'app-loading-ui');
        // Only log once per reload (guard StrictMode double render)
        const w = typeof window !== 'undefined' ? (window as unknown as Record<string, boolean | undefined>) : {};
        if (!w.__reloadFirstFrameLogged) {
          w.__reloadFirstFrameLogged = true;
          console.info('[reload] first-frame:', Math.round(firstFrame.duration), 'ms');
        }
      }
    } catch { /* ignore errors */ }
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--primary-background)', color: 'var(--primary-text)' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p style={{ color: 'var(--secondary-text)' }}>
            Initializing application...
          </p>
        </div>
      </div>
    );
  }

  // Show error state if database failed to initialize
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--primary-background)', color: 'var(--primary-text)' }}>
        <div className="rounded-lg shadow-md p-6 max-w-md w-full" style={{ backgroundColor: 'var(--card-background)', border: '1px solid var(--card-border)' }}>
          <div className="text-center">
            <div className="text-red-500 text-4xl mb-4">
              <i className="fas fa-database"></i>
            </div>
            <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--primary-text)' }}>
              Database Error
            </h2>
            <p className="mb-4" style={{ color: 'var(--secondary-text)' }}>
              Failed to initialize the database: {error}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded transition" style={{ backgroundColor: 'var(--button-primary)', color: 'white' }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--button-primary-hover)'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'var(--button-primary)'}
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const showLockScreen = isLocked && biometricsEnabled && biometricsAvailable;

  return (
    <div className={`min-h-screen transition-colors duration-200 relative`} style={{ backgroundColor: 'var(--primary-background)', color: 'var(--primary-text)' }}>
      
      <div className={showLockScreen ? "filter blur-md pointer-events-none select-none h-screen overflow-hidden" : ""}>
        {/* Timing: if DB just became ready, end total reload timer */}
        {isReady && (<TimingOnReady />)}
        <Header
            onSearchClick={handleSearchClick}
            onAnalyticsClick={handleAnalyticsClick}
            onSettingsClick={handleSettingsClick}
            onTackleBoxClick={handleTackleBoxClick}
            onGalleryClick={handleGalleryClick}
          />

        <Container className="py-6">
          <main className="space-y-6">
            {/* Calendar Component */}
            <Card>
              <Calendar onDateSelect={handleDateSelect} refreshTrigger={calendarRefreshTrigger} />
            </Card>

            {/* Legend Component */}
            <Legend />

            {/* Current Moon Info */}
            <CurrentMoonInfo onSettingsClick={handleSettingsClick} />

          </main>
        </Container>

        <Footer />

        {/* Background encryption migration status */}
        <EncryptionMigrationStatus />

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

        {/* DataMigrationModal removed */}

        <LunarModal
          isOpen={currentModal === "lunar"}
          onClose={handleCloseModal}
          selectedDate={selectedDate}
          onTripLogOpen={handleTripLogOpen}
          onSettingsClick={handleSettingsClick}
        />

        <TripLogModal
          isOpen={currentModal === "tripLog"}
          onClose={handleCloseModal}
          selectedDate={selectedDate!}
          onNewTrip={handleNewTrip}
          onEditTrip={handleEditTrip}
          refreshTrigger={tripLogRefreshTrigger}
          onTripDeleted={handleTripDeleted}
        />

        <TripFormModal
          isOpen={currentModal === "tripForm"}
          onClose={handleCloseModal}
          selectedDate={selectedDate!}
          onTripCreated={handleTripCreated}
        />

        <TripDetailsModal
          isOpen={currentModal === "tripDetails"}
          onClose={handleCloseModal}
          tripId={editingTripId || undefined}
          selectedDate={selectedDate!}
          onTripUpdated={handleTripUpdated}
          onCancelEdit={handleCancelEditTrip}
        />

        <WeatherLogModal
          isOpen={currentModal === "weatherLog"}
          onClose={handleCloseModal}
          tripId={editingTripId || 1} // Use the stored trip ID
          weatherId={editingWeatherId ? editingWeatherId.toString() : undefined}
          onWeatherLogged={handleWeatherLogged}
        />

        <FishCatchModal
          isOpen={currentModal === "fishCatch"}
          onClose={handleCloseModal}
          tripId={editingTripId || 1}
          onFishCaught={handleFishCaught}
        />

        {/* PWA Components */}
        <OfflineIndicator />
        <PWAInstallPrompt />
        <PWAUpdateNotification />

        {/* Authentication Success Toast */}
        <SuccessToast />

        {/* Sync completion toast */}
        <SyncToast />

        {/* Development Debug Components */}
        {/* Uncomment for migration verification debugging */}
        {/* <MigrationVerification /> */}
        {/* End Development Debug Components */}

        {/* End of overlay components */}
      </div>

      {/* Lock Screen Overlay */}
      {showLockScreen && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
          <div className="text-center max-w-sm w-full space-y-6">
            <div className="text-6xl mb-4 text-white drop-shadow-lg">
              <i className="fas fa-lock"></i>
            </div>
            
            <div className="text-white drop-shadow-md">
              <h2 className="text-2xl font-bold mb-2">Locked</h2>
              <p className="opacity-90">
                Authentication required to access your fishing data
              </p>
            </div>

            <button
              onClick={() => unlockWithBiometrics()}
              className="w-full py-3 px-4 rounded-lg font-medium shadow-xl transition-transform active:scale-95 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white border border-blue-500"
            >
              <i className="fas fa-fingerprint"></i>
              <span>Unlock with Biometrics</span>
            </button>
            
            <button
              onClick={logout}
              className="text-sm underline mt-4 text-white opacity-80 hover:opacity-100 transition-opacity drop-shadow-sm"
            >
              Log out
            </button>
          </div>
        </div>
      )}
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
