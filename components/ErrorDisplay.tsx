'use client';

import { useState } from 'react';
import type { PdfError } from '@/lib/errors';
import { AlertCircle, RefreshCw, Bug, Copy, Check } from 'lucide-react';
import * as Sentry from '@sentry/nextjs';

interface ErrorDisplayProps {
  error: PdfError;
  onReset: () => void;
}

export const ErrorDisplay = ({ error, onReset }: ErrorDisplayProps) => {
  const [copied, setCopied] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);

  const errorDetails = `Error Code: ${error.code}\nMessage: ${error.message}\nTime: ${new Date().toISOString()}`;

  const handleCopyError = async () => {
    try {
      await navigator.clipboard.writeText(errorDetails);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  };

  const handleReportIssue = () => {
    // Report to Sentry
    const eventId = Sentry.captureException(error, {
      extra: {
        errorCode: error.code,
        userMessage: error.userMessage,
      },
    });

    // Show Sentry report dialog if available
    if (eventId) {
      Sentry.showReportDialog({
        eventId,
        title: 'Report an Issue',
        subtitle: 'Help us fix this problem',
        subtitle2: 'Your feedback is valuable to us.',
        labelSubmit: 'Submit Report',
      });
    }

    setReportSubmitted(true);
    setTimeout(() => setReportSubmitted(false), 3000);
  };

  return (
    <div
      className="bg-white rounded-xl p-6 max-w-md mx-auto shadow-sm border border-slate-200"
      role="alert"
      aria-live="assertive"
    >
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-red-500" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">
          Processing Failed
        </h2>
        <p className="text-slate-600">
          {error.userMessage}
        </p>
      </div>

      {/* Error details (collapsible) */}
      <details className="mb-6 bg-slate-50 rounded-lg border border-slate-200">
        <summary className="px-4 py-3 cursor-pointer text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
          Technical Details
        </summary>
        <div className="px-4 pb-3">
          <div className="flex items-start justify-between gap-2">
            <pre className="text-xs text-slate-500 font-mono whitespace-pre-wrap break-all">
              {errorDetails}
            </pre>
            <button
              onClick={handleCopyError}
              className="flex-shrink-0 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded transition-colors"
              aria-label={copied ? 'Copied!' : 'Copy error details'}
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </details>

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={onReset}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
        >
          <RefreshCw className="w-4 h-4" aria-hidden="true" />
          Try Another File
        </button>

        <button
          onClick={handleReportIssue}
          disabled={reportSubmitted}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Bug className="w-4 h-4" aria-hidden="true" />
          {reportSubmitted ? 'Reported!' : 'Report Issue'}
        </button>
      </div>

      {/* Help text */}
      <p className="mt-4 text-xs text-slate-400 text-center">
        If this problem persists, please report it so we can investigate.
      </p>
    </div>
  );
};
