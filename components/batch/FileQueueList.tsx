'use client';

import { BatchFileItem } from '@/lib/batch-types';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { formatBytes } from '@/lib/utils';
import { twMerge } from 'tailwind-merge';

interface FileQueueListProps {
    queue: BatchFileItem[];
    onRemove: (id: string) => void;
}

export const FileQueueList = ({ queue, onRemove }: FileQueueListProps) => {
    if (queue.length === 0) return null;

    return (
        <div className="w-full space-y-3">
            <div className="flex items-center justify-between text-sm font-medium text-slate-500 px-1">
                <span>Queue ({queue.length})</span>
                <span>Status</span>
            </div>

            <div className="space-y-2">
                <AnimatePresence mode="popLayout">
                    {queue.map((item) => (
                        <motion.div
                            key={item.id}
                            layout
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 10, scale: 0.95 }}
                            className="bg-white border border-slate-200 rounded-lg p-3 flex items-center justify-between shadow-sm group hover:border-slate-300 transition-colors"
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <div className={twMerge(
                                    "w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0",
                                    item.status === 'done' ? "bg-emerald-100 text-emerald-600" :
                                        item.status === 'error' ? "bg-red-100 text-red-600" :
                                            "bg-slate-100 text-slate-500"
                                )}>
                                    <FileText className="w-5 h-5" />
                                </div>

                                <div className="min-w-0">
                                    <h4 className="font-medium text-slate-800 text-sm truncate max-w-[200px] sm:max-w-xs">{item.originalFile.name}</h4>
                                    <p className="text-xs text-slate-500">{formatBytes(item.originalFile.size)}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                {/* Status Indicator */}
                                <div className="text-xs font-medium">
                                    {item.status === 'queued' && (
                                        <span className="text-slate-500 bg-slate-100 px-2 py-1 rounded">Queued</span>
                                    )}
                                    {item.status === 'processing' && (
                                        <div className="flex items-center gap-2 text-blue-600 bg-blue-50 px-2 py-1 rounded">
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                            <span>{item.progress}%</span>
                                        </div>
                                    )}
                                    {item.status === 'done' && (
                                        <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
                                            <CheckCircle2 className="w-3 h-3" />
                                            <span>Saved {item.analysis?.methodResults.reduce((acc, curr) => acc + curr.savedBytes, 0) ? formatBytes(item.analysis.methodResults.reduce((acc, curr) => acc + curr.savedBytes, 0)) : ''}</span>
                                        </div>
                                    )}
                                    {item.status === 'error' && (
                                        <div className="flex items-center gap-2 text-red-700 bg-red-50 px-2 py-1 rounded">
                                            <AlertCircle className="w-3 h-3" />
                                            <span>Failed</span>
                                        </div>
                                    )}
                                </div>

                                <button
                                    onClick={() => onRemove(item.id)}
                                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                    title="Remove from queue"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </div>
    );
};
