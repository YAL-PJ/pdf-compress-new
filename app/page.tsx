'use client';

import { useState, useCallback, useMemo } from 'react';
import { 
  UploadZone, 
  ResultsDisplay, 
  ProcessingIndicator, 
  ErrorDisplay,
  CompressionMethods,
} from '@/components';
import { usePdfCompression } from '@/hooks/usePdfCompression';
import { DEFAULT_COMPRESSION_OPTIONS, CompressionOptions } from '@/lib/types';

export default function Home() {
  const { state, processFile, reset } = usePdfCompression();
  const [options, setOptions] = useState<CompressionOptions>(DEFAULT_COMPRESSION_OPTIONS);

  const handleFileSelect = useCallback((file: File) => {
    processFile(file);
  }, [processFile]);

  const handleReset = useCallback(() => {
    reset();
    setOptions(DEFAULT_COMPRESSION_OPTIONS);
  }, [reset]);

  // Calculate estimated compressed size by summing selected methods
  const currentResult = useMemo(() => {
    if (state.status !== 'done') return null;

    const { analysis } = state;
    const hasSelectedMethods = Object.values(options).some(Boolean);
    
    // Sum savings from enabled methods
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
    };
  }, [state, options]);

  const isProcessing = state.status === 'processing' || state.status === 'validating';
  const showMethodsPanel = state.status === 'idle' || state.status === 'done' || isProcessing;

  const methodResults = state.status === 'done' 
    ? state.analysis.methodResults 
    : undefined;

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🗜️ PDF Compress
          </h1>
          <p className="text-gray-600">
            Compress your PDFs in the browser. No upload to servers.
          </p>
        </header>

        {/* Main layout */}
        <div className="flex flex-col md:flex-row gap-6">
          {/* Left: Compression methods */}
          {showMethodsPanel && (
            <aside className="md:w-72 flex-shrink-0">
              <CompressionMethods
                options={options}
                onChange={setOptions}
                disabled={isProcessing}
                methodResults={methodResults}
              />
            </aside>
          )}

          {/* Right: Main content */}
          <div className="flex-1">
            {state.status === 'idle' && (
              <UploadZone onFileSelect={handleFileSelect} />
            )}

            {state.status === 'validating' && (
              <ProcessingIndicator 
                fileName="" 
                progress="Validating file..." 
              />
            )}

            {state.status === 'processing' && (
              <ProcessingIndicator 
                fileName={state.fileName} 
                progress={state.progress} 
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
              />
            )}

            {state.status === 'error' && (
              <ErrorDisplay error={state.error} onReset={handleReset} />
            )}
          </div>
        </div>

        {/* Privacy notice */}
        <footer className="text-center text-sm text-gray-500 mt-8">
          <p>🔒 Your files never leave your browser. All processing happens locally.</p>
        </footer>
      </div>
    </main>
  );
}
