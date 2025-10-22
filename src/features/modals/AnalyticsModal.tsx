import React, { useState, useEffect, useCallback } from 'react';
import { Modal, ModalHeader, ModalBody } from './Modal';
import { useAuth } from '../../app/providers/AuthContext';
import { firebaseDataService } from '@shared/services/firebaseDataService';
import type { Trip, WeatherLog, FishCaught, ModalProps } from '../../shared/types';
import { LUNAR_PHASES } from '../../shared/types';
import { getMoonPhaseData } from '@shared/services/lunarService';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  BarElement, 
  ArcElement, 
  Title, 
  Tooltip, 
  Legend 
} from 'chart.js';
import {
  MoonPhaseChart,
  SpeciesChart,
  LocationChart,
  GearChart,
  WeatherChart,
  PersonalBestsDisplay
} from '@features/charts';
import { PROD_ERROR } from '../../shared/utils/loggingHelpers';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

export type AnalyticsModalProps = ModalProps;

/**
 * AnalyticsModal component displays comprehensive analytics and insights
 * Features:
 * - Chart type selection and data filtering options
 * - Species breakdown, location performance, and gear effectiveness charts
 * - Moon phase performance and weather condition analysis charts
 * - Personal best records display
 * - Responsive layout for charts on mobile and desktop
 */
