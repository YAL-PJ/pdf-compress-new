'use client';

import { memo } from 'react';
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
    };
}

export const MethodItem = memo(({
    method,
    isEnabled,
    disabled,
    result,
    onToggle,
    imageSettings,
    onImageSettingsChange,
    imageStats
}: MethodItemProps) => {
    const Icon = method.icon;
    const displayBytes = result?.savedBytes ?? 0;

    const handleQualityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const quality = parseInt(e.target.value, 10);
        onImageSettingsChange({ ...imageSettings, quality });
    };

    const handleDpiChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const targetDpi = parseInt(e.target.value, 10);
        onImageSettingsChange({ ...imageSettings, targetDpi });
    };

    return (
        <div>
            <button
                onClick={() => onToggle(method.key)}
                disabled={disabled}
                className={twMerge(
                    "w-full flex items-center gap-2 p-2 rounded text-left transition-all duration-200",
                    "focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-1",
                    isEnabled
                        ? "bg-slate-900 text-white"
                        : "bg-white hover:bg-slate-50 text-slate-700",
                    disabled && "opacity-50 cursor-not-allowed"
                )}
            >
                <div className={twMerge(
                    "flex items-center justify-center",
                    isEnabled ? "text-white" : "text-slate-600"
                )}>
                    <Icon className="w-4 h-4" />
                </div>

                <div className="flex-1 min-w-0">
                    <div className="font-medium text-xs leading-none flex justify-between items-center">
                        <span className="truncate">{method.label}</span>
                        {isEnabled && displayBytes > 0 && (
                            <span className="text-[9px] bg-emerald-500/20 text-emerald-200 px-1 py-0.5 rounded ml-1 flex-shrink-0">
                                -{formatBytes(displayBytes)}
                            </span>
                        )}
                    </div>
                    <div className={twMerge(
                        "text-[10px] mt-0.5 truncate",
                        isEnabled ? "text-slate-300" : "text-slate-600"
                    )}>
                        {method.description}
                    </div>
                </div>

                <div className={twMerge(
                    "w-4 h-4 rounded border flex items-center justify-center transition-colors flex-shrink-0",
                    isEnabled
                        ? "bg-white border-white text-slate-900"
                        : "bg-transparent border-slate-400 text-transparent"
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
                                <select
                                    value={imageSettings.targetDpi}
                                    onChange={handleDpiChange}
                                    disabled={disabled}
                                    className="w-full text-xs bg-white border rounded px-1.5 py-1 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                                >
                                    {DPI_OPTIONS.PRESETS.map((preset) => (
                                        <option key={preset.value} value={preset.value}>
                                            {preset.label}
                                        </option>
                                    ))}
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
