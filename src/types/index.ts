// Core data types for the Māori Fishing Calendar

export type FishingQuality = "Excellent" | "Good" | "Average" | "Poor";
export type BiteQuality = "excellent" | "good" | "average" | "fair" | "poor";

export interface LunarPhase {
  name: string;
  quality: FishingQuality;
  description: string;
  biteQualities: BiteQuality[];
}

// Lunar phases constant array with proper typing
export const LUNAR_PHASES: readonly LunarPhase[] = [
  {
    name: "Whiro",
    quality: "Poor",
    description: "The new moon. An unfavourable day for fishing.",
    biteQualities: ["poor", "poor", "poor", "poor"],
  },
  {
    name: "Tirea",
    quality: "Average",
    description: "The moon is a sliver. A reasonably good day for crayfishing.",
    biteQualities: ["poor", "average", "poor", "poor"],
  },
  {
    name: "Hoata",
    quality: "Excellent",
    description: "A very good day for eeling and crayfishing.",
    biteQualities: ["good", "excellent", "good", "average"],
  },
  {
    name: "Oue",
    quality: "Good",
    description: "A good day for planting and fishing.",
    biteQualities: ["average", "good", "average", "poor"],
  },
  {
    name: "Okoro",
    quality: "Good",
    description: "Another good day for planting and fishing.",
    biteQualities: ["average", "good", "fair", "poor"],
  },
  {
    name: "Tamatea-a-hotu",
    quality: "Average",
    description: "A day for planting. Fishing is average.",
    biteQualities: ["fair", "average", "fair", "poor"],
  },
  {
    name: "Tamatea-a-ngana",
    quality: "Good",
    description:
      "A good day for fishing, but the weather can be unpredictable.",
    biteQualities: ["good", "fair", "good", "fair"],
  },
  {
    name: "Tamatea-whakapau",
    quality: "Poor",
    description: "Not a good day for fishing.",
    biteQualities: ["poor", "fair", "poor", "fair"],
  },
  {
    name: "Huna",
    quality: "Poor",
    description: "Means 'to hide'. Not a good day for fishing.",
    biteQualities: ["poor", "poor", "poor", "poor"],
  },
  {
    name: "Ari",
    quality: "Poor",
    description: "A disagreeable day. Unproductive.",
    biteQualities: ["poor", "poor", "poor", "poor"],
  },
  {
    name: "Hotu",
    quality: "Excellent",
    description:
      "The moon is bright and nearing full. A very good time for night fishing.",
    biteQualities: ["excellent", "average", "fair", "fair"],
  },
  {
    name: "Mawharu",
    quality: "Good",
    description:
      "A most favourable day for planting food and a good day for fishing.",
    biteQualities: ["good", "good", "fair", "fair"],
  },
  {
    name: "Atua",
    quality: "Poor",
    description: "Not a good day for planting or fishing.",
    biteQualities: ["fair", "poor", "poor", "poor"],
  },
  {
    name: "Ohua",
    quality: "Excellent",
    description: "The moon is nearly full. One of the best nights for fishing.",
    biteQualities: ["excellent", "good", "good", "fair"],
  },
  {
    name: "Oanui",
    quality: "Good",
    description: "The day of the full moon. Good for fishing.",
    biteQualities: ["average", "excellent", "good", "fair"],
  },
  {
    name: "Oturu",
    quality: "Good",
    description: "A good day for fishing and a very good day for eeling.",
    biteQualities: ["fair", "good", "poor", "poor"],
  },
  {
    name: "Rakau-nui",
    quality: "Good",
    description: "A very good day for fishing.",
    biteQualities: ["fair", "good", "poor", "poor"],
  },
  {
    name: "Rakau-matohi",
    quality: "Good",
    description: "A fine day for fishing.",
    biteQualities: ["good", "fair", "poor", "poor"],
  },
  {
    name: "Takirau",
    quality: "Average",
    description: "Fine weather in the morning. Fishing is average.",
    biteQualities: ["excellent", "average", "fair", "fair"],
  },
  {
    name: "Oike",
    quality: "Average",
    description: "The afternoon is favourable for fishing.",
    biteQualities: ["average", "average", "fair", "fair"],
  },
  {
    name: "Korekore-te-whiwhia",
    quality: "Good",
    description: "A bad day for fishing.",
    biteQualities: ["good", "good", "average", "average"],
  },
  {
    name: "Korekore-te-rawea",
    quality: "Poor",
    description: "Another bad day for fishing.",
    biteQualities: ["poor", "poor", "poor", "poor"],
  },
  {
    name: "Korekore-whakapau",
    quality: "Poor",
    description: "A fairly good day.",
    biteQualities: ["poor", "poor", "poor", "poor"],
  },
  {
    name: "Tangaroa-a-mua",
    quality: "Excellent",
    description: "A good day for fishing.",
    biteQualities: ["excellent", "good", "good", "fair"],
  },
  {
    name: "Tangaroa-a-roto",
    quality: "Excellent",
    description: "Another good day for fishing.",
    biteQualities: ["excellent", "excellent", "good", "good"],
  },
  {
    name: "Tangaroa-kiokio",
    quality: "Excellent",
    description: "An excellent day for fishing.",
    biteQualities: ["excellent", "excellent", "excellent", "good"],
  },
  {
    name: "Otane",
    quality: "Good",
    description: "A good day, and a good night for eeling.",
    biteQualities: ["good", "fair", "fair", "poor"],
  },
  {
    name: "Orongonui",
    quality: "Good",
    description: "A desirable day for fishing.",
    biteQualities: ["good", "good", "fair", "fair"],
  },
  {
    name: "Mauri",
    quality: "Average",
    description: "The morning is fine. Fishing is average.",
    biteQualities: ["fair", "average", "poor", "poor"],
  },
  {
    name: "Mutuwhenua",
    quality: "Poor",
    description: "An exceedingly bad day for fishing.",
    biteQualities: ["poor", "poor", "poor", "poor"],
  },
] as const;

