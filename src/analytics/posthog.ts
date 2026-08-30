/**
 * PostHog Analytics Integration
 * Monitor de Avaliações Miplace
 * Provides comprehensive analytics, event tracking, and user insights
 * @version 2.0.0
 */

// PostHog will be loaded via npm package
// Using any type to avoid strict type conflicts with posthog-js

// Analytics configuration
const ANALYTICS_CONFIG = {
  API_KEY: import.meta.env.VITE_POSTHOG_KEY || 'dev-key',
  API_HOST: import.meta.env.VITE_POSTHOG_HOST || 'https://app.posthog.com',
  DEBUG: import.meta.env.VITE_DEBUG_LOGGING === 'true',
};

// Store reference for lazy loading
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let posthogInstance: any = null;
let isInitialized = false;

/**
 * Initialize PostHog analytics
 * Call this once when the app loads
 */
export async function initAnalytics(): Promise<void> {
  if (isInitialized) {
    console.warn('[Analytics] Already initialized');
    return;
  }

  // Skip in development if no key provided
  if (!ANALYTICS_CONFIG.API_KEY || ANALYTICS_CONFIG.API_KEY === 'dev-key') {
    console.log('[Analytics] Skipping initialization - no API key');
    return;
  }

  try {
    // Dynamically import posthog-js
    const { default: posthogModule } = await import('posthog-js');
    posthogInstance = posthogModule;

    if (!posthogInstance) {
      throw new Error('Failed to load posthog-js');
    }

    posthogInstance.init(ANALYTICS_CONFIG.API_KEY, {
      api_host: ANALYTICS_CONFIG.API_HOST,
      autocapture: true,
      capture_pageview: true,
      capture_pageleave: true,
      persistence: 'localStorage',
      loaded: (posthog: any) => {
        // Set super properties for all events
        posthog.register({
          app_version: import.meta.env.VITE_APP_VERSION || '2.0.0',
          app_environment: import.meta.env.VITE_APP_ENV || 'production',
          platform: 'web',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          build_time: (window as any).__BUILD_TIME__,
        });

        // Start session recording if feature flag is enabled
        if (posthog.isFeatureEnabled && posthog.isFeatureEnabled('record-session')) {
          posthog.startSessionRecording && posthog.startSessionRecording();
          console.log('[Analytics] Session recording started');
        }

        console.log('[Analytics] PostHog initialized successfully');
      },
      // Privacy settings - sanitize sensitive data
      mask_all_text: false,
      mask_all_element_attributes: false,
      sanitize_properties: (properties: Record<string, unknown>) => {
        // Remove sensitive data from events
        const sanitized = { ...properties };
        delete sanitized.password;
        delete sanitized.token;
        delete sanitized.api_key;
        delete sanitized.senha;
        return sanitized;
      },
    });

    isInitialized = true;
  } catch (error) {
    console.error('[Analytics] Failed to initialize PostHog:', error);
  }
}

/**
 * Track a custom event
 * @param eventName - Name of the event
 * @param properties - Additional event properties
 */
export function track(eventName: string, properties?: Record<string, unknown>): void {
  if (!posthogInstance || !isInitialized) {
    if (ANALYTICS_CONFIG.DEBUG) {
      console.log('[Analytics Debug] Event:', eventName, properties);
    }
    return;
  }

  const enrichedProperties = {
    ...properties,
    timestamp: new Date().toISOString(),
    user_agent: navigator.userAgent,
    screen_size: `${window.innerWidth}x${window.innerHeight}`,
    language: navigator.language,
  };

  posthogInstance.capture(eventName, enrichedProperties);
}

/**
 * Identify a user
 * Call this after successful login
 * @param userId - Unique user identifier (e.g., store ID)
 * @param userProperties - Additional user properties
 */
export function identify(userId: string, userProperties?: Record<string, unknown>): void {
  if (!posthogInstance || !isInitialized) {
    console.log('[Analytics] Cannot identify - not initialized');
    return;
  }

  posthogInstance.identify(userId, {
    ...userProperties,
    identified_at: new Date().toISOString(),
  });

  console.log('[Analytics] User identified:', userId);
}

