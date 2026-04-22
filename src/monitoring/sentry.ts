// ═══════════════════════════════════════════════════════════════
// SENTRY - Error Tracking & Performance Monitoring
// ═══════════════════════════════════════════════════════════════

import * as Sentry from '@sentry/browser';
import { getCurrentStore } from '../state';

declare const __APP_VERSION__: string;
declare const __APP_ENV__: string;

interface PerformanceMetrics {
  firebaseInitTime: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  timeToInteractive: number;
}

// ═══════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════

export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  
  if (!dsn) {
    console.warn('[Sentry] DSN not configured, skipping initialization');
    return;
  }

  Sentry.init({
    dsn,
    environment: __APP_ENV__ || import.meta.env.MODE,
    release: __APP_VERSION__ || '2.0.0',

    // Performance Monitoring
    integrations: [
      Sentry.browserTracingIntegration(),
      // Session Replay for debugging
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
        maskAllInputs: false,
        // Only mask sensitive fields
        block: ['[data-sentry-block]'],
        mask: ['[data-sentry-mask]'],
      }),
    ],

    // Sampling rates
    tracesSampleRate: __APP_ENV__ === 'production' ? 0.1 : 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    // Before send - sanitize sensitive data
    beforeSend(event) {
      // Remove Firebase tokens from breadcrumbs
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map((crumb: any) => {
          if (crumb.category === 'xhr' && crumb.data?.url) {
            // Remove sensitive query params
            try {
              const url = new URL(crumb.data.url);
              url.searchParams.delete('token');
              url.searchParams.delete('key');
              crumb.data.url = url.toString();
            } catch {
              // Invalid URL, ignore
            }
          }
          return crumb;
        });
      }

      // Remove PII from user context
      if (event.user) {
        delete (event.user as any).email;
        delete (event.user as any).ip_address;
      }

      return event;
    },
    
    // Ignore certain errors
    ignoreErrors: [
      // Browser extensions
      /^.*extension.*$/i,
      /^.*plugin.*$/i,
      // Network errors (handled separately)
      /^.*Network Error.*$/i,
      /^.*net::ERR_.*$/i,
      // Third party scripts
      /Script error\./i,
    ],
    
    // Deny URLs
    denyUrls: [
      // Extensions
      /extensions\//i,
      /^chrome:\/\//i,
      /^chrome-extension:\/\//i,
      // Analytics
      /google-analytics\.com/i,
    ],
  });

  console.log('[Sentry] Initialized successfully');
}

// ═══════════════════════════════════════════════════════════════
// USER CONTEXT
// ═══════════════════════════════════════════════════════════════

export function setSentryUser(userId: string, metadata?: Record<string, string>): void {
  Sentry.setUser({
    id: userId,
    username: metadata?.username,
    store: metadata?.store,
    // Remove PII
    ip_address: null as unknown as string, // Don't track IP
  });
}

export function clearSentryUser(): void {
  Sentry.setUser(null);
}

// ═══════════════════════════════════════════════════════════════
// CUSTOM ERROR HANDLING
// ═══════════════════════════════════════════════════════════════

export function captureError(
  error: Error,
  context?: Record<string, unknown>
): void {
  Sentry.captureException(error, {
    extra: context,
    tags: {
      store: getCurrentStore()?.name || 'unknown',
    },
  });
}

export function captureMessage(
  message: string,
  level: 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug' = 'info',
  context?: Record<string, unknown>
): void {
  Sentry.captureMessage(message, {
    level,
    extra: context,
  });
}

// ═══════════════════════════════════════════════════════════════
// BREADCRUMBS
// ═══════════════════════════════════════════════════════════════

export function addBreadcrumb(
  category: string,
  message: string,
  level: 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug' = 'info',
  data?: Record<string, unknown>
): void {
  Sentry.addBreadcrumb({
    category,
    message,
    level,
    data,
    timestamp: Date.now(),
  });
}

