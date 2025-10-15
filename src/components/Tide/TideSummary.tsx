import React, { useMemo } from "react";
import { useTideData } from "../../hooks/useTideData";
import { getUtcDateFromTideTime } from "../../services/tideService";
import { TideChart } from "./TideChart";

interface TideSummaryProps {
  date: Date | null;
  title?: React.ReactNode;
  className?: string;
  titleClassName?: string;
  bodyClassName?: string;
  retryButtonClassName?: string;
  loadingMessage?: string;
  emptyMessage?: string;
  showProviderInfo?: boolean;
}

export const TideSummary: React.FC<TideSummaryProps> = ({
  date,
  title = "Tide Forecast",
  className = "",
  titleClassName = "font-semibold mb-1",
  bodyClassName = "text-sm",
  retryButtonClassName = "mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline",
  loadingMessage = "Loading tide information…",
  emptyMessage = "No tide data available for this date.",
  showProviderInfo = true,
}) => {
  const { tide, loading, error, refetch, providerUsed } = useTideData(date);

  const timeFormatter = useMemo(() => {
    const options: Intl.DateTimeFormatOptions = {
      hour: "numeric",
      minute: "2-digit",
    };

    if (tide?.timezone) {
      options.timeZone = tide.timezone;
    }

    return new Intl.DateTimeFormat(undefined, options);
  }, [tide?.timezone]);

  const renderTitle = () => {
    if (!title) {
      return null;
    }

    if (typeof title === "string") {
      return (
        <h4 className={titleClassName}>
          {title}
        </h4>
      );
    }

    return <div className={titleClassName}>{title}</div>;
  };

  return (
    <div className={className}>
      {renderTitle()}
      <div className={bodyClassName}>
        {loading ? (
          <p>{loadingMessage}</p>
        ) : error ? (
          <div>
            <p>{error}</p>
            <button
              type="button"
              onClick={refetch}
              className={retryButtonClassName}
            >
              Try again
            </button>
          </div>
        ) : tide ? (
          <div className="space-y-3">
            {tide.series.length > 0 && (
              <div
                className="rounded-md border p-2 sm:p-3"
                style={{
                  backgroundColor: "var(--secondary-background)",
                  borderColor: "var(--border-color)",
                }}
              >
                <div className="flex items-center mb-2" style={{ color: "var(--tertiary-text)" }}>
                  <i className="fas fa-water mr-2" aria-hidden="true"></i>
                  <span className="text-xs uppercase tracking-wide">Daily tide trend</span>
                </div>
                <TideChart
                  series={tide.series}
                  units={tide.units}
                  timezone={tide.timezone}
                  utcOffsetSeconds={tide.utcOffsetSeconds}
                />
              </div>
            )}
            {showProviderInfo && providerUsed && (
              <div className="text-xs" style={{ color: "var(--tertiary-text)" }}>
                <i className="fas fa-database mr-1"></i>
                Data source: {providerUsed}
                {providerUsed.includes('NIWA') && <span className="text-green-600 ml-1">✓</span>}
              </div>
            )}
            {tide.extrema.length > 0 ? (
              <div className="grid grid-cols-2 gap-4" style={{ color: "var(--tertiary-text)" }}>
                {(() => {
                  // Group tides into pairs (high with following low)
                  const pairs = [];
                  for (let i = 0; i < tide.extrema.length; i += 2) {
                    if (i + 1 < tide.extrema.length) {
                      const high = tide.extrema[i].type === 'high' ? tide.extrema[i] : tide.extrema[i + 1];
                      const low = tide.extrema[i].type === 'low' ? tide.extrema[i] : tide.extrema[i + 1];
                      pairs.push({ high, low });
                    }
                  }
                  return pairs.map((pair, index) => (
                    <div key={index} className="space-y-2">
                      <p className="flex items-center">
                        <i className="fas fa-arrow-up mr-1" aria-hidden="true"></i>
                        <span>
                          High Tide: {timeFormatter.format(getUtcDateFromTideTime(pair.high.time, tide.utcOffsetSeconds))} ({pair.high.height.toFixed(2)} {tide.units})
                        </span>
                      </p>
                      <p className="flex items-center">
                        <i className="fas fa-arrow-down mr-1" aria-hidden="true"></i>
                        <span>
                          Low Tide: {timeFormatter.format(getUtcDateFromTideTime(pair.low.time, tide.utcOffsetSeconds))} ({pair.low.height.toFixed(2)} {tide.units})
                        </span>
                      </p>
                    </div>
                  ));
                })()}
              </div>
            ) : (
              <p style={{ color: "var(--tertiary-text)" }}>{emptyMessage}</p>
            )}
          </div>
        ) : (
          <p>{emptyMessage}</p>
        )}
      </div>
    </div>
  );
};

export default TideSummary;
