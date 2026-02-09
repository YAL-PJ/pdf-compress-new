'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Bug } from 'lucide-react';

/**
 * Error handler for route segments.
 * Catches errors within the app directory.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Report error to console (Sentry removed)
    console.error('Route Segment Error:', error);
  }, [error]);

  const handleReportIssue = () => {
    // Console log reporting (Sentry removed)
    console.log('User reported issue:', error);
  };

  return (
    <div className="min-h-[600px] flex items-center justify-center p-8">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center border border-slate-200">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-8 h-8 text-red-500" aria-hidden="true" />
        </div>

        <h2 className="text-xl font-bold text-slate-900 mb-2">
          Something went wrong
        </h2>

        <p className="text-slate-500 mb-6">
          An error occurred while processing your request. Our team has been notified.
        </p>

        {process.env.NODE_ENV === 'development' && (
          <pre className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-left text-xs text-red-600 overflow-auto mb-6 max-h-32">
            {error.message}
          </pre>
        )}

        {error.digest && (
          <p className="text-xs text-slate-400 mb-6 font-mono">
            Error ID: {error.digest}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={reset}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            Try Again
          </button>

          <button
            onClick={handleReportIssue}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
          >
            <Bug className="w-4 h-4" aria-hidden="true" />
            Report Issue
          </button>
        </div>
      </div>
    </div>
  );
}
