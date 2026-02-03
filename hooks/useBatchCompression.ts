
import { useState, useCallback, useRef, useEffect } from 'react';
import { BatchFileItem } from '@/lib/batch-types';
import type {
    WorkerResponse,
    WorkerSuccessPayload,
    WorkerErrorPayload,
    WorkerProgressPayload,
    ImageCompressionSettings,
    CompressionOptions,
} from '@/lib/types';
import { DEFAULT_IMAGE_SETTINGS, DEFAULT_COMPRESSION_OPTIONS } from '@/lib/types';
import { validateFile } from '@/lib/utils';
import { createPdfError } from '@/lib/errors';

interface BatchCompressionSettings {
    imageSettings: ImageCompressionSettings;
    options: CompressionOptions;
}

export const useBatchCompression = () => {
    const [queue, setQueue] = useState<BatchFileItem[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const workerRef = useRef<Worker | null>(null);
    const currentFileIdRef = useRef<string | null>(null);

    // Cleanup worker on unmount
    useEffect(() => {
        return () => {
            workerRef.current?.terminate();
        };
    }, []);

    const addFiles = useCallback((files: File[]) => {
        const newItems: BatchFileItem[] = files.map(file => {
            // Validate file on add
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

            // Update status to processing
            setQueue(prev => prev.map(i =>
                i.id === item.id ? { ...i, status: 'processing' as const, progress: 0 } : i
            ));

            // Create worker
            workerRef.current?.terminate();
            workerRef.current = new Worker(
                new URL('../workers/pdf.worker.ts', import.meta.url)
            );

            workerRef.current.onmessage = (event: MessageEvent<WorkerResponse>) => {
                const { type, payload } = event.data;

                // Ignore if this is not the current file being processed
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
                                },
                            } : i
                        ));
                        resolve();
                        break;
                    }

                    case 'error': {
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
                        resolve(); // Resolve even on error to continue with next file
                        break;
                    }
                }
            };

            workerRef.current.onerror = (error) => {
                setQueue(prev => prev.map(i =>
                    i.id === item.id ? {
                        ...i,
                        status: 'error' as const,
                        progress: 0,
                        error: createPdfError('WORKER_ERROR', error.message),
                    } : i
                ));
                resolve(); // Resolve even on error to continue with next file
            };

            // Start processing
            item.originalFile.arrayBuffer().then((arrayBuffer) => {
                workerRef.current?.postMessage(
                    {
                        type: 'start',
                        payload: { arrayBuffer, fileName: item.originalFile.name, imageSettings, options }
                    },
                    [arrayBuffer]
                );
            }).catch((err) => {
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

        // Get all queued items
        const queuedItems = queue.filter(item => item.status === 'queued');

        // Process each file sequentially
        for (const item of queuedItems) {
            // Re-check if item is still in queue (might have been removed)
            const currentQueue = await new Promise<BatchFileItem[]>(resolve => {
                setQueue(prev => {
                    resolve(prev);
                    return prev;
                });
            });

            const stillExists = currentQueue.find(i => i.id === item.id);
            if (!stillExists || stillExists.status !== 'queued') continue;

            await processFile(item, { imageSettings, options });
        }

        setIsProcessing(false);
        currentFileIdRef.current = null;
    }, [queue, processFile]);

    // Get statistics
    const stats = {
        total: queue.length,
        queued: queue.filter(i => i.status === 'queued').length,
        processing: queue.filter(i => i.status === 'processing').length,
        done: queue.filter(i => i.status === 'done').length,
        error: queue.filter(i => i.status === 'error').length,
    };

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
