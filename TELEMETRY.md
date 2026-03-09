# Telemetry & Error Tracking

How PDF Compress collects analytics, compression telemetry, and error reports.

---

## Overview

| Channel | Purpose | Destination |
|---------|---------|-------------|
| Google Analytics (gtag.js) | Page views, UI events | GA4 dashboard |
| Google Sheets — **Telemetry** tab | Compression results per session | Google Spreadsheet |
| Google Sheets — **Errors** tab | Every error with full context | Google Spreadsheet |

All telemetry is **fire-and-forget** (`mode: 'no-cors'`, `keepalive: true`). Failures are silently ignored — telemetry never affects user experience.

---

## Architecture

```
Browser (lib/analytics.ts)
  │
  ├─ trackEvent()          → Google Analytics (gtag.js)
  │
  ├─ trackTelemetry()      → Google Apps Script → "Telemetry" tab
  │     sends { report: payload }
  │
  └─ trackErrorToSheet()   → Google Apps Script → "Errors" tab
        sends { error: payload }
```

The Google Apps Script (`google-apps-script/Code.gs`) receives POST requests and routes them based on the JSON key:
- `{ report: ... }` → **Telemetry** tab
- `{ error: ... }` → **Errors** tab

---

## Google Sheets — Telemetry Tab

Sent after every successful compression via `trackTelemetry()` (called from `ResultsDisplay.tsx`).

| Column | Description |
|--------|-------------|
| Timestamp | ISO timestamp |
| Session ID | Unique per browser session (`s_{ts}_{random}`) |
| Original Size | File size in bytes before compression |
| Compressed Size | File size in bytes after compression |
| Savings % | Percentage reduced |
| Page Count | Number of pages in the PDF |
| Methods Used | Comma-separated list of enabled methods |
| Methods Successful | Methods that actually saved bytes |
| Top Method | Method with the highest byte savings |
| Errors | Count of errors during processing |
| User Agent | Browser/OS string |

---

## Google Sheets — Errors Tab

Sent automatically on every error, and when users click "Report Issue".

| Column | Description |
|--------|-------------|
| Timestamp | ISO timestamp |
| Session ID | Same session ID as telemetry, for correlation |
| Error Code | Machine-readable code (see below) |
| Error Message | Technical error message |
| User Message | User-friendly message shown in the UI |
| File Name | Name of the file that caused the error |
| File Size | Size in bytes |
| Context | Where the error originated (see below) |
| Stack Trace | JS stack trace (when available) |
| User Agent | Browser/OS string |

### Error Codes

Defined in `lib/errors.ts`:

| Code | Meaning |
|------|---------|
| `FILE_TOO_LARGE` | File exceeds size limit |
| `INVALID_FILE_TYPE` | Not a PDF or failed signature check |
| `ENCRYPTED_PDF` | PDF is password-protected |
| `CORRUPTED_PDF` | PDF structure is damaged |
| `PROCESSING_FAILED` | Compression failed (timeout, read error, etc.) |
| `WORKER_ERROR` | Web Worker crashed |
| `STALE_WORKER` | Worker from a previous session responded |

### Context Values

The `context` field tells you where the error happened:

| Context | Source |
|---------|--------|
| `worker_compression` | Worker returned an error during single-file compression |
| `worker_onerror` | Worker crashed (single-file) |
| `file_validation` | File failed size/type check |
| `pdf_signature_validation` | File bytes don't start with `%PDF` |
| `batch_worker_compression` | Worker error during batch processing |
| `batch_worker_onerror` | Worker crash during batch processing |
| `batch_timeout` | File exceeded 2-minute batch timeout |
| `batch_pdf_signature_validation` | Invalid PDF during batch |
| `batch_file_read` | Could not read file into memory |
| `user_reported` | User clicked "Report Issue" in the error UI |

---

## Key Files

| File | Role |
|------|------|
| `lib/analytics.ts` | All tracking functions, telemetry payload building |
| `lib/logger.ts` | Structured logging with session IDs and in-memory buffer |
| `lib/errors.ts` | `PdfError` class, error codes, `createPdfError()` factory |
| `components/ErrorDisplay.tsx` | Error UI with "Report Issue" button |
| `components/ResultsDisplay.tsx` | Triggers `trackTelemetry()` after compression |
| `hooks/usePdfCompression.ts` | Single-file error tracking |
| `hooks/useBatchCompression.ts` | Batch processing error tracking |
| `google-apps-script/Code.gs` | Apps Script that routes data to sheet tabs |

---

## Google Apps Script Setup

1. Open your Google Spreadsheet
2. Go to **Extensions → Apps Script**
3. Replace the code with the contents of `google-apps-script/Code.gs`
4. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Copy the deployment URL into `lib/analytics.ts` (`TELEMETRY_SHEET_URL`)
6. Update CSP headers in `netlify.toml` if the URL domain changes

After deploying, the script will auto-create the "Telemetry" and "Errors" tabs with headers on first request.

---

## Logging (In-Memory)

`lib/logger.ts` provides structured logging used throughout the app:

- **Levels:** `debug`, `info`, `warn`, `error`
- **Buffer:** Max 500 entries per session, accessible via `getLogBuffer()`
- **Session ID:** Every session gets a unique ID for correlation
- **Production:** Silent console, logs captured for telemetry payloads
- **Development:** Colored console output
