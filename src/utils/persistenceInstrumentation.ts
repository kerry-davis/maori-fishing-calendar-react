/**
 * Persistence Layer Instrumentation System
 * 
 * This instrument tracks all persistence artifacts that survive logout to document
 * cross-account contamination paths and ensure comprehensive cleanup coverage.
 * Enhanced with automatic detection of browser storage events and comprehensive
 * leakage path analysis during login/logout flows.
 */

// Type definitions for persistence tracking
export interface PersistenceArtifact {
  layer: 'localStorage' | 'sessionStorage' | 'indexedDB' | 'firebase' | 'memory' | 'cache' | 'url' | 'eventListener' | 'timeout' | 'interval';
  key: string;
  valueType: 'string' | 'object' | 'number' | 'boolean' | 'array';
  value: unknown;
  riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  userId?: string;
  timestamp: number;
  source: string; // Function that created/modified this artifact
  metadata?: Record<string, unknown>;
}

export interface LeakageReport {
  userId: string;
  sessionStart: number;
  sessionEnd: number;
  logoutMethodUsed: string;
  artifactsBeforeLogout: PersistenceArtifact[];
  artifactsAfterCleanup: PersistenceArtifact[];
  leakagePaths: string[];
  highRiskCount: number;
  mediumRiskCount: number;
  totalArtifactsRemaining: number;
  criticalIssues: string[];
  recommendations: string[];
}

// Global instrumentation state
class PersistenceInstrumentation {
  private artifactsStore: Map<string, PersistenceArtifact> = new Map();
  private sessionReport: LeakageReport | null = null;
  private listeners: Set<() => void> = new Set();
  private storageEventListeners: ((e: StorageEvent) => void)[] = [];
  private isTracking = false;

  /**
   * Register a persistence artifact for tracking
   */
  registerArtifact(
    layer: PersistenceArtifact['layer'],
    key: string,
    value: unknown,
    riskLevel: PersistenceArtifact['riskLevel'],
    source: string,
    userId?: string,
    metadata?: Record<string, unknown>
  ): void {
    const artifact: PersistenceArtifact = {
      layer,
      key,
      valueType: this.getValueType(value),
      value: typeof value === 'object' ? JSON.stringify(value) : value,
      riskLevel,
      userId,
      timestamp: Date.now(),
      source,
      metadata
    };
    
    this.artifactsStore.set(`${layer}:${key}`, artifact);
    this.addToReport(artifact);
  }

  private getValueType(value: unknown): PersistenceArtifact['valueType'] {
    if (Array.isArray(value)) {
      return 'array';
    }
    switch (typeof value) {
      case 'number':
        return 'number';
      case 'boolean':
        return 'boolean';
      case 'object':
        return value === null ? 'string' : 'object';
      default:
        return 'string';
    }
  }

  /**
   * Detect persistence artifacts that escaped cleanup
   */
  detectLeaks(
    initialArtifacts: PersistenceArtifact[],
    currentUserId: string,
    logoutMethod: string
  ): LeakageReport {
    const artifactsBefore = new Map(initialArtifacts.map(a => [`${a.layer}:${a.key}`, a]));
    
    // Detect what remains
    const remainingArtifacts: PersistenceArtifact[] = [];
    const leakagePaths: string[] = [];
    
    for (const [key, artifact] of this.artifactsStore) {
      if (artifactsBefore.has(key)) {
        artifactsBefore.delete(key);
        remainingArtifacts.push(artifact);
        
        // If artifact from previous user, that's a leak
        if (artifact.userId !== currentUserId) {
          leakagePaths.push(`${artifact.layer}:${artifact.key} (user ${artifact.userId} → ${currentUserId})`);
        }
      } else {
        // New artifact created after cleanup
        if (artifact.userId !== currentUserId) {
          leakagePaths.push(`${artifact.layer}:${artifact.key} (new artifact from user ${artifact.userId})`);
        }
        remainingArtifacts.push(artifact);
      }
    }
    
    return this.createReport(
      currentUserId,
      remainingArtifacts,
      leakagePaths,
      logoutMethod
    );
  }

