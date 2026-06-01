/**
 * Analytics module for tracking user events
 * Uses Google Analytics (gtag.js) + structured logging + telemetry API
 */

import type { CompressionReport, MethodResult } from './types';
import { createLogger, getCurrentSessionId } from './logger';
import { formatBytes } from './utils';

const log = createLogger('analytics');

const SHARED_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzgIwblyMQv4O8GypUMT7xfj8Xkv6W2oyCFxZVcUExwpWhHr_7WWXQlvi2tfzjXisu4Ww/exec';
const APP_ID = 'compresspdf';
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0';

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

interface ErrorReporterOptions {
  feature?: string;
  userNote?: string;
  stack?: string;
  url?: string;
}

interface ErrorReportResult {
  ok: boolean;
  target: 'apps-script';
  ignored?: boolean;
  error?: string;
}

type CustomReportError = (error: unknown, options?: ErrorReporterOptions) => Promise<ErrorReportResult>;

type ErrorReporterWindow = Window & typeof globalThis & {
  __pdfCompressErrorReporterInstalled?: boolean;
  __pdfCompressNativeReportError?: (error: unknown) => void;
  reportError?: CustomReportError;
};

declare global {
  interface Window {
    gtag?: (
      command: 'event' | 'config' | 'js',
      targetId: string | Date,
      config?: Record<string, unknown>
    ) => void;
    dataLayer?: unknown[];
    __pdfCompressErrorReporterInstalled?: boolean;
    __pdfCompressNativeReportError?: (error: unknown) => void;
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

const THIRD_PARTY_ERROR_PATTERNS = [
  'chrome-extension://',
  'moz-extension://',
  'safari-extension://',
  'extensions/',
  'googletagmanager.com',
  'google-analytics.com',
  'analytics.google.com',
  'doubleclick.net',
  'googlesyndication.com',
  'googleadservices.com',
  'adsbygoogle',
  'gstatic.com/recaptcha',
  'user-sync',
  'syncframe',
  'taboola',
  'outbrain',
  'hotjar',
  'clarity.ms',
];

const normalizeError = (error: unknown) => {
  if (error instanceof Error) {
    return {
      message: error.message || error.name || 'Unknown error',
      stack: error.stack || '',
    };
  }

  if (typeof error === 'string') {
    return { message: error, stack: '' };
  }

  try {
    return { message: JSON.stringify(error), stack: '' };
  } catch {
    return { message: String(error), stack: '' };
  }
};

const shouldIgnoreErrorReport = (message: string, stack: string, url: string): boolean => {
  const combined = `${message}\n${stack}\n${url}`.toLowerCase();

  if (message === 'Script error.' && !stack) return true;

  return THIRD_PARTY_ERROR_PATTERNS.some(pattern => combined.includes(pattern));
};

/**
 * Send structured JavaScript errors to the shared Apps Script backend.
 * The `action: "error_report"` field routes the payload to the Errors tab.
 */
export async function reportError(
  error: unknown,
  options: ErrorReporterOptions = {}
): Promise<ErrorReportResult> {
  if (typeof window === 'undefined') {
    return { ok: false, target: 'apps-script', error: 'window unavailable' };
  }

  const normalized = normalizeError(error);
  const url = options.url || window.location.href;
  const stack = options.stack || normalized.stack;

  if (shouldIgnoreErrorReport(normalized.message, stack, url)) {
    return { ok: true, target: 'apps-script', ignored: true };
  }

  const payload = {
    action: 'error_report',
    app: APP_ID,
    message: normalized.message,
    stack,
    url,
    feature: options.feature || 'unknown',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    appVersion: APP_VERSION,
    userNote: options.userNote || '',
  };

  try {
    const response = await fetch(SHARED_APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      keepalive: true,
    });

    const json = await response.json().catch(() => ({}));
    if (json && json.ok === false) {
      return { ok: false, target: 'apps-script', error: json.error || 'error report rejected' };
    }

    return { ok: true, target: 'apps-script' };
  } catch (err) {
    return {
      ok: false,
      target: 'apps-script',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Install the console-friendly window.reportError helper and automatic browser
 * error listeners. This deliberately uses the shared feedback Apps Script rather
 * than the legacy telemetry deployment.
 */
export function installErrorReporter(): void {
  if (typeof window === 'undefined') return;

  const target = window as ErrorReporterWindow;
  if (target.__pdfCompressErrorReporterInstalled) return;

  if (typeof target.reportError === 'function' && !target.__pdfCompressNativeReportError) {
    target.__pdfCompressNativeReportError = target.reportError as unknown as (error: unknown) => void;
  }

  target.reportError = reportError;

  target.addEventListener('error', (event) => {
    void reportError(event.error || event.message, {
      feature: 'window-error',
      stack: event.error?.stack,
      url: event.filename || window.location.href,
    });
  });

  target.addEventListener('unhandledrejection', (event) => {
    void reportError(event.reason, {
      feature: 'unhandledrejection',
    });
  });

  target.__pdfCompressErrorReporterInstalled = true;
}

/**
 * Send error details to Google Sheets "Errors" tab via the shared Apps Script.
 */
export function trackErrorToSheet(opts: {
  errorCode: string;
  errorMessage: string;
  userMessage?: string;
  stack?: string;
  fileName?: string;
  fileSize?: number;
  context?: string;
}): void {
  const sendError = () => {
    void reportError(new Error(opts.errorMessage), {
      feature: opts.context || opts.errorCode,
      stack: opts.stack,
      userNote: [
        opts.userMessage ? `userMessage: ${opts.userMessage}` : '',
        opts.fileName ? `fileName: ${opts.fileName}` : '',
        opts.fileSize ? `fileSize: ${opts.fileSize}` : '',
        `errorCode: ${opts.errorCode}`,
      ].filter(Boolean).join('\n'),
    }).catch(() => {
      // Silently ignore — telemetry is non-critical
    });
  };

  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    window.requestIdleCallback(sendError, { timeout: 5000 });
  } else {
    setTimeout(sendError, 1000);
  }
}

const TELEMETRY_SHEET_URL = 'https://script.google.com/macros/s/AKfycbxk7hBbThv1g_PLHMZTeoR7_bgD2gcIgGonercT8gpptlMm7V4p2UsWRQ12cPtIyufYgg/exec';

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
