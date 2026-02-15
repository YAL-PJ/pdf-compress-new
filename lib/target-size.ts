/**
 * Maps a target size percentage to interpolated compression settings.
 *
 * The slider maps to 3 zones:
 * - 10-40%  → Aggressive range (quality 25-40, DPI 72, heavy methods on)
 * - 40-70%  → Balanced range   (quality 40-65, DPI 72-150, moderate methods)
 * - 70-100% → Minimal range    (quality 65-90, DPI 150-300, light methods)
 */

import { CompressionOptions, ImageCompressionSettings, DEFAULT_COMPRESSION_OPTIONS, DEFAULT_IMAGE_SETTINGS } from './types';
import { PRESETS } from './presets';

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export interface TargetSizeResult {
  options: CompressionOptions;
  imageSettings: ImageCompressionSettings;
}

/**
 * Given a target size as a percentage of the original (10-100),
 * return interpolated compression settings.
 */
export function settingsForTargetPercent(targetPercent: number): TargetSizeResult {
  const pct = clamp(targetPercent, 10, 100);

  // === Quality mapping (continuous) ===
  // 10% → quality 20, 50% → quality 55, 100% → quality 95
  const quality = clamp(lerp(20, 95, (pct - 10) / 90), 10, 95);

  // === DPI mapping ===
  // 10-40% → 72 DPI, 40-70% → 72→150, 70-100% → 150→300
  let targetDpi: number;
  if (pct <= 40) {
    targetDpi = 72;
  } else if (pct <= 70) {
    const t = (pct - 40) / 30;
    targetDpi = lerp(72, 150, t);
  } else {
    const t = (pct - 70) / 30;
    targetDpi = lerp(150, 300, t);
  }

  // === Method toggles based on zones ===
  const enableDownsampling = pct <= 80;
  const enableAggressiveMethods = pct <= 50;

  const options: CompressionOptions = {
    ...DEFAULT_COMPRESSION_OPTIONS,
    useObjectStreams: true,
    stripMetadata: true,
    recompressImages: true,
    downsampleImages: enableDownsampling,
    removeDuplicateResources: pct <= 80,
    removeColorProfiles: pct <= 85,
    deepCleanMetadata: pct <= 80,
    // Aggressive-only methods
    pngToJpeg: enableAggressiveMethods,
    removeAlphaChannels: enableAggressiveMethods,
    removeAttachments: enableAggressiveMethods,
  };

  const imageSettings: ImageCompressionSettings = {
    ...DEFAULT_IMAGE_SETTINGS,
    quality,
    targetDpi,
    enableDownsampling,
  };

  return { options, imageSettings };
}

/**
 * Snap target percent to nearest preset steps for clean UX.
 * Returns step values suitable for the slider.
 */
export const TARGET_SIZE_STEPS = {
  min: 10,
  max: 100,
  step: 1,
} as const;
