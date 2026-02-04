/**
 * Analytics module for tracking user events
 * Uses Plausible Analytics for privacy-friendly tracking
 */

type EventName =
  | 'file_upload'
  | 'compression_started'
  | 'compression_completed'
  | 'compression_error'
  | 'download_click'
  | 'batch_started'
  | 'batch_completed'
  | 'method_toggle'
  | 'preset_selected'
  | 'page_rotated'
  | 'page_deleted'
  | 'pages_reordered';

interface EventProps {
  [key: string]: string | number | boolean;
}

declare global {
  interface Window {
    plausible?: (event: string, options?: { props?: EventProps }) => void;
  }
}

/**
 * Track an analytics event
 * Events are only sent if Plausible is loaded
 */
export function trackEvent(name: EventName, props?: EventProps): void {
  // Only track in production or if explicitly enabled
  if (typeof window === 'undefined') return;

  // Use Plausible if available
  if (window.plausible) {
    window.plausible(name, props ? { props } : undefined);
  }

  // Log events in development for debugging
  if (process.env.NODE_ENV === 'development') {
    console.log('[Analytics]', name, props);
  }
}

/**
 * Track file upload
 */
export function trackFileUpload(fileSizeMB: number, isBatch: boolean = false): void {
  trackEvent('file_upload', {
    file_size_mb: Math.round(fileSizeMB * 100) / 100,
    is_batch: isBatch,
  });
}

/**
 * Track compression start
 */
export function trackCompressionStarted(pageCount: number): void {
  trackEvent('compression_started', { page_count: pageCount });
}

/**
 * Track compression completion
 */
export function trackCompressionCompleted(
  originalSizeMB: number,
  compressedSizeMB: number,
  savingsPercent: number
): void {
  trackEvent('compression_completed', {
    original_size_mb: Math.round(originalSizeMB * 100) / 100,
    compressed_size_mb: Math.round(compressedSizeMB * 100) / 100,
    savings_percent: Math.round(savingsPercent),
  });
}

/**
 * Track download click
 */
export function trackDownload(fileSizeMB: number): void {
  trackEvent('download_click', {
    file_size_mb: Math.round(fileSizeMB * 100) / 100,
  });
}

/**
 * Track batch processing
 */
export function trackBatchStarted(fileCount: number): void {
  trackEvent('batch_started', { file_count: fileCount });
}

export function trackBatchCompleted(fileCount: number, totalSavingsPercent: number): void {
  trackEvent('batch_completed', {
    file_count: fileCount,
    total_savings_percent: Math.round(totalSavingsPercent),
  });
}

/**
 * Track method toggle
 */
export function trackMethodToggle(method: string, enabled: boolean): void {
  trackEvent('method_toggle', { method, enabled });
}

/**
 * Track preset selection
 */
export function trackPresetSelected(preset: string): void {
  trackEvent('preset_selected', { preset });
}

/**
 * Track page operations
 */
export function trackPageOperation(operation: 'rotated' | 'deleted' | 'reordered'): void {
  if (operation === 'rotated') {
    trackEvent('page_rotated');
  } else if (operation === 'deleted') {
    trackEvent('page_deleted');
  } else {
    trackEvent('pages_reordered');
  }
}

/**
 * Track compression error
 */
export function trackCompressionError(errorCode: string): void {
  trackEvent('compression_error', { error_code: errorCode });
}
