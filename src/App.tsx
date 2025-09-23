import { useState, useCallback, useEffect } from "react";
import {
  AppProviders,
  useDatabaseContext,
  useAuth,
} from "./contexts";
import { firebaseDataService } from "./services/firebaseDataService";
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

function AppContent() {
  const { isReady, error } = useDatabaseContext();
  const { user } = useAuth();

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
  const handleTripLogOpen = useCallback(async (date?: Date) => {
    if (date) {
      setSelectedDate(date);
    }

    // Check if trips exist for this date
    if (date && user) {
      try {
        const allTrips = await firebaseDataService.getAllTrips();
        const dateStr = date.toLocaleDateString("en-CA");
        const tripsForDate = allTrips.filter(trip => trip.date === dateStr);

        if (tripsForDate.length === 0) {
          // No trips exist, open trip form directly
          setCurrentModal("tripForm");
          return;
        }
      } catch (err) {
        console.error("Error checking trips:", err);
        // On error, default to showing trip log
      }
    }

    // Trips exist or error occurred, show trip log
    setCurrentModal("tripLog");
  }, [user]);

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
            <Calendar onDateSelect={handleDateSelect} refreshTrigger={calendarRefreshTrigger} />
          </div>

          {/* Legend Component */}
          <Legend />

          {/* Current Moon Info */}
          <CurrentMoonInfo />

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

        <DataMigrationModal
          isOpen={currentModal === "dataMigration"}
          onClose={handleCloseModal}
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
          weatherId={editingWeatherId || undefined}
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
