
import { useState, useCallback } from 'react';
import { BatchFileItem } from '@/lib/batch-types';

export const useBatchCompression = () => {
    const [queue, setQueue] = useState<BatchFileItem[]>([]);

    const addFiles = useCallback((files: File[]) => {
        const newItems: BatchFileItem[] = files.map(file => ({
            id: crypto.randomUUID(),
            originalFile: file,
            status: 'queued',
            progress: 0,
        }));

        setQueue(prev => [...prev, ...newItems]);
    }, []);

    const removeFile = useCallback((id: string) => {
        setQueue(prev => prev.filter(item => item.id !== id));
    }, []);

    const clearQueue = useCallback(() => {
        setQueue([]);
    }, []);

    // Update logic to be added in Phase 4 (Server) or Phase 2 extension
    // For now, this just manages the UI state of the queue.
    const updateFileStatus = useCallback((id: string, updates: Partial<BatchFileItem>) => {
        setQueue(prev => prev.map(item =>
            item.id === id ? { ...item, ...updates } : item
        ));
    }, []);

    return {
        queue,
        addFiles,
        removeFile,
        clearQueue,
        updateFileStatus
    };
};
