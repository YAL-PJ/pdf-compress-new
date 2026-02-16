'use client';

import { memo, useState, useMemo, useRef } from 'react';
import { usePdf } from '@/context/PdfContext';
import { settingsForTargetPercent, TARGET_SIZE_STEPS } from '@/lib/target-size';
import { calculateCompressionPotential, selectMethodsForTarget } from '@/lib/compression-potential';
import { formatBytes } from '@/lib/utils';
import { IMAGE_COMPRESSION, DPI_OPTIONS } from '@/lib/constants';
import { Target, ImageIcon, Minimize2, Shield, AlertTriangle, Zap } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

export const TargetSizeSlider = memo(() => {
  const {
    analysis,
    options,
    setOptions,
    imageSettings,
    setImageSettings,
    setTargetPercent: setContextTargetPercent,
    isProcessing,
    isUpdating,
  } = usePdf();

  const [targetPercent, setTargetPercent] = useState(70);
  const [isActive, setIsActive] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const disabled = isProcessing && !isUpdating;
  const originalSize = analysis?.originalSize ?? 0;
  const imageStats = analysis?.imageStats;
  const methodResults = analysis?.methodResults;

  // Lookup savings for image compression and downsampling
  const qualitySaved = useMemo(() => {
    return methodResults?.find(r => r.key === 'recompressImages')?.savedBytes ?? 0;
  }, [methodResults]);
  const downsampleSaved = useMemo(() => {
    return methodResults?.find(r => r.key === 'downsampleImages')?.savedBytes ?? 0;
  }, [methodResults]);

  // Calculate compression potential from measured method results
  const potential = useMemo(() => {
    if (!methodResults || originalSize === 0) return null;
    return calculateCompressionPotential(originalSize, methodResults);
  }, [methodResults, originalSize]);

  // Convert floor sizes to slider percentages
  const potentialPercents = useMemo(() => {
    if (!potential || originalSize === 0) return null;
    return {
      safePercent: Math.max(TARGET_SIZE_STEPS.min, Math.round((potential.safeFloor / originalSize) * 100)),
      mediumPercent: Math.max(TARGET_SIZE_STEPS.min, Math.round((potential.mediumFloor / originalSize) * 100)),
      absolutePercent: Math.max(TARGET_SIZE_STEPS.min, Math.round((potential.absoluteFloor / originalSize) * 100)),
    };
  }, [potential, originalSize]);

  // Don't render if no file has been compressed yet
  if (!analysis || originalSize === 0) return null;

  const targetBytes = Math.round(originalSize * (targetPercent / 100));

  // Determine if target is achievable and at what risk level
  const targetFeasibility = (() => {
    if (!potentialPercents) return null;
    if (targetPercent >= potentialPercents.safePercent) return 'safe';
    if (targetPercent >= potentialPercents.mediumPercent) return 'medium';
    if (targetPercent >= potentialPercents.absolutePercent) return 'reachable';
    return 'unreachable';
  })();

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPercent = Number(e.target.value);
    setTargetPercent(newPercent);

    if (!isActive) setIsActive(true);

    // Debounce settings update to avoid rapid recompressions
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      // Use measured savings to pick methods progressively when we have data
      if (methodResults && methodResults.length > 0) {
        const needed = selectMethodsForTarget(originalSize, Math.round(originalSize * (newPercent / 100)), methodResults);

        // Start from the zone-based settings as a baseline for image quality/DPI
        const baseline = settingsForTargetPercent(newPercent);

        // Merge: enable all methods the progressive selector chose,
        // but keep zone-based image quality/DPI settings
        const mergedOptions = { ...baseline.options };
        for (const key of needed) {
          (mergedOptions as Record<string, boolean>)[key] = true;
        }

        setOptions(mergedOptions);
        setImageSettings(baseline.imageSettings);
      } else {
        // Fallback: no measurements yet, use zone-based heuristics
        const { options, imageSettings } = settingsForTargetPercent(newPercent);
        setOptions(options);
        setImageSettings(imageSettings);
      }
      setContextTargetPercent(newPercent);
    }, 300);
  };

  const handleQualityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const quality = parseInt(e.target.value, 10);
    const newSettings = { ...imageSettings, quality };
    setImageSettings(newSettings);
    if (!options.recompressImages) {
      setOptions({ ...options, recompressImages: true });
    }
  };

  const handleDpiChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const targetDpi = parseInt(e.target.value, 10);
    const newSettings = { ...imageSettings, targetDpi, enableDownsampling: true };
    setImageSettings(newSettings);
    if (!options.downsampleImages) {
      setOptions({ ...options, downsampleImages: true, recompressImages: true });
    }
  };

  const dpiAboveOriginal = imageStats && imageStats.avgDpi > 0 && imageSettings.targetDpi >= imageStats.avgDpi;

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

  // Helper to convert a size-percent (10-100) to slider track position (0-100%)
  const toTrackPosition = (pct: number) =>
    ((pct - TARGET_SIZE_STEPS.min) / (TARGET_SIZE_STEPS.max - TARGET_SIZE_STEPS.min)) * 100;

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

        {/* Main slider with potential markers */}
        <div className="relative mt-2 mb-1">
          {/* Track background */}
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2 bg-slate-100 rounded-full border border-slate-200" />

          {/* Compression potential zone overlays on the track */}
          {potentialPercents && (
            <>
              {/* High-risk zone: absolutePercent → mediumPercent (red tint) */}
              {potentialPercents.absolutePercent < potentialPercents.mediumPercent && (
                <div
                  className="absolute top-1/2 -translate-y-1/2 h-2 bg-red-200/60 rounded-full"
                  style={{
                    left: `${toTrackPosition(potentialPercents.absolutePercent)}%`,
                    width: `${toTrackPosition(potentialPercents.mediumPercent) - toTrackPosition(potentialPercents.absolutePercent)}%`,
                  }}
                />
              )}
              {/* Medium-risk zone: mediumPercent → safePercent (amber tint) */}
              {potentialPercents.mediumPercent < potentialPercents.safePercent && (
                <div
                  className="absolute top-1/2 -translate-y-1/2 h-2 bg-amber-200/60 rounded-full"
                  style={{
                    left: `${toTrackPosition(potentialPercents.mediumPercent)}%`,
                    width: `${toTrackPosition(potentialPercents.safePercent) - toTrackPosition(potentialPercents.mediumPercent)}%`,
                  }}
                />
              )}
              {/* Safe zone: safePercent → 100% (green tint) */}
              <div
                className="absolute top-1/2 -translate-y-1/2 h-2 bg-emerald-200/60 rounded-full"
                style={{
                  left: `${toTrackPosition(potentialPercents.safePercent)}%`,
                  width: `${100 - toTrackPosition(potentialPercents.safePercent)}%`,
                }}
              />

              {/* Marker: safe floor */}
              <div
                className="absolute top-1/2 -translate-y-[7px] w-0.5 h-3.5 bg-emerald-500 z-[5] rounded-full"
                style={{ left: `${toTrackPosition(potentialPercents.safePercent)}%` }}
                title={`Safe methods: ${formatBytes(potential!.safeFloor)} (${potentialPercents.safePercent}%)`}
              />
              {/* Marker: medium floor */}
              {potentialPercents.mediumPercent < potentialPercents.safePercent && (
                <div
                  className="absolute top-1/2 -translate-y-[7px] w-0.5 h-3.5 bg-amber-500 z-[5] rounded-full"
                  style={{ left: `${toTrackPosition(potentialPercents.mediumPercent)}%` }}
                  title={`+ Medium methods: ${formatBytes(potential!.mediumFloor)} (${potentialPercents.mediumPercent}%)`}
                />
              )}
              {/* Marker: absolute floor */}
              {potentialPercents.absolutePercent < potentialPercents.mediumPercent && (
                <div
                  className="absolute top-1/2 -translate-y-[7px] w-0.5 h-3.5 bg-red-500 z-[5] rounded-full"
                  style={{ left: `${toTrackPosition(potentialPercents.absolutePercent)}%` }}
                  title={`+ All methods: ${formatBytes(potential!.absoluteFloor)} (${potentialPercents.absolutePercent}%)`}
                />
              )}
            </>
          )}

          {/* Active fill */}
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

        {/* Compression potential legend */}
        {potentialPercents && potential && (
          <div className="mt-3 space-y-1.5">
            {/* Feasibility indicator for the current target */}
            {isActive && targetFeasibility && (
              <div className={twMerge(
                "flex items-center gap-1.5 text-[10px] font-medium px-2 py-1 rounded",
                targetFeasibility === 'safe' && "bg-emerald-50 text-emerald-700",
                targetFeasibility === 'medium' && "bg-amber-50 text-amber-700",
                targetFeasibility === 'reachable' && "bg-red-50 text-red-700",
                targetFeasibility === 'unreachable' && "bg-slate-100 text-slate-500",
              )}>
                {targetFeasibility === 'safe' && <><Shield className="w-3 h-3" /> Achievable with safe methods only</>}
                {targetFeasibility === 'medium' && <><AlertTriangle className="w-3 h-3" /> Requires medium-risk methods</>}
                {targetFeasibility === 'reachable' && <><Zap className="w-3 h-3" /> Requires aggressive methods</>}
                {targetFeasibility === 'unreachable' && <><AlertTriangle className="w-3 h-3" /> Below measurable limit — may not be reachable</>}
              </div>
            )}

            {/* Tier legend */}
            <div className="flex items-center gap-3 text-[9px] text-slate-400 font-medium">
              <span className="flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Safe {formatBytes(potential.safeFloor)}
              </span>
              {potential.mediumSavings > potential.safeSavings && (
                <span className="flex items-center gap-1">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500" />
                  +Medium {formatBytes(potential.mediumFloor)}
                </span>
              )}
              {potential.totalSavings > potential.mediumSavings && (
                <span className="flex items-center gap-1">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500" />
                  +All {formatBytes(potential.absoluteFloor)}
                </span>
              )}
              {potential.hasPending && (
                <span className="text-slate-300 animate-pulse">
                  measuring...
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* === Divider === */}
      <div className="border-t" />

      {/* === Secondary Controls - Quality & DPI === */}
      <div className="px-4 py-3 space-y-3">
        {/* Image Quality */}
        <div>
          <div className="flex items-center gap-1.5 mb-0.5">
            <ImageIcon className="w-3 h-3 text-slate-400" />
            <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide">Image Quality</span>
            <span className="ml-auto text-[10px] font-mono font-bold text-slate-800 bg-slate-100 px-1 py-0.5 rounded">
              {imageSettings.quality}%
            </span>
            {qualitySaved > 0 && (
              <span className="text-[9px] font-medium text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded">
                -{formatBytes(qualitySaved)}
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-400 mb-1.5">
            Re-encodes images at lower quality.
            {imageStats ? ` ${imageStats.totalImages} image${imageStats.totalImages !== 1 ? 's' : ''} (${imageStats.jpegCount} JPEG)` : ''}
          </p>
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

        {/* Thin separator */}
        <div className="border-t border-slate-100" />

        {/* DPI / Downsample */}
        <div className={dpiAboveOriginal ? 'opacity-50' : ''}>
          <div className="flex items-center gap-1.5 mb-0.5">
            <Minimize2 className="w-3 h-3 text-slate-400" />
            <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide">Downsample</span>
            <span className="ml-auto text-[10px] font-mono font-bold text-slate-800 bg-slate-100 px-1 py-0.5 rounded">
              {imageSettings.targetDpi} DPI
            </span>
            {downsampleSaved > 0 && (
              <span className="text-[9px] font-medium text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded">
                -{formatBytes(downsampleSaved)}
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-400 mb-1.5">
            Reduces image resolution to target DPI.
            {imageStats && imageStats.avgDpi > 0 ? ` Current avg: ~${imageStats.avgDpi} DPI.` : ''}
            {imageStats && imageStats.highDpiCount > 0 ? ` ${imageStats.highDpiCount} high-DPI image${imageStats.highDpiCount !== 1 ? 's' : ''} found.` : ''}
          </p>
          {dpiAboveOriginal && (
            <p className="text-[10px] text-amber-600 mb-1.5">
              Target DPI is equal to or higher than original (~{imageStats!.avgDpi} DPI) — downsampling will have no effect.
            </p>
          )}
          <select
            value={imageSettings.targetDpi}
            onChange={handleDpiChange}
            disabled={disabled}
            aria-label="Target DPI for downsampling"
            className="w-full text-[11px] bg-slate-50 border border-slate-200 rounded px-1.5 py-[5px] text-slate-800 font-medium
              focus:outline-none focus:ring-1 focus:ring-slate-400
              cursor-pointer hover:bg-slate-100 transition-colors"
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
    </div>
  );
});

TargetSizeSlider.displayName = 'TargetSizeSlider';