  /**
   * Create comprehensive leakage report
   */
  private createReport(
    userId: string,
    remainingArtifacts: PersistenceArtifact[],
    leakagePaths: string[],
    logoutMethod: string
  ): LeakageReport {
    const riskAssessment = this.assessRisk(remainingArtifacts);
    
    const report: LeakageReport = {
      userId,
      sessionStart: Date.now(),
      sessionEnd: Date.now(),
      logoutMethodUsed: logoutMethod,
      artifactsBeforeLogout: Array.from(this.artifactsStore.values()),
      artifactsAfterCleanup: remainingArtifacts,
      leakagePaths,
      ...riskAssessment,
      recommendations: this.generateRecommendations(remainingArtifacts)
    };
    
    this.sessionReport = report;
    return report;
  }

  /**
   * Risk assessment for remaining artifacts
   */
  private assessRisk(artifacts: PersistenceArtifact[]): {
    highRiskCount: number;
    mediumRiskCount: number;
    totalArtifactsRemaining: number;
    criticalIssues: string[];
  } {
    const critical = artifacts.filter(a => a.riskLevel === 'CRITICAL').length;
    const medium = artifacts.filter(a => a.riskLevel === 'MEDIUM').length;
    
    const issues = artifacts
      .filter(a => a.riskLevel === 'CRITICAL')
      .map(a => `CRITICAL: ${a.layer}:${a.key} (user: ${a.userId})`);

    return {
      highRiskCount: critical,
      mediumRiskCount: medium,
      totalArtifactsRemaining: artifacts.length,
      criticalIssues: issues
    };
  }

  /**
   * Generate cleanup recommendations
   */
  private generateRecommendations(artifacts: PersistenceArtifact[]): string[] {
    const recommendations: string[] = [];
    
    const layerStats = this.analyzeByLayer(artifacts);
    
    if (layerStats.localStorage.remain > 0) {
      recommendations.push(`Add localStorage cleanup for ${layerStats.localStorage.remain} keys`);
    }
    
    if (layerStats.sessionStorage.remain > 0) {
      recommendations.push(`Add sessionStorage cleanup for ${layerStats.sessionStorage.remain} keys`);
    }
    
    if (layerStats.indexedDB.remain > 0) {
      recommendations.push(`Add IndexedDB cleanup for ${layerStats.indexedDB.remain} items`);
    }
    
    if (layerStats.memory.remain > 0) {
      recommendations.push(`Implement in-memory cache clearing for ${layerStats.memory.remain} items`);
    }
    
    return recommendations;
  }

  /**
   * Analyze artifacts by persistence layer
   */
  private analyzeByLayer(artifacts: PersistenceArtifact[]): Record<string, any> {
    const layers = {
      localStorage: { remain: 0, total: 0 },
      sessionStorage: { remain: 0, total: 0 },
      indexedDB: { remain: 0, total: 0 },
      firebase: { remain: 0, total: 0 },
      memory: { remain: 0, total: 0 },
      cache: { remain: 0, total: 0 },
      url: { remain: 0, total: 0 },
      eventListener: { remain: 0, total: 0 },
      timeout: { remain: 0, total: 0 },
      interval: { remain: 0, total: 0 }
    };
    
    artifacts.forEach(artifact => {
      const layer = layers[artifact.layer];
      layer.total++;
      if (artifact.riskLevel === 'LOW') {
        return;
      }
      layer.remain++;
    });
    
    return layers as Record<string, any>;
  }

  /**
   * Add artifact to current report
   */
  private addToReport(artifact: PersistenceArtifact): void {
    if (!this.sessionReport) {
      return;
    }
    this.sessionReport.artifactsBeforeLogout.push(artifact);
  }

  /**
   * Get current session report
   */
  getReport(): LeakageReport | null {
    return this.sessionReport;
  }

  /**
   * Start comprehensive instrumentation session for login/logout flow tracking
   */
  startSession(): void {
    console.log('🔍 Starting persistence instrumentation session...');
    this.artifactsStore.clear();
    this.listeners.clear();
    this.sessionReport = {
      userId: 'pending',
      sessionStart: Date.now(),
      sessionEnd: Date.now(),
      logoutMethodUsed: 'pending',
      artifactsBeforeLogout: [],
      artifactsAfterCleanup: [],
      leakagePaths: [],
      highRiskCount: 0,
      mediumRiskCount: 0,
      totalArtifactsRemaining: 0,
      criticalIssues: [],
      recommendations: []
    };
    this.isTracking = true;
    
    // Capture initial state
    this.captureCurrentState();
    
    // Set up storage event listeners to track changes
    this.setupStorageEventListeners();
  }