/**
 * Reset user identification (logout)
 */
export function reset(): void {
  if (!posthogInstance || !isInitialized) {
    return;
  }

  posthogInstance.reset();
  console.log('[Analytics] User reset');
}

/**
 * Set user properties without identifying
 * @param properties - User properties to set
 */
export function setUserProperties(properties: Record<string, unknown>): void {
  if (!posthogInstance || !isInitialized) {
    return;
  }

  posthogInstance.setPersonProperties(properties);
}

/**
 * Increment a numeric user property
 * @param property - Property name
 * @param value - Value to increment by (default: 1)
 */
export function increment(property: string, value: number = 1): void {
  if (!posthogInstance || !isInitialized) {
    return;
  }

  // PostHog people.increment might not exist, use capture instead
  track('Increment Property', { property, value });
}

/**
 * Track page views
 * Call this when navigating between routes
 * @param pageName - Name of the page
 * @param properties - Additional page properties
 */
export function trackPageView(pageName: string, properties?: Record<string, unknown>): void {
  track('Page View', {
    page_name: pageName,
    url: window.location.href,
    referrer: document.referrer,
    ...properties,
  });
}

/**
 * Check if a feature flag is enabled
 * @param flagName - Name of the feature flag
 * @returns Boolean indicating if flag is enabled
 */
export function isFeatureEnabled(flagName: string): boolean {
  if (!posthogInstance || !isInitialized) {
    return false;
  }

  return posthogInstance.isFeatureEnabled(flagName) || false;
}

/**
 * Get the value of a feature flag
 * @param flagName - Name of the feature flag
 * @returns The flag value (string, boolean, or null)
 */
export function getFeatureFlag(flagName: string): string | boolean | null {
  if (!posthogInstance || !isInitialized) {
    return null;
  }

  return posthogInstance.getFeatureFlag(flagName);
}

/**
 * Register callback when feature flags are loaded
 * @param callback - Function to call with flags
 */
export function onFeatureFlags(
  callback: (flags: Record<string, boolean | string>) => void
): void {
  if (!posthogInstance || !isInitialized) {
    return;
  }

  posthogInstance.onFeatureFlags(callback);
}

/**
 * Start session recording manually
 */
export function startSessionRecording(): void {
  if (!posthogInstance || !isInitialized) {
    return;
  }

  posthogInstance.startSessionRecording();
}

/**
 * Stop session recording manually
 */
export function stopSessionRecording(): void {
  if (!posthogInstance || !isInitialized) {
    return;
  }

  posthogInstance.stopSessionRecording();
}

/**
 * Opt out of tracking
 */
export function optOut(): void {
  if (!posthogInstance || !isInitialized) {
    return;
  }

  posthogInstance.opt_out_capturing();
}

/**
 * Opt in to tracking
 */
export function optIn(): void {
  if (!posthogInstance || !isInitialized) {
    return;
  }

  posthogInstance.opt_in_capturing();
}

/**
 * Enable/disable debug mode
 * @param enabled - Whether to enable debug
 */
export function setDebug(enabled: boolean): void {
  if (!posthogInstance || !isInitialized) {
    return;
  }

  posthogInstance.debug(enabled);
}

// ============================================
// Predefined Events
// ============================================

