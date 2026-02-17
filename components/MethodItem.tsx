'use client';

import { memo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import { IMAGE_COMPRESSION, DPI_OPTIONS } from '@/lib/constants';
import { formatBytes } from '@/lib/utils';
import type { MethodResult, ImageCompressionSettings, CompressionOptions } from '@/lib/types';
import type { MethodConfig } from './CompressionMethods';

interface MethodItemProps {
    method: MethodConfig;
    isEnabled: boolean;
    disabled: boolean;
    result?: MethodResult;
    onToggle: (key: keyof CompressionOptions) => void;
    // Image settings specific props
    imageSettings: ImageCompressionSettings;
    onImageSettingsChange: (settings: ImageCompressionSettings) => void;
    imageStats?: {
        totalImages: number;
        jpegCount: number;
        pngCount: number;
        otherCount: number;
        highDpiCount: number;
        avgDpi: number;
    };
    /** If set, this method won't save anything for this PDF (e.g. "No images found") */
    notApplicable?: string;
}

export const MethodItem = memo(({
    method,
    isEnabled,
    disabled,
    result,
    onToggle,
    imageSettings,
    onImageSettingsChange,
    imageStats,
    notApplicable
}: MethodItemProps) => {
    const Icon = method.icon;
    const displayBytes = result?.savedBytes ?? 0;
    const isPending = result?.pending ?? false;
    const range = result?.savingsRange;

    const handleQualityChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const quality = parseInt(e.target.value, 10);
        onImageSettingsChange({ ...imageSettings, quality });
    }, [imageSettings, onImageSettingsChange]);

    // Check if target DPI is at or above original - downsampling won't help
    const dpiAboveOriginal = imageStats && imageStats.avgDpi > 0 && imageSettings.targetDpi >= imageStats.avgDpi;

    // Find which DPI preset is closest to the detected average (the "original")
    const closestOriginalDpi = (() => {
        if (!imageStats || imageStats.avgDpi <= 0) return null;
        let closest: number = DPI_OPTIONS.PRESETS[0].value;
        let minDiff = Infinity;
        for (const p of DPI_OPTIONS.PRESETS) {
            const diff = Math.abs(p.value - imageStats.avgDpi);
            if (diff < minDiff) { minDiff = diff; closest = p.value; }
        }
        return closest;
    })();

    return (
        <div>
            <button
                onClick={() => onToggle(method.key)}
                disabled={disabled}
                title={notApplicable || undefined}
                className={twMerge(
                    "w-full flex items-center gap-2 p-2 rounded text-left transition-all duration-200",
                    "focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-1",
                    isEnabled && !notApplicable
                        ? "bg-slate-900 text-white"
                        : isEnabled && notApplicable
                        ? "bg-slate-700 text-white"
                        : "bg-white hover:bg-slate-50 text-slate-700",
                    disabled && "opacity-50 cursor-not-allowed",
                    notApplicable && !isEnabled && "opacity-50"
                )}
            >
                <div className={twMerge(
                    "flex items-center justify-center",
                    isEnabled ? "text-white" : "text-slate-600",
                    notApplicable && !isEnabled && "text-slate-400"
                )}>
                    <Icon className="w-4 h-4" />
                </div>

                <div className="flex-1 min-w-0">
                    <div className="font-medium text-xs leading-none flex justify-between items-center">
                        <span className="truncate">{method.label}</span>
                        {notApplicable ? (
                            <span className="text-[9px] bg-slate-200 text-slate-500 px-1 py-0.5 rounded ml-1 flex-shrink-0 whitespace-nowrap">
                                {notApplicable}
                            </span>
                        ) : isEnabled && isPending ? (
                            <span className="text-[9px] bg-slate-500/20 text-slate-300 px-1 py-0.5 rounded ml-1 flex-shrink-0 animate-pulse">
                                calculating...
                            </span>
                        ) : isEnabled && displayBytes > 0 && range && range.min !== range.max ? (
                            <span className="text-[9px] bg-emerald-500/20 text-emerald-200 px-1 py-0.5 rounded ml-1 flex-shrink-0">
                                -{formatBytes(range.min)}–{formatBytes(range.max)}
                            </span>
                        ) : isEnabled && displayBytes > 0 ? (
                            <span className="text-[9px] bg-emerald-500/20 text-emerald-200 px-1 py-0.5 rounded ml-1 flex-shrink-0">
                                -{formatBytes(displayBytes)}
                            </span>
                        ) : null}
                    </div>
                    <div className={twMerge(
                        "text-[10px] mt-0.5",
                        isEnabled ? "text-slate-300" : "text-slate-500",
                        notApplicable && !isEnabled && "text-slate-400"
                    )}>
                        {method.impact}
                    </div>
                </div>

                <div className={twMerge(
                    "w-4 h-4 rounded border flex items-center justify-center transition-colors flex-shrink-0",
                    isEnabled
                        ? "bg-white border-white text-slate-900"
                        : "bg-transparent border-slate-400 text-transparent",
                    notApplicable && !isEnabled && "border-slate-300"
                )}>
                    <Check className="w-3 h-3 stroke-[3]" />
                </div>
            </button>

            {/* Settings panel for image compression */}
            <AnimatePresence>
                {method.key === 'recompressImages' && method.hasSettings && isEnabled && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="px-2 pb-2 pt-1">
                            <div className="bg-slate-50 border rounded p-2 space-y-2">
                                {imageStats && (
                                    <div className="text-[9px] text-slate-600 bg-white p-1.5 rounded border grid grid-cols-2 gap-1">
                                        <div>
                                            <div className="font-bold text-slate-800">{imageStats.totalImages}</div>
                                            <div>Images</div>
                                        </div>
                                        <div>
                                            <div className="font-bold text-slate-800">{imageStats.jpegCount}</div>
                                            <div>JPEG</div>
                                        </div>
                                    </div>
                                )}

                                <div className="flex justify-between items-center text-[10px] font-bold text-slate-800">
                                    <span>Quality</span>
                                    <span className="font-mono bg-white px-1 py-0.5 rounded border border-slate-300 text-slate-900">
                                        {imageSettings.quality}%
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min={IMAGE_COMPRESSION.MIN_QUALITY}
                                    max={IMAGE_COMPRESSION.MAX_QUALITY}
                                    step={5}
                                    value={imageSettings.quality}
                                    onChange={handleQualityChange}
                                    disabled={disabled}
                                    aria-label="Image compression quality"
                                    className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-900"
                                />
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Settings panel for downsampling */}
            <AnimatePresence>
                {method.key === 'downsampleImages' && method.hasSettings && isEnabled && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="px-2 pb-2 pt-1">
                            <div className="bg-slate-50 border rounded p-2 space-y-2">
                                {imageStats && (
                                    <div className="text-[9px] text-slate-600 bg-white p-1.5 rounded border grid grid-cols-2 gap-1">
                                        <div>
                                            <div className="font-bold text-slate-800">{imageStats.jpegCount}</div>
                                            <div>JPEG</div>
                                        </div>
                                        <div>
                                            <div className="font-bold text-amber-700">{imageStats.highDpiCount}</div>
                                            <div>High-DPI</div>
                                        </div>
                                    </div>
                                )}

                                <div className="text-[10px] font-medium text-slate-700">Target DPI</div>
                                {dpiAboveOriginal && (
                                    <div className="text-[9px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-1">
                                        Target DPI is equal to or higher than original (~{imageStats!.avgDpi} DPI) — no effect.
                                    </div>
                                )}
                                <div className="grid grid-cols-5 gap-1" role="radiogroup" aria-label="Target DPI for downsampling">
                                    {DPI_OPTIONS.PRESETS.map((preset) => {
                                        const isOriginal = preset.value === closestOriginalDpi;
                                        const isAboveOriginal = closestOriginalDpi !== null && preset.value > closestOriginalDpi;
                                        const isSelected = imageSettings.targetDpi === preset.value;
                                        return (
                                            <button
                                                key={preset.value}
                                                type="button"
                                                role="radio"
                                                aria-checked={isSelected}
                                                disabled={disabled || isAboveOriginal}
                                                onClick={() => {
                                                    if (isAboveOriginal) return;
                                                    onImageSettingsChange({ ...imageSettings, targetDpi: preset.value });
                                                }}
                                                title={
                                                    isAboveOriginal
                                                        ? `Cannot upscale above original (~${imageStats!.avgDpi} DPI)`
                                                        : isOriginal
                                                            ? `${preset.label} — closest to original (~${imageStats!.avgDpi} DPI)`
                                                            : preset.label
                                                }
                                                className={twMerge(
                                                    "relative px-1 py-1.5 rounded text-center text-[10px] font-semibold transition-all duration-150 border",
                                                    "focus:outline-none focus:ring-1 focus:ring-slate-400 focus:ring-offset-1",
                                                    isSelected && !isAboveOriginal && "bg-slate-900 text-white border-slate-900 shadow-sm",
                                                    isOriginal && !isSelected && !isAboveOriginal && "bg-blue-50 text-blue-800 border-blue-300 ring-1 ring-blue-200",
                                                    !isSelected && !isOriginal && !isAboveOriginal && "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 cursor-pointer",
                                                    isAboveOriginal && "bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed",
                                                )}
                                            >
                                                <div>{preset.value}</div>
                                                {isOriginal && (
                                                    <div className={twMerge(
                                                        "text-[7px] font-bold uppercase tracking-wider mt-0.5",
                                                        isSelected ? "text-blue-200" : "text-blue-500"
                                                    )}>
                                                        current
                                                    </div>
                                                )}
                                                {isAboveOriginal && (
                                                    <div className="absolute inset-0 flex items-center justify-center">
                                                        <div className="w-full h-px bg-slate-300 rotate-[-15deg]" />
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
});

MethodItem.displayName = 'MethodItem';
