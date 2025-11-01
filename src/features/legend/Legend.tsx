import React from 'react';
import type { FishingQuality } from '../../shared/types';

interface LegendItem {
  quality: FishingQuality;
  color: string;
  className: string;
}

const LEGEND_ITEMS: LegendItem[] = [
  {
    quality: 'Excellent',
    color: '#10b981',
    className: 'quality-excellent'
  },
  {
    quality: 'Good',
    color: '#3b82f6',
    className: 'quality-good'
  },
  {
    quality: 'Poor',
    color: '#ef4444',
    className: 'quality-poor'
  }
];

export const Legend: React.FC = () => {
  return (
    <div className="rounded-lg shadow-md p-4 mb-6" style={{ backgroundColor: 'var(--card-background)', border: '1px solid var(--card-border)' }}>
      <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--primary-text)' }}>
        Fishing Quality Legend
      </h3>

      {/* Legend items - spread across full width */}
      <div className="flex items-center justify-between" style={{ color: 'var(--secondary-text)' }}>
        {LEGEND_ITEMS.map((item) => (
          <div key={item.quality} className="flex items-center">
            <div
              className={`w-4 h-4 ${item.className} rounded-full mr-2`}
              style={{ backgroundColor: item.color }}
              aria-hidden="true"
            />
            <span className="text-sm">{item.quality}</span>
          </div>
        ))}
      </div>
      
      {/* Helper text - mobile */}
      <p className="text-sm mt-3 text-center block md:hidden" style={{ color: 'var(--tertiary-text)' }}>
        Tap any day to view lunar info, bite times, and log trips.
      </p>
      
      {/* Helper text - desktop */}
      <p className="text-sm mt-3 text-center hidden md:block" style={{ color: 'var(--tertiary-text)' }}>
        Hover to see quality. Click for lunar info, bite times, and trip logging.
      </p>
    </div>
  );
};