# Context Providers

This directory contains React Context providers for the Māori Fishing Calendar application. These contexts provide centralized state management for theme, location, and database functionality.

## Implemented Contexts

### 1. ThemeContext (`ThemeContext.tsx`)

Manages application theme state (dark/light mode) with localStorage persistence.

**Features:**
- Dark/light theme toggle functionality
- Automatic persistence to localStorage
- CSS class management for theme switching
- System preference detection on first load
- Cross-tab synchronization

**Usage:**
```tsx
import { useThemeContext } from './contexts';

function MyComponent() {
  const { isDark, toggleTheme } = useThemeContext();
  
  return (
    <button onClick={toggleTheme}>
      {isDark ? 'Switch to Light' : 'Switch to Dark'}
    </button>
  );
}
```

### 2. LocationContext (`LocationContext.tsx`)

Manages user location data with geolocation API integration.

**Features:**
- Geolocation API integration with error handling
- Location persistence to localStorage
- Manual location setting
- Location validation via weather API
- Proper error handling for permission denied, timeout, etc.

**Usage:**
```tsx
import { useLocationContext } from './contexts';

function MyComponent() {
  const { userLocation, setLocation, requestLocation } = useLocationContext();
  
  const handleGetLocation = async () => {
    try {
      await requestLocation();
    } catch (error) {
      console.error('Failed to get location:', error);
    }
  };
  
  return (
    <div>
      <p>Current: {userLocation?.name || 'No location set'}</p>
      <button onClick={handleGetLocation}>Get Current Location</button>
    </div>
  );
}
```

### 3. DatabaseContext (`DatabaseContext.tsx`)

Manages IndexedDB database connection and initialization.

**Features:**
- Automatic database initialization on app start
- Database ready state management
- Error handling and recovery
- Connection monitoring
- Integration with existing DatabaseService

**Usage:**
```tsx
import { useDatabaseContext, useDatabaseService } from './contexts';

function MyComponent() {
  const { isReady, error } = useDatabaseContext();
  const dbService = useDatabaseService(); // Only available when ready
  
  if (!isReady) {
    return <div>Loading database...</div>;
  }
  
  if (error) {
    return <div>Database error: {error}</div>;
  }
  
  // Use dbService for database operations
  return <div>Database ready!</div>;
}
```

## Combined Provider

The `AppProviders` component combines all context providers for easy setup:

```tsx
import { AppProviders } from './contexts';

function App() {
  return (
    <AppProviders>
      <YourAppContent />
    </AppProviders>
  );
}
```

## Provider Hierarchy

The contexts are nested in the following order:
1. ThemeProvider (outermost)
2. LocationProvider
3. DatabaseProvider (innermost)

This ensures that theme is available first, followed by location services, and finally database functionality.

## Error Handling

All contexts implement graceful error handling:

- **ThemeContext**: Logs errors but continues with default theme
- **LocationContext**: Throws descriptive errors for geolocation failures
- **DatabaseContext**: Provides error state and recovery mechanisms

## Testing

Comprehensive tests are included:

- `ThemeContext.test.tsx`: Unit tests for theme functionality
- `AppProviders.test.tsx`: Integration tests for provider nesting
- `integration.test.tsx`: Full integration tests with all contexts

Run tests with:
```bash
npm test -- contexts/
```

## Requirements Satisfied

This implementation satisfies the following requirements from the spec:

- **4.2, 4.3, 5.1**: Theme persistence and CSS class management
- **8.2, 5.1**: Location management with geolocation API
- **5.1, 5.2, 3.3**: Database initialization and state management

## Files Structure

```
contexts/
├── ThemeContext.tsx          # Theme management
├── LocationContext.tsx       # Location services
├── DatabaseContext.tsx       # Database connection
├── index.ts                  # Exports and AppProviders
├── README.md                 # This documentation
└── __tests__/
    ├── ThemeContext.test.tsx      # Theme tests
    ├── AppProviders.test.tsx      # Provider integration tests
    └── integration.test.tsx       # Full integration tests
```

## Next Steps

These contexts are now ready to be used throughout the application. The next tasks in the implementation plan can utilize these contexts for:

- Component state management
- Theme-aware styling
- Location-based calculations
- Database operations

All contexts follow React best practices and provide type-safe interfaces for TypeScript development.