import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { BatchFileItem } from '@/lib/batch-types';
import {
    DEFAULT_COMPRESSION_OPTIONS,
    DEFAULT_IMAGE_SETTINGS,
} from '@/lib/types';
import type {
    WorkerResponse,
    WorkerSuccessPayload,
    WorkerErrorPayload,
    WorkerProgressPayload,
    ImageCompressionSettings,
    CompressionOptions,
} from '@/lib/types';
import { validateFile, validatePdfSignature } from '@/lib/utils';
import { createPdfError } from '@/lib/errors';

interface BatchCompressionSettings {
    imageSettings: ImageCompressionSettings;
    options: CompressionOptions;
}

const WORKER_TIMEOUT_MS = 120_000; // 2 minutes per file

export const useBatchCompression = () => {
    const [queue, setQueue] = useState<BatchFileItem[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const workerRef = useRef<Worker | null>(null);
    const currentFileIdRef = useRef<string | null>(null);
    const queueRef = useRef<BatchFileItem[]>([]);

    // Keep queueRef in sync
    useEffect(() => {
        queueRef.current = queue;
    }, [queue]);

    // Cleanup worker on unmount
    useEffect(() => {
        return () => {
            workerRef.current?.terminate();
        };
    }, []);

    const addFiles = useCallback((files: File[]) => {
        const newItems: BatchFileItem[] = files.map(file => {
            const validation = validateFile(file);
            if (!validation.valid) {
                return {
                    id: crypto.randomUUID(),
                    originalFile: file,
                    status: 'error' as const,
                    progress: 0,
                    error: createPdfError('INVALID_FILE_TYPE', validation.error),
                };
            }

            return {
                id: crypto.randomUUID(),
                originalFile: file,
                status: 'queued' as const,
                progress: 0,
            };
        });

        setQueue(prev => [...prev, ...newItems]);
    }, []);

    const removeFile = useCallback((id: string) => {
        setQueue(prev => prev.filter(item => item.id !== id));
    }, []);

    const clearQueue = useCallback(() => {
        workerRef.current?.terminate();
        workerRef.current = null;
        currentFileIdRef.current = null;
        setIsProcessing(false);
        setQueue([]);
    }, []);

    const updateFileStatus = useCallback((id: string, updates: Partial<BatchFileItem>) => {
        setQueue(prev => prev.map(item =>
            item.id === id ? { ...item, ...updates } : item
        ));
    }, []);

    // Process a single file
    const processFile = useCallback((
        item: BatchFileItem,
        settings: BatchCompressionSettings
    ): Promise<void> => {
        return new Promise((resolve) => {
            const { imageSettings, options } = settings;

            currentFileIdRef.current = item.id;

            setQueue(prev => prev.map(i =>
                i.id === item.id ? { ...i, status: 'processing' as const, progress: 0 } : i
            ));

            // Per-file timeout to prevent hanging
            const timeout = setTimeout(() => {
                setQueue(prev => prev.map(i =>
                    i.id === item.id ? {
                        ...i,
                        status: 'error' as const,
                        progress: 0,
                        error: createPdfError('PROCESSING_FAILED', 'Processing timed out'),
                    } : i
                ));
                workerRef.current?.terminate();
                workerRef.current = null;
                resolve();
            }, WORKER_TIMEOUT_MS);

            // Reuse existing worker if available — avoids JIT warmup cost per file.
            // Only create a new worker if one doesn't exist (first file or after error termination).
            if (!workerRef.current) {
                workerRef.current = new Worker(
                    new URL('../workers/compression.worker.ts', import.meta.url)
                );
            }

            workerRef.current.onmessage = (event: MessageEvent<WorkerResponse>) => {
                const { type, payload } = event.data;

                if (currentFileIdRef.current !== item.id) return;

                switch (type) {
                    case 'progress': {
                        const p = payload as WorkerProgressPayload;
                        setQueue(prev => prev.map(i =>
                            i.id === item.id ? { ...i, progress: p.percent ?? 0 } : i
                        ));
                        break;
                    }

                    case 'success': {
                        clearTimeout(timeout);
                        const s = payload as WorkerSuccessPayload;
                        setQueue(prev => prev.map(i =>
                            i.id === item.id ? {
                                ...i,
                                status: 'done' as const,
                                progress: 100,
                                analysis: {
                                    originalSize: s.originalSize,
                                    pageCount: s.pageCount,
                                    baselineSize: s.baselineSize,
                                    fullBlob: new Blob([s.fullCompressedBuffer], { type: 'application/pdf' }),
                                    methodResults: s.methodResults,
                                    imageStats: s.imageStats,
                                    report: s.report,
                                },
                            } : i
                        ));
                        resolve();
                        break;
                    }

                    case 'error': {
                        clearTimeout(timeout);
                        const e = payload as WorkerErrorPayload;
                        setQueue(prev => prev.map(i =>
                            i.id === item.id ? {
                                ...i,
                                status: 'error' as const,
                                progress: 0,
                                error: createPdfError(
                                    e.code as Parameters<typeof createPdfError>[0],
                                    e.message
                                ),
                            } : i
                        ));
                        resolve();
                        break;
                    }
                }
            };

            workerRef.current.onerror = (error) => {
                clearTimeout(timeout);
                // Terminate broken worker so next file gets a fresh one
                workerRef.current?.terminate();
                workerRef.current = null;
                setQueue(prev => prev.map(i =>
                    i.id === item.id ? {
                        ...i,
                        status: 'error' as const,
                        progress: 0,
                        error: createPdfError('WORKER_ERROR', error.message),
                    } : i
                ));
                resolve();
            };

            // Start processing
            item.originalFile.arrayBuffer().then((arrayBuffer) => {
                const signatureValidation = validatePdfSignature(arrayBuffer);
                if (!signatureValidation.valid) {
                    clearTimeout(timeout);
                    setQueue(prev => prev.map(i =>
                        i.id === item.id ? {
                            ...i,
                            status: 'error' as const,
                            progress: 0,
                            error: createPdfError('INVALID_FILE_TYPE', signatureValidation.error),
                        } : i
                    ));
                    resolve();
                    return;
                }

                workerRef.current?.postMessage(
                    {
                        type: 'start',
                        payload: { arrayBuffer, fileName: item.originalFile.name, imageSettings, options }
                    },
                    [arrayBuffer]
                );
            }).catch((err) => {
                clearTimeout(timeout);
                setQueue(prev => prev.map(i =>
                    i.id === item.id ? {
                        ...i,
                        status: 'error' as const,
                        progress: 0,
                        error: createPdfError('PROCESSING_FAILED', `Failed to read file: ${err.message}`),
                    } : i
                ));
                resolve();
            });
        });
    }, []);

    // Start processing all queued files
    const startProcessing = useCallback(async (settings?: Partial<BatchCompressionSettings>) => {
        const imageSettings = settings?.imageSettings ?? DEFAULT_IMAGE_SETTINGS;
        const options = settings?.options ?? DEFAULT_COMPRESSION_OPTIONS;

        setIsProcessing(true);

        // Snapshot queued items at start
        const queuedItems = queueRef.current.filter(item => item.status === 'queued');

        for (const item of queuedItems) {
            // Re-check using ref (no extra reconciliation)
            const current = queueRef.current.find(i => i.id === item.id);
            if (!current || current.status !== 'queued') continue;

            await processFile(item, { imageSettings, options });
        }

        setIsProcessing(false);
        currentFileIdRef.current = null;
    }, [processFile]);

    // Compute stats via useMemo instead of recalculating on every render
    const stats = useMemo(() => {
        let queued = 0, processing = 0, done = 0, error = 0;
        for (const i of queue) {
            if (i.status === 'queued') queued++;
            else if (i.status === 'processing') processing++;
            else if (i.status === 'done') done++;
            else if (i.status === 'error') error++;
        }
        return { total: queue.length, queued, processing, done, error };
    }, [queue]);

    return {
        queue,
        isProcessing,
        stats,
        addFiles,
        removeFile,
        clearQueue,
        updateFileStatus,
        startProcessing,
    };
};
