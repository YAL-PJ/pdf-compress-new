'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { formatBytes, calculateSavings, getOutputFilename } from '@/lib/utils';
import { trackDownload, trackTelemetry } from '@/lib/analytics';
import { applyPageOperations, hasPageModifications } from '@/lib/page-operations';
import { motion } from 'framer-motion';
import { Download, RefreshCw, FileCheck, ArrowRight, X, Loader2 } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import { PageGrid } from './PageGrid';
import { VisualDiff } from './VisualDiff';
import { ActivityLog } from './ActivityLog';
import { CompressionStats } from './CompressionStats';
import { renderPageToImage } from '@/lib/pdf-renderer';

import type { PageState } from '@/hooks/usePageManager';
import type { CompressionReport, MethodResult } from '@/lib/types';

interface ResultsDisplayProps {
  originalSize: number;
  compressedSize: number;
  pageCount: number;
  blob: Blob;
  originalFile: File;
  originalFileName: string;
  onReset: () => void;
  imageStats?: {
    totalImages: number;
    jpegCount: number;
    pngCount: number;
    otherCount: number;
  };
  // Page management (lifted state)
  pages?: PageState[];
  onToggleDeletePage?: (pageIndex: number) => void;
  onToggleKeepOriginalPage?: (pageIndex: number) => void;
  onRotatePage?: (pageIndex: number) => void;
  onReorderPages?: (fromPosition: number, toPosition: number) => void;
  onMovePage?: (pageIndex: number, direction: 'up' | 'down') => void;
  report?: CompressionReport;
  methodResults?: MethodResult[];
  isUpdating?: boolean;
  showCompressionAnalytics?: boolean;
}

import { memo } from 'react';