  /**
   * End instrumentation session and generate comprehensive report
   */
  endSession(currentUserId: string, logoutMethod: string): LeakageReport {
    if (!this.isTracking) {
      console.warn('⚠️ No active tracking session to end');
      return this.createEmptyReport(currentUserId, logoutMethod);
    }
    
    console.log('📊 Ending persistence instrumentation session...');
    
    // Capture final state after logout/cleanup
    this.captureCurrentState();
    
    // Detect what artifacts survived cleanup
    const remainingArtifacts = Array.from(this.artifactsStore.values());
    
    // Generate leakage paths
    const leakagePaths = this.identifyLeakagePaths(remainingArtifacts, currentUserId);
    
    this.isTracking = false;
    this.cleanupStorageEventListeners();
    
    const report: LeakageReport = {
      userId: currentUserId,
      sessionStart: Date.now(), // Would need to store the actual start time
      sessionEnd: Date.now(),
      logoutMethodUsed: logoutMethod,
      artifactsBeforeLogout: Array.from(this.artifactsStore.values()),
      artifactsAfterCleanup: remainingArtifacts,
      leakagePaths,
      ...this.assessRisk(remainingArtifacts),
      recommendations: this.generateRecommendations(remainingArtifacts)
    };
    
    // Log summary for debugging
    console.log('📋 Persistence Instrumentation Report:', {
      userId: currentUserId,
      logoutMethod,
      totalArtifacts: this.artifactsStore.size,
      leakedArtifacts: remainingArtifacts.length,
      leakagePaths: leakagePaths.length,
      riskLevel: this.assessRisk(remainingArtifacts).highRiskCount > 0 ? 'HIGH' : 
                remainingArtifacts.length > 0 ? 'MEDIUM' : 'LOW'
    });
    
    // Clear for next session while keeping summary accessible
    this.sessionReport = report;
    this.artifactsStore.clear();
    
    return report;
  }
  
  /**
   * Create empty report for failed tracking sessions
   */
  private createEmptyReport(userId: string, logoutMethod: string): LeakageReport {
    return {
      userId,
      sessionStart: Date.now(),
      sessionEnd: Date.now(),
      logoutMethodUsed: logoutMethod,
      artifactsBeforeLogout: [],
      artifactsAfterCleanup: [],
      leakagePaths: [],
      highRiskCount: 0,
      mediumRiskCount: 0,
      totalArtifactsRemaining: 0,
      criticalIssues: [],
      recommendations: ['Enable persistence instrumentation tracking']
    };
  }
  
  /**
   * Identify specific leakage paths
   */
  private identifyLeakagePaths(artifacts: PersistenceArtifact[], currentUserId: string): string[] {
    const paths: string[] = [];
    
    artifacts.forEach(artifact => {
      if (artifact.userId && artifact.userId !== currentUserId) {
        paths.push(`${artifact.layer}:${artifact.key} (contamination from user ${artifact.userId})`);
      } else if (!artifact.userId) {
        paths.push(`${artifact.layer}:${artifact.key} (non-user-specific persistence)`);
      }
      
      // Additional path analysis
      if (artifact.layer === 'localStorage' && artifact.key.includes('modal')) {
        paths.push(`Modal state leakage: ${artifact.key} persisted in ${artifact.layer}`);
      }
      
      if (artifact.layer === 'url' && artifact.key === 'hash') {
        paths.push(`URL hash leakage: ${artifact.value} preserved after logout`);
      }
    });
    
    return paths;
  }

  /**
   * Get instrumentation summary
   */
  getSummary(): { totalArtifacts: number; layerStats: Record<string, any> } {
    return {
      totalArtifacts: this.artifactsStore.size,
      layerStats: this.analyzeByLayer(Array.from(this.artifactsStore.values()))
    };
  }

  /**
   * Export current session data for debugging
   */
  exportData(): { artifacts: PersistenceArtifact[]; summary: Record<string, any> } {
    return {
      artifacts: Array.from(this.artifactsStore.values()),
      summary: this.getSummary()
    };
  }

