import React, { useMemo } from "react";

// Inject a tiny stylesheet to ensure short labels are hidden inside the trip modal
if (typeof document !== "undefined" && !document.getElementById("tide-short-label-style")) {
  const style = document.createElement("style");
  style.id = "tide-short-label-style";
  style.innerHTML = 
    ".trip-log-modal .tide-short-label { display: none !important; }\n" +
    ".tide-short-label { font-weight: inherit; margin-right: 0.25rem; }";
  document.head.appendChild(style);
}
import { useTideData } from "@shared/hooks/useTideData";
import { getUtcDateFromTideTime } from "@shared/services/tideService";
import type { TideExtremum } from "@shared/services/tideService";
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
  showShortLabel?: boolean;
  instanceId?: string;
  axisColor?: string;
  gridColor?: string;
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
  showShortLabel = true,
  instanceId,
  axisColor,
  gridColor,
}) => {
  const effectiveShowShortLabel = instanceId === "trip-modal" ? false : showShortLabel;
  const { tide, loading, error, refetch, providerUsed } = useTideData(date);

  // (replaced by `fullDateFormatter` for date+time labels)

  // Full date+time formatter for tide labels (e.g. "Fri Oct 17, 7:01 pm")
  const fullDateFormatter = useMemo(() => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    };
    if (tide?.timezone) {
      // Use tide timezone when available so strings match the chart
      return (d: Date) => d.toLocaleString(undefined, { ...options, timeZone: tide.timezone });
    }
    return (d: Date) => d.toLocaleString(undefined, options);
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
                  axisColor={axisColor}
                  gridColor={gridColor}
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
                  // Pair each high tide with the next available low tide so UI ordering matches natural tide cycles.
                  // Simple adjacent pairing: group sorted extrema into consecutive pairs (0&1, 2&3, ...)
                  const sortedExtrema = [...tide.extrema].sort((a, b) => a.time.localeCompare(b.time));
                  type TidePair = { high?: TideExtremum; low?: TideExtremum };
                  const pairs: TidePair[] = [];
                  for (let i = 0; i < sortedExtrema.length; i += 2) {
                    const first = sortedExtrema[i];
                    const second = sortedExtrema[i + 1];
                    if (first && second) {
                      // assign based on their types so labels still say High/Low correctly
                      if (first.type === "high" && second.type === "low") {
                        pairs.push({ high: first, low: second });
                      } else if (first.type === "low" && second.type === "high") {
                        pairs.push({ high: second, low: first });
                      } else {
                        // two of the same type: push both but keep order
                        pairs.push({ high: first.type === "high" ? first : undefined, low: first.type === "low" ? first : undefined });
                        pairs.push({ high: second.type === "high" ? second : undefined, low: second.type === "low" ? second : undefined });
                      }
                    } else if (first) {
                      // leftover single extremum
                      pairs.push({ high: first.type === "high" ? first : undefined, low: first.type === "low" ? first : undefined });
                    }
                  }

                  return pairs.map((pair, index) => {
                    // collect existing extrema in this pair and sort them by time so earlier shows first
                    const entries: { extremum: TideExtremum; label: "High" | "Low" }[] = [];
                    if (pair.high) entries.push({ extremum: pair.high, label: "High" });
                    if (pair.low) entries.push({ extremum: pair.low, label: "Low" });
                    entries.sort((a, b) => a.extremum.time.localeCompare(b.extremum.time));

                    return (
                      <div key={index} className="space-y-2">
                        {entries.map((e, i) => (
                          <p className="flex items-center" key={i}>
                            <i className={e.label === "High" ? "fas fa-arrow-up mr-1" : "fas fa-arrow-down mr-1"} aria-hidden="true"></i>
                            <span>
                              {effectiveShowShortLabel && (
                                <span className="tide-short-label">
                                  {`${e.label}, `}
                                </span>
                              )}
                              {fullDateFormatter(getUtcDateFromTideTime(e.extremum.time, tide.utcOffsetSeconds))} ({e.extremum.height.toFixed(2)} {tide.units})
                            </span>
                          </p>
                        ))}
                      </div>
                    );
                  });
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
