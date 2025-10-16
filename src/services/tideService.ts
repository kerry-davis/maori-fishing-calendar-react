import type { UserLocation, TideCoverageStatus } from "../types";

const MARINE_API_URL = "https://marine-api.open-meteo.com/v1/marine";
const TIDE_VARIABLE = "sea_level_height_msl";

export type TideErrorType = "network" | "api" | "parsing" | "validation";

export interface TideError extends Error {
  type: TideErrorType;
  status?: number;
}

export interface TideDataPoint {
  time: string;
  height: number;
}

export interface TideExtremum {
  type: "high" | "low";
  time: string;
  height: number;
}

export interface TideForecast {
  date: string;
  timezone: string;
  units: string;
  extrema: TideExtremum[];
  minHeight: number;
  maxHeight: number;
  series: TideDataPoint[];
  utcOffsetSeconds: number;
}

interface MarineApiResponse {
  timezone?: string;
  utc_offset_seconds?: number;
  hourly_units?: Record<string, string>;
  hourly?: {
    time?: string[];
    sea_level_height_msl?: number[];
  };
}

function formatDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(source: Date, amount: number): Date {
  return new Date(Date.UTC(
    source.getUTCFullYear(),
    source.getUTCMonth(),
    source.getUTCDate() + amount,
    source.getUTCHours(),
    source.getUTCMinutes(),
    source.getUTCSeconds(),
    source.getUTCMilliseconds()
  ));
}

function roundHeight(value: number): number {
  return Math.round(value * 100) / 100;
}

function createTideError(
  type: TideErrorType,
  message: string,
  status?: number,
): TideError {
  const error = new Error(message) as TideError;
  error.name = "TideError";
  error.type = type;
  if (status) {
    error.status = status;
  }
  return error;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseMarineResponse(data: unknown): MarineApiResponse {
  if (!data || typeof data !== "object") {
    throw createTideError("parsing", "Invalid tide API response structure");
  }
  return data as MarineApiResponse;
}

function combineSeries(
  times: string[] | undefined,
  values: number[] | undefined,
): TideDataPoint[] {
  if (!times || !values || times.length !== values.length) {
    return [];
  }
  return times
    .map((time, index) => ({ time, height: values[index] }))
    .filter((entry) => isFiniteNumber(entry.height));
}

function findExtrema(
  series: TideDataPoint[],
): TideExtremum[] {
  const extrema: TideExtremum[] = [];
  for (let i = 1; i < series.length - 1; i += 1) {
    const previous = series[i - 1];
    const current = series[i];
    const next = series[i + 1];

    if (!isFiniteNumber(previous.height) || !isFiniteNumber(next.height)) {
      continue;
    }

    const rising = current.height >= previous.height;
    const falling = current.height >= next.height;
    const dropping = current.height <= previous.height;
    const climbing = current.height <= next.height;

    if (rising && falling && (current.height > previous.height || current.height > next.height)) {
      extrema.push({ type: "high", time: current.time, height: roundHeight(current.height) });
    } else if (dropping && climbing && (current.height < previous.height || current.height < next.height)) {
      extrema.push({ type: "low", time: current.time, height: roundHeight(current.height) });
    }
  }
  // CRITICAL FIX: Sort extrema chronologically by time
  return extrema.sort((a, b) => a.time.localeCompare(b.time));
}

async function requestSeaLevelSeries(params: {
  lat: number;
  lon: number;
  startDate: string;
  endDate: string;
}): Promise<MarineApiResponse> {
  const query = new URLSearchParams({
    latitude: params.lat.toString(),
    longitude: params.lon.toString(),
    hourly: TIDE_VARIABLE,
    timezone: "auto",
    start_date: params.startDate,
    end_date: params.endDate,
  });

  let response: Response;
  try {
    response = await fetch(`${MARINE_API_URL}?${query.toString()}`);
  } catch (error) {
    throw createTideError("network", "Network error: Unable to fetch tide data");
  }

  if (!response.ok) {
    throw createTideError(
      "api",
      `Tide service returned status ${response.status}`,
      response.status,
    );
  }

  try {
    const json = await response.json();
    return parseMarineResponse(json);
  } catch (error) {
    throw createTideError("parsing", "Failed to parse tide API response");
  }
}

function ensureValidCoordinates(lat: number, lon: number): void {
  if (!isFiniteNumber(lat) || !isFiniteNumber(lon)) {
    throw createTideError("validation", "Invalid coordinates provided for tide request");
  }
}

function fallbackExtrema(
  dateSeries: TideDataPoint[],
): TideExtremum[] {
  if (dateSeries.length === 0) {
    return [];
  }
  const minPoint = dateSeries.reduce((min, current) =>
    current.height < min.height ? current : min,
  );
  const maxPoint = dateSeries.reduce((max, current) =>
    current.height > max.height ? current : max,
  );
  const extrema: TideExtremum[] = [];
  extrema.push({ type: "high", time: maxPoint.time, height: roundHeight(maxPoint.height) });
  extrema.push({ type: "low", time: minPoint.time, height: roundHeight(minPoint.height) });
  // CRITICAL FIX: Sort fallback extrema chronologically by time
  return extrema.sort((a, b) => a.time.localeCompare(b.time));
}

export function getUtcDateFromTideTime(
  time: string,
  utcOffsetSeconds = 0,
): Date {
  const [datePart, timePart] = time.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hours, minutes] = timePart.split(":").map(Number);
  const utcMillis = Date.UTC(year, month - 1, day, hours, minutes);
  return new Date(utcMillis - utcOffsetSeconds * 1000);
}

