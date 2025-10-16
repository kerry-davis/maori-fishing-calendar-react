/**
 * Centralized Logging Helpers
 * 
 * Logging Strategy:
 * - Production logs: Critical errors, security issues, auth failures (always logged)
 * - Development logs: Diagnostics, parameters, successful operations (DEV_* only)
 * 
 * Tree-shaking: Ternary operators with import.meta.env.DEV enable bundlers to remove
 * development-only logging calls during production builds, keeping console output clean.
 */

// ============================================================================
// DEVELOPMENT-ONLY LOGGING (tree-shaken in production)
// ============================================================================

/**
 * Development-only info logging - for diagnostics and traces
 * @example DEV_LOG('NIWA request sent:', { lat, lon })
 */
export const DEV_LOG = import.meta.env.DEV ? console.log : () => {};

/**
 * Development-only warning logging - for non-critical issues
 * @example DEV_WARN('Fallback provider used:', { reason })
 */
export const DEV_WARN = import.meta.env.DEV ? console.warn : () => {};

/**
 * Development-only error logging - for caught errors that don't need user attention
 * @example DEV_ERROR('Parse attempt failed:', error)
 */
export const DEV_ERROR = import.meta.env.DEV ? console.error : () => {};

// ============================================================================
// PRODUCTION LOGGING (always visible - use sparingly!)
// ============================================================================

/**
 * Security issue logging - must always be visible for production debugging
 * @example PROD_SECURITY('Direct API call attempted:', url)
 */
export function PROD_SECURITY(message: string, ...args: any[]): void {
  console.error(`🔒 SECURITY: ${message}`, ...args);
}

/**
 * Critical error that impacts functionality - must always be visible
 * @example PROD_ERROR('Database connection failed:', error)
 */
export function PROD_ERROR(message: string, ...args: any[]): void {
  console.error(`❌ ERROR: ${message}`, ...args);
}

/**
 * Configuration warning - missing setup that may cause features to fail
 * @example PROD_WARN('NIWA_PROXY_URL not configured')
 */
export function PROD_WARN(message: string, ...args: any[]): void {
  console.warn(`⚠️ WARNING: ${message}`, ...args);
}

/**
 * User-facing info (e.g., data import status) - rarely used
 * @example PROD_INFO('Importing 42 trips from legacy app')
 */
export function PROD_INFO(message: string, ...args: any[]): void {
  console.log(`ℹ️ INFO: ${message}`, ...args);
}

// ============================================================================
// SERVICE-SPECIFIC HELPERS (categorized by domain)
// ============================================================================

/**
 * Tide service diagnostics - logs provider selection, API responses, fallbacks
 */
export const TideLogging = {
  dev: {
    providerAttempt: (provider: string, location: string) =>
      DEV_LOG(`🌊 Tide: Attempting ${provider} for ${location}`),
    providerSuccess: (provider: string, pointCount: number) =>
      DEV_LOG(`✅ Tide: ${provider} returned ${pointCount} points`),
    providerFallback: (from: string, to: string, reason: string) =>
      DEV_WARN(`🌊 Tide: Switching from ${from} to ${to} (${reason})`),
    parametersUsed: (params: Record<string, any>) =>
      DEV_LOG('🌊 Tide parameters:', params),
  },
  prod: {
    allProvidersFailed: (error: string) =>
      PROD_ERROR(`All tide providers failed: ${error}`),
    apiKeyMissing: (provider: string) =>
      PROD_SECURITY(`API key missing for ${provider}`),
  },
};

/**
 * Database service diagnostics - schema migrations, query results, errors
 */
export const DatabaseLogging = {
  dev: {
    schemaUpgrade: (version: number) =>
      DEV_LOG(`📦 Database: Upgrading to schema v${version}`),
    storeCreated: (storeName: string) =>
      DEV_LOG(`✅ Database: Created store '${storeName}'`),
    migrationComplete: (storeName: string) =>
      DEV_LOG(`✅ Database: Migrated store '${storeName}'`),
    queryResult: (operation: string, count: number) =>
      DEV_LOG(`📊 Database: ${operation} returned ${count} records`),
  },
  prod: {
    initializationFailed: (error: string) =>
      PROD_ERROR(`Database initialization failed: ${error}`),
    corruptionDetected: () =>
      PROD_ERROR('Database corruption detected - attempting recovery'),
  },
};

/**
 * Firebase service diagnostics - authentication, data sync, uploads
 */
export const FirebaseLogging = {
  dev: {
    userSwitched: (userId: string, mode: 'authenticated' | 'guest') =>
      DEV_LOG(`🔐 Firebase: Switched to ${mode} mode (${userId})`),
    queryResult: (operation: string, count: number) =>
      DEV_LOG(`☁️ Firebase: ${operation} returned ${count} records`),
    fallbackToLocal: (reason: string) =>
      DEV_WARN(`☁️ Firebase: Falling back to local storage (${reason})`),
    uploadProgress: (fileName: string, progress: number) =>
      DEV_LOG(`⬆️ Firebase: Uploading ${fileName} (${progress}%)`),
  },
  prod: {
    uploadFailed: (error: string) =>
      PROD_ERROR(`Firebase upload failed: ${error}`),
    authenticationFailed: (reason: string) =>
      PROD_ERROR(`Firebase authentication failed: ${reason}`),
  },
};

