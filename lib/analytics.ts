/**
 * Analytics module for tracking user events
 * Uses Google Analytics (gtag.js)
 */

import type { CompressionReport } from './types';

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
    gtag?: (
      command: 'event' | 'config' | 'js',
      targetId: string | Date,
      config?: Record<string, unknown>
    ) => void;
    dataLayer?: unknown[];
  }
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

export function trackEvent(name: EventName, props?: EventProps): void {
  if (typeof window === 'undefined') return;

  if (window.gtag) {
    window.gtag('event', name, props);
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('[Analytics]', name, props);
  }
}

export function trackFileUpload(fileSizeMB: number, isBatch: boolean = false): void {
  trackEvent('file_upload', {
    file_size_mb: round2(fileSizeMB),
    is_batch: isBatch,
  });
}

export function trackCompressionStarted(pageCount: number): void {
  trackEvent('compression_started', { page_count: pageCount });
}

export function trackCompressionCompleted(
  originalSizeMB: number,
  compressedSizeMB: number,
  savingsPercent: number
): void {
  trackEvent('compression_completed', {
    original_size_mb: round2(originalSizeMB),
    compressed_size_mb: round2(compressedSizeMB),
    savings_percent: Math.round(savingsPercent),
  });
}

export function trackDownload(fileSizeMB: number): void {
  trackEvent('download_click', {
    file_size_mb: round2(fileSizeMB),
  });
}

export function trackBatchStarted(fileCount: number): void {
  trackEvent('batch_started', { file_count: fileCount });
}

export function trackBatchCompleted(fileCount: number, totalSavingsPercent: number): void {
  trackEvent('batch_completed', {
    file_count: fileCount,
    total_savings_percent: Math.round(totalSavingsPercent),
  });
}

export function trackMethodToggle(method: string, enabled: boolean): void {
  trackEvent('method_toggle', { method, enabled });
}

export function trackPresetSelected(preset: string): void {
  trackEvent('preset_selected', { preset });
}

export function trackPageOperation(operation: 'rotated' | 'deleted' | 'reordered'): void {
  if (operation === 'rotated') {
    trackEvent('page_rotated');
  } else if (operation === 'deleted') {
    trackEvent('page_deleted');
  } else {
    trackEvent('pages_reordered');
  }
}

export function trackCompressionError(errorCode: string): void {
  trackEvent('compression_error', { error_code: errorCode });
}

/**
 * Send admin telemetry report (Fire and Forget)
 */
export function trackTelemetry(report: CompressionReport): void {
  const sendTelemetry = () => {
    try {
      const lightweightReport = {
        ...report,
        logs: [
          ...report.logs.filter(l => l.level === 'error' || l.level === 'warning'),
          ...report.logs.filter(l => l.level !== 'error' && l.level !== 'warning').slice(-20)
        ]
      };

      fetch('/api/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report: lightweightReport }),
        keepalive: true,
      }).catch(err => {
        if (process.env.NODE_ENV === 'development') console.error('Telemetry failed:', err);
      });
    } catch {
      // Fail silently in production
    }
  };

  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    window.requestIdleCallback(sendTelemetry, { timeout: 5000 });
  } else {
    setTimeout(sendTelemetry, 1000);
  }
}