export const AnalyticsModal: React.FC<AnalyticsModalProps> = ({
  isOpen,
  onClose
}) => {
  const { user } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [weatherLogs, setWeatherLogs] = useState<WeatherLog[]>([]);
  const [fishCaught, setFishCaught] = useState<FishCaught[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSpecies, setSelectedSpecies] = useState<string>('all');
  const [selectedGearType, setSelectedGearType] = useState<string>('all');

  // Load all analytics data
  const loadAnalyticsData = useCallback(async () => {
    if (!isOpen) return;

    setIsLoading(true);
    setError(null);

    try {
      const [tripsData, weatherData, fishData] = await Promise.all([
        firebaseDataService.getAllTrips(),
        firebaseDataService.getAllWeatherLogs(),
        firebaseDataService.getAllFishCaught()
      ]);

      setTrips(tripsData);
      setWeatherLogs(weatherData);
      setFishCaught(fishData);

      // Check if we have fish data for analytics
      if (fishData.length === 0) {
        setError('No fish have been logged. Analytics requires catch data to be displayed.');
        return;
      }
    } catch (err) {
      PROD_ERROR('Error loading analytics data:', err);
      setError('Failed to load analytics data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [isOpen, user]);

  // Load data when modal opens
   useEffect(() => {
     loadAnalyticsData();
   }, [loadAnalyticsData]);

   // Helper function to filter fish data based on selected filters
   const getFilteredFishData = useCallback((fishData: FishCaught[]) => {
     return fishData.filter(fish => {
       // Filter by species
       if (selectedSpecies !== 'all' && fish.species !== selectedSpecies) {
         return false;
       }

       // Filter by gear type
       if (selectedGearType !== 'all' && (!fish.gear || !fish.gear.includes(selectedGearType))) {
         return false;
       }

       return true;
     });
   }, [selectedSpecies, selectedGearType]);

   // Calculate moon phase performance data
   const getMoonPhaseChartData = useCallback(() => {
     const filteredFish = getFilteredFishData(fishCaught);
     const moonPhaseData: Record<string, { trips: number; fish: number }> = {};

     trips.forEach(trip => {
       const dateParts = trip.date.split('-');
       const date = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
       const moonPhase = LUNAR_PHASES[getMoonPhaseData(date).phaseIndex].name;
       const fishCount = filteredFish.filter(fish => fish.tripId === trip.id).length;

       if (moonPhaseData[moonPhase]) {
         moonPhaseData[moonPhase].trips++;
         moonPhaseData[moonPhase].fish += fishCount;
       } else {
         moonPhaseData[moonPhase] = { trips: 1, fish: fishCount };
       }
     });

     const labels = Object.keys(moonPhaseData);
     const data = labels.map(phase => moonPhaseData[phase].fish);

     return {
       labels,
       datasets: [{
         label: '# Fish Caught',
         data,
         backgroundColor: 'rgba(54, 162, 235, 0.6)',
         borderColor: 'rgba(54, 162, 235, 1)',
         borderWidth: 1
       }]
     };
   }, [trips, fishCaught, getFilteredFishData]);


  // Calculate species breakdown data
   const getSpeciesData = useCallback(() => {
     const filteredFish = getFilteredFishData(fishCaught);
     const speciesData: Record<string, number> = {};

     filteredFish.forEach(fish => {
       const species = fish.species || 'Unknown';
       speciesData[species] = (speciesData[species] || 0) + 1;
     });

     const labels = Object.keys(speciesData);
     const data = Object.values(speciesData);
     const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'];

     return {
       labels,
       datasets: [{
         data,
         backgroundColor: colors.slice(0, labels.length),
       }]
     };
   }, [fishCaught, getFilteredFishData]);

  // Calculate location performance data
   const getLocationData = useCallback(() => {
     const filteredFish = getFilteredFishData(fishCaught);
     const locationData: Record<string, number> = {};

     filteredFish.forEach(fish => {
       const trip = trips.find(t => t.id === fish.tripId);
       if (trip) {
         const location = trip.location || 'Unknown';
         locationData[location] = (locationData[location] || 0) + 1;
       }
     });

     const labels = Object.keys(locationData);
     const data = Object.values(locationData);

     return {
       labels,
       datasets: [{
         label: '# Fish Caught',
         data,
         backgroundColor: 'rgba(75, 192, 192, 0.6)',
         borderColor: 'rgba(75, 192, 192, 1)',
         borderWidth: 1
       }]
     };
   }, [trips, fishCaught, getFilteredFishData]);

  // Calculate gear effectiveness data
   const getGearData = useCallback(() => {
     const filteredFish = getFilteredFishData(fishCaught);
     const gearData: Record<string, number> = {};

     filteredFish.forEach(fish => {
       if (fish.gear && fish.gear.length > 0) {
         fish.gear.forEach(gearName => {
           const name = gearName || 'Unknown';
           gearData[name] = (gearData[name] || 0) + 1;
         });
       }
     });

     const labels = Object.keys(gearData);
     const data = Object.values(gearData);
     const colors = ['#FF9F40', '#FFCD56', '#4BC0C0', '#9966FF', '#C9CBCF', '#FF6384'];

     return {
       labels,
       datasets: [{
         data,
         backgroundColor: colors.slice(0, labels.length),
       }]
     };
   }, [fishCaught, getFilteredFishData]);

  // Calculate weather condition data
   const getWeatherData = useCallback(() => {
     const filteredFish = getFilteredFishData(fishCaught);
     const weatherData: Record<string, number> = {};

     weatherLogs.forEach(weather => {
       const condition = weather.sky || 'Unknown';
       const tripFish = filteredFish.filter(f => f.tripId === weather.tripId).length;
       if (tripFish > 0) {
         weatherData[condition] = (weatherData[condition] || 0) + tripFish;
       }
     });

     const labels = Object.keys(weatherData);
     const data = Object.values(weatherData);

     return {
       labels,
       datasets: [{
         label: '# Fish Caught',
         data,
         backgroundColor: 'rgba(153, 102, 255, 0.6)',
         borderColor: 'rgba(153, 102, 255, 1)',
         borderWidth: 1
       }]
     };
   }, [weatherLogs, fishCaught, getFilteredFishData]);

  // Calculate personal bests
   const getPersonalBests = useCallback(() => {
     const filteredFish = getFilteredFishData(fishCaught);
     let largestFish: FishCaught | null = null;
     let longestFish: FishCaught | null = null;

     filteredFish.forEach(fish => {
       const weight = parseFloat(fish.weight) || 0;
       const length = parseFloat(fish.length) || 0;

       if (weight > 0 || length > 0) {
         if (!largestFish || weight > (parseFloat(largestFish.weight) || 0) ||
             (weight === (parseFloat(largestFish.weight) || 0) && length > (parseFloat(largestFish.length) || 0))) {
           largestFish = fish;
         }
       }

       if (length > 0) {
         if (!longestFish || length > (parseFloat(longestFish.length) || 0)) {
           longestFish = fish;
         }
       }
     });

     // Find trip with most fish
     const fishCountByTrip: Record<number, number> = {};
     filteredFish.forEach(fish => {
       fishCountByTrip[fish.tripId] = (fishCountByTrip[fish.tripId] || 0) + 1;
     });

     let mostFishTrip: Trip | null = null;
     let maxFish = 0;
     trips.forEach(trip => {
       const total = fishCountByTrip[trip.id] || 0;
       if (total > 0 && total > maxFish) {
         maxFish = total;
         mostFishTrip = trip;
       }
     });

     return { largestFish, longestFish, mostFishTrip, maxFish };
   }, [trips, fishCaught, getFilteredFishData]);

  // Get unique species for filtering
  const getUniqueSpecies = useCallback(() => {
    const species = new Set(fishCaught.map(fish => fish.species || 'Unknown'));
    return Array.from(species).sort();
  }, [fishCaught]);

  // Get unique gear types for filtering
  const getUniqueGearTypes = useCallback(() => {
    const gearTypes = new Set<string>();
    fishCaught.forEach(fish => {
      if (fish.gear && fish.gear.length > 0) {
        fish.gear.forEach(gear => gearTypes.add(gear));
      }
    });
    return Array.from(gearTypes).sort();
  }, [fishCaught]);



  // Check if filters are active
  const hasActiveFilters = selectedSpecies !== 'all' || selectedGearType !== 'all';

  const moonPhaseChartData = getMoonPhaseChartData();
  const speciesChartData = getSpeciesData();
  const locationChartData = getLocationData();
  const gearChartData = getGearData();
  const weatherChartData = getWeatherData();
  const personalBests = getPersonalBests();
  const uniqueSpecies = getUniqueSpecies();
  const uniqueGearTypes = getUniqueGearTypes();



  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="3xl"
      className="analytics-modal"
    >
      <ModalHeader
        title="Analytics Dashboard"
        subtitle={
          hasActiveFilters
            ? `Filtered Fish: ${getFilteredFishData(fishCaught).length} of ${fishCaught.length} total`
            : `Total Fish Caught: ${fishCaught.length}`
        }
        onClose={onClose}
      />

      <ModalBody className="min-h-[600px] modal-body">
        {/* Error display */}
        {error && (
          <div className="mb-4 p-4 border rounded-lg" style={{
            backgroundColor: 'var(--error-background)',
            borderColor: 'var(--error-border)'
          }}>
            <div className="flex items-center">
              <i className="fas fa-exclamation-triangle text-red-500 mr-2"></i>
              <span className="text-red-700 dark:text-red-300" style={{ color: 'var(--error-text)' }}>{error}</span>
            </div>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className="ml-3" style={{ color: 'var(--secondary-text)' }}>Loading analytics...</span>
          </div>
        )}

        {/* Analytics content */}
        {!isLoading && !error && fishCaught.length > 0 && (
          <div className="space-y-8">
            {/* Chart type selection and filters */}
            <div className="rounded-lg p-4 data-filters-section">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-semibold" style={{ color: 'var(--primary-text)' }}>
                  Data Filters
                </h4>
                {hasActiveFilters && (
                  <button
                    onClick={() => {
                      setSelectedSpecies('all');
                      setSelectedGearType('all');
                    }}
                    className="text-sm px-2 py-1 rounded transition-colors"
                    style={{
                      color: 'var(--accent-color)',
                      border: `1px solid var(--accent-color)`
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--accent-color)';
                      e.currentTarget.style.color = 'white';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = 'var(--accent-color)';
                    }}
                  >
                    <i className="fas fa-times mr-1"></i>
                    Clear Filters
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="species-filter" className="block text-sm font-medium mb-1" style={{ color: 'var(--primary-text)' }}>
                    Filter by Species
                  </label>
                  <select
                    id="species-filter"
                    value={selectedSpecies}
                    onChange={(e) => setSelectedSpecies(e.target.value)}
                    className="w-full p-2 border rounded-md"
                    style={{
                      backgroundColor: 'var(--input-background)',
                      borderColor: 'var(--input-border)',
                      color: 'var(--primary-text)'
                    }}
                  >
                    <option value="all">All Species</option>
                    {uniqueSpecies.map(species => (
                      <option key={species} value={species}>{species}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="gear-filter" className="block text-sm font-medium mb-1" style={{ color: 'var(--primary-text)' }}>
                    Filter by Gear Type
                  </label>
                  <select
                    id="gear-filter"
                    value={selectedGearType}
                    onChange={(e) => setSelectedGearType(e.target.value)}
                    className="w-full p-2 border rounded-md"
                    style={{
                      backgroundColor: 'var(--input-background)',
                      borderColor: 'var(--input-border)',
                      color: 'var(--primary-text)'
                    }}
                  >
                    <option value="all">All Gear Types</option>
                    {uniqueGearTypes.map(gear => (
                      <option key={gear} value={gear}>{gear}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Moon Phase Performance */}
            {moonPhaseChartData.labels.length > 0 && (
              <div className="h-80 moon-phase-chart-container">
                <MoonPhaseChart data={moonPhaseChartData} className="moon-phase-chart" />
              </div>
            )}

            {/* Catch Breakdown */}
            <div>
              <h4 className="text-xl font-semibold mb-4" style={{ color: 'var(--primary-text)' }}>
                Catch Breakdown
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Species Chart */}
                {speciesChartData.labels.length > 0 && (
                  <div className="h-64 species-chart-container">
                    <SpeciesChart data={speciesChartData} className="species-chart" />
                  </div>
                )}

                {/* Location Chart */}
                {locationChartData.labels.length > 0 && (
                  <div className="h-64 location-chart-container">
                    <LocationChart data={locationChartData} className="location-chart" />
                  </div>
                )}

                {/* Gear Chart */}
                {gearChartData.labels.length > 0 && (
                  <div className="h-64 gear-chart-container">
                    <GearChart data={gearChartData} className="gear-chart" />
                  </div>
                )}

                {/* Weather Chart */}
                {weatherChartData.labels.length > 0 && (
                  <div className="md:col-span-2 h-64 weather-chart-container">
                    <WeatherChart data={weatherChartData} className="weather-chart" />
                  </div>
                )}
              </div>
            </div>

            {/* Personal Bests */}
            <PersonalBestsDisplay personalBests={personalBests} />
          </div>
        )}
      </ModalBody>
    </Modal>
  );
};

export default AnalyticsModal;