/**
 * Google Apps Script — PDF Compress Telemetry & Error Tracking
 *
 * This script receives POST requests from the pdf-compress-new frontend
 * (lib/analytics.ts) and writes data to two tabs in this spreadsheet:
 *
 *   1. "Telemetry" — successful compression reports (sent via { report: payload })
 *   2. "Errors"    — error events (sent via { error: payload })
 *
 * Deployment:
 *   1. Open your Google Sheet → Extensions → Apps Script
 *   2. Replace the existing code with this file
 *   3. Deploy → New deployment → Web app
 *      - Execute as: Me
 *      - Who has access: Anyone
 *   4. Copy the deployment URL into lib/analytics.ts (TELEMETRY_SHEET_URL)
 *
 * The frontend sends requests with mode: 'no-cors' and Content-Type: 'text/plain',
 * so doPost receives the JSON body as e.postData.contents.
 */

function doPost(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var data = JSON.parse(e.postData.contents);

  if (data.error) {
    handleError(ss, data.error);
  } else if (data.report) {
    handleReport(ss, data.report);
  }

  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok' }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Write a compression report row to the "Telemetry" tab.
 *
 * Columns:
 *   Timestamp | Session ID | Original Size | Compressed Size | Savings % |
 *   Page Count | Methods Used | Methods Successful | Top Method | Errors |
 *   User Agent | Country
 */
function handleReport(ss, report) {
  var sheet = ss.getSheetByName('Telemetry');
  if (!sheet) {
    sheet = ss.insertSheet('Telemetry');
    sheet.appendRow([
      'Timestamp', 'Session ID', 'Original Size', 'Compressed Size',
      'Savings %', 'Page Count', 'Methods Used', 'Methods Successful',
      'Top Method', 'Errors', 'User Agent', 'Country'
    ]);
    sheet.getRange(1, 1, 1, 12).setFontWeight('bold');
  }

  sheet.appendRow([
    new Date().toISOString(),
    report.sessionId || '',
    report.originalSize || 0,
    report.compressedSize || 0,
    report.savingsPercent || 0,
    report.pageCount || 0,
    (report.methodsUsed || []).join(', '),
    (report.methodsSuccessful || []).join(', '),
    report.topMethod || '',
    report.errorCount || 0,
    report.userAgent || '',
    ''
  ]);
}

/**
 * Write an error row to the "Errors" tab.
 *
 * Columns:
 *   Timestamp | Session ID | Error Code | Error Message | User Message |
 *   File Name | File Size | Context | Stack Trace | User Agent
 *
 * Context values indicate where the error originated:
 *   - worker_compression      — compression worker returned an error
 *   - worker_onerror           — worker crashed unexpectedly
 *   - file_validation          — file failed basic validation (size/type)
 *   - pdf_signature_validation — file is not a valid PDF
 *   - batch_worker_compression — same as worker_compression, during batch
 *   - batch_worker_onerror     — same as worker_onerror, during batch
 *   - batch_timeout            — file exceeded 2-minute processing limit
 *   - batch_pdf_signature_validation — invalid PDF during batch
 *   - batch_file_read          — could not read file bytes
 *   - user_reported            — user clicked "Report Issue" button
 */
function handleError(ss, error) {
  var sheet = ss.getSheetByName('Errors');
  if (!sheet) {
    sheet = ss.insertSheet('Errors');
    sheet.appendRow([
      'Timestamp', 'Session ID', 'Error Code', 'Error Message',
      'User Message', 'File Name', 'File Size', 'Context',
      'Stack Trace', 'User Agent'
    ]);
    sheet.getRange(1, 1, 1, 10).setFontWeight('bold');
  }

  sheet.appendRow([
    error.timestamp || new Date().toISOString(),
    error.sessionId || '',
    error.errorCode || '',
    error.errorMessage || '',
    error.userMessage || '',
    error.fileName || '',
    error.fileSize || 0,
    error.context || '',
    error.stack || '',
    error.userAgent || ''
  ]);
}
