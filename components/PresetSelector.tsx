'use client';

import { PRESETS, PresetId, getPresetForCurrentSettings } from '@/lib/presets';
import { trackPresetSelected } from '@/lib/analytics';
import { motion } from 'framer-motion';
import { twMerge } from 'tailwind-merge';
import { memo, useState, useEffect } from 'react';
import { usePdf } from '@/context/PdfContext';

// No props needed! Fully autonomous component
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

        // Defer tracking slightly to prioritize UI update
        setTimeout(() => trackPresetSelected(presetId), 0);

        const preset = PRESETS[presetId];

        // Use React transition for smooth updates if available, or just direct update
        import('react').then(({ startTransition }) => {
            startTransition(() => {
                setOptions(preset.options);
                setImageSettings(preset.imageSettings);
            });
        });
    };

    const presetKeys: PresetId[] = ['minimal', 'balanced', 'aggressive'];

    return (
        <div className="grid grid-cols-1 gap-2 mb-6">
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
                            "relative group p-3 rounded-lg border text-left transition-all duration-200",
                            "focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-1 select-none",
                            isActive
                                ? "bg-slate-900 border-slate-900 text-white shadow-md transform scale-[1.02]"
                                : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50",
                            disabled && "opacity-50 cursor-not-allowed"
                        )}
                        title={preset.description}
                    >
                        <div className="flex items-center gap-3">
                            <Icon className={twMerge("w-5 h-5 flex-shrink-0", isActive ? "text-emerald-400" : "text-slate-500")} />
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-bold truncate">{preset.label}</div>
                                <div className={twMerge(
                                    "text-xs truncate",
                                    isActive ? "text-slate-300" : "text-slate-500"
                                )}>
                                    {preset.description}
                                </div>
                            </div>
                        </div>

                        {/* Active Checkmark */}
                        {isActive && (
                            <motion.div
                                layoutId="active-preset"
                                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                className="absolute top-1/2 -translate-y-1/2 right-3 w-1.5 h-1.5 rounded-full bg-emerald-400"
                            />
                        )}
                    </button>
                );
            })}
        </div>
    );
});

PresetSelector.displayName = 'PresetSelector';
