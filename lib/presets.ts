
import { CompressionOptions, ImageCompressionSettings, DEFAULT_COMPRESSION_OPTIONS, DEFAULT_IMAGE_SETTINGS } from './types';
import { Package, Zap, ShieldCheck } from 'lucide-react';

export type PresetId = 'recommended' | 'maximum' | 'custom';

export interface CompressionPreset {
    id: PresetId;
    label: string;
    description: string;
    icon: typeof Package; // Using Lucide icon type
    options: CompressionOptions;
    imageSettings: ImageCompressionSettings;
}

export const PRESETS: Record<PresetId, CompressionPreset> = {
    recommended: {
        id: 'recommended',
        label: 'Recommended',
        description: 'Balanced compression & quality',
        icon: ShieldCheck,
        options: {
            ...DEFAULT_COMPRESSION_OPTIONS,
            useObjectStreams: true,
            stripMetadata: true,
            recompressImages: true,
            downsampleImages: false, // Don't aggressively reduce resolution by default
        },
        imageSettings: {
            ...DEFAULT_IMAGE_SETTINGS,
            quality: 75, // Good balance
            targetDpi: 150,
        },
    },
    maximum: {
        id: 'maximum',
        label: 'Maximum',
        description: 'Smallest file size',
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
            quality: 50, // More aggressive
            targetDpi: 96, // Screen resolution
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
    // Check Recommended
    if (
        JSON.stringify(currentOptions) === JSON.stringify(PRESETS.recommended.options) &&
        JSON.stringify(currentImageSettings) === JSON.stringify(PRESETS.recommended.imageSettings)
    ) {
        return 'recommended';
    }

    // Check Maximum
    if (
        JSON.stringify(currentOptions) === JSON.stringify(PRESETS.maximum.options) &&
        JSON.stringify(currentImageSettings) === JSON.stringify(PRESETS.maximum.imageSettings)
    ) {
        return 'maximum';
    }

    return 'custom';
};