export const AnalyticsEvents = {
  // Authentication
  LOGIN: 'User Login',
  LOGOUT: 'User Logout',
  LOGIN_FAILED: 'Login Failed',

  // Data Management
  ENTRY_CREATED: 'Entry Created',
  ENTRY_UPDATED: 'Entry Updated',
  ENTRY_DELETED: 'Entry Deleted',
  ENTRY_VIEWED: 'Entry Viewed',

  // OCR
  OCR_STARTED: 'OCR Started',
  OCR_COMPLETED: 'OCR Completed',
  OCR_FAILED: 'OCR Failed',

  // Exports
  CSV_EXPORT: 'CSV Export',
  PDF_EXPORT: 'PDF Export',
  SHARE_CLICKED: 'Share Clicked',

  // Navigation
  PAGE_VIEW: 'Page View',
  TAB_CHANGED: 'Tab Changed',
  FILTER_APPLIED: 'Filter Applied',
  SORT_APPLIED: 'Sort Applied',

  // Features
  CHART_VIEWED: 'Chart Viewed',
  INSIGHT_VIEWED: 'Insight Viewed',
  FORECAST_TOGGLED: 'Forecast Toggled',

  // Errors
  ERROR_OCCURRED: 'Error Occurred',
  API_ERROR: 'API Error',
  VALIDATION_ERROR: 'Validation Error',
} as const;

// ============================================
// Convenience Functions for Common Events
// ============================================

/**
 * Track login event
 * @param store - Store name
 * @param success - Whether login was successful
 */
export function trackLogin(store: string, success: boolean): void {
  track(success ? AnalyticsEvents.LOGIN : AnalyticsEvents.LOGIN_FAILED, {
    store,
    success,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Track entry creation
 * @param entry - Entry data
 */
export function trackEntryCreated(entry: {
  id: string;
  store: string;
  hasImage: boolean;
  hasNotes: boolean;
  total: number;
  rating: number;
}): void {
  track(AnalyticsEvents.ENTRY_CREATED, {
    entry_id: entry.id,
    store: entry.store,
    has_image: entry.hasImage,
    has_notes: entry.hasNotes,
    total_reviews: entry.total,
    rating: entry.rating,
  });

  // Increment user properties
  increment('entries_created');
}

/**
 * Track OCR usage
 * @param success - Whether OCR succeeded
 * @param confidence - OCR confidence score
 * @param duration - Time taken in ms
 */
export function trackOCR(success: boolean, confidence?: number, duration?: number): void {
  track(success ? AnalyticsEvents.OCR_COMPLETED : AnalyticsEvents.OCR_FAILED, {
    success,
    confidence,
    duration_ms: duration,
  });
}

/**
 * Track export
 * @param type - Export type (csv, pdf)
 * @param recordCount - Number of records exported
 */
export function trackExport(type: 'csv' | 'pdf', recordCount: number): void {
  const event = type === 'csv' ? AnalyticsEvents.CSV_EXPORT : AnalyticsEvents.PDF_EXPORT;
  track(event, {
    export_type: type,
    record_count: recordCount,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Track error
 * @param error - Error object or message
 * @param context - Additional context
 */
export function trackError(error: Error | string, context?: Record<string, unknown>): void {
  const errorMessage = error instanceof Error ? error.message : error;
  const errorStack = error instanceof Error ? error.stack : undefined;

  track(AnalyticsEvents.ERROR_OCCURRED, {
    error_message: errorMessage,
    error_stack: errorStack,
    ...context,
  });
}

// ============================================
// Initialization for Different Scenarios
// ============================================

/**
 * Initialize analytics for authenticated user
 * @param userId - User/store ID
 * @param storeName - Store name
 */
export async function initForUser(userId: string, storeName: string): Promise<void> {
  await initAnalytics();
  identify(userId, {
    store_name: storeName,
    login_time: new Date().toISOString(),
  });
}

/**
 * Clean up analytics on logout
 */
export function cleanup(): void {
  reset();
  isInitialized = false;
  posthogInstance = null;
}

export default {
  init: initAnalytics,
  initForUser,
  track,
  trackPageView,
  trackLogin,
  trackEntryCreated,
  trackOCR,
  trackExport,
  trackError,
  identify,
  reset,
  setUserProperties,
  increment,
  isFeatureEnabled,
  getFeatureFlag,
  onFeatureFlags,
  startSessionRecording,
  stopSessionRecording,
  optOut,
  optIn,
  setDebug,
  cleanup,
  AnalyticsEvents,
};
