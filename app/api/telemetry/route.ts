
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

/**
 * Telemetry API - receives structured compression reports
 *
 * Logs are written to stdout in structured JSON format so they can be
 * captured by Vercel Log Drains, Datadog, or any log aggregation service.
 *
 * Each log line is a self-contained JSON object for easy parsing.
 */

interface TelemetryReport {
  sessionId?: string;
  userAgent?: string;
  timestamp?: number;
  originalSize?: number;
  originalSizeFormatted?: string;
  compressedSize?: number;
  compressedSizeFormatted?: string;
  savingsPercent?: number;
  pageCount?: number;
  methodsUsed?: string[];
  methodsSuccessful?: string[];
  methodCount?: number;
  successfulMethodCount?: number;
  methodBreakdown?: Array<{
    method: string;
    savedBytes: number;
    savedFormatted: string;
    percentOfTotal: number;
  }>;
  topMethod?: { method: string; savedBytes: number; savedFormatted: string; percentOfTotal: number } | null;
  errorCount?: number;
  warningCount?: number;
  errors?: Array<{ message: string; details?: unknown }>;
  warnings?: Array<{ message: string; details?: unknown }>;
}

function formatStructuredLog(
  level: 'INFO' | 'WARN' | 'ERROR',
  event: string,
  data: Record<string, unknown>
): string {
  return JSON.stringify({
    level,
    event,
    ts: new Date().toISOString(),
    ...data,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body || !body.report) {
      return NextResponse.json({ status: 'ignored', reason: 'no_data' }, { status: 400 });
    }

    const report = body.report as TelemetryReport;
    const geo = req.headers.get('x-vercel-ip-country') || 'unknown';
    const region = req.headers.get('x-vercel-ip-country-region') || 'unknown';

    // Main compression event log
    console.log(formatStructuredLog('INFO', 'compression_completed', {
      sessionId: report.sessionId,
      geo: `${geo}-${region}`,
      originalSize: report.originalSize,
      originalSizeFormatted: report.originalSizeFormatted,
      compressedSize: report.compressedSize,
      compressedSizeFormatted: report.compressedSizeFormatted,
      savingsPercent: report.savingsPercent,
      pageCount: report.pageCount,
      methodCount: report.methodCount,
      successfulMethodCount: report.successfulMethodCount,
      topMethod: report.topMethod?.method || 'none',
      topMethodSavings: report.topMethod?.savedFormatted || '0 B',
    }));

    // Per-method breakdown log (for analyzing which methods are most effective)
    if (report.methodBreakdown && report.methodBreakdown.length > 0) {
      console.log(formatStructuredLog('INFO', 'method_breakdown', {
        sessionId: report.sessionId,
        methods: report.methodBreakdown.map(m => ({
          method: m.method,
          saved: m.savedFormatted,
          pct: m.percentOfTotal,
        })),
      }));
    }

    // Log errors separately for easy filtering
    if (report.errorCount && report.errorCount > 0 && report.errors) {
      for (const err of report.errors) {
        console.log(formatStructuredLog('ERROR', 'compression_error', {
          sessionId: report.sessionId,
          geo: `${geo}-${region}`,
          message: err.message,
          details: err.details,
          userAgent: report.userAgent,
        }));
      }
    }

    // Log warnings
    if (report.warningCount && report.warningCount > 0 && report.warnings) {
      for (const warn of report.warnings) {
        console.log(formatStructuredLog('WARN', 'compression_warning', {
          sessionId: report.sessionId,
          message: warn.message,
          details: warn.details,
        }));
      }
    }

    return NextResponse.json({ status: 'logged' });
  } catch (err) {
    console.log(formatStructuredLog('ERROR', 'telemetry_parse_error', {
      error: String(err),
    }));
    return NextResponse.json({ status: 'error' }, { status: 200 });
  }
}
