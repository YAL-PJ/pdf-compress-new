
import { CompressionOptions, ImageCompressionSettings, DEFAULT_COMPRESSION_OPTIONS, DEFAULT_IMAGE_SETTINGS } from './types';
import { Package, Zap, ShieldCheck, Scale } from 'lucide-react';

export type PresetId = 'aggressive' | 'balanced' | 'minimal' | 'custom';

export interface CompressionPreset {
    id: PresetId;
    label: string;
    description: string;
    icon: typeof Package; // Using Lucide icon type
    options: CompressionOptions;
    imageSettings: ImageCompressionSettings;
}

export const PRESETS: Record<PresetId, CompressionPreset> = {
    aggressive: {
        id: 'aggressive',
        label: 'Aggressive',
        description: 'Max compression, lower quality',
        icon: Zap,
        options: {
            ...DEFAULT_COMPRESSION_OPTIONS,
            useObjectStreams: true,
            stripMetadata: true,
            recompressImages: true,
            downsampleImages: true,
        },
        imageSettings: {
            ...DEFAULT_IMAGE_SETTINGS,
            quality: 40,
            targetDpi: 72,
            enableDownsampling: true,
        },
    },
    balanced: {
        id: 'balanced',
        label: 'Balanced',
        description: 'Good compression & quality',
        icon: Scale,
        options: {
            ...DEFAULT_COMPRESSION_OPTIONS,
            useObjectStreams: true,
            stripMetadata: true,
            recompressImages: true,
            downsampleImages: true,
            removeDuplicateResources: true,
            removeColorProfiles: true,
            deepCleanMetadata: true,
        },
        imageSettings: {
            ...DEFAULT_IMAGE_SETTINGS,
            quality: 65,
            targetDpi: 150,
            enableDownsampling: true,
        },
    },
    minimal: {
        id: 'minimal',
        label: 'Minimal',
        description: 'Highest quality preservation',
        icon: ShieldCheck,
        options: {
            ...DEFAULT_COMPRESSION_OPTIONS,
            useObjectStreams: true,
            stripMetadata: true,
            recompressImages: true,
            downsampleImages: false,
        },
        imageSettings: {
            ...DEFAULT_IMAGE_SETTINGS,
            quality: 90,
            targetDpi: 300,
            enableDownsampling: false,
        },
    },
    custom: {
        id: 'custom',
        label: 'Custom',
        description: 'Manual settings',
        icon: Package,
        options: DEFAULT_COMPRESSION_OPTIONS,
        imageSettings: DEFAULT_IMAGE_SETTINGS,
    },
};

export const getPresetForCurrentSettings = (
    currentOptions: CompressionOptions,
    currentImageSettings: ImageCompressionSettings
): PresetId => {
    // Check Aggressive
    if (
        JSON.stringify(currentOptions) === JSON.stringify(PRESETS.aggressive.options) &&
        JSON.stringify(currentImageSettings) === JSON.stringify(PRESETS.aggressive.imageSettings)
    ) {
        return 'aggressive';
    }

    // Check Balanced
    if (
        JSON.stringify(currentOptions) === JSON.stringify(PRESETS.balanced.options) &&
        JSON.stringify(currentImageSettings) === JSON.stringify(PRESETS.balanced.imageSettings)
    ) {
        return 'balanced';
    }

    // Check Minimal
    if (
        JSON.stringify(currentOptions) === JSON.stringify(PRESETS.minimal.options) &&
        JSON.stringify(currentImageSettings) === JSON.stringify(PRESETS.minimal.imageSettings)
    ) {
        return 'minimal';
    }

    return 'custom';
};
