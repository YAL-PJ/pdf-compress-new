'use client';

import { useCallback, useEffect, useRef } from 'react';
import { formatBytes, calculateSavings, getOutputFilename } from '@/lib/utils';

interface ResultsDisplayProps {
  originalSize: number;
  compressedSize: number;
  pageCount: number;
  blob: Blob;
  originalFileName: string;
  onReset: () => void;
}

export const ResultsDisplay = ({ 
  originalSize,
  compressedSize,
  pageCount,
  blob,
  originalFileName, 
  onReset 
}: ResultsDisplayProps) => {
  const blobUrlRef = useRef<string | null>(null);
  const { savedBytes, savedPercent, isSmaller } = calculateSavings(
    originalSize,
    compressedSize
  );

  // Cleanup blob URL on unmount or when blob changes
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [blob]);

  const handleDownload = useCallback(() => {
    // Revoke previous URL if exists
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
    }

    // Create new URL
    const url = URL.createObjectURL(blob);
    blobUrlRef.current = url;

    // Trigger download
    const link = document.createElement('a');
    link.href = url;
    link.download = getOutputFilename(originalFileName);
    link.click();
  }, [blob, originalFileName]);

  return (
    <div 
      className="bg-white rounded-xl p-6 shadow-sm"
      role="region"
      aria-label="Compression results"
    >
      <h2 className="text-lg font-semibold text-gray-800 mb-4">
        Results
      </h2>

      <div className="flex items-center justify-between gap-3 mb-6 rounded-lg border border-gray-100 px-4 py-3">
        <p className="text-sm font-medium text-gray-700 truncate">
          {originalFileName}
        </p>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-500
                     hover:text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2
                     focus:ring-gray-400 focus:ring-offset-2 transition-colors"
          aria-label="Remove file"
          title="Remove file"
        >
          <span aria-hidden="true" className="text-lg leading-none">
            ×
          </span>
        </button>
      </div>

      {/* Size comparison table */}
      <dl className="space-y-3 mb-6">
        <div className="flex justify-between py-2 border-b border-gray-100">
          <dt className="text-gray-600">Original size</dt>
          <dd className="font-medium">{formatBytes(originalSize)}</dd>
        </div>
        <div className="flex justify-between py-2 border-b border-gray-100">
          <dt className="text-gray-600">Compressed size</dt>
          <dd className="font-medium">{formatBytes(compressedSize)}</dd>
        </div>
        <div className="flex justify-between py-2 border-b border-gray-100">
          <dt className="text-gray-600">Pages</dt>
          <dd className="font-medium">{pageCount}</dd>
        </div>
      </dl>

      {/* Savings display */}
      <div
        className={`text-center py-4 rounded-lg mb-6 ${
          isSmaller ? 'bg-green-50' : 'bg-amber-50'
        }`}
        role="status"
        aria-live="polite"
      >
        {isSmaller ? (
          <p className="text-green-700 font-semibold text-lg">
            📉 Saved {formatBytes(savedBytes)} ({savedPercent.toFixed(1)}%)
          </p>
        ) : (
          <p className="text-amber-700 font-medium">
            📊 No size reduction (file may already be optimized)
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleDownload}
          className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg font-medium
                     hover:bg-blue-700 focus:outline-none focus:ring-2 
                     focus:ring-blue-500 focus:ring-offset-2 transition-colors"
        >
          Download
        </button>
      </div>
    </div>
  );
};