function createForecast(
  date: string,
  timezone: string | undefined,
  units: string | undefined,
  extrema: TideExtremum[],
  dateSeries: TideDataPoint[],
  utcOffsetSeconds: number,
): TideForecast {
  const heights = dateSeries.map((entry) => entry.height);
  const minHeight = roundHeight(Math.min(...heights));
  const maxHeight = roundHeight(Math.max(...heights));

  return {
    date,
    timezone: timezone ?? "GMT",
    units: units ?? "m",
    extrema,
    minHeight,
    maxHeight,
    series: dateSeries.map((point) => ({
      time: point.time,
      height: roundHeight(point.height),
    })),
    utcOffsetSeconds,
  };
}

export async function fetchTideForecast(
  lat: number,
  lon: number,
  date: Date,
  _options: { forceRefresh?: boolean } = {},
): Promise<TideForecast> {
  ensureValidCoordinates(lat, lon);
  const targetDate = formatDate(date);
  const startDate = formatDate(addDays(date, -1));
  const endDate = formatDate(addDays(date, 1));
  const response = await requestSeaLevelSeries({ lat, lon, startDate, endDate });

  const series = combineSeries(
    response.hourly?.time,
    response.hourly?.sea_level_height_msl,
  );

  if (series.length === 0) {
    throw createTideError(
      "validation",
      "Tide data is not available for this location or date",
    );
  }

  const seriesForDate = series.filter((entry) => entry.time.startsWith(targetDate));

  if (seriesForDate.length === 0) {
    throw createTideError(
      "validation",
      "Tide data could not be retrieved for the selected date",
    );
  }

  const extremaForRange = findExtrema(series).filter((extremum) =>
    extremum.time.startsWith(targetDate),
  );

  const extrema = extremaForRange.length > 0
    ? extremaForRange
    : fallbackExtrema(seriesForDate);

  return createForecast(
    targetDate,
    response.timezone,
    response.hourly_units?.[TIDE_VARIABLE],
    // CRITICAL FIX: Ensure extrema are sorted by time after filtering
    extrema.sort((a, b) => a.time.localeCompare(b.time)),
    seriesForDate,
    response.utc_offset_seconds ?? 0,
  );
}

export async function fetchTideForLocation(
  location: UserLocation,
  date: Date,
  _options?: { forceRefresh?: boolean },
): Promise<TideForecast> {
  return fetchTideForecast(location.lat, location.lon, date);
}

