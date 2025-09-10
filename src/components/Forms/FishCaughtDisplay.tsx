import React from 'react';
import type { FishCaught } from '../../types';

export interface FishCaughtDisplayProps {
  fishCaught: FishCaught[];
  onEdit?: (fishCaught: FishCaught) => void;
  onDelete?: (fishCaughtId: number) => void;
  isLoading?: boolean;
}

/**
 * FishCaughtDisplay component for showing fish catch records in trip details
 * Features:
 * - Display fish catches with species, size, weight, and time
 * - Show gear used and additional details
 * - Edit and delete functionality
 * - Photo display (placeholder for future implementation)
 */
export const FishCaughtDisplay: React.FC<FishCaughtDisplayProps> = ({
  fishCaught,
  onEdit,
  onDelete,
  isLoading = false
}) => {
  // Handle delete with confirmation
  const handleDelete = (fishCaughtId: number) => {
    if (onDelete && confirm('Are you sure you want to delete this fish catch record?')) {
      onDelete(fishCaughtId);
    }
  };

  // Format time display
  const formatTime = (time: string): string => {
    if (!time) return 'Not recorded';
    return time;
  };

  // Format measurements
  const formatLength = (length: string): string => {
    return length ? `${length} cm` : 'Not recorded';
  };

  const formatWeight = (weight: string): string => {
    return weight ? `${weight} kg` : 'Not recorded';
  };

  // Format gear list
  const formatGear = (gear: string[]): string => {
    if (!gear || gear.length === 0) return 'Not specified';
    return gear.join(', ');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-gray-600 dark:text-gray-400">Loading fish catches...</span>
      </div>
    );
  }

  if (fishCaught.length === 0) {
    return (
      <div className="text-center py-6">
        <i className="fas fa-fish text-3xl text-gray-400 dark:text-gray-600 mb-3"></i>
        <p className="text-gray-500 dark:text-gray-400">No fish caught recorded</p>
      </div>
    );
  }

  return (
    <div className="fish-caught-display space-y-4">
      {fishCaught.map((fish) => (
        <FishCaughtCard
          key={fish.id}
          fish={fish}
          onEdit={onEdit}
          onDelete={onDelete ? () => handleDelete(fish.id) : undefined}
          formatTime={formatTime}
          formatLength={formatLength}
          formatWeight={formatWeight}
          formatGear={formatGear}
        />
      ))}
    </div>
  );
};

// Individual fish catch card component
interface FishCaughtCardProps {
  fish: FishCaught;
  onEdit?: (fish: FishCaught) => void;
  onDelete?: () => void;
  formatTime: (time: string) => string;
  formatLength: (length: string) => string;
  formatWeight: (weight: string) => string;
  formatGear: (gear: string[]) => string;
}

const FishCaughtCard: React.FC<FishCaughtCardProps> = ({
  fish,
  onEdit,
  onDelete,
  formatTime,
  formatLength,
  formatWeight,
  formatGear
}) => {
  return (
    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center">
          <i className="fas fa-fish text-green-500 text-xl mr-3"></i>
          <div>
            <h4 className="font-medium text-gray-800 dark:text-gray-200 text-lg">
              {fish.species}
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Caught at {formatTime(fish.time)}
            </p>
          </div>
        </div>
        
        {(onEdit || onDelete) && (
          <div className="flex space-x-2">
            {onEdit && (
              <button
                onClick={() => onEdit(fish)}
                className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                title="Edit fish catch"
              >
                <i className="fas fa-edit"></i>
              </button>
            )}
            {onDelete && (
              <button
                onClick={onDelete}
                className="text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                title="Delete fish catch"
              >
                <i className="fas fa-trash"></i>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Measurements */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
        <div className="flex items-center">
          <i className="fas fa-ruler text-gray-500 mr-2"></i>
          <div>
            <span className="text-gray-500 dark:text-gray-400 block text-sm">Length:</span>
            <span className="text-gray-700 dark:text-gray-300 font-medium">
              {formatLength(fish.length)}
            </span>
          </div>
        </div>
        
        <div className="flex items-center">
          <i className="fas fa-weight text-gray-500 mr-2"></i>
          <div>
            <span className="text-gray-500 dark:text-gray-400 block text-sm">Weight:</span>
            <span className="text-gray-700 dark:text-gray-300 font-medium">
              {formatWeight(fish.weight)}
            </span>
          </div>
        </div>
        
        <div className="flex items-center">
          <i className="fas fa-clock text-gray-500 mr-2"></i>
          <div>
            <span className="text-gray-500 dark:text-gray-400 block text-sm">Time:</span>
            <span className="text-gray-700 dark:text-gray-300 font-medium">
              {formatTime(fish.time)}
            </span>
          </div>
        </div>
      </div>

      {/* Gear Used */}
      {fish.gear && fish.gear.length > 0 && (
        <div className="mb-3">
          <div className="flex items-start">
            <i className="fas fa-tools text-gray-500 mr-2 mt-1"></i>
            <div className="flex-1">
              <span className="text-gray-500 dark:text-gray-400 block text-sm">Gear used:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {fish.gear.map((gear, index) => (
                  <span
                    key={index}
                    className="inline-block px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs rounded-full"
                  >
                    {gear}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Photo placeholder */}
      {fish.photo && (
        <div className="mb-3">
          <div className="flex items-center">
            <i className="fas fa-camera text-gray-500 mr-2"></i>
            <span className="text-gray-500 dark:text-gray-400 text-sm">Photo attached</span>
          </div>
          <div className="mt-2 p-3 bg-gray-100 dark:bg-gray-600 rounded border-2 border-dashed border-gray-300 dark:border-gray-500">
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
              Photo display will be available in a future update
            </p>
          </div>
        </div>
      )}

      {/* Additional Details */}
      {fish.details && (
        <div className="pt-3 border-t border-gray-200 dark:border-gray-600">
          <div className="flex items-start">
            <i className="fas fa-sticky-note text-gray-500 mr-2 mt-1"></i>
            <div>
              <span className="text-gray-500 dark:text-gray-400 block text-sm">Details:</span>
              <p className="text-gray-700 dark:text-gray-300 text-sm mt-1">
                {fish.details}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FishCaughtDisplay;