import React from 'react';
import type { FishingQuality } from '../../types';

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
    quality: 'Average',
    color: '#f59e0b',
    className: 'quality-average'
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

      {/* Legend items grid - responsive layout */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2" style={{ color: 'var(--secondary-text)' }}>
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
      
      {/* Helper text */}
      <p className="text-sm mt-3" style={{ color: 'var(--tertiary-text)' }}>
        Hover over any day to see the fishing quality. Click for more details.
      </p>
    </div>
  );
};