  /**
   * Capture current browser/storage state as baseline
   */
  private captureCurrentState(): void {
    console.log('📊 Capturing current persistence state...');
    
    // Capture localStorage
    if (typeof localStorage !== 'undefined') {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const value = localStorage.getItem(key);
          const riskLevel = this.assessKeyRisk(key);
          this.registerArtifact('localStorage', key, value, riskLevel, 'captureCurrentState');
        }
      }
    }
    
    // Capture sessionStorage
    if (typeof sessionStorage !== 'undefined') {
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key) {
          const value = sessionStorage.getItem(key);
          const riskLevel = this.assessKeyRisk(key);
          this.registerArtifact('sessionStorage', key, value, riskLevel, 'captureCurrentState');
        }
      }
    }
    
    // Capture URL hash if present
    if (typeof window !== 'undefined' && window.location.hash) {
      this.registerArtifact('url', 'hash', window.location.hash, 'MEDIUM', 'captureCurrentState');
    }
    
    console.log(`✅ Captured ${this.artifactsStore.size} persistence artifacts`);
  }
  
  /**
   * Assess risk level based on key patterns
   */
  private assessKeyRisk(key: string): PersistenceArtifact['riskLevel'] {
    const criticalKeys = ['userLocation', 'tacklebox', 'gearTypes', 'authToken', 'encryptionKey'];
    const highKeys = ['theme', 'pendingModal', 'settingsModalOpen', 'lastActiveUser', 'authState'];
    const mediumKeys = ['temp', 'cache', 'settings'];
    
    if (criticalKeys.some(k => key.includes(k))) return 'CRITICAL';
    if (highKeys.some(k => key.includes(k))) return 'HIGH';
    if (mediumKeys.some(k => key.includes(k))) return 'MEDIUM';
    return 'LOW';
  }
  
  /**
   * Set up storage event listeners to track real-time changes
   */
  private setupStorageEventListeners(): void {
    if (typeof window === 'undefined') return;
    
    // Listen to storage events
    const storageListener = (e: StorageEvent) => {
      if (!this.isTracking) return;
      
      if (e.key) {
        const riskLevel = this.assessKeyRisk(e.key);
        if (e.newValue !== null) {
          this.registerArtifact(
            'localStorage', 
            e.key, 
            e.newValue, 
            riskLevel, 
            'storageListener'
          );
        } else {
          // Item was removed - track this as cleanup
          console.log(`🗑️ Storage item removed by other context: ${e.key}`);
        }
      }
    };
    
    window.addEventListener('storage', storageListener);
    this.storageEventListeners.push(storageListener);
    
    // Monitor URL hash changes
    const hashListener = () => {
      if (!this.isTracking) return;
      
      if (window.location.hash) {
        this.registerArtifact('url', 'hash', window.location.hash, 'MEDIUM', 'hashChangeListener');
      }
    };
    
    window.addEventListener('hashchange', hashListener);
    this.storageEventListeners.push(hashListener as any);
    
    console.log('👂 Set up storage event listeners');
  }
  
  /**
   * Clean up storage event listeners
   */
  private cleanupStorageEventListeners(): void {
    if (typeof window === 'undefined') return;
    
    this.storageEventListeners.forEach(listener => {
      try {
        window.removeEventListener('storage', listener);
        window.removeEventListener('hashchange', listener as any);
      } catch (error) {
        console.warn('Failed to cleanup storage listener:', error);
      }
    });
    
    this.storageEventListeners = [];
    console.log('🧹 Cleaned up storage event listeners');
  }

  /**
   * Cleanup and reset instrumentation (for testing)
   */
  reset(): void {
    this.cleanupStorageEventListeners();
    this.artifactsStore.clear();
    this.listeners.clear();
    this.sessionReport = null;
    this.isTracking = false;
  }
}

// Singleton instance for global tracking
export const persistenceInstrumentation = new PersistenceInstrumentation();

// Utility functions for automatic tracking
export function trackArtifact(
  layer: PersistenceArtifact['layer'],
  key: string,
  value: unknown,
  riskLevel: PersistenceArtifact['riskLevel'] = 'LOW',
  userId?: string,
  source = 'trackArtifact'
): void {
  persistenceInstrumentation.registerArtifact(layer, key, value, riskLevel, source, userId);
}

