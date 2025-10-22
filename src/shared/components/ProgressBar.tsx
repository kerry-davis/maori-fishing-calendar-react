import React from 'react';
import type { ImportProgress } from '../../shared/types';

export interface ProgressBarProps {
  progress: ImportProgress | null;
  className?: string;
  compact?: boolean;
}

function formatETA(seconds?: number) {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return '';
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s remaining` : `${sec}s remaining`;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ progress, className = '', compact = false }) => {
  if (!progress) return null;
  const pct = Math.max(0, Math.min(100, Math.round(progress.percent)));
  const etaText = formatETA(progress.etaSeconds);

  return (
    <div className={`w-full ${className}`} aria-live="polite">
      <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--secondary-text)' }}>
        <span>{progress.message || progress.phase}</span>
        <span>{pct}%{etaText ? ` · ${etaText}` : ''}</span>
      </div>
      <div className="w-full h-2 rounded-full" style={{ backgroundColor: 'var(--border-color)' }} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: 'var(--accent-color)' }} />
      </div>
      {!compact && (
        <div className="text-[11px] mt-1" style={{ color: 'var(--secondary-text)' }}>
          {progress.current}/{progress.total} • {progress.phase}
        </div>
      )}
    </div>
  );
};

export default ProgressBar;
