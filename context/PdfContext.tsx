'use client';

import React, { createContext, useContext, useCallback, useState, useRef, useEffect } from 'react';
import {
    CompressionOptions,
    ImageCompressionSettings,
    DEFAULT_COMPRESSION_OPTIONS,
    DEFAULT_IMAGE_SETTINGS,
    CompressionAnalysis,
} from '@/lib/types';
import { PdfError } from '@/lib/errors';
import { usePdfCompression, CompressionState } from '@/hooks/usePdfCompression';
import { trackPresetSelected } from '@/lib/analytics';

// Define the shape of our context
interface PdfContextType {
    // State
    state: CompressionState;
    options: CompressionOptions;
    imageSettings: ImageCompressionSettings;

    // Actions
    setOptions: (options: CompressionOptions) => void;
    setImageSettings: (settings: ImageCompressionSettings) => void;
    processFile: (file: File) => void;
    reset: () => void;

    // Helpers
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

    // Lifted state for settings
    const [options, setOptions] = useState<CompressionOptions>(DEFAULT_COMPRESSION_OPTIONS);
    const [imageSettings, setImageSettings] = useState<ImageCompressionSettings>(DEFAULT_IMAGE_SETTINGS);

    // Refs for debouncing auto-recompression
    const prevSettingsRef = useRef<ImageCompressionSettings>(DEFAULT_IMAGE_SETTINGS);
    const prevOptionsRef = useRef<CompressionOptions>(DEFAULT_COMPRESSION_OPTIONS);

    // Process initial file
    useEffect(() => {
        if (initialFile && state.status === 'idle') {
            // Track initial upload
            processFileInternal(initialFile, { imageSettings, options });
        }
    }, [initialFile]);

    // Wrapper for processFile to use current settings
    const processFile = useCallback((file: File) => {
        prevSettingsRef.current = imageSettings;
        prevOptionsRef.current = options;
        processFileInternal(file, { imageSettings, options });
    }, [processFileInternal, imageSettings, options]);

    // Smart Reset
    const reset = useCallback(() => {
        resetInternal();
        setOptions(DEFAULT_COMPRESSION_OPTIONS);
        setImageSettings(DEFAULT_IMAGE_SETTINGS);
        prevSettingsRef.current = DEFAULT_IMAGE_SETTINGS;
        prevOptionsRef.current = DEFAULT_COMPRESSION_OPTIONS;
        if (onReset) onReset();
    }, [resetInternal, onReset]);

    // Auto-recompression effect
    useEffect(() => {
        if (state.status !== 'done') return;

        const imageSettingsChanged = JSON.stringify(imageSettings) !== JSON.stringify(prevSettingsRef.current);
        const optionsChanged = JSON.stringify(options) !== JSON.stringify(prevOptionsRef.current);

        if (!imageSettingsChanged && !optionsChanged) return;

        // Use the original file from state, not the already compressed blob
        const fileToProcess = state.originalFile;

        // Debounce re-compression
        const timer = setTimeout(() => {
            prevSettingsRef.current = imageSettings;
            prevOptionsRef.current = options;
            // Pass isBackground=true to avoid full loading screen
            processFileInternal(fileToProcess, { imageSettings, options }, true);
        }, 500);

        return () => clearTimeout(timer);
    }, [imageSettings, options, state, processFileInternal]);

    const value: PdfContextType = {
        state,
        options,
        imageSettings,
        setOptions,
        setImageSettings,
        processFile,
        reset,
        isProcessing: state.status === 'processing' || state.status === 'validating',
        isUpdating: state.status === 'done' ? !!state.isUpdating : false,
        analysis: state.status === 'done' ? state.analysis : null,
    };

    return (
        <PdfContext.Provider value={value}>
            {children}
        </PdfContext.Provider>
    );
};
