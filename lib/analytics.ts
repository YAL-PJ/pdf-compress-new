/**
 * Analytics module for tracking user events
 * Uses Google Analytics (gtag.js) + structured logging + telemetry API
 */

import type { CompressionReport, MethodResult } from './types';
import { createLogger, getCurrentSessionId } from './logger';
import { formatBytes } from './utils';

const log = createLogger('analytics');

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

  log.debug(`Event: ${name}`, props as Record<string, unknown>);
}

export function trackFileUpload(fileSizeMB: number, isBatch: boolean = false): void {
  log.info('File uploaded', { sizeMB: round2(fileSizeMB), isBatch });
  trackEvent('file_upload', {
    file_size_mb: round2(fileSizeMB),
    is_batch: isBatch,
  });
}

export function trackCompressionStarted(pageCount: number): void {
  log.info('Compression started', { pageCount });
  trackEvent('compression_started', { page_count: pageCount });
}

export function trackCompressionCompleted(
  originalSizeMB: number,
  compressedSizeMB: number,
  savingsPercent: number
): void {
  log.info('Compression completed', {
    originalMB: round2(originalSizeMB),
    compressedMB: round2(compressedSizeMB),
    savingsPercent: Math.round(savingsPercent),
  });
  trackEvent('compression_completed', {
    original_size_mb: round2(originalSizeMB),
    compressed_size_mb: round2(compressedSizeMB),
    savings_percent: Math.round(savingsPercent),
  });
}

export function trackDownload(fileSizeMB: number): void {
  log.info('Download clicked', { sizeMB: round2(fileSizeMB) });
  trackEvent('download_click', {
    file_size_mb: round2(fileSizeMB),
  });
}

export function trackBatchStarted(fileCount: number): void {
  log.info('Batch started', { fileCount });
  trackEvent('batch_started', { file_count: fileCount });
}

export function trackBatchCompleted(fileCount: number, totalSavingsPercent: number): void {
  log.info('Batch completed', { fileCount, savingsPercent: Math.round(totalSavingsPercent) });
  trackEvent('batch_completed', {
    file_count: fileCount,
    total_savings_percent: Math.round(totalSavingsPercent),
  });
}

export function trackMethodToggle(method: string, enabled: boolean): void {
  log.debug(`Method toggled: ${method}`, { method, enabled });
  trackEvent('method_toggle', { method, enabled });
}

export function trackPresetSelected(preset: string): void {
  log.info(`Preset selected: ${preset}`);
  trackEvent('preset_selected', { preset });
}

export function trackPageOperation(operation: 'rotated' | 'deleted' | 'reordered'): void {
  log.debug(`Page operation: ${operation}`);
  if (operation === 'rotated') {
    trackEvent('page_rotated');
  } else if (operation === 'deleted') {
    trackEvent('page_deleted');
  } else {
    trackEvent('pages_reordered');
  }
}

export function trackCompressionError(errorCode: string): void {
  log.error(`Compression error: ${errorCode}`, { errorCode });
  trackEvent('compression_error', { error_code: errorCode });
}

const TELEMETRY_SHEET_URL = 'https://script.google.com/macros/s/AKfycbxBDNWqkuC-g7uecl6o-PeJM6oJISqJBfQndt6IlejpBnYDQp5nFhzsyc0iUMjEMvBSYw/exec';

/**
 * Build a telemetry payload with per-method stats
 */
function buildTelemetryPayload(report: CompressionReport, methodResults?: MethodResult[]) {
  const savingsPercent = report.originalSize > 0
    ? ((report.originalSize - report.compressedSize) / report.originalSize * 100)
    : 0;

  const methodBreakdown = methodResults
    ? methodResults
      .filter(m => m.savedBytes > 0)
      .map(m => ({
        method: m.key,
        savedBytes: m.savedBytes,
        savedFormatted: formatBytes(m.savedBytes),
        percentOfTotal: report.originalSize > 0
          ? round2((m.savedBytes / report.originalSize) * 100)
          : 0,
      }))
      .sort((a, b) => b.savedBytes - a.savedBytes)
    : [];

  return {
    sessionId: typeof window !== 'undefined' ? getCurrentSessionId() : undefined,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    timestamp: report.timestamp,
    originalSize: report.originalSize,
    compressedSize: report.compressedSize,
    savingsPercent: round2(savingsPercent),
    pageCount: report.pageCount,
    methodsUsed: report.methodsUsed,
    methodsSuccessful: report.methodsSuccessful,
    topMethod: methodBreakdown.length > 0 ? methodBreakdown[0].method : null,
    errorCount: report.logs.filter(l => l.level === 'error').length,
  };
}

/**
 * Send telemetry report to Google Sheets via Apps Script (fire and forget)
 */
export function trackTelemetry(report: CompressionReport, methodResults?: MethodResult[]): void {
  const sendTelemetry = () => {
    try {
      const payload = buildTelemetryPayload(report, methodResults);

      log.info('Sending telemetry', {
        originalSize: formatBytes(payload.originalSize),
        compressedSize: formatBytes(payload.compressedSize),
        savingsPercent: payload.savingsPercent,
      });

      fetch(TELEMETRY_SHEET_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ report: payload }),
        keepalive: true,
      }).catch(() => {
        // Silently ignore — telemetry is non-critical
      });
    } catch {
      // Fail silently
    }
  };

  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    window.requestIdleCallback(sendTelemetry, { timeout: 5000 });
  } else {
    setTimeout(sendTelemetry, 1000);
  }
}
