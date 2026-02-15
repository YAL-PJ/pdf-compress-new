'use client';

import { PRESETS, PresetId, getPresetForCurrentSettings } from '@/lib/presets';
import { trackPresetSelected } from '@/lib/analytics';
import { motion } from 'framer-motion';
import { twMerge } from 'tailwind-merge';
import { memo, useState, useEffect, startTransition } from 'react';
import { usePdf } from '@/context/PdfContext';

export const PresetSelector = memo(() => {
    const { options, imageSettings, setOptions, setImageSettings, isProcessing, isUpdating } = usePdf();

    // Check disabled state
    const disabled = isProcessing && !isUpdating;

    // Optimistic local state for immediate feedback
    const realPresetId = getPresetForCurrentSettings(options, imageSettings);
    const [optimisticPresetId, setOptimisticPresetId] = useState<PresetId | null>(null);

    // Sync optimistic state when real state updates
    useEffect(() => {
        setOptimisticPresetId(null);
    }, [realPresetId]);

    const activePresetId = optimisticPresetId ?? realPresetId;

    const handlePresetClick = (presetId: PresetId) => {
        if (disabled || presetId === 'custom') return;

        // Immediate visual feedback
        setOptimisticPresetId(presetId);

        trackPresetSelected(presetId);

        const preset = PRESETS[presetId];

        startTransition(() => {
            setOptions(preset.options);
            setImageSettings(preset.imageSettings);
        });
    };

    const presetKeys: PresetId[] = ['minimal', 'balanced', 'aggressive'];

    return (
        <div className="grid grid-cols-3 gap-2 mb-6">
            {presetKeys.map((key) => {
                const preset = PRESETS[key];
                const isActive = activePresetId === key;
                const Icon = preset.icon;

                return (
                    <button
                        key={key}
                        onClick={() => handlePresetClick(key)}
                        disabled={disabled}
                        className={twMerge(
                            "relative group px-3 py-2 rounded-lg border text-center transition-all duration-200",
                            "focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-1 select-none",
                            isActive
                                ? "bg-slate-900 border-slate-900 text-white shadow-md transform scale-[1.02]"
                                : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50",
                            disabled && "opacity-50 cursor-not-allowed"
                        )}
                        title={preset.description}
                    >
                        <div className="flex items-center justify-center gap-1.5">
                            <Icon className={twMerge("w-4 h-4 flex-shrink-0", isActive ? "text-emerald-400" : "text-slate-500")} />
                            <span className="text-sm font-bold">{preset.label}</span>
                        </div>

                        {/* Active indicator dot */}
                        {isActive && (
                            <motion.div
                                layoutId="active-preset"
                                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-emerald-400"
                            />
                        )}
                    </button>
                );
            })}
        </div>
    );
});

PresetSelector.displayName = 'PresetSelector';
