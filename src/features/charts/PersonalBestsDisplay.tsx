import React from 'react';
import type { Trip, FishCaught } from "@shared/types";

export interface PersonalBest {
  largestFish: FishCaught | null;
  longestFish: FishCaught | null;
  mostFishTrip: Trip | null;
  maxFish: number;
}

export interface PersonalBestsDisplayProps {
  personalBests: PersonalBest;
  className?: string;
}

/**
 * PersonalBestsDisplay component shows personal best records
 * Displays heaviest fish, longest fish, and most productive trip
 */
export const PersonalBestsDisplay: React.FC<PersonalBestsDisplayProps> = ({
  personalBests,
  className = ''
}) => {
  const { largestFish, longestFish, mostFishTrip, maxFish } = personalBests;

  // Format date for display
  const formatDate = (dateStr: string): string => {
    const dateParts = dateStr.split('-');
    const date = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
    return date.toLocaleDateString('en-NZ', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  return (
    <div className={`personal-bests-display ${className}`}>
      <h4 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">
        Personal Bests
      </h4>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Heaviest Fish */}
        {largestFish ? (
          <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-lg text-center">
            <div className="mb-2">
              <i className="fas fa-weight-hanging text-2xl text-blue-500 mb-2"></i>
            </div>
            <p className="font-bold text-lg text-gray-800 dark:text-gray-200">
              Heaviest Fish
            </p>
            <p className="text-gray-600 dark:text-gray-400 font-medium">
              {largestFish.species}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              {largestFish.weight ? `${largestFish.weight}` : 'Weight not recorded'}
            </p>
            {largestFish.length && (
              <p className="text-sm text-gray-500 dark:text-gray-500">
                {largestFish.length}
              </p>
            )}
          </div>
        ) : (
          <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-lg text-center opacity-50">
            <div className="mb-2">
              <i className="fas fa-weight-hanging text-2xl text-gray-400 mb-2"></i>
            </div>
            <p className="font-bold text-lg text-gray-400">
              Heaviest Fish
            </p>
            <p className="text-sm text-gray-400">
              No weight data recorded
            </p>
          </div>
        )}

        {/* Longest Fish */}
        {longestFish ? (
          <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-lg text-center">
            <div className="mb-2">
              <i className="fas fa-ruler text-2xl text-green-500 mb-2"></i>
            </div>
            <p className="font-bold text-lg text-gray-800 dark:text-gray-200">
              Longest Fish
            </p>
            <p className="text-gray-600 dark:text-gray-400 font-medium">
              {longestFish.species}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              {longestFish.length}
            </p>
            {longestFish.weight && (
              <p className="text-sm text-gray-500 dark:text-gray-500">
                {longestFish.weight}
              </p>
            )}
          </div>
        ) : (
          <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-lg text-center opacity-50">
            <div className="mb-2">
              <i className="fas fa-ruler text-2xl text-gray-400 mb-2"></i>
            </div>
            <p className="font-bold text-lg text-gray-400">
              Longest Fish
            </p>
            <p className="text-sm text-gray-400">
              No length data recorded
            </p>
          </div>
        )}

        {/* Most Fish in a Trip */}
        {mostFishTrip ? (
          <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-lg text-center">
            <div className="mb-2">
              <i className="fas fa-trophy text-2xl text-yellow-500 mb-2"></i>
            </div>
            <p className="font-bold text-lg text-gray-800 dark:text-gray-200">
              Most Fish in a Trip
            </p>
            <p className="text-gray-600 dark:text-gray-400 font-medium">
              {maxFish} fish
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              {formatDate(mostFishTrip.date)}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              {mostFishTrip.location}
            </p>
          </div>
        ) : (
          <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-lg text-center opacity-50">
            <div className="mb-2">
              <i className="fas fa-trophy text-2xl text-gray-400 mb-2"></i>
            </div>
            <p className="font-bold text-lg text-gray-400">
              Most Fish in a Trip
            </p>
            <p className="text-sm text-gray-400">
              No trips with catches recorded
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PersonalBestsDisplay;