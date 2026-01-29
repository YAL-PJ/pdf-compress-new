'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  UploadZone,
  ResultsDisplay,
  ProcessingIndicator,
  ErrorDisplay,
  CompressionMethods,
} from '@/components';
import { usePdfCompression } from '@/hooks/usePdfCompression';
import {
  DEFAULT_COMPRESSION_OPTIONS,
  DEFAULT_IMAGE_SETTINGS,
  CompressionOptions,
  ImageCompressionSettings,
} from '@/lib/types';

export default function Home() {
  const { state, processFile, reset } = usePdfCompression();
  const [options, setOptions] = useState<CompressionOptions>(DEFAULT_COMPRESSION_OPTIONS);
  const [imageSettings, setImageSettings] = useState<ImageCompressionSettings>(DEFAULT_IMAGE_SETTINGS);

  // Track settings effectively used to prevent infinite processing loops
  const prevSettingsRef = useRef<ImageCompressionSettings>(DEFAULT_IMAGE_SETTINGS);

  const handleFileSelect = useCallback((file: File) => {
    prevSettingsRef.current = imageSettings; // Sync ref immediately on manual action
    processFile(file, imageSettings);
  }, [processFile, imageSettings]);

  const handleReset = useCallback(() => {
    reset();
    setOptions(DEFAULT_COMPRESSION_OPTIONS);
    setImageSettings(DEFAULT_IMAGE_SETTINGS);
    prevSettingsRef.current = DEFAULT_IMAGE_SETTINGS; // Sync ref on reset
  }, [reset]);

  // Re-process when image settings change (debounced)
  useEffect(() => {
    if (state.status !== 'done') return;

    // Only process if settings actually CHANGED from what we last processed
    // This equality check is crucial to stop infinite loops
    if (JSON.stringify(imageSettings) === JSON.stringify(prevSettingsRef.current)) {
      return;
    }

    // Capture file ref to satisfy TS/closure
    const fileToProcess = state.originalFile;

    // Debounce to prevent flashing/overload while sliding
    const timer = setTimeout(() => {
      prevSettingsRef.current = imageSettings; // Mark as handled
      processFile(fileToProcess, imageSettings, true); // background mode
    }, 500);

    return () => clearTimeout(timer);
  }, [imageSettings, state, processFile]);

  const currentResult = useMemo(() => {
    if (state.status !== 'done') return null;

    const { analysis } = state;
    const hasSelectedMethods = Object.values(options).some(Boolean);

    let totalSaved = 0;
    for (const result of analysis.methodResults) {
      if (options[result.key]) {
        totalSaved += result.savedBytes;
      }
    }

    const estimatedSize = hasSelectedMethods
      ? analysis.baselineSize - totalSaved
      : analysis.originalSize;

    return {
      originalSize: analysis.originalSize,
      compressedSize: estimatedSize,
      pageCount: analysis.pageCount,
      blob: hasSelectedMethods ? analysis.fullBlob : state.originalFile,
      imageStats: analysis.imageStats,
    };
  }, [state, options]);

  // Check valid status for showing methods panel
  // Ideally, if updating in bg, status is still 'done', so panel shows.
  const isProcessing = state.status === 'processing' || state.status === 'validating';
  const showMethodsPanel = state.status === 'idle' || state.status === 'done' || isProcessing;

  const methodResults = state.status === 'done' ? state.analysis.methodResults : undefined;
  const imageStats = state.status === 'done' ? state.analysis.imageStats : undefined;
  const isUpdating = state.status === 'done' ? state.isUpdating : false;

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">🗜️ PDF Compress</h1>
          <p className="text-gray-600">Compress your PDFs in the browser. No upload to servers.</p>
        </header>

        <div className="flex flex-col md:flex-row gap-6">
          {showMethodsPanel && (
            <aside className="md:w-80 flex-shrink-0">
              <CompressionMethods
                options={options}
                onChange={setOptions}
                disabled={isProcessing && !isUpdating} // Allow interaction if just bg updating (except maybe file upload)
                methodResults={methodResults}
                imageSettings={imageSettings}
                onImageSettingsChange={setImageSettings}
                imageStats={imageStats}
                baselineOverhead={state.status === 'done' ? (state.analysis.baselineSize - state.analysis.originalSize) : 0}
                isUpdating={isUpdating}
              />
            </aside>
          )}

          <div className="flex-1">
            {state.status === 'idle' && (
              <UploadZone onFileSelect={handleFileSelect} />
            )}

            {state.status === 'validating' && (
              <ProcessingIndicator fileName="" progress="Validating file..." />
            )}

            {state.status === 'processing' && (
              <ProcessingIndicator
                fileName={state.fileName}
                progress={state.progress}
                progressPercent={state.progressPercent}
              />
            )}

            {state.status === 'done' && currentResult && (
              <ResultsDisplay
                originalSize={currentResult.originalSize}
                compressedSize={currentResult.compressedSize}
                pageCount={currentResult.pageCount}
                blob={currentResult.blob}
                originalFileName={state.fileName}
                onReset={handleReset}
                imageStats={currentResult.imageStats}
              />
            )}

            {state.status === 'error' && (
              <ErrorDisplay error={state.error} onReset={handleReset} />
            )}
          </div>
        </div>

        <footer className="text-center text-sm text-gray-500 mt-8">
          <p>🔒 Your files never leave your browser. All processing happens locally.</p>
        </footer>
      </div>
    </main>
  );
}
