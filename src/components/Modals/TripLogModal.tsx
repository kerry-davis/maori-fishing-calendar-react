import React, { useState, useEffect, useCallback } from "react";
import { Button } from "../UI";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "./Modal";
import { useDatabaseService } from "../../contexts/DatabaseContext";
import { WeatherLogModal } from "./WeatherLogModal";
import { FishCatchModal } from "./FishCatchModal";
import ContextualConfirmation from "../UI/ContextualConfirmation";
import type { Trip, WeatherLog, FishCaught, DateModalProps } from "../../types";

export interface TripLogModalProps extends DateModalProps {
  onEditTrip?: (tripId: number) => void;
  onNewTrip?: () => void;
  refreshTrigger?: number; // Add refresh trigger prop
  onTripDeleted?: () => void; // Add callback for when trips are deleted
}

/**
 * TripLogModal component displays all trips for a selected date
 * Features:
 * - Trip list display with trip cards
 * - New trip creation button
 * - Edit/delete functionality for existing trips
 * - Loading states and error handling
 */
export const TripLogModal: React.FC<TripLogModalProps> = ({
  isOpen,
  onClose,
  selectedDate,
  onEditTrip,
  onNewTrip,
  refreshTrigger,
  onTripDeleted,
}) => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [weatherLogs, setWeatherLogs] = useState<WeatherLog[]>([]);
  const [fishCatches, setFishCatches] = useState<FishCaught[]>([]);
  const [showWeatherModal, setShowWeatherModal] = useState(false);
  const [showFishModal, setShowFishModal] = useState(false);
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const [editingWeatherId, setEditingWeatherId] = useState<string | null>(null);
  const [editingFishId, setEditingFishId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'weather' | 'fish' | 'trip', id: string, tripId?: number, firebaseDocId?: string } | null>(null);
  const db = useDatabaseService();

  // Format date for display and database queries
  const formatDateForDisplay = (date: Date): string => {
    return date.toLocaleDateString("en-NZ", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatDateForDB = (date: Date): string => {
    // Use local date string to avoid timezone conversion issues
    return date.toLocaleDateString("en-CA");
  };

  // Load trips for the selected date
  const loadTrips = useCallback(async () => {
    if (!isOpen || !selectedDate) return;

    setIsLoading(true);
    setError(null);

    try {
      const dateStr = formatDateForDB(selectedDate);
      console.log('Loading trips for date:', dateStr);
      const tripsData = await db.getTripsByDate(dateStr);
      console.log('Loaded trips data:', tripsData);
      setTrips(tripsData);
    } catch (err) {
      console.error("Error loading trips:", err);
      setError("Failed to load trips. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [isOpen, selectedDate]);

  // Load all fish catches for the selected date
  const loadFishCatches = useCallback(async () => {
    if (!isOpen || !selectedDate) return;

    try {
      // Get all fish catches - the Firebase service will handle filtering by user
      const allFishCatches = await db.getAllFishCaught();

      // Filter fish catches for trips that exist on the selected date
      const dateStr = formatDateForDB(selectedDate);
      const tripsOnDate = await db.getTripsByDate(dateStr);

      // Get fish catches only for trips on the selected date
      const relevantFishCatches = allFishCatches.filter((fish: FishCaught) =>
        tripsOnDate.some((trip: Trip) => trip.id === fish.tripId)
      );

      setFishCatches(relevantFishCatches);

    } catch (err) {
      console.error("Error loading fish catches:", err);
      // Don't set error state for fish catches as it's not critical
    }
  }, [isOpen, selectedDate, db]);

  // Load all weather logs for the selected date
  const loadWeatherLogs = useCallback(async () => {
    if (!isOpen || !selectedDate) return;

    try {
      // Get all weather logs from database
      const allWeatherLogs = await db.getAllWeatherLogs();

      // Filter weather logs for trips that exist on the selected date
      const dateStr = formatDateForDB(selectedDate);
      const tripsOnDate = await db.getTripsByDate(dateStr);

      // Get weather logs only for trips on the selected date
      const relevantWeatherLogs = allWeatherLogs.filter((log: WeatherLog) =>
        tripsOnDate.some((trip: Trip) => trip.id === log.tripId)
      );

      setWeatherLogs(relevantWeatherLogs);
    } catch (err) {
      console.error("Error loading weather logs:", err);
      // Don't set error state for weather logs as it's not critical
    }
  }, [isOpen, selectedDate, db]);

  // Helper function to get the correct ID for deletion
  const getCorrectIdForDeletion = useCallback((item: WeatherLog | FishCaught): string => {
    // If the item has a string ID (from Firestore), use it
    if (typeof item.id === 'string' && item.id.includes('-')) {
      return item.id;
    }
    // For numeric IDs, we need to construct the correct string ID
    // The pattern is ${tripId}-${timestamp}, but we don't have the original timestamp
    // However, we can use the ID mapping system which has the correct mappings
    // For now, pass the numeric ID and let the Firebase service handle the lookup
    return item.id.toString();
  }, []);

  // Load trips when modal opens or date changes
  useEffect(() => {
    loadTrips();
  }, [loadTrips]);

  // Also reload trips when modal reopens (for data refresh)
  useEffect(() => {
    if (isOpen && selectedDate) {
      loadTrips();
      loadFishCatches();
      loadWeatherLogs();
    }
  }, [isOpen, selectedDate, loadFishCatches, loadWeatherLogs]);

  // Reload data when refresh trigger changes (e.g., after trip deletion from other modals)
  useEffect(() => {
    if (isOpen && selectedDate && refreshTrigger !== undefined) {
      loadTrips();
      loadFishCatches();
      loadWeatherLogs();
    }
  }, [refreshTrigger, isOpen, selectedDate, loadTrips, loadFishCatches, loadWeatherLogs]);

  // Handle trip deletion - show confirmation first
  const handleDeleteTrip = useCallback(async (tripId: number, firebaseDocId?: string) => {
    console.log('handleDeleteTrip called with tripId:', tripId, 'firebaseDocId:', firebaseDocId);
    setDeleteTarget({ type: 'trip', id: tripId.toString(), tripId, firebaseDocId });
    setShowDeleteConfirm(true);
  }, []);

  // Execute trip deletion after confirmation
  const executeTripDeletion = useCallback(async (tripId: number, firebaseDocId?: string) => {
    console.log('Executing trip deletion with tripId:', tripId, 'firebaseDocId:', firebaseDocId);

    try {
      await db.deleteTrip(tripId, firebaseDocId);
      console.log('Deletion completed, reloading trips...');
      // Reload trips after deletion
      await loadTrips();
      console.log('Trips reloaded successfully');

      // Notify parent component that a trip was deleted (for calendar refresh)
      if (onTripDeleted) {
        console.log('TripLogModal: Calling onTripDeleted callback');
        onTripDeleted();
      }
    } catch (err) {
      console.error("Error deleting trip:", err);
      setError("Failed to delete trip. Please try again.");
    }
  }, [db, loadTrips, onTripDeleted]);

  // Handle edit trip
  const handleEditTrip = (tripId: number) => {
    if (onEditTrip) {
      onEditTrip(tripId);
    }
  };

  // Handle new trip creation
  const handleNewTrip = () => {
    if (onNewTrip) {
      onNewTrip();
    }
  };

  // Handle opening weather modal
  const handleAddWeather = (tripId: number) => {
    setSelectedTripId(tripId);
    setEditingWeatherId(null); // Clear any existing editing state
    setShowWeatherModal(true);
  };

  // Handle opening fish modal
  const handleAddFish = (tripId: number) => {
    setSelectedTripId(tripId);
    setShowFishModal(true);
  };

  // Handle weather logged
  const handleWeatherLogged = (weatherLog: WeatherLog) => {
    setWeatherLogs(prev => {
      // Check if this weather log already exists (for updates)
      const existingIndex = prev.findIndex(log => log.id === weatherLog.id);
      if (existingIndex >= 0) {
        // Replace existing weather log
        const updated = [...prev];
        updated[existingIndex] = weatherLog;
        return updated;
      } else {
        // Add new weather log
        return [...prev, weatherLog];
      }
    });
  };

  // Handle fish caught
  const handleFishCaught = (fish: FishCaught) => {
    setFishCatches(prev => {
      // Check if this fish already exists (for updates)
      const existingIndex = prev.findIndex(f => f.id === fish.id);
      if (existingIndex >= 0) {
        // Replace existing fish catch
        const updated = [...prev];
        updated[existingIndex] = fish;
        return updated;
      } else {
        // Add new fish catch
        return [...prev, fish];
      }
    });
  };

  // Handle fish catch editing
  const handleEditFish = useCallback((fishId: string) => {
    // Find the fish catch to edit
    const fishCatch = fishCatches.find(fish => fish.id === fishId);
    if (fishCatch) {
      setSelectedTripId(fishCatch.tripId);
      // Use the correct ID for editing
      const correctId = getCorrectIdForDeletion(fishCatch);
      setEditingFishId(correctId);
      setShowFishModal(true);
    }
  }, [fishCatches, getCorrectIdForDeletion]);

  // Handle fish catch deletion
  const handleDeleteFish = useCallback(async (fishId: string) => {
    setDeleteTarget({ type: 'fish', id: fishId });
    setShowDeleteConfirm(true);
  }, []);

  // Execute fish deletion after confirmation
  const executeFishDeletion = useCallback(async (fishId: string) => {
    try {
      // The fishId passed here is the one from the UI element, which is what we need to filter the state.
      // The underlying `deleteFishCaught` service has already been fixed to handle various ID formats.
      await db.deleteFishCaught(fishId);

      // On successful deletion, update the UI by filtering the state
      setFishCatches(prevCatches => prevCatches.filter(fish => fish.id.toString() !== fishId.toString()));

      console.log('[Delete] Fish deletion successful.');
    } catch (err) {
      console.error("Error deleting fish catch:", err);
      setError("Failed to delete fish catch. Please try again.");
      // If the deletion fails, reload the data to ensure UI consistency
      loadFishCatches();
    }
  }, [db, loadFishCatches]);

  // Handle weather log editing
  const handleEditWeather = useCallback((weatherId: string) => {
    // Find the tripId for this weather log
    const weatherLog = weatherLogs.find(log => log.id === weatherId);
    if (weatherLog) {
      setSelectedTripId(weatherLog.tripId);
      // Use the correct ID for editing
      const correctId = getCorrectIdForDeletion(weatherLog);
      setEditingWeatherId(correctId);
    }
    setShowWeatherModal(true);
  }, [weatherLogs, getCorrectIdForDeletion]);

  // Handle weather log deletion
  const handleDeleteWeather = useCallback(async (weatherId: string) => {
    setDeleteTarget({ type: 'weather', id: weatherId });
    setShowDeleteConfirm(true);
  }, []);

  // Execute weather deletion after confirmation
  const executeWeatherDeletion = useCallback(async (weatherId: string) => {
    try {
      // The weatherId passed here is the one from the UI element, which is what we need to filter the state.
      // The underlying `deleteWeatherLog` service has already been fixed to handle various ID formats.
      await db.deleteWeatherLog(weatherId);

      // On successful deletion, update the UI by filtering the state
      setWeatherLogs(prevLogs => prevLogs.filter(log => log.id.toString() !== weatherId.toString()));

      console.log('[Delete] Weather deletion successful.');
    } catch (err) {
      console.error("Error deleting weather log:", err);
      setError("Failed to delete weather log. Please try again.");
      // If the deletion fails, reload the data to ensure UI consistency
      loadWeatherLogs();
    }
  }, [db, loadWeatherLogs]);

  // Handle confirmation dialog
  const handleConfirmDelete = useCallback(() => {
    if (!deleteTarget) return;

    if (deleteTarget.type === 'weather') {
      executeWeatherDeletion(deleteTarget.id);
    } else if (deleteTarget.type === 'fish') {
      executeFishDeletion(deleteTarget.id);
    } else if (deleteTarget.type === 'trip') {
      executeTripDeletion(deleteTarget.tripId!, deleteTarget.firebaseDocId);
    }

    setShowDeleteConfirm(false);
    setDeleteTarget(null);
  }, [deleteTarget, executeWeatherDeletion, executeFishDeletion, executeTripDeletion]);

  const handleCancelDelete = useCallback(() => {
    console.log('[Delete Debug] User cancelled deletion in custom modal');
    setShowDeleteConfirm(false);
    setDeleteTarget(null);
  }, []);

  // Removed debug logging to reduce console clutter

  // Add error boundary for debugging
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error('[TripLogModal Debug] JavaScript error caught:', event.error);
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="2xl"
      className="trip-log-modal"
    >
      <ModalHeader
        title="Trip Log"
        subtitle={selectedDate ? formatDateForDisplay(selectedDate) : ""}
        onClose={onClose}
      />

      <ModalBody className="min-h-[400px] max-h-[60vh] overflow-y-auto">
        {/* Error display */}
        {error && (
          <div className="mb-4 p-4 rounded-lg" style={{ backgroundColor: 'var(--error-background)', border: '1px solid var(--error-border)' }}>
            <div className="flex items-center">
              <i className="fas fa-exclamation-triangle mr-2" style={{ color: 'var(--error-text)' }}></i>
              <span style={{ color: 'var(--error-text)' }}>{error}</span>
            </div>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className="ml-3" style={{ color: 'var(--secondary-text)' }}>
              Loading trips...
            </span>
          </div>
        )}

        {/* No trips message - This should rarely be seen now since we skip TripLogModal when no trips exist */}
        {!isLoading && trips.length === 0 && !error && (
          <div className="text-center py-8">
            <i className="fas fa-fish text-4xl mb-4" style={{ color: 'var(--secondary-text)' }}></i>
            <h3 className="text-lg font-medium mb-2" style={{ color: 'var(--secondary-text)' }}>
              No trips logged for this date
            </h3>
            <p style={{ color: 'var(--secondary-text)' }}>
              Start by creating your first trip log for{" "}
              {selectedDate ? formatDateForDisplay(selectedDate) : "this date"}
            </p>
          </div>
        )}

        {/* Trips list */}
        {!isLoading && trips.length > 0 && (
          <div className="space-y-4 pb-4">
            {trips.map((trip) => (
              <TripCard
                key={trip.id}
                trip={trip}
                onEdit={() => handleEditTrip(trip.id)}
                onDelete={(firebaseDocId) => handleDeleteTrip(trip.id, firebaseDocId)}
                onAddWeather={handleAddWeather}
                onAddFish={handleAddFish}
                onEditWeather={handleEditWeather}
                onDeleteWeather={handleDeleteWeather}
                onEditFish={handleEditFish}
                onDeleteFish={handleDeleteFish}
                weatherLogs={weatherLogs.filter(log => log.tripId === trip.id)}
                fishCatches={fishCatches.filter(fish => fish.tripId === trip.id)}
              />
            ))}
          </div>
        )}
      </ModalBody>

      <ModalFooter>
        <div className="flex justify-end space-x-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button onClick={handleNewTrip}>
            New
          </Button>
        </div>
      </ModalFooter>

      {/* Weather Log Modal */}
      {(selectedTripId || editingWeatherId) && (
        <WeatherLogModal
          isOpen={showWeatherModal}
          onClose={() => {
            setShowWeatherModal(false);
            setSelectedTripId(null);
            setEditingWeatherId(null);
          }}
          tripId={selectedTripId || 1} // Use 1 as fallback if no trip selected
          weatherId={editingWeatherId || undefined}
          onWeatherLogged={handleWeatherLogged}
        />
      )}

      {/* Fish Catch Modal */}
      {selectedTripId && (
        <FishCatchModal
          isOpen={showFishModal}
          onClose={() => {
            setShowFishModal(false);
            setSelectedTripId(null);
            setEditingFishId(null);
          }}
          tripId={selectedTripId}
          fishId={editingFishId || undefined}
          onFishCaught={handleFishCaught}
        />
      )}

      {/* Standardized Delete Confirmation */}
      <ContextualConfirmation
        isOpen={showDeleteConfirm && deleteTarget !== null}
        title={`Delete ${deleteTarget?.type === 'trip' ? 'Trip' : deleteTarget?.type === 'weather' ? 'Weather Log' : 'Fish Catch'}`}
        message={
          deleteTarget?.type === 'trip' 
            ? 'This will permanently delete the entire trip and all associated data (weather logs, fish catches).'
            : `This will permanently delete this ${deleteTarget?.type} from your records.`
        }
        confirmText={`Delete ${deleteTarget?.type === 'trip' ? 'Trip' : deleteTarget?.type === 'weather' ? 'Weather Log' : 'Fish Catch'}`}
        cancelText="Keep It"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        variant="danger"
        position="top-right"
      />
    </Modal>
  );
};

// Trip card component for displaying individual trips
interface TripCardProps {
  trip: Trip;
  onEdit: () => void;
  onDelete: (firebaseDocId?: string) => void;
  onAddWeather: (tripId: number) => void;
  onAddFish: (tripId: number) => void;
  onEditWeather: (weatherId: string) => void;
  onDeleteWeather: (weatherId: string) => void;
  onEditFish: (fishId: string) => void;
  onDeleteFish: (fishId: string) => void;
  weatherLogs: WeatherLog[];
  fishCatches: FishCaught[];
}

const TripCard: React.FC<TripCardProps> = ({
  trip,
  onEdit,
  onDelete,
  onAddWeather,
  onAddFish,
  onEditWeather,
  onDeleteWeather,
  onEditFish,
  onDeleteFish,
  weatherLogs,
  fishCatches
}) => {
  const formatHours = (hours: number): string => {
    if (hours === 1) return "1 hour";
    return `${hours} hours`;
  };

  // Format weather display intelligently - only show data that was entered
  const formatWeatherDisplay = (log: WeatherLog): string => {
    const parts: string[] = [];

    // Debug logging
    console.log('Weather log data:', {
      windCondition: log.windCondition,
      windDirection: log.windDirection,
      airTemp: log.airTemp,
      waterTemp: log.waterTemp
    });

    // Show wind information if either wind condition or wind direction exists
    const windCondition = log.windCondition && log.windCondition.trim();
    const windDirection = log.windDirection && log.windDirection.trim();

    if (windCondition && windDirection) {
      parts.push(`Wind: ${windCondition} ${windDirection}`);
      console.log('Displaying wind with both condition and direction:', windCondition, windDirection);
    } else if (windCondition) {
      parts.push(`Wind: ${windCondition}`);
      console.log('Displaying wind condition only:', windCondition);
    } else if (windDirection) {
      parts.push(`Wind: ${windDirection}`);
      console.log('Displaying wind direction only:', windDirection);
    } else {
      console.log('No wind information to display');
    }

    // Only show temperatures if they were provided
    const temps: string[] = [];
    if (log.airTemp && log.airTemp.trim()) {
      temps.push(`Air: ${log.airTemp}°C`);
    }
    if (log.waterTemp && log.waterTemp.trim()) {
      temps.push(`Water: ${log.waterTemp}°C`);
    }

    if (temps.length > 0) {
      parts.push(temps.join(" / "));
    }

    const result = parts.join(" • ");
    console.log('Final weather display result:', result);
    return result;
  };

  return (
    <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--card-background)', border: '1px solid var(--border-color)' }}>
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <h4 className="text-lg font-semibold mb-1" style={{ color: 'var(--primary-text)' }}>
            {trip.water} - {trip.location}
          </h4>
          <p className="text-sm" style={{ color: 'var(--secondary-text)' }}>
            # Fish Caught: {fishCatches.length}
          </p>
        </div>

        <div className="flex space-x-2">
          <Button
            onClick={onEdit}
            size="sm"
            className="px-3 py-1 text-xs"
            title="Edit trip"
          >
            Edit
          </Button>
          <Button
            onClick={() => {
              console.log('Delete button clicked for trip:', trip.id, 'firebaseDocId:', trip.firebaseDocId);
              onDelete(trip.firebaseDocId);
            }}
            variant="secondary"
            size="sm"
            className="px-3 py-1 text-xs"
            title="Delete trip"
          >
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span style={{ color: 'var(--secondary-text)' }}>Duration:</span>
          <span className="ml-2" style={{ color: 'var(--primary-text)' }}>
            {formatHours(trip.hours)}
          </span>
        </div>

        {trip.companions && (
          <div>
            <span style={{ color: 'var(--secondary-text)' }}>
              Companions:
            </span>
            <span className="ml-2" style={{ color: 'var(--primary-text)' }}>
              {trip.companions}
            </span>
          </div>
        )}
      </div>

      {trip.notes && (
        <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border-color)' }}>
          <p className="text-sm" style={{ color: 'var(--secondary-text)' }}>
            <span className="font-medium">Notes:</span> {trip.notes}
          </p>
        </div>
      )}

      {/* Weather and Fish Catch Sections */}
      <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border-color)' }}>
        <div className="space-y-6">
          {/* Weather Conditions Section */}
          <div className="w-full">
            <h5 className="text-sm font-medium mb-3" style={{ color: 'var(--primary-text)' }}>
              Weather Conditions
            </h5>
            {weatherLogs.length > 0 ? (
              <div className="space-y-2">
                {weatherLogs.map((log) => (
                  <div key={log.id} className="text-xs p-3 rounded" style={{ backgroundColor: 'var(--card-background)', border: '1px solid var(--border-color)' }}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="font-medium" style={{ color: 'var(--primary-text)' }}>
                          Time: {log.timeOfDay}{log.sky && log.sky.trim() ? ` - ${log.sky}` : ''}
                        </div>
                        <div className="mt-1" style={{ color: 'var(--secondary-text)' }}>
                          {formatWeatherDisplay(log)}
                        </div>
                      </div>
                      <div className="flex space-x-2 ml-2">
                        <Button
                          onClick={() => onEditWeather(log.id)}
                          size="sm"
                          className="px-3 py-1 text-xs"
                          title="Update weather log"
                        >
                          Update
                        </Button>
                        <Button
                          onClick={(e) => {
                            console.log('[UI Debug] Weather delete button clicked, calling onDeleteWeather with ID:', log.id);
                            console.log('[UI Debug] Button element:', e.currentTarget);
                            console.log('[UI Debug] Button is disabled?', e.currentTarget.disabled);
                            onDeleteWeather(log.id);
                          }}
                          variant="secondary"
                          size="sm"
                          className="px-3 py-1 text-xs cursor-pointer select-none"
                          title="Delete weather log"
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm mb-3" style={{ color: 'var(--secondary-text)' }}>
                  No weather logs for this trip yet.
                </p>
                <Button
                  onClick={() => onAddWeather(trip.id)}
                  className="w-full"
                >
                  Add Weather
                </Button>
              </div>
            )}
          </div>

          {/* Separator Line */}
          <div style={{ borderTop: '1px solid var(--border-color)' }}></div>

          {/* Catch Section */}
          <div className="w-full">
            <h5 className="text-sm font-medium mb-3" style={{ color: 'var(--primary-text)' }}>
              Catch
            </h5>

            {fishCatches.length > 0 ? (
              <div className="space-y-2">
                {fishCatches.map((fish) => (
                  <div key={fish.id} className="p-3 rounded" style={{ backgroundColor: 'var(--card-background)', border: '1px solid var(--border-color)' }}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        {fish.photo && (
                          <img
                            src={fish.photo}
                            alt={`${fish.species} photo`}
                            className="w-8 h-8 object-cover rounded border flex-shrink-0"
                            style={{ borderColor: 'var(--border-color)' }}
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium" style={{ color: 'var(--primary-text)' }}>
                            {fish.species}
                          </div>
                          <div className="text-xs mt-1" style={{ color: 'var(--secondary-text)' }}>
                            {[
                              fish.length && fish.length.trim(),
                              fish.weight && fish.weight.trim(),
                              fish.time && fish.time.trim()
                            ].filter(Boolean).join(" • ")}
                          </div>
                          {fish.gear.length > 0 && (
                            <div className="text-xs mt-1" style={{ color: 'var(--secondary-text)' }}>
                              Gear: {fish.gear.join(", ")}
                            </div>
                          )}
                          {fish.details && fish.details.trim() && (
                            <div className="text-xs mt-1 italic" style={{ color: 'var(--secondary-text)' }}>
                              "{fish.details}"
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Button
                          onClick={() => onEditFish(fish.id)}
                          size="sm"
                          className="px-3 py-1 text-xs"
                        >
                          Update
                        </Button>
                        <Button
                          onClick={(e) => {
                            console.log('[UI Debug] Fish delete button clicked, calling onDeleteFish with ID:', fish.id);
                            console.log('[UI Debug] Button element:', e.currentTarget);
                            console.log('[UI Debug] Button is disabled?', e.currentTarget.disabled);
                            onDeleteFish(fish.id);
                          }}
                          variant="secondary"
                          size="sm"
                          className="px-3 py-1 text-xs cursor-pointer select-none"
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm mb-3" style={{ color: 'var(--secondary-text)' }}>
                  No fish logged for this trip yet.
                </p>
              </div>
            )}

            <div className="pt-2">
              <Button
                onClick={() => onAddFish(trip.id)}
                className="w-full"
              >
                Add Fish
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TripLogModal;
