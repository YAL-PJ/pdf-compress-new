'use client';

import { useState, useCallback, useMemo, startTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    UploadZone,
    ResultsDisplay,
    ProcessingIndicator,
    ErrorDisplay,
    CompressionMethods,
    PresetSelector,
    TargetSizeSlider,
    BatchUploadZone,
    FileQueueList,
    ErrorBoundary,
    BetaFeedbackBanner,
} from '@/components';

import { Footer } from '@/components/landing/Footer';

// Hooks
import { useBatchCompression } from '@/hooks/useBatchCompression';
import { usePageManager } from '@/hooks/usePageManager';
import { usePdf, PdfProvider } from '@/context/PdfContext';

// Types
import type {
    CompressionOptions,
    ImageCompressionSettings,
} from '@/lib/types';


interface PdfAppProps {
    initialFile?: File;
    onReset?: () => void;
}

// Inner component that consumes Context
const PdfAppContent = ({ onReset }: { onReset?: () => void }) => {
    const {
        state,
        options,
        imageSettings,
        setOptions,
        setImageSettings,
        reset: resetContext,
        processFile,
        isProcessing,
        isUpdating,
        analysis
    } = usePdf();

    // Batch processing (kept separate for now as requested)
    const [isBatchMode, setIsBatchMode] = useState(false);
    const {
        queue,
        isProcessing: isBatchProcessing,
        stats: batchStats,
        addFiles,
        removeFile,
        clearQueue,
        startProcessing: startBatchProcessing,
    } = useBatchCompression();

    // Page management - lifted state
    const pageCount = state.status === 'done' && analysis ? analysis.pageCount : 0;
    const { pages, toggleDelete, rotatePage, reorderPages, movePage } = usePageManager(pageCount);

    const handleReset = useCallback(() => {
        resetContext();
        onReset?.();
    }, [resetContext, onReset]);

    // Handle batch file selection
    const handleBatchFilesSelect = useCallback((files: File[]) => {
        addFiles(files);
    }, [addFiles]);

    // Start batch processing
    const handleStartBatchProcessing = useCallback(() => {
        startBatchProcessing({ imageSettings, options });
    }, [startBatchProcessing, imageSettings, options]);

    // Toggle between single and batch mode
    const toggleBatchMode = useCallback(() => {
        setIsBatchMode(prev => !prev);
        if (isBatchMode) {
            clearQueue();
        } else {
            handleReset();
        }
    }, [isBatchMode, clearQueue, handleReset]);

    // Handle preset selection
    const handlePresetSelect = useCallback((newOptions: CompressionOptions, newSettings: ImageCompressionSettings) => {
        startTransition(() => {
            setOptions(newOptions);
            setImageSettings(newSettings);
        });
    }, [setOptions, setImageSettings]);

    // Smart result calculation
    const currentResult = useMemo(() => {
        if (state.status !== 'done' || !analysis) return null;

        const hasSelectedMethods = Object.values(options).some(Boolean);

        // When methods are selected, use the actual compressed blob size for accurate savings display.
        const compressedSize = hasSelectedMethods
            ? analysis.fullBlob.size
            : analysis.originalSize;

        return {
            originalSize: analysis.originalSize,
            compressedSize,
            pageCount: analysis.pageCount,
            blob: hasSelectedMethods ? analysis.fullBlob : state.originalFile,
            imageStats: analysis.imageStats,
        };
    }, [state, options, analysis]);

    const methodResults = state.status === 'done' ? state.analysis.methodResults : undefined;
    const imageStats = state.status === 'done' ? state.analysis.imageStats : undefined;

    /* =========================
       APP VIEW (from /compress - the better version)
    ========================= */

    return (
        <ErrorBoundary>
            <BetaFeedbackBanner />

            <main
                id="main-content"
                className="min-h-screen w-full bg-slate-50 text-slate-900 font-sans selection:bg-slate-200 pt-10"
                role="main"
            >
                {/* Background - Technical Grid for Pro feel */}
                <div
                    className="fixed inset-0 z-0 bg-[linear-gradient(to_right,#e2e8f080_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f080_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"
                    aria-hidden="true"
                />

                <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 md:py-12">
                    {/* Header */}
                    <header className="mb-8 sm:mb-12 flex flex-col items-center md:items-start md:flex-row md:justify-between gap-4 sm:gap-6">
                        <div className="text-center md:text-left">
                            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl flex items-center gap-2 sm:gap-3 justify-center md:justify-start">
                                <span className="text-2xl sm:text-3xl" aria-hidden="true">🗜️</span>
                                <span>PDF Compress</span>
                                <span className="text-slate-400 font-normal text-lg sm:text-xl md:text-2xl">PRO</span>
                            </h1>
                            <p className="mt-2 text-base sm:text-lg text-slate-500 max-w-2xl">
                                Professional client-side compression. No server uploads. 100% Secure.
                            </p>
                        </div>
                    </header>

                    <div className="flex flex-col lg:flex-row gap-8 items-start">

                        {/* Sidebar - Controls (Visible when needed) */}
                        <AnimatePresence>
                            {(state.status === 'idle' || state.status === 'done' || isProcessing) && (
                                <motion.aside
                                    initial={false}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="w-full lg:w-80 flex-shrink-0 space-y-6 lg:sticky lg:top-8"
                                >
                                    <div className="bg-white border rounded-lg shadow-sm p-4">
                                        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-3">
                                            Compression Levels
                                        </h2>
                                        {/* Simplified Prop Usage via Context in wrapper */}
                                        <PresetSelector />
                                    </div>

                                    <TargetSizeSlider />

                                    <CompressionMethods />

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

                                {/* IDLE STATE / BATCH MODE */}
                                {(state.status === 'idle' || isBatchMode) && !isProcessing && (
                                    <motion.div
                                        key="idle-batch"
                                        initial={false}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="space-y-4"
                                    >
                                        {/* Mode Toggle */}
                                        <div className="flex justify-end">
                                            <button
                                                onClick={toggleBatchMode}
                                                disabled={isBatchProcessing}
                                                className="text-sm px-3 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {isBatchMode ? '← Single File Mode' : 'Batch Mode →'}
                                            </button>
                                        </div>

                                        {/* Upload Zone - Single or Batch */}
                                        {isBatchMode ? (
                                            <>
                                                <BatchUploadZone
                                                    onFilesSelect={handleBatchFilesSelect}
                                                    disabled={isBatchProcessing}
                                                />

                                                {/* Batch Queue */}
                                                {queue.length > 0 && (
                                                    <>
                                                        <FileQueueList queue={queue} onRemove={removeFile} />

                                                        {/* Batch Action Buttons */}
                                                        <div className="flex gap-3">
                                                            {batchStats.queued > 0 && (
                                                                <button
                                                                    onClick={handleStartBatchProcessing}
                                                                    disabled={isBatchProcessing}
                                                                    className="flex-1 px-4 py-3 rounded-md bg-slate-900 text-white font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2 text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                                                >
                                                                    {isBatchProcessing ? (
                                                                        <>
                                                                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                                            Processing...
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            Compress {batchStats.queued} File{batchStats.queued !== 1 ? 's' : ''}
                                                                        </>
                                                                    )}
                                                                </button>
                                                            )}

                                                            <button
                                                                onClick={clearQueue}
                                                                disabled={isBatchProcessing}
                                                                className="px-4 py-3 rounded-md border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                                            >
                                                                Clear All
                                                            </button>
                                                        </div>
                                                    </>
                                                )}
                                            </>
                                        ) : (
                                            <UploadZone onFileSelect={processFile} />
                                        )}
                                    </motion.div>
                                )}

                                {/* PROCESSING STATE (Single file mode only) */}
                                {isProcessing && !isBatchMode && (
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

                                {/* RESULTS STATE (Single file mode only) */}
                                {state.status === 'done' && currentResult && !isBatchMode && (
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
                                            originalFile={state.originalFile}
                                            originalFileName={state.fileName}
                                            onReset={handleReset}
                                            imageStats={currentResult.imageStats}
                                            pages={pages}
                                            onToggleDeletePage={toggleDelete}
                                            onRotatePage={rotatePage}
                                            onReorderPages={reorderPages}
                                            onMovePage={movePage}
                                            report={analysis?.report}
                                            methodResults={methodResults}
                                            isUpdating={isUpdating}
                                        />
                                    </motion.div>
                                )}

                                {/* ERROR STATE (Single file mode only) */}
                                {state.status === 'error' && !isBatchMode && (
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

                <Footer />
            </main>
        </ErrorBoundary>
    );
};

// Main Export - Wrapper with Provider
export const PdfApp = ({ initialFile, onReset }: PdfAppProps) => {
    return (
        <PdfProvider initialFile={initialFile} onReset={onReset}>
            <PdfAppContent onReset={onReset} />
        </PdfProvider>
    );
};