// Bite quality colors constant
export const BITE_QUALITY_COLORS: Record<BiteQuality, string> = {
  excellent: "#10b981",
  good: "#3b82f6",
  average: "#f59e0b",
  fair: "#8b5cf6",
  poor: "#ef4444",
} as const;

export interface Trip {
  id: number;
  date: string;
  water: string;
  location: string;
  hours: number;
  companions: string;
  notes: string;
  firebaseDocId?: string; // Firestore document ID for deletion
}

export interface WeatherLog {
  id: string;
  tripId: number;
  timeOfDay: string;
  sky: string;
  windCondition: string;
  windDirection: string;
  waterTemp: string;
  airTemp: string;
}

export interface FishCaught {
  id: string;
  tripId: number;
  species: string;
  length: string;
  weight: string;
  time: string;
  gear: string[];
  details: string;
  // Legacy inline/base64 photo or URL (kept for backward compatibility)
  photo?: string;
  // New Storage-backed photo reference fields
  photoHash?: string;     // sha256 hex of bytes
  photoPath?: string;     // storage path: users/{uid}/images/{hash}
  photoMime?: string;     // e.g., image/jpeg
  photoUrl?: string;      // optional cached download URL
}

export interface TackleItem {
  id: number;
  name: string;
  brand: string;
  type: string;
  colour: string;
}

export interface UserLocation {
  lat: number;
  lon: number;
  name: string;
}

export interface WeatherForecast {
  temperature_max: number;
  temperature_min: number;
  windspeed_max: number;
  wind_direction: number;
}

export interface BiteTime {
  start: string;
  end: string;
  quality: BiteQuality;
}

export interface CalendarDay {
  date: Date;
  lunarPhase: LunarPhase;
  quality: FishingQuality;
  hasTrips: boolean;
}

// Context types
export interface ThemeContextType {
  isDark: boolean;
  toggleTheme: () => void;
}

export interface LocationContextType {
  userLocation: UserLocation | null;
  setLocation: (location: UserLocation | null) => void;
  requestLocation: () => Promise<void>;
  searchLocation: (locationName: string) => Promise<void>;
  searchLocationSuggestions: (locationName: string) => Promise<UserLocation[]>;
}

export interface DatabaseContextType {
  db: IDBDatabase | null;
  isReady: boolean;
  error: string | null;
}

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
}

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  successMessage: string | null;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  clearSuccessMessage: () => void;
}

// Modal types
export type ModalType =
  | "lunar"
  | "tripLog"
  | "tripDetails"
  | "tackleBox"
  | "analytics"
  | "settings"
  | "search"
  | "gallery"
  | "weather"
  | "gearSelection"
  | "weatherLog"
  | "fishCatch";

export interface ModalState {
  isOpen: boolean;
  type: ModalType | null;
  data?: any;
}

// Error types
export interface DatabaseError {
  type: "connection" | "transaction" | "data";
  message: string;
  recoverable: boolean;
}

// Calendar configuration constants
export const MONTH_NAMES: readonly string[] = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export const DAY_NAMES: readonly string[] = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
] as const;

// Default gear types for tackle box
export const DEFAULT_GEAR_TYPES: readonly string[] = [
  "Lure",
  "Rod",
  "Reel",
] as const;

// Utility types for modal states
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface DateModalProps extends ModalProps {
  selectedDate: Date;
}

export interface TripModalProps extends ModalProps {
  tripId?: number;
  selectedDate: Date;
  onTripUpdated?: () => void;
  onCancelEdit?: () => void; // Called when canceling edit to return to trip log
}

// Import progress reporting
export interface ImportProgress {
  // High-level step name: reading, parsing, photos, importing, finalizing
  phase: string;
  // Units completed and total across the overall import (best-effort)
  current: number;
  total: number;
  // Rounded overall percentage [0-100]
  percent: number;
  // Estimated seconds remaining if known
  etaSeconds?: number;
  // Optional human-friendly status
  message?: string;
}

// Form validation types
export interface FormValidation {
  isValid: boolean;
  errors: Record<string, string>;
}

// Gallery sort order type
export type GallerySortOrder = "asc" | "desc";

// Chart data types for analytics
export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

export interface ChartData {
  labels: string[];
  datasets: {
    label?: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string | string[];
    borderWidth?: number;
  }[];
}

// Moon phase calculation data
export interface MoonPhaseData {
  phaseIndex: number;
  moonAge: number;
  illumination: number;
}

// Transit time data for bite calculations
export interface MoonTransit {
  time: Date;
  overhead: boolean;
}

export interface MoonTransitData {
  transits: MoonTransit[];
}

// Storage keys constants
export const STORAGE_KEYS = {
  THEME: "theme",
  USER_LOCATION: "userLocation",
  TACKLEBOX: "tacklebox",
  GEAR_TYPES: "gearTypes",
} as const;

// Database configuration
export const DB_CONFIG = {
  NAME: "fishingLog",
  VERSION: 3,
  STORES: {
    TRIPS: "trips",
    WEATHER_LOGS: "weather_logs",
    FISH_CAUGHT: "fish_caught",
  },
} as const;
