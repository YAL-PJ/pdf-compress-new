'use client';

import { useCallback } from 'react';
import { BatchFileItem } from '@/lib/batch-types';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, X, CheckCircle2, AlertCircle, Loader2, Download, Archive } from 'lucide-react';
import { formatBytes, calculateSavings } from '@/lib/utils';
import { createZipBlob, downloadBlob, getCompressedFilename } from '@/lib/zip-utils';
import { twMerge } from 'tailwind-merge';

interface FileQueueListProps {
    queue: BatchFileItem[];
    onRemove: (id: string) => void;
    showDownloads?: boolean;
}

export const FileQueueList = ({ queue, onRemove, showDownloads = true }: FileQueueListProps) => {
    // Download single file
    const handleDownloadFile = useCallback((item: BatchFileItem) => {
        if (item.status !== 'done' || !item.analysis?.fullBlob) return;

        const filename = getCompressedFilename(item.originalFile.name);
        downloadBlob(item.analysis.fullBlob, filename);
    }, []);

    // Download all as ZIP
    const handleDownloadAll = useCallback(async () => {
        const completedItems = queue.filter(
            item => item.status === 'done' && item.analysis?.fullBlob
        );

        if (completedItems.length === 0) return;

        const entries = await Promise.all(
            completedItems.map(async (item) => {
                const blob = item.analysis!.fullBlob;
                const arrayBuffer = await blob.arrayBuffer();
                return {
                    name: getCompressedFilename(item.originalFile.name),
                    data: new Uint8Array(arrayBuffer),
                };
            })
        );

        const zipBlob = await createZipBlob(entries);
        downloadBlob(zipBlob, 'compressed_pdfs.zip');
    }, [queue]);

    if (queue.length === 0) return null;

    const completedCount = queue.filter(i => i.status === 'done').length;
    const totalSaved = queue.reduce((sum, item) => {
        if (item.status === 'done' && item.analysis) {
            // Use actual blob size for accurate savings calculation
            const { savedBytes } = calculateSavings(item.analysis.originalSize, item.analysis.fullBlob.size);
            return sum + Math.max(0, savedBytes); // Don't count negative savings
        }
        return sum;
    }, 0);

    return (
        <div className="w-full space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-slate-500">
                        Queue ({queue.length})
                    </span>
                    {completedCount > 0 && (
                        <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                            {completedCount} done
                        </span>
                    )}
                </div>

                {/* Download All Button */}
                {showDownloads && completedCount > 1 && (
                    <button
                        onClick={handleDownloadAll}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                    >
                        <Archive className="w-4 h-4" />
                        Download All ({completedCount})
                    </button>
                )}
            </div>

            {/* Summary Stats */}
            {completedCount > 0 && totalSaved > 0 && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 flex items-center justify-between">
                    <span className="text-sm text-emerald-700">
                        Total space saved across {completedCount} file{completedCount !== 1 ? 's' : ''}
                    </span>
                    <span className="text-sm font-bold text-emerald-800">
                        {formatBytes(totalSaved)}
                    </span>
                </div>
            )}

            {/* File List */}
            <div className="space-y-2">
                <AnimatePresence mode="popLayout">
                    {queue.map((item) => (
                        <FileQueueItem
                            key={item.id}
                            item={item}
                            onRemove={onRemove}
                            onDownload={showDownloads ? handleDownloadFile : undefined}
                        />
                    ))}
                </AnimatePresence>
            </div>
        </div>
    );
};

// Individual file item component
interface FileQueueItemProps {
    item: BatchFileItem;
    onRemove: (id: string) => void;
    onDownload?: (item: BatchFileItem) => void;
}

const FileQueueItem = ({ item, onRemove, onDownload }: FileQueueItemProps) => {
    // Use actual blob size for accurate savings calculation
    const savings = item.status === 'done' && item.analysis
        ? calculateSavings(item.analysis.originalSize, item.analysis.fullBlob.size)
        : null;

    return (
        <motion.div
            layout
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10, scale: 0.95 }}
            className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm group hover:border-slate-300 transition-colors"
        >
            <div className="flex items-center justify-between gap-3">
                {/* File Info */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={twMerge(
                        "w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0",
                        item.status === 'done' ? "bg-emerald-100 text-emerald-600" :
                            item.status === 'error' ? "bg-red-100 text-red-600" :
                                item.status === 'processing' ? "bg-blue-100 text-blue-600" :
                                    "bg-slate-100 text-slate-500"
                    )}>
                        <FileText className="w-5 h-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                        <h4 className="font-medium text-slate-800 text-sm truncate">
                            {item.originalFile.name}
                        </h4>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span>{formatBytes(item.originalFile.size)}</span>
                            {savings && savings.isSmaller && (
                                <>
                                    <span className="text-slate-300">→</span>
                                    <span className="text-emerald-600 font-medium">
                                        {formatBytes(item.analysis!.fullBlob.size)}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Status & Actions */}
                <div className="flex items-center gap-3">
                    {/* Status Badge */}
                    <StatusBadge item={item} savings={savings} />

                    {/* Download Button */}
                    {onDownload && item.status === 'done' && (
                        <button
                            onClick={() => onDownload(item)}
                            className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"
                            title="Download compressed file"
                        >
                            <Download className="w-4 h-4" />
                        </button>
                    )}

                    {/* Remove Button */}
                    <button
                        onClick={() => onRemove(item.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        title="Remove from queue"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Progress Bar */}
            {item.status === 'processing' && (
                <div className="mt-3">
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-blue-500 rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${item.progress}%` }}
                            transition={{ duration: 0.3 }}
                        />
                    </div>
                </div>
            )}

            {/* Error Message */}
            {item.status === 'error' && item.error && (
                <div className="mt-2 text-xs text-red-600 bg-red-50 rounded p-2">
                    {item.error.message}
                </div>
            )}
        </motion.div>
    );
};

// Status badge component
interface StatusBadgeProps {
    item: BatchFileItem;
    savings: ReturnType<typeof calculateSavings> | null;
}

const StatusBadge = ({ item, savings }: StatusBadgeProps) => {
    switch (item.status) {
        case 'queued':
            return (
                <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded">
                    Queued
                </span>
            );
        case 'processing':
            return (
                <div className="flex items-center gap-2 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>{item.progress}%</span>
                </div>
            );
        case 'done':
            return (
                <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>
                        {savings?.isSmaller
                            ? `-${savings.savedPercent.toFixed(0)}%`
                            : 'Done'}
                    </span>
                </div>
            );
        case 'error':
            return (
                <div className="flex items-center gap-2 text-xs font-medium text-red-700 bg-red-50 px-2 py-1 rounded">
                    <AlertCircle className="w-3 h-3" />
                    <span>Failed</span>
                </div>
            );
    }
};