export const ResultsDisplay = memo(({
  originalSize,
  compressedSize,
  pageCount,
  blob,
  originalFile,
  originalFileName,
  onReset,
  imageStats,
  pages,
  onToggleDeletePage,
  onToggleKeepOriginalPage,
  onRotatePage,
  onReorderPages,
  onMovePage,
  report,
  methodResults,
  isUpdating,
  showCompressionAnalytics = true,
}: ResultsDisplayProps) => {
  const blobUrlRef = useRef<string | null>(null);
  const { savedBytes, savedPercent, isSmaller } = calculateSavings(originalSize, compressedSize);

  // Count active (non-deleted) pages
  const activePageCount = pages ? pages.filter(p => !p.isDeleted).length : pageCount;
  const hasPageOps = pages ? hasPageModifications(pages) : false;

  // Visual diff state
  const [diffImages, setDiffImages] = useState<{ original: string; compressed: string } | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState(false);
  const [previewPage, setPreviewPage] = useState(1);

  // Cache rendered page images to avoid re-rendering on navigation back
  const pageImageCache = useRef<Map<number, { original: string; compressed: string }>>(new Map());

  // Reset cache and page when file changes
  useEffect(() => {
    pageImageCache.current.clear();
    setPreviewPage(1);
    setDiffImages(null);
  }, [originalFile, blob]);

  // Generate visual diff preview images for the current page
  useEffect(() => {
    let cancelled = false;

    const generatePreviews = async () => {
      if (!originalFile || !blob) return;

      // Check cache first
      const cached = pageImageCache.current.get(previewPage);
      if (cached) {
        setDiffImages(cached);
        setDiffLoading(false);
        return;
      }

      setDiffLoading(true);
      setDiffError(false);

      try {
        const originalImage = await renderPageToImage(originalFile, previewPage, 1.0);

        const compressedFile = new File([blob], 'compressed.pdf', { type: 'application/pdf' });
        const compressedImage = await renderPageToImage(compressedFile, previewPage, 1.0);

        if (!cancelled) {
          const images = { original: originalImage, compressed: compressedImage };
          pageImageCache.current.set(previewPage, images);
          setDiffImages(images);
          setDiffLoading(false);
        }
      } catch (err) {
        console.warn('Failed to generate diff previews:', err);
        if (!cancelled) {
          setDiffError(true);
          setDiffLoading(false);
        }
      }
    };

    // Delay only on initial load (page 1), navigate instantly for other pages
    const delay = previewPage === 1 && !pageImageCache.current.has(1) ? 800 : 0;
    const timeoutId = setTimeout(() => {
      generatePreviews();
    }, delay);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [originalFile, blob, previewPage]);

  const handlePreviewPageChange = useCallback((page: number) => {
    if (page >= 1 && page <= pageCount) {
      setPreviewPage(page);
    }
  }, [pageCount]);

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [blob]);

  // Track Telemetry
  useEffect(() => {
    if (report) {
      trackTelemetry(report, methodResults);
    }
  }, [report, methodResults]);

  const [isApplyingPageOps, setIsApplyingPageOps] = useState(false);

  const handleDownload = useCallback(async () => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
    }

    let downloadBlob = blob;

    // Apply page operations (delete, rotate, reorder) if user made any changes
    if (pages && hasPageModifications(pages)) {
      setIsApplyingPageOps(true);
      try {
        downloadBlob = await applyPageOperations(blob, pages, originalFile);
      } catch (err) {
        console.error('Failed to apply page operations:', err);
        // Fall back to original compressed blob
        downloadBlob = blob;
      } finally {
        setIsApplyingPageOps(false);
      }
    }

    // Track download event
    trackDownload(downloadBlob.size / 1024 / 1024);

    const url = URL.createObjectURL(downloadBlob);
    blobUrlRef.current = url;

    const link = document.createElement('a');
    link.href = url;
    link.download = getOutputFilename(originalFileName);
    link.click();
  }, [blob, originalFileName, pages]);

  const compressionRatio = Math.min(Math.max((compressedSize / originalSize) * 100, 5), 100);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white rounded-lg overflow-hidden shadow-sm border border-slate-200"
      role="region"
      aria-label="Compression results"
    >
      {/* Header */}
      <div className="bg-slate-50 border-b border-slate-200 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-8 h-8 rounded-md bg-emerald-100 flex items-center justify-center text-emerald-700 flex-shrink-0 border border-emerald-200">
            <FileCheck className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-800 truncate">
              {originalFileName}
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              {activePageCount !== pageCount ? (
                <span>{activePageCount}/{pageCount} pages</span>
              ) : (
                <span>{pageCount} pages</span>
              )} • {isUpdating ? (
                <span className="inline-flex items-center gap-1 text-blue-600">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Recompressing...
                </span>
              ) : diffLoading ? (
                <span className="inline-flex items-center gap-1 text-slate-500">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Rendering preview...
                </span>
              ) : 'Ready'}
            </p>
          </div>
        </div>

        <button
          onClick={onReset}
          className="p-1.5 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-600 transition-colors"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Updating indicator banner */}
      {isUpdating && (
        <div className="bg-blue-50 border-b border-blue-200 px-4 py-2.5 flex items-center gap-2.5">
          <Loader2 className="w-4 h-4 animate-spin text-blue-600 flex-shrink-0" />
          <span className="text-xs font-semibold text-blue-700">
            Recompressing with new settings... Results below may be stale.
          </span>
        </div>
      )}

      <div className="p-6 space-y-8">
        {/* Visual Comparison */}
        <div className={twMerge("space-y-4 transition-opacity duration-300", isUpdating && "opacity-50")}>
          <div className="flex items-end justify-between text-sm">
            <span className="font-semibold text-slate-600">Size Comparison</span>
            <span className={twMerge(
              "font-bold px-2 py-0.5 rounded text-xs",
              isSmaller ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
            )}>
              {isSmaller ? `SAVED ${savedPercent.toFixed(1)}%` : 'NO SAVINGS'}
            </span>
          </div>

          {/* Bars - Sharper */}
          <div className="relative h-10 bg-slate-100 rounded border border-slate-200 overflow-hidden flex items-center">
            {/* Original Size Bar (Background) */}
            <div className="absolute inset-y-0 left-0 bg-slate-200 w-full" />

            {/* Compressed Size Bar - Solid High Contrast Color */}
            <motion.div
              initial={{ width: '100%' }}
              animate={{ width: `${compressionRatio}%` }}
              transition={{ duration: 0.8, ease: "circOut", delay: 0.2 }}
              className={twMerge(
                "absolute inset-y-0 left-0 border-r border-white/20",
                isSmaller ? "bg-emerald-600" : "bg-amber-500"
              )}
            />

            {/* Labels overlaid on bars - High Contrast Text Shadow */}
            <div className="absolute inset-0 flex justify-between items-center px-4 pointer-events-none">
              <span className="z-10 text-xs font-bold text-slate-700 drop-shadow-sm bg-white/50 px-1 rounded backdrop-blur-[2px]">
                ORIGINAL: {formatBytes(originalSize)}
              </span>
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="z-10 text-xs font-bold text-white drop-shadow-md bg-black/20 px-1 rounded"
              >
                {formatBytes(compressedSize)}
              </motion.span>
            </div>
          </div>
        </div>


        {/* Visual Difference Tool */}
        <div className={twMerge("space-y-3 transition-opacity duration-300", isUpdating && "opacity-50")}>
          <h3 className="text-sm font-bold text-slate-800">Visual Quality Comparison</h3>
          {diffLoading && (
            <div className="relative flex items-center justify-center h-48 bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
              {/* Shimmer animation */}
              <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent" />
              <div className="flex flex-col items-center gap-2 text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                <span className="text-sm font-medium">Rendering visual preview...</span>
                <span className="text-xs text-slate-400">Comparing original vs compressed</span>
              </div>
            </div>
          )}
          {diffError && (
            <div className="flex items-center justify-center h-32 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-sm text-slate-400">Unable to generate visual comparison</p>
            </div>
          )}
          {diffImages && !diffLoading && !diffError && (
            <VisualDiff
              originalImageSrc={diffImages.original}
              compressedImageSrc={diffImages.compressed}
              currentPage={previewPage}
              totalPages={pageCount}
              onPageChange={handlePreviewPageChange}
            />
          )}
        </div>

        {/* Page Manager Tool */}
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <PageGrid
            file={originalFile}
            pageCount={pageCount}
            pages={pages}
            onToggleDelete={onToggleDeletePage}
            onToggleKeepOriginal={onToggleKeepOriginalPage}
            onRotate={onRotatePage}
            onReorder={onReorderPages}
            onMovePage={onMovePage}
            selectedPreviewPage={previewPage}
            onSelectPreviewPage={handlePreviewPageChange}
            compressedBlob={blob}
          />
        </div>

        {/* Compression Analytics */}
        {showCompressionAnalytics && methodResults && (
          <div className="pt-4 border-t border-slate-100">
            <CompressionStats
              methodResults={methodResults}
              originalSize={originalSize}
              compressedSize={compressedSize}
              report={report}
            />
          </div>
        )}

        {/* Activity Log */}
        {report && (
          <div className="pt-4 border-t border-slate-100">
            <ActivityLog logs={report.logs} />
          </div>
        )}

        {/* Action Buttons - Solid Blocks */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            onClick={onReset}
            className="flex-1 px-4 py-3 rounded-md border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 hover:text-slate-900 transition-colors flex items-center justify-center gap-2 text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            New File
          </button>
          <button
            onClick={handleDownload}
            disabled={isApplyingPageOps}
            className="flex-[2] px-4 py-3 rounded-md bg-slate-900 text-white font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2 text-sm shadow-sm disabled:opacity-70 disabled:cursor-wait"
          >
            {isApplyingPageOps ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Applying page changes...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                DOWNLOAD PDF
                <ArrowRight className="w-4 h-4 opacity-70" />
              </>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
});

ResultsDisplay.displayName = 'ResultsDisplay';