// Hook for React components to automatically track their state
export function usePersistenceTracking(componentName: string) {
  // This would be a React hook that automatically tracks component state changes
  // For now, we provide the utility function
  return {
    trackState: (key: string, value: any, riskLevel?: string) => {
      const resolvedRisk = (riskLevel ?? 'LOW') as PersistenceArtifact['riskLevel'];
      trackArtifact('memory', `${componentName}.${key}`, value, resolvedRisk, undefined, componentName);
    },
    trackCache: (key: string, value: any) => {
      trackArtifact('memory', `${componentName}.cache.${key}`, value, 'MEDIUM', undefined, componentName);
    },
    trackListener: (key: string) => {
      trackArtifact('eventListener', `listener.${key}`, true, 'LOW', undefined, componentName);
    }
  };
}

// Browser API safety wrapper
export class BrowserAPISafe {
  /**
   * Safe localStorage access with error handling
   */
  static safeLocalStorage(key: string, operation: 'get' | 'set' | 'remove' | 'clear'): any {
    try {
      if (typeof localStorage === 'undefined') {
        console.warn('localStorage not available');
        return null;
      }
      
      switch (operation) {
        case 'get':
          return localStorage.getItem(key);
        case 'set':
          return localStorage.setItem(key, JSON.stringify(arguments[1]));
        case 'remove':
          return localStorage.removeItem(key);
        case 'clear':
          return localStorage.clear();
        default:
          return null;
      }
    } catch (error) {
      console.warn(`localStorage error (${operation} on ${key}):`, error);
      return null;
    }
  }

  /**
   * Safe sessionStorage access with error handling
   */
  static safeSessionStorage(key: string, operation: 'get' | 'set' | 'remove' | 'clear'): any {
    try {
      if (typeof sessionStorage === 'undefined') {
        console.warn('sessionStorage not available');
        return null;
      }
      
      switch (operation) {
        case 'get':
          return sessionStorage.getItem(key);
        case 'set':
          return sessionStorage.setItem(key, JSON.stringify(arguments[1]));
        case 'remove':
          return sessionStorage.removeItem(key);
        case 'clear':
          return sessionStorage.clear();
        default:
          return null;
      }
    } catch (error) {
      console.warn(`sessionStorage error (${operation} on ${key}):`, error);
      return null;
    }
  }

  /**
   * Safe service worker cache access
   */
  static safeCacheAccess(cacheName: string, operation: 'delete' | 'clear'): Promise<boolean> {
    try {
      if (typeof caches === 'undefined') {
        console.warn('Cache API not available');
        return Promise.resolve(false);
      }
      
      switch (operation) {
        case 'delete':
          return caches.delete(cacheName);
        case 'clear':
          // Clear all caches
          return caches.keys().then(keys => {
            return Promise.all(
              keys.map(name => caches.delete(name))
            ).then(() => true);
          });
        default:
          return Promise.resolve(false);
      }
    } catch (error) {
      console.warn(`Cache API error (${operation} on ${cacheName}):`, error);
      return Promise.resolve(false);
    }
  }

  /**
   * Safe timeout/interval cleanup
   */
  static safeTimerCleanup(): void {
    try {
      // Clear timeouts
      const maxTimeoutId = Number(setTimeout(() => {}, 1));
      for (let id = 1; id <= maxTimeoutId; id++) {
        clearTimeout(id);
      }
      
      // Clear intervals
      const maxIntervalId = Number(setInterval(() => {}, 1000));
      for (let id = 1; id <= maxIntervalId; id++) {
        clearInterval(id);
      }
    } catch (error) {
      console.warn('Timer cleanup error:', error);
    }
  }

  /**
   * Safe addEventListener cleanup
   */
  static safeEventListenerCleanup(): void {
    try {
      // Get all window listeners by creating an event
      const events = [
        'load', 'unload', 'beforeunload', 'storage', 'message',
        'hashchange', 'popstate', 'devicemotionchange',
        'visibilitychange', 'pagehide', 'pageshow', 
        'resize', 'scroll', 'focus', 'blur', 'orientationchange'
      ];
      
      events.forEach(event => {
        try {
          // Clone all event listeners (this is a cleanup attempt)
          const listeners = (window as any).getEventListeners?.(event, []) || [];
          listeners.forEach((listener: any) => {
            try {
              window.removeEventListener(event, listener.listener, listener.options);
            } catch (error) {
              // Ignore cleanup errors
            }
          });
        } catch (error) {
          console.warn(`Event listener cleanup error for ${event}:`, error);
        }
      });
    } catch (error) {
      console.warn('Event listener cleanup error:', error);
    }
  }
}

export default persistenceInstrumentation;
