# Logging Guidelines

This document outlines the logging strategy for the Maori Fishing Calendar React application to maintain clean production console output while retaining debugging capabilities during development.

## Core Principles

1. **Production Console = Critical Only**: Production builds should output only critical errors and security issues
2. **Development Console = Full Diagnostics**: Development builds show detailed traces for debugging
3. **Tree-shaking Optimization**: Development-only logs are automatically removed during production bundling
4. **No Console in Tests**: Tests should not rely on console output; use assertions instead

## Logging Categories

### Production-Critical Logs (ALWAYS VISIBLE)

These logs are **always visible** in both development and production:

- **Security Issues**: Direct API calls, unauthorized access attempts, configuration bypasses
- **Critical Errors**: Database failures, authentication failures, unrecoverable errors
- **Configuration Warnings**: Missing API keys, incomplete setup that breaks features
- **User-Facing Information**: Data import status, migration progress (rare)

**Usage**:
```typescript
import { PROD_ERROR, PROD_SECURITY, PROD_WARN, PROD_INFO } from '@/utils/loggingHelpers';

// Security violation - always logged
PROD_SECURITY('Direct NIWA API call attempted:', url);

// Critical failure - always logged
PROD_ERROR('Database connection failed:', error);

// Configuration issue - always logged
PROD_WARN('NIWA_PROXY_URL not configured - falling back to Open-Meteo');

// User info (rarely used) - always logged
PROD_INFO('Importing 42 trips from legacy app');
```

### Development-Only Logs (TREE-SHAKEN IN PRODUCTION)

These logs are **only visible in development** and automatically removed during production builds:

- **Diagnostics**: Provider selection, API responses, parameter values
- **Traces**: Function entry/exit, state changes, operation results
- **Performance**: Timing, counts, batch operations
- **Successful Operations**: Completed tasks, data loaded, transformations applied

**Usage**:
```typescript
import { DEV_LOG, DEV_WARN, DEV_ERROR } from '@/utils/loggingHelpers';

// Development diagnostic
DEV_LOG('NIWA request parameters:', { lat, lon, date });

// Development warning (non-critical issue caught)
DEV_WARN('Fallback provider used:', reason);

// Caught error that doesn't need user attention
DEV_ERROR('CSV parse attempt failed:', parseError);
```

## Service-Specific Logging Patterns

Each domain has structured logging helpers available:

### Tide Service

```typescript
import { TideLogging } from '@/utils/loggingHelpers';

// Development logs
TideLogging.dev.providerAttempt('NIWA', 'Auckland');
TideLogging.dev.providerSuccess('Open-Meteo', 144);
TideLogging.dev.providerFallback('NIWA', 'Open-Meteo', 'network timeout');
TideLogging.dev.parametersUsed({ lat, lon, date });

// Production logs
TideLogging.prod.allProvidersFailed('No tide data available');
TideLogging.prod.apiKeyMissing('NIWA');
```

### Database Service

```typescript
import { DatabaseLogging } from '@/utils/loggingHelpers';

// Development logs
DatabaseLogging.dev.schemaUpgrade(3);
DatabaseLogging.dev.storeCreated('trips');
DatabaseLogging.dev.migrationComplete('fish_caught');
DatabaseLogging.dev.queryResult('getAllTrips', 42);

// Production logs
DatabaseLogging.prod.initializationFailed(error.message);
DatabaseLogging.prod.corruptionDetected();
```

### Firebase Service

```typescript
import { FirebaseLogging } from '@/utils/loggingHelpers';

// Development logs
FirebaseLogging.dev.userSwitched('user123', 'authenticated');
FirebaseLogging.dev.queryResult('getTripsByDate', 15);
FirebaseLogging.dev.fallbackToLocal('network error');
FirebaseLogging.dev.uploadProgress('photo-abc.jpg', 75);

// Production logs
FirebaseLogging.prod.uploadFailed('Storage quota exceeded');
FirebaseLogging.prod.authenticationFailed('Token expired');
```

### Generic Helper Usage (Most Services)

For services without domain-specific helpers, use the generic DEV_*/PROD_* functions:

```typescript
import { DEV_LOG, DEV_WARN, DEV_ERROR, PROD_ERROR, PROD_WARN } from '@/utils/loggingHelpers';

// Storage/Session Operations (Development)
DEV_LOG('[Guest Session] localStorage initialized');
DEV_WARN('[Guest Session] Failed to persist session state:', error);
DEV_LOG('[Guest Data Retention] Data saved to IndexedDB');

// Encryption Operations (Development)
DEV_WARN('[Encryption] Trip encrypt failed:', error);
DEV_LOG('[Salt] User salt synchronized');

// Fallback Operations (Development)
DEV_WARN('[Firebase] Falling back to local storage after Firestore failure');
FirebaseLogging.dev.fallbackToLocal('query failed');

// Critical Failures (Production)
PROD_ERROR('Photo encryption failed:', error);
PROD_ERROR('Failed to mark migration complete:', error);
PROD_WARN('Cannot merge local data in guest mode');
```

## Tree-Shaking Mechanism

Development-only logging uses a ternary operator that bundlers can statically analyze:

