'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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

  const prevSettingsRef = useRef<ImageCompressionSettings>(DEFAULT_IMAGE_SETTINGS);

  const handleFileSelect = useCallback((file: File) => {
    prevSettingsRef.current = imageSettings;
    processFile(file, { imageSettings, options });
  }, [processFile, imageSettings, options]);

  const handleReset = useCallback(() => {
    reset();
    setOptions(DEFAULT_COMPRESSION_OPTIONS);
    setImageSettings(DEFAULT_IMAGE_SETTINGS);
    prevSettingsRef.current = DEFAULT_IMAGE_SETTINGS;
  }, [reset]);

  useEffect(() => {
    if (state.status !== 'done') return;

    if (JSON.stringify(imageSettings) === JSON.stringify(prevSettingsRef.current)) {
      return;
    }

    const fileToProcess = state.originalFile;
    const timer = setTimeout(() => {
      prevSettingsRef.current = imageSettings;
      processFile(fileToProcess, { imageSettings, options }, true);
    }, 500);

    return () => clearTimeout(timer);
  }, [imageSettings, options, state, processFile]);

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

  const methodResults = state.status === 'done' ? state.analysis.methodResults : undefined;
  const imageStats = state.status === 'done' ? state.analysis.imageStats : undefined;
  const isUpdating = state.status === 'done' ? state.isUpdating : false;
  const isProcessing = state.status === 'processing' || state.status === 'validating';

  return (
    <main className="min-h-screen w-full bg-slate-50 text-slate-900 font-sans selection:bg-slate-200">
      {/* Background - Technical Grid for Pro feel */}
      <div className="fixed inset-0 z-0 bg-[linear-gradient(to_right,#e2e8f080_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f080_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        {/* Header */}
        <header className="mb-12 flex flex-col items-center md:items-start md:flex-row md:justify-between gap-6">
          <div className="text-center md:text-left">
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl flex items-center gap-3 justify-center md:justify-start">
              <span className="text-3xl">🗜️</span>
              PDF Compress <span className="text-slate-400 font-normal">PRO</span>
            </h1>
            <p className="mt-2 text-lg text-slate-500 max-w-2xl">
              Professional client-side compression. No server uploads. 100% Secure.
            </p>
          </div>
        </header>

        <div className="flex flex-col lg:flex-row gap-8 items-start">

          {/* Sidebar - Controls (Visible when needed) */}
          <AnimatePresence>
            {(state.status === 'idle' || state.status === 'done' || isProcessing) && (
              <motion.aside
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="w-full lg:w-80 flex-shrink-0 space-y-6 lg:sticky lg:top-8"
              >
                <CompressionMethods
                  options={options}
                  onChange={setOptions}
                  disabled={isProcessing && !isUpdating}
                  methodResults={methodResults}
                  imageSettings={imageSettings}
                  onImageSettingsChange={setImageSettings}
                  imageStats={imageStats}
                  baselineOverhead={state.status === 'done' ? (state.analysis.baselineSize - state.analysis.originalSize) : 0}
                  isUpdating={isUpdating}
                />

                {state.status === 'idle' && (
                  <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-4 text-sm text-blue-700">
                    <p><strong>Tip:</strong> Select your compression preference before or after uploading.</p>
                  </div>
                )}
              </motion.aside>
            )}
          </AnimatePresence>

          {/* Main Content Area */}
          <div className="flex-1 w-full min-w-0">
            <AnimatePresence mode="wait">

              {/* IDLE STATE */}
              {state.status === 'idle' && (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <UploadZone onFileSelect={handleFileSelect} />
                </motion.div>
              )}

              {/* PROCESSING STATE */}
              {isProcessing && (
                <motion.div
                  key="processing"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="flex justify-center py-12"
                >
                  <ProcessingIndicator
                    fileName={state.status === 'processing' ? state.fileName : ''}
                    progress={state.status === 'processing' ? state.progress : 'Validating file...'}
                    progressPercent={state.status === 'processing' ? state.progressPercent : undefined}
                  />
                </motion.div>
              )}

              {/* RESULTS STATE */}
              {state.status === 'done' && currentResult && (
                <motion.div
                  key="results"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  <ResultsDisplay
                    originalSize={currentResult.originalSize}
                    compressedSize={currentResult.compressedSize}
                    pageCount={currentResult.pageCount}
                    blob={currentResult.blob}
                    originalFileName={state.fileName}
                    onReset={handleReset}
                    imageStats={currentResult.imageStats}
                  />


                </motion.div>
              )}

              {/* ERROR STATE */}
              {state.status === 'error' && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <ErrorDisplay error={state.error} onReset={handleReset} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>
      </div>
    </main>
  );
}
