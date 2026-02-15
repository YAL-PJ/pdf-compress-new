'use client';

import { memo, useState, useCallback, useEffect, useRef } from 'react';
import { usePdf } from '@/context/PdfContext';
import { settingsForTargetPercent, TARGET_SIZE_STEPS } from '@/lib/target-size';
import { formatBytes } from '@/lib/utils';
import { Target } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

export const TargetSizeSlider = memo(() => {
  const { analysis, setOptions, setImageSettings, isProcessing, isUpdating } = usePdf();

  const [targetPercent, setTargetPercent] = useState(70);
  const [isActive, setIsActive] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const disabled = isProcessing && !isUpdating;
  const originalSize = analysis?.originalSize ?? 0;

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

  return (
    <div className={twMerge(
      "bg-white border rounded-lg shadow-sm p-4",
      disabled && "opacity-50 pointer-events-none"
    )}>
      <div className="flex items-center justify-between mb-3">
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

      {/* Slider */}
      <div className="relative mt-3 mb-1">
        {/* Track background */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2 bg-slate-100 rounded-full border border-slate-200" />

        {/* Track fill */}
        <div
          className={twMerge("absolute left-0 top-1/2 -translate-y-1/2 h-2 rounded-full transition-colors duration-200", fillColor)}
          style={{ width: `${fillPercent}%` }}
        />

        {/* Native range input */}
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

      {/* Scale labels */}
      <div className="flex justify-between text-[10px] text-slate-400 font-medium mt-1 px-0.5">
        <span>Smallest</span>
        <span>Original</span>
      </div>
    </div>
  );
});

TargetSizeSlider.displayName = 'TargetSizeSlider';