```typescript
// Bundlers see this at build time:
const DEV_LOG = import.meta.env.DEV ? console.log : () => {};

// In production (import.meta.env.DEV === false), the entire condition is false,
// and bundlers (Vite, Rollup, esbuild) eliminate dead code:
DEV_LOG('debug info'); // → completely removed from bundle
```

**Result**: Development logs generate zero bytes in production bundles.

## Console.error for Critical Issues

Direct `console.error()` calls are acceptable **only** for:

1. **Security violations** that must always be logged
2. **Unrecoverable errors** from error boundaries
3. **API proxy diagnostics** (server-side logging)

Example:
```typescript
// OK - Security issue that should always be visible
if (apiUrl.includes('api.niwa.co.nz')) {
  console.error('🔒 SECURITY: Direct API call detected');
}

// NOT OK - This should use DEV_ERROR
console.error('Failed to parse response:', error); // Use DEV_ERROR instead
```

## Real-World Examples from Refactored Services

### Example 1: Guest Session Service

**Before (console.warn)**:
```typescript
// Many console.warn calls scattered throughout
console.warn('[guestSession] Failed to persist session state:', error);
```

**After (DEV_WARN)**:
```typescript
import { DEV_WARN } from '../utils/loggingHelpers';

// Clear categorization, consistent with other services
DEV_WARN('[Guest Session] Failed to persist session state:', error);
```

**Why**: Development team sees when sessions fail to persist. In production, only visible if debugging is enabled.

### Example 2: Firebase Data Service

**Before (207 console.log/warn/error calls)**:
```typescript
console.log('Trip created in Firestore with validation:', docRef.id);
console.warn('Firestore create failed, falling back to local:', error);
console.error('Data migration failed:', error);
```

**After (DEV_LOG, DEV_WARN, PROD_ERROR)**:
```typescript
import { DEV_LOG, DEV_WARN, PROD_ERROR } from '../utils/loggingHelpers';

DEV_LOG('Trip created in Firestore with validation:', docRef.id);
DEV_WARN('[Firebase] Falling back to local storage:', error);
PROD_ERROR('Data migration failed:', error);
```

**Benefits**:
- Development: Full visibility into all operations (204 messages reduced to ~30 in typical workflows)
- Production: Only critical migration failures appear in console
- Bundle: Zero bytes added for all DEV_LOG/DEV_WARN calls

### Example 3: Photo Encryption Service

**Before**:
```typescript
console.error('Photo encryption failed:', error);
```

**After**:
```typescript
import { PROD_ERROR } from '../utils/loggingHelpers';

PROD_ERROR('Photo encryption failed:', error);
```

**Why**: Photo encryption is user-facing. Failures must be visible in production for debugging user issues.

## Migration Path for Existing Logs

When encountering `console.log/warn/error` in the codebase:

1. **If it's an error that users/admins must see** → Use `PROD_ERROR` or appropriate `PROD_*` helper
2. **If it's diagnostic/trace info** → Use `DEV_LOG` or appropriate `DEV_*` helper
3. **If it's a caught non-critical error** → Use `DEV_ERROR`
4. **If it's in tests** → Replace with assertions; remove console output

## Testing Considerations

Tests should **never** depend on console output:

```typescript
// ❌ BAD - Test relies on console
test('creates trip', () => {
  const consoleSpy = vi.spyOn(console, 'log');
  createTrip(tripData);
  expect(consoleSpy).toHaveBeenCalledWith('Trip created');
});

// ✅ GOOD - Test uses assertions
test('creates trip', () => {
  const trip = createTrip(tripData);
  expect(trip.id).toBeDefined();
  expect(trip.date).toBe('2024-01-15');
});
```

## Bundles Size Impact

Production builds without development logging:

- **NIWA Service**: ~50 bytes saved (12 DEV_LOG calls removed)
- **Tide Provider Factory**: ~100 bytes saved (18 DEV_LOG calls removed)
- **Firebase Service**: ~200 bytes saved (30+ DEV_LOG calls removed)
- **Overall Production Bundle**: Development logging adds **0 bytes** (fully tree-shaken)

## Monitoring Production Issues

When production users experience issues:

1. **Enable remote debugging** with conditional production logging:
   ```typescript
   const DEBUG_MODE = localStorage.getItem('debug-mode') === 'true';
   const DEBUG_LOG = DEBUG_MODE ? console.log : () => {};
   ```

2. **Use error reporting** (Sentry, etc.) for structured logging:
   ```typescript
   import * as Sentry from '@sentry/react';
   try {
     // operation
   } catch (error) {
     Sentry.captureException(error);
     PROD_ERROR('Operation failed:', error);
   }
   ```

## Related Files

- **Logging Helpers**: `src/utils/loggingHelpers.ts`
- **NIWA Service**: `src/services/niwaTideService.ts` (example implementation)
- **API Proxy**: `api/niwa-tides.ts` (server-side logging)

## Validation Checklist

When reviewing code:

- [ ] Production logs use `PROD_*` helpers
- [ ] Development logs use `DEV_*` helpers
- [ ] Tests don't depend on console output
- [ ] Service-specific helpers used when available
- [ ] No `console.log/warn/error` calls in new code (use helpers instead)
- [ ] Error boundaries use `console.error` or `PROD_ERROR`
- [ ] API proxy uses consistent `logRequest`/`logError` naming
