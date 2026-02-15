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

    const handleQualityChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const quality = parseInt(e.target.value, 10);
        onImageSettingsChange({ ...imageSettings, quality });
    }, [imageSettings, onImageSettingsChange]);

    const handleDpiChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        const targetDpi = parseInt(e.target.value, 10);
        onImageSettingsChange({ ...imageSettings, targetDpi });
    }, [imageSettings, onImageSettingsChange]);

    // Check if target DPI is at or above original - downsampling won't help
    const dpiAboveOriginal = imageStats && imageStats.avgDpi > 0 && imageSettings.targetDpi >= imageStats.avgDpi;

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
                                <select
                                    value={imageSettings.targetDpi}
                                    onChange={handleDpiChange}
                                    disabled={disabled}
                                    aria-label="Target DPI for downsampling"
                                    className={twMerge(
                                        "w-full text-xs bg-white border rounded px-1.5 py-1 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900",
                                        dpiAboveOriginal && "opacity-50"
                                    )}
                                >
                                    {DPI_OPTIONS.PRESETS.map((preset) => {
                                        const isOriginal = imageStats && imageStats.avgDpi > 0 &&
                                            Math.abs(preset.value - imageStats.avgDpi) <=
                                              Math.min(...DPI_OPTIONS.PRESETS.map(p => Math.abs(p.value - (imageStats?.avgDpi ?? 0))));
                                        return (
                                            <option key={preset.value} value={preset.value}>
                                                {preset.label}{isOriginal ? ' ← original' : ''}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
});

MethodItem.displayName = 'MethodItem';
