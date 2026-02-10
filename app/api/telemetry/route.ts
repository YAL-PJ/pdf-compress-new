
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

/**
 * Telemetry API - receives structured compression reports and stores in Supabase
 *
 * Requires env vars:
 *   SUPABASE_URL        - e.g. https://xxx.supabase.co
 *   SUPABASE_SERVICE_KEY - secret/service_role key (NOT the publishable key)
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

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

async function insertToSupabase(report: TelemetryReport, geo: string): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn('[Telemetry] Supabase not configured — SUPABASE_URL or SUPABASE_SERVICE_KEY missing');
    return false;
  }

  const row = {
    session_id: report.sessionId || null,
    geo,
    original_size: report.originalSize || 0,
    compressed_size: report.compressedSize || 0,
    savings_percent: report.savingsPercent || 0,
    page_count: report.pageCount || 0,
    methods_used: report.methodsUsed || [],
    methods_successful: report.methodsSuccessful || [],
    top_method: report.topMethod?.method || null,
    error_count: report.errorCount || 0,
    warning_count: report.warningCount || 0,
    errors: report.errors || [],
    method_breakdown: report.methodBreakdown || [],
    user_agent: report.userAgent || null,
  };

  const res = await fetch(`${SUPABASE_URL}/rest/v1/compression_events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify(row),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`[Telemetry] Supabase insert failed (${res.status}):`, errText);
    return false;
  }

  return true;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body || !body.report) {
      return NextResponse.json({ status: 'ignored', reason: 'no_data' }, { status: 400 });
    }

    const report = body.report as TelemetryReport;

    // Netlify provides geo headers too
    const geo = req.headers.get('x-nf-client-connection-ip')
      ? `${req.headers.get('x-country') || 'unknown'}`
      : req.headers.get('x-vercel-ip-country') || 'unknown';

    // Insert into Supabase
    const stored = await insertToSupabase(report, geo);

    return NextResponse.json({ status: stored ? 'stored' : 'logged' });
  } catch (err) {
    console.error('[Telemetry] Parse error:', String(err));
    return NextResponse.json({ status: 'error' }, { status: 200 });
  }
}
