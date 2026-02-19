'use client';

import React, { createContext, useContext, useCallback, useState, useRef, useEffect, useMemo } from 'react';
import {
    DEFAULT_COMPRESSION_OPTIONS,
    DEFAULT_IMAGE_SETTINGS,
} from '@/lib/types';
import type {
    CompressionOptions,
    ImageCompressionSettings,
    CompressionAnalysis,
} from '@/lib/types';
import { PRESETS } from '@/lib/presets';
import { usePdfCompression, CompressionState } from '@/hooks/usePdfCompression';

interface PdfContextType {
    state: CompressionState;
    options: CompressionOptions;
    imageSettings: ImageCompressionSettings;
    targetPercent: number | undefined;
    setOptions: (options: CompressionOptions) => void;
    setImageSettings: (settings: ImageCompressionSettings) => void;
    setTargetPercent: (percent: number | undefined) => void;
    processFile: (file: File) => void;
    reset: () => void;
    isProcessing: boolean;
    isUpdating: boolean;
    analysis: CompressionAnalysis | null;
}

const PdfContext = createContext<PdfContextType | null>(null);

export const usePdf = () => {
    const context = useContext(PdfContext);
    if (!context) {
        throw new Error('usePdf must be used within a PdfProvider');
    }
    return context;
};

interface PdfProviderProps {
    children: React.ReactNode;
    initialFile?: File;
    onReset?: () => void;
    autoProcessInitialFile?: boolean;
}

export const PdfProvider = ({ children, initialFile, onReset, autoProcessInitialFile = true }: PdfProviderProps) => {
    const { state, processFile: processFileInternal, reset: resetInternal } = usePdfCompression();

    const [options, setOptions] = useState<CompressionOptions>(PRESETS.minimal.options);
    const [imageSettings, setImageSettings] = useState<ImageCompressionSettings>(PRESETS.minimal.imageSettings);
    const [targetPercent, setTargetPercent] = useState<number | undefined>(undefined);

    // Refs for tracking previous settings for auto-recompression
    const prevSettingsRef = useRef<ImageCompressionSettings>(PRESETS.minimal.imageSettings);
    const prevOptionsRef = useRef<CompressionOptions>(PRESETS.minimal.options);
    const initialFileProcessed = useRef(false);

    // Process initial file (once)
    useEffect(() => {
        if (autoProcessInitialFile && initialFile && state.status === 'idle' && !initialFileProcessed.current) {
            initialFileProcessed.current = true;
            processFileInternal(initialFile, { imageSettings, options });
        }
    }, [autoProcessInitialFile, initialFile]); // eslint-disable-line react-hooks/exhaustive-deps

    // Wrapper for processFile to use current settings
    const processFile = useCallback((file: File) => {
        prevSettingsRef.current = imageSettings;
        prevOptionsRef.current = options;
        processFileInternal(file, { imageSettings, options, targetPercent });
    }, [processFileInternal, imageSettings, options, targetPercent]);

    const reset = useCallback(() => {
        resetInternal();
        setOptions(PRESETS.minimal.options);
        setImageSettings(PRESETS.minimal.imageSettings);
        setTargetPercent(undefined);
        prevSettingsRef.current = PRESETS.minimal.imageSettings;
        prevOptionsRef.current = PRESETS.minimal.options;
        initialFileProcessed.current = false;
        onReset?.();
    }, [resetInternal, onReset]);

    // Auto-recompression when settings change after initial compression
    useEffect(() => {
        if (state.status !== 'done') return;

        // Compare by reference first (cheap), then by value
        const imageSettingsChanged = imageSettings !== prevSettingsRef.current;
        const optionsChanged = options !== prevOptionsRef.current;

        if (!imageSettingsChanged && !optionsChanged) return;

        const fileToProcess = state.originalFile;

        const timer = setTimeout(() => {
            prevSettingsRef.current = imageSettings;
            prevOptionsRef.current = options;
            processFileInternal(fileToProcess, { imageSettings, options, targetPercent }, true);
        }, 500);

        return () => clearTimeout(timer);
    }, [imageSettings, options, targetPercent, state, processFileInternal]);

    const isProcessing = state.status === 'processing' || state.status === 'validating';
    const isUpdating = state.status === 'done' ? !!state.isUpdating : false;
    const analysis = state.status === 'done' ? state.analysis : null;

    // Memoize context value to prevent unnecessary re-renders
    const value = useMemo<PdfContextType>(() => ({
        state,
        options,
        imageSettings,
        targetPercent,
        setOptions,
        setImageSettings,
        setTargetPercent,
        processFile,
        reset,
        isProcessing,
        isUpdating,
        analysis,
    }), [state, options, imageSettings, targetPercent, processFile, reset, isProcessing, isUpdating, analysis]);

    return (
        <PdfContext.Provider value={value}>
            {children}
        </PdfContext.Provider>
    );
};