/**
 * Photo migration diagnostics - batch processing, compression, uploads
 */
export const PhotoLogging = {
  dev: {
    batchStarted: (batchId: string, count: number) =>
      DEV_LOG(`📸 Photos: Batch ${batchId} started (${count} images)`),
    photoMigrated: (photoId: string, size: number) =>
      DEV_LOG(`✅ Photos: Migrated ${photoId} (${Math.round(size / 1024)}KB)`),
    compressionStats: (original: number, compressed: number) =>
      DEV_LOG(`📊 Photos: Compression ${original}B → ${compressed}B (${Math.round((1 - compressed/original) * 100)}%)`),
    timeoutWarning: (batchId: string, ms: number) =>
      DEV_WARN(`⏱️ Photos: Batch ${batchId} timed out after ${ms}ms`),
  },
  prod: {
    migrationFailed: (photoId: string, error: string) =>
      PROD_ERROR(`Photo migration failed (${photoId}): ${error}`),
    corruptionDetected: (photoId: string) =>
      PROD_WARN(`Photo data may be corrupted (${photoId}) - will skip`),
  },
};

/**
 * Encryption/Security diagnostics - key derivation, encryption failures
 */
export const SecurityLogging = {
  dev: {
    encryptionAttempt: (dataSize: number, algorithm: string) =>
      DEV_LOG(`🔐 Encryption: Processing ${dataSize}B with ${algorithm}`),
    keyDerivedSuccess: (keyType: string) =>
      DEV_LOG(`✅ Encryption: ${keyType} key derived successfully`),
  },
  prod: {
    encryptionFailed: (reason: string) =>
      PROD_ERROR(`Encryption failed: ${reason}`),
    decryptionFailed: (reason: string) =>
      PROD_WARN(`Decryption failed - data may be inaccessible: ${reason}`),
    directApiAttempt: (url: string) =>
      PROD_SECURITY(`Direct API call detected - security violation: ${url}`),
  },
};

/**
 * User context/Session diagnostics - login, logout, persistence
 */
export const SessionLogging = {
  dev: {
    storageOperation: (operation: string, key: string) =>
      DEV_LOG(`💾 Session: ${operation} (${key})`),
    contextCleared: (items: number) =>
      DEV_LOG(`🧹 Session: Cleared ${items} context items`),
    logoutStarted: () =>
      DEV_LOG('🔐 Session: Logout initiated'),
  },
  prod: {
    storageQuotaExceeded: () =>
      PROD_WARN('Session storage quota exceeded - some data may not persist'),
    persistenceFailed: (reason: string) =>
      PROD_ERROR(`Failed to persist session: ${reason}`),
  },
};

/**
 * Component/UI diagnostics - modal lifecycle, form submissions, error boundaries
 */
export const UILogging = {
  dev: {
    modalOpened: (modalId: string) =>
      DEV_LOG(`🔓 UI: Modal opened (${modalId})`),
    modalClosed: (modalId: string) =>
      DEV_LOG(`🔒 UI: Modal closed (${modalId})`),
    formSubmitted: (formType: string, dataSize: number) =>
      DEV_LOG(`📝 UI: ${formType} submitted (${dataSize} bytes)`),
    renderOptimization: (componentName: string, skippedMs: number) =>
      DEV_LOG(`⚡ UI: ${componentName} render optimization saved ${skippedMs}ms`),
  },
  prod: {
    errorBoundaryTriggered: (componentName: string, error: string) =>
      PROD_ERROR(`Component error (${componentName}): ${error}`),
    formValidationFailed: (fieldName: string, reason: string) =>
      PROD_WARN(`Form validation failed (${fieldName}): ${reason}`),
  },
};

/**
 * Analytics/Tracking diagnostics - event collection, conversions, metrics
 */
export const AnalyticsLogging = {
  dev: {
    eventTracked: (eventName: string, properties: Record<string, any>) =>
      DEV_LOG(`📊 Analytics: ${eventName}`, properties),
    conversionRecorded: (userId: string, conversionType: string) =>
      DEV_LOG(`💰 Analytics: Conversion recorded (${userId}, ${conversionType})`),
  },
  prod: {
    trackingFailed: (reason: string) =>
      PROD_WARN(`Analytics tracking failed: ${reason}`),
  },
};

// ============================================================================
// LEGACY SUPPORT - For backward compatibility
// ============================================================================

/**
 * Formats a scope prefix for logs (e.g., "[NIWA]" or "[Firebase]")
 * @example logWithScope('NIWA', 'Processing tide data')
 */
export function logWithScope(scope: string, message: string, ...args: any[]): void {
  DEV_LOG(`[${scope}] ${message}`, ...args);
}

/**
 * Batch log operations for reduced console noise during heavy processing
 */
export function batchLog(scope: string, operations: string[]): void {
  if (!import.meta.env.DEV) return;
  console.log(`[${scope}] Batch operations (${operations.length} total):`);
  operations.forEach((op, i) => console.log(`  ${i + 1}. ${op}`));
}
