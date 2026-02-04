/**
 * Analytics using Google Analytics (gtag.js)
 */

// Event names for type safety
export const AnalyticsEvents = {
  // File operations
  FILE_UPLOAD: 'File Upload',
  COMPRESSION_START: 'Compression Start',
  COMPRESSION_COMPLETE: 'Compression Complete',
  COMPRESSION_ERROR: 'Compression Error',
  FILE_DOWNLOAD: 'File Download',
  BATCH_DOWNLOAD: 'Batch Download',

  // User interactions
  PRESET_SELECT: 'Preset Select',
  METHOD_TOGGLE: 'Method Toggle',
  BATCH_MODE_TOGGLE: 'Batch Mode Toggle',
  PAGE_DELETE: 'Page Delete',
  PAGE_ROTATE: 'Page Rotate',
  PAGE_REORDER: 'Page Reorder',

  // Navigation
  CTA_CLICK: 'CTA Click',
  FAQ_EXPAND: 'FAQ Expand',
} as const;

export type AnalyticsEvent = (typeof AnalyticsEvents)[keyof typeof AnalyticsEvents];

// Event properties type
export interface EventProps {
  // File events
  fileSize?: number;
  fileSizeMB?: string;
  compressionRatio?: number;
  savedPercent?: string;
  pageCount?: number;
  methodCount?: number;
  errorType?: string;
  fileCount?: number;

  // Interaction events
  preset?: string;
  method?: string;
  enabled?: boolean;
  mode?: string;

  // Navigation events
  location?: string;
  faqQuestion?: string;
}

// Google Analytics window extension
declare global {
  interface Window {
    gtag?: (
      command: 'event' | 'config' | 'js',
      targetId: string | Date,
      config?: Record<string, unknown>
    ) => void;
    dataLayer?: unknown[];
  }
}

/**
 * Track a custom event
 * Safe to call even if Google Analytics isn't loaded
 */
export function trackEvent(event: AnalyticsEvent, props?: EventProps): void {
  // Only track in browser
  if (typeof window === 'undefined') return;

  // Only track in production (or when explicitly enabled)
  if (
    process.env.NODE_ENV !== 'production' &&
    !process.env.NEXT_PUBLIC_ENABLE_ANALYTICS
  ) {
    // Log in development for debugging
    console.debug('[Analytics]', event, props);
    return;
  }

  // Track with Google Analytics if available
  if (window.gtag) {
    window.gtag('event', event, props as Record<string, unknown>);
  }
}

/**
 * Track file upload event
 */
export function trackFileUpload(fileSize: number, pageCount?: number): void {
  trackEvent(AnalyticsEvents.FILE_UPLOAD, {
    fileSize,
    fileSizeMB: (fileSize / (1024 * 1024)).toFixed(2),
    pageCount,
  });
}

/**
 * Track compression completion
 */
export function trackCompressionComplete(
  originalSize: number,
  compressedSize: number,
  methodCount: number
): void {
  const savedBytes = originalSize - compressedSize;
  const savedPercent = ((savedBytes / originalSize) * 100).toFixed(1);
  const compressionRatio = originalSize / compressedSize;

  trackEvent(AnalyticsEvents.COMPRESSION_COMPLETE, {
    fileSize: originalSize,
    compressionRatio: Math.round(compressionRatio * 100) / 100,
    savedPercent,
    methodCount,
  });
}

/**
 * Track compression error
 */
export function trackCompressionError(errorType: string): void {
  trackEvent(AnalyticsEvents.COMPRESSION_ERROR, {
    errorType,
  });
}

/**
 * Track file download
 */
export function trackFileDownload(fileSize: number, savedPercent: number): void {
  trackEvent(AnalyticsEvents.FILE_DOWNLOAD, {
    fileSize,
    savedPercent: savedPercent.toFixed(1),
  });
}

/**
 * Track batch download
 */
export function trackBatchDownload(fileCount: number): void {
  trackEvent(AnalyticsEvents.BATCH_DOWNLOAD, {
    fileCount,
  });
}

/**
 * Track preset selection
 */
export function trackPresetSelect(preset: string): void {
  trackEvent(AnalyticsEvents.PRESET_SELECT, {
    preset,
  });
}

/**
 * Track method toggle
 */
export function trackMethodToggle(method: string, enabled: boolean): void {
  trackEvent(AnalyticsEvents.METHOD_TOGGLE, {
    method,
    enabled,
  });
}

/**
 * Track CTA click
 */
export function trackCTAClick(location: string): void {
  trackEvent(AnalyticsEvents.CTA_CLICK, {
    location,
  });
}