export async function checkTideCoverage(lat: number, lon: number): Promise<TideCoverageStatus> {
  try {
    // Test with current date using Open-Meteo
    const testDate = new Date();
    const forecast = await fetchTideForecast(lat, lon, testDate);
    return {
      available: true,
      checkedAt: new Date().toISOString(),
      timezone: forecast.timezone,
      units: forecast.units
    };
  } catch (error) {
    const tideError = error as TideError;
    return {
      available: false,
      checkedAt: new Date().toISOString(),
      message: getTideErrorMessage(tideError)
    };
  }
}

// Enhanced Open-Meteo fetch with better NZ harbour support
export async function fetchOpenMeteoTideForecast(
  lat: number,
  lon: number,
  date: Date,
): Promise<TideForecast> {
  const targetDate = formatDate(date);
  const startDate = formatDate(addDays(date, -1));
  const endDate = formatDate(addDays(date, 1));
  
  const query = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    hourly: TIDE_VARIABLE,
    timezone: "auto", // Let Open-Meteo determine NZ timezone
    start_date: startDate,
    end_date: endDate,
  });

  let response: Response;
  try {
    response = await fetch(`${MARINE_API_URL}?${query.toString()}`);
  } catch (error) {
    throw createTideError("network", "Unable to connect to Open-Meteo tide service");
  }

  if (!response.ok) {
    if (response.status === 429) {
      throw createTideError("api", "Open-Meteo rate limit exceeded", response.status);
    }
    if (response.status >= 500) {
      throw createTideError("api", "Open-Meteo service unavailable", response.status);
    }
    throw createTideError("api", `Open-Meteo returned status ${response.status}`, response.status);
  }

  try {
    const json: MarineApiResponse = await response.json();
    const series = combineSeries(
      json.hourly?.time,
      json.hourly?.sea_level_height_msl,
    );

    if (series.length === 0) {
      throw createTideError(
        "validation",
        "Open-Meteo: No tide data available for this location",
      );
    }

    const seriesForDate = series.filter((entry) => entry.time.startsWith(targetDate));

    if (seriesForDate.length === 0) {
      throw createTideError(
        "validation",
        "Open-Meteo: No tide data for selected date",
      );
    }

    const extremaForRange = findExtrema(series).filter((extremum) =>
      extremum.time.startsWith(targetDate)
    );

    // Enhanced validation for NZ harbours
    const extrema = extremaForRange.length >= 2
      ? extremaForRange.slice(0, 4) // Take first 4 extrema (2 high/low pairs)
      : fallbackExtrema(seriesForDate);

    return createForecast(
      targetDate,
      json.timezone,
      json.hourly_units?.[TIDE_VARIABLE],
      extrema,
      seriesForDate,
      json.utc_offset_seconds ?? 0,
    );
  } catch (error) {
    if (error instanceof Error && error.name === "TideError") {
      throw error;
    }
    throw createTideError("parsing", "Failed to parse Open-Meteo tide response");
  }
}

export function getTideErrorMessage(error: TideError | unknown): string {
  const tideError = error as TideError | undefined;
  if (!tideError || tideError.name !== "TideError" || !tideError.type) {
    return "Unable to load tide information. Please try again.";
  }

  switch (tideError.type) {
    case "network":
      return "Unable to connect to tide service. Please check your internet connection.";
    case "api":
      if (tideError.status === 429) {
        return "Tide service rate limit reached. Please try again shortly.";
      }
      if (tideError.status && tideError.status >= 500) {
        return "Tide service is currently unavailable. Please try again later.";
      }
      return "Tide service returned an unexpected response.";
    case "parsing":
      return "Unable to process tide data. Please try again.";
    case "validation":
      return tideError.message || "Tide data is not available for this location or date.";
    default:
      return "Unable to load tide information. Please try again.";
  }
}

// Export types used by other modules
export type { TideCoverageStatus } from "../types";