// ═══════════════════════════════════════════════════════════════
// PERFORMANCE MONITORING
// ═══════════════════════════════════════════════════════════════

// Performance monitoring using Sentry's current API
export function startTransaction(
  name: string,
  op: string
): void {
  // Use startSpan API from @sentry/browser v8
  Sentry.startSpan({ name, op }, () => {
    // Transaction body
  });
}

export function startSpan(
  name: string,
  op: string,
  _description: string
): void {
  Sentry.startSpan({ name, op }, () => {
    // Span body - description is informational
  });
}

// ═══════════════════════════════════════════════════════════════
// WEB VITALS TRACKING
// ═══════════════════════════════════════════════════════════════

export function trackWebVitals(): void {
  if ('web-vitals' in window) {
    // First Contentful Paint
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === 'first-contentful-paint') {
          Sentry.addBreadcrumb({
            category: 'web-vitals',
            message: `FCP: ${entry.startTime}ms`,
            level: 'info',
            data: { value: entry.startTime },
          });
        }
      }
    }).observe({ entryTypes: ['paint'] });
    
    // Largest Contentful Paint
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      if (lastEntry) {
        Sentry.addBreadcrumb({
          category: 'web-vitals',
          message: `LCP: ${lastEntry.startTime}ms`,
          level: 'info',
          data: { value: lastEntry.startTime },
        });
      }
    }).observe({ entryTypes: ['largest-contentful-paint'] });
  }
}

// ═══════════════════════════════════════════════════════════════
// CUSTOM PERFORMANCE MARKS
// ═══════════════════════════════════════════════════════════════

export function markPerformance(name: string, data?: Record<string, unknown>): void {
  performance.mark(name);
  
  Sentry.addBreadcrumb({
    category: 'performance',
    message: `Mark: ${name}`,
    level: 'info',
    data: {
      timestamp: performance.now(),
      ...data,
    },
  });
}

export function measurePerformance(
  name: string,
  startMark: string,
  endMark: string,
  data?: Record<string, unknown>
): void {
  try {
    const measure = performance.measure(name, startMark, endMark);
    
    Sentry.addBreadcrumb({
      category: 'performance',
      message: `Measure: ${name} = ${measure.duration.toFixed(2)}ms`,
      level: 'info',
      data: {
        duration: measure.duration,
        ...data,
      },
    });
  } catch (e) {
    // Marks might not exist
  }
}

// ═══════════════════════════════════════════════════════════════
// HEALTH CHECK
// ═══════════════════════════════════════════════════════════════

export function reportHealth(): void {
  const metrics: Record<string, number> = {
    // Memory usage
    memoryUsed: (performance as any).memory?.usedJSHeapSize || 0,
    memoryTotal: (performance as any).memory?.totalJSHeapSize || 0,
    // Navigation timing
    domInteractive: performance.timing?.domInteractive || 0,
    domComplete: performance.timing?.domComplete || 0,
    // Connection
    connectionType: (navigator as any).connection?.effectiveType || 'unknown',
  };
  
  Sentry.captureMessage('Health check', {
    level: 'info',
    extra: { metrics },
  });
}

// ═══════════════════════════════════════════════════════════════
// ERROR BOUNDARY HELPER
// ═══════════════════════════════════════════════════════════════

export class SentryErrorBoundary {
  private componentName: string;
  
  constructor(componentName: string) {
    this.componentName = componentName;
  }
  
  captureError(error: Error, errorInfo?: Record<string, unknown>): void {
    Sentry.captureException(error, {
      tags: {
        component: this.componentName,
      },
      extra: errorInfo,
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// TELEMETRY
// ═══════════════════════════════════════════════════════════════

export function trackEvent(
  eventName: string,
  properties?: Record<string, unknown>
): void {
  Sentry.addBreadcrumb({
    category: 'telemetry',
    message: eventName,
    level: 'info',
    data: properties,
  });
}
