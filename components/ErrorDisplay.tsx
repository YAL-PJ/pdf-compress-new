'use client';

import type { PdfError } from '@/lib/errors';

interface ErrorDisplayProps {
  error: PdfError;
  onReset: () => void;
}

export const ErrorDisplay = ({ error, onReset }: ErrorDisplayProps) => {
  return (
    <div 
      className="bg-white rounded-xl p-6"
      role="alert"
      aria-live="assertive"
    >
      <div className="text-center mb-6">
        <div className="text-4xl mb-4" aria-hidden="true">
          ❌
        </div>
        <p className="text-red-600 font-medium">
          {error.userMessage}
        </p>
      </div>
      
      <button
        onClick={onReset}
        className="w-full bg-gray-100 text-gray-700 py-3 px-6 rounded-lg font-medium
                   hover:bg-gray-200 focus:outline-none focus:ring-2 
                   focus:ring-gray-500 focus:ring-offset-2 transition-colors"
      >
        Try Another File
      </button>
    </div>
  );
};
