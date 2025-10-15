/**
 * Analytics for guest-to-authenticated conversion tracking
 */

export interface GuestConversionAnalytics {
  guestSessions: number;
  authenticatedConversions: number;
  conversionRate: number;
  dates: {
    firstGuestSession: string | null;
    lastGuestSession: string | null;
    firstConversion: string | null;
    lastConversion: string | null;
  };
}

class GuestConversionTrackingService {
  private ANALYTICS_KEY = 'guestConversionAnalytics';
  
  /**
   * Record when a guest session starts
   */
  recordGuestSession(_sessionId: string): void {
    try {
      const analytics = this.getAnalytics();
      analytics.guestSessions += 1;
      
      const now = new Date().toISOString();
      if (!analytics.dates.firstGuestSession) {
        analytics.dates.firstGuestSession = now;
      }
      analytics.dates.lastGuestSession = now;
      
      this.saveAnalytics(analytics);
    } catch (error) {
      console.warn('[analytics] Failed to record guest session:', error);
    }
  }
  
  /**
   * Record when a guest converts to an authenticated user
   */
  recordConversion(userId: string, _guestSessionId?: string): void {
    try {
      const analytics = this.getAnalytics();
      analytics.authenticatedConversions += 1;
      
      const now = new Date().toISOString();
      if (!analytics.dates.firstConversion) {
        analytics.dates.firstConversion = now;
      }
      analytics.dates.lastConversion = now;
      
      // Calculate conversion rate
      if (analytics.guestSessions > 0) {
        analytics.conversionRate = (analytics.authenticatedConversions / analytics.guestSessions) * 100;
      }
      
      this.saveAnalytics(analytics);
      console.log(`[analytics] Conversion recorded for user ${userId}`, analytics);
    } catch (error) {
      console.warn('[analytics] Failed to record conversion:', error);
    }
  }
  
  /**
   * Get current analytics data
   */
  getAnalytics(): GuestConversionAnalytics {
    try {
      const stored = localStorage.getItem(this.ANALYTICS_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.warn('[analytics] Failed to load analytics:', error);
    }
    
    // Return default analytics object
    return {
      guestSessions: 0,
      authenticatedConversions: 0,
      conversionRate: 0,
      dates: {
        firstGuestSession: null,
        lastGuestSession: null,
        firstConversion: null,
        lastConversion: null
      }
    };
  }
  
  /**
   * Save analytics to localStorage
   */
  private saveAnalytics(analytics: GuestConversionAnalytics): void {
    try {
      localStorage.setItem(this.ANALYTICS_KEY, JSON.stringify(analytics));
    } catch (error) {
      console.warn('[analytics] Failed to save analytics:', error);
    }
  }
  
  /**
   * Reset analytics (for testing purposes)
   */
  reset(): void {
    try {
      localStorage.removeItem(this.ANALYTICS_KEY);
    } catch (error) {
      console.warn('[analytics] Failed to reset analytics:', error);
    }
  }
  
  /**
   * Get formatted analytics report
   */
  getFormattedReport(): string {
    const analytics = this.getAnalytics();
    
    return `
Guest Conversion Analytics Report:
- Total Guest Sessions: ${analytics.guestSessions}
- Total Conversions: ${analytics.authenticatedConversions}
- Conversion Rate: ${analytics.conversionRate.toFixed(2)}%
- First Guest Session: ${analytics.dates.firstGuestSession || 'N/A'}
- Last Guest Session: ${analytics.dates.lastGuestSession || 'N/A'}
- First Conversion: ${analytics.dates.firstConversion || 'N/A'}
- Last Conversion: ${analytics.dates.lastConversion || 'N/A'}
    `.trim();
  }
}

export const guestConversionTrackingService = new GuestConversionTrackingService();