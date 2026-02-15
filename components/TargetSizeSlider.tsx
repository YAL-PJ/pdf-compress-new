'use client';

import { memo, useState, useCallback, useRef } from 'react';
import { usePdf } from '@/context/PdfContext';
import { settingsForTargetPercent, TARGET_SIZE_STEPS } from '@/lib/target-size';
import { formatBytes } from '@/lib/utils';
import { IMAGE_COMPRESSION, DPI_OPTIONS } from '@/lib/constants';
import { Target, ImageIcon, Minimize2 } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

export const TargetSizeSlider = memo(() => {
  const {
    analysis,
    options,
    setOptions,
    imageSettings,
    setImageSettings,
    isProcessing,
    isUpdating,
  } = usePdf();

  const [targetPercent, setTargetPercent] = useState(70);
  const [isActive, setIsActive] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const disabled = isProcessing && !isUpdating;
  const originalSize = analysis?.originalSize ?? 0;
  const imageStats = analysis?.imageStats;

  // Don't render if no file has been compressed yet
  if (!analysis || originalSize === 0) return null;

  const targetBytes = Math.round(originalSize * (targetPercent / 100));

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPercent = Number(e.target.value);
    setTargetPercent(newPercent);

    if (!isActive) setIsActive(true);

    // Debounce settings update to avoid rapid recompressions
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const { options, imageSettings } = settingsForTargetPercent(newPercent);
      setOptions(options);
      setImageSettings(imageSettings);
    }, 300);
  };

  const handleQualityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const quality = parseInt(e.target.value, 10);
    const newSettings = { ...imageSettings, quality };
    setImageSettings(newSettings);
    // Also ensure recompressImages is enabled when quality is adjusted
    if (!options.recompressImages) {
      setOptions({ ...options, recompressImages: true });
    }
  };

  const handleDpiChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const targetDpi = parseInt(e.target.value, 10);
    const newSettings = { ...imageSettings, targetDpi, enableDownsampling: true };
    setImageSettings(newSettings);
    // Also ensure downsampleImages and recompressImages are enabled
    if (!options.downsampleImages) {
      setOptions({ ...options, downsampleImages: true, recompressImages: true });
    }
  };

  // Label for current zone
  const zoneLabel = targetPercent <= 35
    ? 'Maximum compression'
    : targetPercent <= 55
      ? 'Aggressive'
      : targetPercent <= 75
        ? 'Balanced'
        : targetPercent <= 90
          ? 'Light'
          : 'Minimal';

  // Color for the slider track fill
  const fillColor = targetPercent <= 35
    ? 'bg-red-500'
    : targetPercent <= 55
      ? 'bg-orange-500'
      : targetPercent <= 75
        ? 'bg-amber-500'
        : targetPercent <= 90
          ? 'bg-emerald-500'
          : 'bg-blue-500';

  const fillPercent = ((targetPercent - TARGET_SIZE_STEPS.min) / (TARGET_SIZE_STEPS.max - TARGET_SIZE_STEPS.min)) * 100;

  // Quality fill for the secondary slider
  const qualityFillPercent = ((imageSettings.quality - IMAGE_COMPRESSION.MIN_QUALITY) / (IMAGE_COMPRESSION.MAX_QUALITY - IMAGE_COMPRESSION.MIN_QUALITY)) * 100;

  return (
    <div className={twMerge(
      "bg-white border rounded-lg shadow-sm",
      disabled && "opacity-50 pointer-events-none"
    )}>
      {/* === Target Size - Primary Control === */}
      <div className="p-4 pb-3">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Target className="w-4 h-4 text-slate-500" />
            Target Size
          </h2>
          {isActive && (
            <span className="text-xs font-medium text-slate-500">{zoneLabel}</span>
          )}
        </div>

        {/* Target size display */}
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-2xl font-bold text-slate-900 tabular-nums">
            {formatBytes(targetBytes)}
          </span>
          <span className="text-sm text-slate-400 font-medium">
            {targetPercent}% of {formatBytes(originalSize)}
          </span>
        </div>

        {/* Main slider */}
        <div className="relative mt-2 mb-1">
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2 bg-slate-100 rounded-full border border-slate-200" />
          <div
            className={twMerge("absolute left-0 top-1/2 -translate-y-1/2 h-2 rounded-full transition-colors duration-200", fillColor)}
            style={{ width: `${fillPercent}%` }}
          />
          <input
            type="range"
            min={TARGET_SIZE_STEPS.min}
            max={TARGET_SIZE_STEPS.max}
            step={TARGET_SIZE_STEPS.step}
            value={targetPercent}
            onChange={handleSliderChange}
            disabled={disabled}
            className="relative z-10 w-full h-6 appearance-none bg-transparent cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:w-5
              [&::-webkit-slider-thumb]:h-5
              [&::-webkit-slider-thumb]:rounded-full
              [&::-webkit-slider-thumb]:bg-slate-900
              [&::-webkit-slider-thumb]:border-2
              [&::-webkit-slider-thumb]:border-white
              [&::-webkit-slider-thumb]:shadow-md
              [&::-webkit-slider-thumb]:cursor-pointer
              [&::-webkit-slider-thumb]:transition-transform
              [&::-webkit-slider-thumb]:hover:scale-110
              [&::-moz-range-thumb]:w-5
              [&::-moz-range-thumb]:h-5
              [&::-moz-range-thumb]:rounded-full
              [&::-moz-range-thumb]:bg-slate-900
              [&::-moz-range-thumb]:border-2
              [&::-moz-range-thumb]:border-white
              [&::-moz-range-thumb]:shadow-md
              [&::-moz-range-thumb]:cursor-pointer
              [&::-webkit-slider-runnable-track]:bg-transparent
              [&::-moz-range-track]:bg-transparent
            "
            aria-label="Target compression size"
          />
        </div>
        <div className="flex justify-between text-[10px] text-slate-400 font-medium px-0.5">
          <span>Smallest</span>
          <span>Original</span>
        </div>
      </div>

      {/* === Divider === */}
      <div className="border-t" />

      {/* === Secondary Controls - Quality & DPI === */}
      <div className="px-4 py-3 grid grid-cols-2 gap-3">
        {/* Image Quality */}
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <ImageIcon className="w-3 h-3 text-slate-400" />
            <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide">Quality</span>
            <span className="ml-auto text-[10px] font-mono font-bold text-slate-800 bg-slate-100 px-1 py-0.5 rounded">
              {imageSettings.quality}%
            </span>
          </div>
          <div className="relative">
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1 bg-slate-100 rounded-full" />
            <div
              className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-slate-400 rounded-full"
              style={{ width: `${qualityFillPercent}%` }}
            />
            <input
              type="range"
              min={IMAGE_COMPRESSION.MIN_QUALITY}
              max={IMAGE_COMPRESSION.MAX_QUALITY}
              step={5}
              value={imageSettings.quality}
              onChange={handleQualityChange}
              disabled={disabled}
              aria-label="Image compression quality"
              className="relative z-10 w-full h-4 appearance-none bg-transparent cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none
                [&::-webkit-slider-thumb]:w-3
                [&::-webkit-slider-thumb]:h-3
                [&::-webkit-slider-thumb]:rounded-full
                [&::-webkit-slider-thumb]:bg-slate-700
                [&::-webkit-slider-thumb]:border
                [&::-webkit-slider-thumb]:border-white
                [&::-webkit-slider-thumb]:shadow-sm
                [&::-webkit-slider-thumb]:cursor-pointer
                [&::-moz-range-thumb]:w-3
                [&::-moz-range-thumb]:h-3
                [&::-moz-range-thumb]:rounded-full
                [&::-moz-range-thumb]:bg-slate-700
                [&::-moz-range-thumb]:border
                [&::-moz-range-thumb]:border-white
                [&::-moz-range-thumb]:shadow-sm
                [&::-moz-range-thumb]:cursor-pointer
                [&::-webkit-slider-runnable-track]:bg-transparent
                [&::-moz-range-track]:bg-transparent
              "
            />
          </div>
        </div>

        {/* DPI / Downsample */}
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Minimize2 className="w-3 h-3 text-slate-400" />
            <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide">DPI</span>
          </div>
          <select
            value={imageSettings.targetDpi}
            onChange={handleDpiChange}
            disabled={disabled}
            aria-label="Target DPI for downsampling"
            className="w-full text-[11px] bg-slate-50 border border-slate-200 rounded px-1.5 py-[5px] text-slate-800 font-medium
              focus:outline-none focus:ring-1 focus:ring-slate-400
              cursor-pointer hover:bg-slate-100 transition-colors"
          >
            {DPI_OPTIONS.PRESETS.map((preset) => (
              <option key={preset.value} value={preset.value}>
                {preset.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Image stats hint */}
      {imageStats && imageStats.totalImages > 0 && (
        <div className="px-4 pb-2">
          <div className="text-[9px] text-slate-400 text-center">
            {imageStats.totalImages} image{imageStats.totalImages !== 1 ? 's' : ''} detected
            {imageStats.highDpiCount > 0 && ` ({imageStats.highDpiCount} high-DPI)`}
          </div>
        </div>
      )}
    </div>
  );
});

TargetSizeSlider.displayName = 'TargetSizeSlider';
