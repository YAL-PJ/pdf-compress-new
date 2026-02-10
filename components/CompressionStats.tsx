'use client';

import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, BarChart3, TrendingDown, AlertTriangle, CheckCircle } from 'lucide-react';
import { formatBytes } from '@/lib/utils';
import type { MethodResult, CompressionReport } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';
import { twMerge } from 'tailwind-merge';

/** Human-readable labels for compression method keys */
const METHOD_LABELS: Record<string, string> = {
  useObjectStreams: 'Object Streams',
  stripMetadata: 'Strip Metadata',
  recompressImages: 'Recompress Images',
  downsampleImages: 'Downsample Images',
  convertToGrayscale: 'Convert to Grayscale',
  pngToJpeg: 'PNG to JPEG',
  convertToMonochrome: 'Convert to Monochrome',
  removeAlphaChannels: 'Remove Alpha Channels',
  removeColorProfiles: 'Remove Color Profiles',
  cmykToRgb: 'CMYK to RGB',
  removeThumbnails: 'Remove Thumbnails',
  removeDuplicateResources: 'Remove Duplicates',
  removeUnusedFonts: 'Remove Unused Fonts',
  removeAttachments: 'Remove Attachments',
  flattenForms: 'Flatten Forms',
  flattenAnnotations: 'Flatten Annotations',
  removeJavaScript: 'Remove JavaScript',
  removeBookmarks: 'Remove Bookmarks',
  removeNamedDestinations: 'Remove Named Destinations',
  removeArticleThreads: 'Remove Article Threads',
  removeWebCaptureInfo: 'Remove Web Capture',
  removeHiddenLayers: 'Remove Hidden Layers',
  removePageLabels: 'Remove Page Labels',
  deepCleanMetadata: 'Deep Clean Metadata',
  inlineToXObject: 'Inline to XObject',
  compressContentStreams: 'Compress Content Streams',
  removeOrphanObjects: 'Remove Orphan Objects',
  removeAlternateContent: 'Remove Alternate Content',
  removeInvisibleText: 'Remove Invisible Text',
};

interface CompressionStatsProps {
  methodResults: MethodResult[];
  originalSize: number;
  compressedSize: number;
  report?: CompressionReport;
  className?: string;
}

export const CompressionStats = ({
  methodResults,
  originalSize,
  compressedSize,
  report,
  className,
}: CompressionStatsProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const stats = useMemo(() => {
    const effective = methodResults
      .filter(m => m.savedBytes > 0)
      .sort((a, b) => b.savedBytes - a.savedBytes);

    const totalSaved = originalSize - compressedSize;
    const maxSaved = effective.length > 0 ? effective[0].savedBytes : 0;

    const methodsUsed = report?.methodsUsed.length ?? 0;
    const methodsSuccessful = report?.methodsSuccessful.length ?? 0;
    const errorCount = report?.logs.filter(l => l.level === 'error').length ?? 0;
    const warningCount = report?.logs.filter(l => l.level === 'warning').length ?? 0;

    return { effective, totalSaved, maxSaved, methodsUsed, methodsSuccessful, errorCount, warningCount };
  }, [methodResults, originalSize, compressedSize, report]);

  return (
    <div className={twMerge('border border-slate-200 rounded-lg overflow-hidden bg-white', className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className="bg-indigo-50 p-2 rounded-md">
            <BarChart3 className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">Compression Analytics</h3>
            <p className="text-xs text-slate-500 font-medium">
              {stats.effective.length} method{stats.effective.length !== 1 ? 's' : ''} saved space
              {stats.errorCount > 0 && ` • ${stats.errorCount} error${stats.errorCount !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {stats.totalSaved > 0 && (
            <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-2 py-1 rounded flex items-center gap-1">
              <TrendingDown className="w-3 h-3" />
              {formatBytes(stats.totalSaved)} saved
            </span>
          )}
          {isOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-slate-100"
          >
            <div className="p-4 space-y-4">
              {/* Summary Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 rounded-md p-3 text-center">
                  <div className="text-lg font-bold text-slate-900">{stats.methodsUsed}</div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Methods Used</div>
                </div>
                <div className="bg-emerald-50 rounded-md p-3 text-center">
                  <div className="text-lg font-bold text-emerald-700">{stats.methodsSuccessful}</div>
                  <div className="text-[10px] text-emerald-600 uppercase tracking-wider font-semibold">Saved Space</div>
                </div>
                <div className="bg-slate-50 rounded-md p-3 text-center">
                  <div className="text-lg font-bold text-slate-900">
                    {originalSize > 0 ? Math.round((stats.totalSaved / originalSize) * 100) : 0}%
                  </div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Total Reduction</div>
                </div>
                <div className={twMerge(
                  'rounded-md p-3 text-center',
                  stats.errorCount > 0 ? 'bg-red-50' : 'bg-slate-50'
                )}>
                  <div className={twMerge(
                    'text-lg font-bold',
                    stats.errorCount > 0 ? 'text-red-700' : 'text-slate-900'
                  )}>
                    {stats.errorCount}
                  </div>
                  <div className={twMerge(
                    'text-[10px] uppercase tracking-wider font-semibold',
                    stats.errorCount > 0 ? 'text-red-600' : 'text-slate-500'
                  )}>Errors</div>
                </div>
              </div>

              {/* Per-Method Breakdown */}
              {stats.effective.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Method Performance
                  </h4>
                  <div className="space-y-1.5">
                    {stats.effective.map((method) => {
                      const pct = stats.maxSaved > 0 ? (method.savedBytes / stats.maxSaved) * 100 : 0;
                      const pctOfOriginal = originalSize > 0 ? (method.savedBytes / originalSize) * 100 : 0;
                      return (
                        <div key={method.key} className="group">
                          <div className="flex items-center justify-between text-xs mb-0.5">
                            <span className="font-medium text-slate-700 flex items-center gap-1.5">
                              <CheckCircle className="w-3 h-3 text-emerald-500" />
                              {METHOD_LABELS[method.key] || method.key}
                            </span>
                            <span className="font-mono text-slate-500 tabular-nums">
                              {formatBytes(method.savedBytes)}
                              <span className="text-slate-400 ml-1">({pctOfOriginal.toFixed(1)}%)</span>
                            </span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.4, ease: 'easeOut' }}
                              className="h-full bg-indigo-500 rounded-full"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Warnings */}
              {stats.warningCount > 0 && report && (
                <div className="space-y-1.5">
                  <h4 className="text-xs font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Warnings ({stats.warningCount})
                  </h4>
                  {report.logs
                    .filter(l => l.level === 'warning')
                    .map((warning, i) => (
                      <div key={i} className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1.5">
                        {warning.message}
                      </div>
                    ))}
                </div>
              )}

              {/* Methods that didn't save anything */}
              {methodResults.filter(m => m.savedBytes === 0).length > 0 && (
                <details className="text-xs">
                  <summary className="text-slate-400 cursor-pointer hover:text-slate-600 font-medium">
                    {methodResults.filter(m => m.savedBytes === 0).length} methods had no impact
                  </summary>
                  <div className="mt-1.5 text-slate-400 space-y-0.5 pl-2">
                    {methodResults
                      .filter(m => m.savedBytes === 0)
                      .map(m => (
                        <div key={m.key}>{METHOD_LABELS[m.key] || m.key}</div>
                      ))}
                  </div>
                </details>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
