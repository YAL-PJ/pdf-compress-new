'use client';

import { CompressionOptions, ImageCompressionSettings } from '@/lib/types';
import { PRESETS, PresetId, getPresetForCurrentSettings } from '@/lib/presets';
import { trackPresetSelected } from '@/lib/analytics';
import { motion } from 'framer-motion';
import { twMerge } from 'tailwind-merge';

interface PresetSelectorProps {
    options: CompressionOptions;
    imageSettings: ImageCompressionSettings;
    onSelect: (options: CompressionOptions, imageSettings: ImageCompressionSettings) => void;
    disabled?: boolean;
}

export const PresetSelector = ({
    options,
    imageSettings,
    onSelect,
    disabled = false,
}: PresetSelectorProps) => {
    const currentPresetId = getPresetForCurrentSettings(options, imageSettings);

    const handlePresetClick = (presetId: PresetId) => {
        if (disabled || presetId === 'custom') return;

        // Track preset selection
        trackPresetSelected(presetId);

        const preset = PRESETS[presetId];
        onSelect(preset.options, preset.imageSettings);
    };

    const presetKeys: PresetId[] = ['recommended', 'maximum'];

    return (
        <div className="grid grid-cols-2 gap-3 mb-6">
            {presetKeys.map((key) => {
                const preset = PRESETS[key];
                const isActive = currentPresetId === key;
                const Icon = preset.icon;

                return (
                    <button
                        key={key}
                        onClick={() => handlePresetClick(key)}
                        disabled={disabled}
                        className={twMerge(
                            "relative group p-3 rounded-lg border text-left transition-all duration-200",
                            "focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-1",
                            isActive
                                ? "bg-slate-900 border-slate-900 text-white shadow-md"
                                : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50",
                            disabled && "opacity-50 cursor-not-allowed"
                        )}
                        title={preset.description}
                    >
                        <div className="flex items-center gap-2 mb-1">
                            <Icon className={twMerge("w-4 h-4", isActive ? "text-emerald-400" : "text-slate-400")} />
                            <span className="text-sm font-bold">{preset.label}</span>
                        </div>
                        <div className={twMerge(
                            "text-xs truncate",
                            isActive ? "text-slate-300" : "text-slate-500"
                        )}>
                            {preset.description}
                        </div>

                        {/* Active Checkmark */}
                        {isActive && (
                            <motion.div
                                layoutId="active-preset"
                                className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-400"
                            />
                        )}
                    </button>
                );
            })}
        </div>
    );
};
