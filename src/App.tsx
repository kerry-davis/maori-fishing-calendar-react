import { useState, useCallback, useEffect } from "react";
import {
  AppProviders,
  useDatabaseContext,
  useAuth,
} from "./contexts";
import "./utils/cleanupDuplicates"; // Load cleanup utilities
import ErrorBoundary from "./components/ErrorBoundary";
import { Header, Footer } from "./components/Layout";
import { Card, Container } from "./components/UI";
import { Calendar } from "./components/Calendar";
import { CurrentMoonInfo } from "./components/MoonInfo";
import { Legend } from "./components/Legend";
import {
  TackleBoxModal,
  AnalyticsModal,
  SettingsModal,
  SearchModal,
  GalleryModal,
  DataMigrationModal,
  LunarModal,
  TripLogModal,
  TripFormModal,
  TripDetailsModal,
  WeatherLogModal,
  FishCatchModal,
} from "./components/Modals";
import {
  PWAInstallPrompt,
  PWAUpdateNotification,
  OfflineIndicator,
} from "./components/PWA";
import { SuccessToast } from "./components/Auth";

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
  | "dataMigration"
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
        const w: any = typeof window !== 'undefined' ? window : {};
        // End the console timer if it was started, only once
        if (w.__reloadTimerActive) {
          try { console.timeEnd('[reload] total'); } catch {}
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
  const { user } = useAuth();

  // Timing: mark first render of AppContent
  useEffect(() => {
    try {
      if (typeof performance !== 'undefined') {
        performance.mark('app-first-render');
      }
    } catch {}
  }, []);

  // Modal state management for routing between different views
  const [currentModal, setCurrentModal] = useState<ModalState>("none");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [editingTripId, setEditingTripId] = useState<number | null>(null);
  const [editingWeatherId, setEditingWeatherId] = useState<number | null>(null);
  const [tripLogRefreshTrigger, setTripLogRefreshTrigger] = useState(0);
  const [calendarRefreshTrigger, setCalendarRefreshTrigger] = useState(0);

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

  const handleLegacyMigration = useCallback(() => {
    console.log('App.tsx: handleLegacyMigration called - opening dataMigration modal');
    setCurrentModal("dataMigration");
    // Set a flag to indicate this is for zip import
    sessionStorage.setItem('dataMigrationForZipImport', 'true');
    console.log('App.tsx: DataMigrationModal should now be open');
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


  const handleTripCreated = useCallback((trip: any) => {
    console.log('App.tsx: handleTripCreated called with trip:', trip);
    console.log('App.tsx: Current modal before:', currentModal);
    // Close the trip form modal and refresh both trip log and calendar
    setCurrentModal("tripLog");
    setTripLogRefreshTrigger(prev => prev + 1); // Trigger trip log refresh
    setCalendarRefreshTrigger(prev => prev + 1); // Trigger calendar refresh
    console.log('App.tsx: Set currentModal to tripLog and triggered calendar refresh');
  }, [currentModal]);

  const handleTripDeleted = useCallback(() => {
    console.log('App.tsx: handleTripDeleted called');
    // Trigger calendar refresh when a trip is deleted
    setCalendarRefreshTrigger(prev => prev + 1);
    console.log('App.tsx: Triggered calendar refresh after trip deletion');
  }, []);

  const handleWeatherLogged = useCallback((_weatherLog: any) => {
    // Close the weather modal and refresh the trip log to show updated weather
    setCurrentModal("tripLog");
    setTripLogRefreshTrigger(prev => prev + 1); // Trigger refresh
  }, []);

  const handleFishCaught = useCallback((_fish: any) => {
    // Close the fish catch modal and refresh the trip log to show new catch
    setCurrentModal("tripLog");
    setTripLogRefreshTrigger(prev => prev + 1); // Trigger refresh
  }, []);

  const handleMigrationComplete = useCallback(() => {
    console.log('App.tsx: Migration completed - refreshing calendar');
    // Trigger calendar refresh to show any imported trip indicators
    setCalendarRefreshTrigger(prev => prev + 1);
    console.log('App.tsx: Calendar refresh triggered after migration');
  }, []);

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
    console.log('App.tsx: handleCloseModal called, current modal:', currentModal);
    setCurrentModal("none");
    setSelectedDate(null);
    setEditingTripId(null);
    setEditingWeatherId(null);
    console.log('App.tsx: Modal closed, set to none');
  }, [currentModal]);

  // Check for data migration when user logs in
  useEffect(() => {
    const checkDataMigration = async () => {
      if (user && isReady) {
        try {
          // Use the Firebase data service for migration checks
          const firebaseDb = (await import('./services/firebaseDataService')).firebaseDataService;

          // Check if guest has imported data that needs migration
          const guestHasImportedData = localStorage.getItem('guestHasImportedData') === 'true';

          if (guestHasImportedData) {
            console.log('Guest has imported data - attempting automatic migration to Firebase...');
            try {
              // Attempt to migrate local data to Firebase
              await firebaseDb.mergeLocalDataForUser();
              console.log('Guest data successfully migrated to Firebase');

              // Clear the guest flag
              localStorage.removeItem('guestHasImportedData');

              // Mark migration as complete
              localStorage.setItem(`migrationComplete_${user.uid}`, 'true');

              console.log('Migration completed automatically for newly logged in user');
            } catch (migrationError) {
              console.error('Automatic migration failed:', migrationError);
              // Still show the migration modal if automatic migration fails
            }
          }

          const [hasLocalData, hasCompletedMigration] = await Promise.all([
            firebaseDb.hasLocalData(),
            firebaseDb.hasCompletedMigration()
          ]);

          if (hasLocalData && !hasCompletedMigration) {
            // Show migration modal
            setCurrentModal("dataMigration");
          }
        } catch (error) {
          console.error('Error checking data migration:', error);
        }
      }
    };

    checkDataMigration();
  }, [user, isReady]);

  // Show loading state while database is initializing
  if (!isReady && !error) {
    // Timing: report time-to-first-frame/loading
    try {
      if (typeof performance !== 'undefined') {
        performance.mark('app-loading-ui');
        const firstFrame = performance.measure('app-first-frame', 'app-reload-start', 'app-loading-ui');
        // Only log once per reload (guard StrictMode double render)
        const w: any = typeof window !== 'undefined' ? window : {};
        if (!w.__reloadFirstFrameLogged) {
          w.__reloadFirstFrameLogged = true;
          console.info('[reload] first-frame:', Math.round(firstFrame.duration), 'ms');
        }
      }
    } catch {}
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

  return (
    <div className={`min-h-screen transition-colors duration-200`} style={{ backgroundColor: 'var(--primary-background)', color: 'var(--primary-text)' }}>
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
          <CurrentMoonInfo />

        </main>
      </Container>

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
           onLegacyMigration={handleLegacyMigration}
         />

        <SearchModal
          isOpen={currentModal === "search"}
          onClose={handleCloseModal}
        />

        <GalleryModal
          isOpen={currentModal === "gallery"}
          onClose={handleCloseModal}
        />

        <DataMigrationModal
           isOpen={currentModal === "dataMigration"}
           onClose={handleCloseModal}
           onMigrationComplete={handleMigrationComplete}
         />

        <LunarModal
          isOpen={currentModal === "lunar"}
          onClose={handleCloseModal}
          selectedDate={selectedDate}
          onTripLogOpen={handleTripLogOpen}
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
