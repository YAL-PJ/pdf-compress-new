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
    setOptions: (options: CompressionOptions) => void;
    setImageSettings: (settings: ImageCompressionSettings) => void;
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
}

export const PdfProvider = ({ children, initialFile, onReset }: PdfProviderProps) => {
    const { state, processFile: processFileInternal, reset: resetInternal } = usePdfCompression();

    const [options, setOptions] = useState<CompressionOptions>(PRESETS.balanced.options);
    const [imageSettings, setImageSettings] = useState<ImageCompressionSettings>(PRESETS.balanced.imageSettings);

    // Refs for tracking previous settings for auto-recompression
    const prevSettingsRef = useRef<ImageCompressionSettings>(PRESETS.balanced.imageSettings);
    const prevOptionsRef = useRef<CompressionOptions>(PRESETS.balanced.options);
    const initialFileProcessed = useRef(false);

    // Process initial file (once)
    useEffect(() => {
        if (initialFile && state.status === 'idle' && !initialFileProcessed.current) {
            initialFileProcessed.current = true;
            processFileInternal(initialFile, { imageSettings, options });
        }
    }, [initialFile]); // eslint-disable-line react-hooks/exhaustive-deps

    // Wrapper for processFile to use current settings
    const processFile = useCallback((file: File) => {
        prevSettingsRef.current = imageSettings;
        prevOptionsRef.current = options;
        processFileInternal(file, { imageSettings, options });
    }, [processFileInternal, imageSettings, options]);

    const reset = useCallback(() => {
        resetInternal();
        setOptions(PRESETS.balanced.options);
        setImageSettings(PRESETS.balanced.imageSettings);
        prevSettingsRef.current = PRESETS.balanced.imageSettings;
        prevOptionsRef.current = PRESETS.balanced.options;
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
            processFileInternal(fileToProcess, { imageSettings, options }, true);
        }, 500);

        return () => clearTimeout(timer);
    }, [imageSettings, options, state, processFileInternal]);

    const isProcessing = state.status === 'processing' || state.status === 'validating';
    const isUpdating = state.status === 'done' ? !!state.isUpdating : false;
    const analysis = state.status === 'done' ? state.analysis : null;

    // Memoize context value to prevent unnecessary re-renders
    const value = useMemo<PdfContextType>(() => ({
        state,
        options,
        imageSettings,
        setOptions,
        setImageSettings,
        processFile,
        reset,
        isProcessing,
        isUpdating,
        analysis,
    }), [state, options, imageSettings, processFile, reset, isProcessing, isUpdating, analysis]);

    return (
        <PdfContext.Provider value={value}>
            {children}
        </PdfContext.Provider>
    );
};
