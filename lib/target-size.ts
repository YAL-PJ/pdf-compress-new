/**
 * Maps a target size percentage to interpolated compression settings.
 *
 * The slider maps to 3 zones:
 * - 10-40%  → Aggressive range (quality 10-30, DPI 72, all methods on)
 * - 40-70%  → Balanced range   (quality 30-65, DPI 72-150, moderate methods)
 * - 70-100% → Minimal range    (quality 65-90, DPI 150-300, light methods)
 *
 * When compression doesn't reach the target, escalation tiers progressively
 * enable more destructive methods:
 * - Tier 1: Lower quality + enable risky image methods
 * - Tier 2: Enable all structural cleanup + flatten everything
 * - Tier 3: Nuclear — grayscale, monochrome, minimum quality
 */

import { CompressionOptions, ImageCompressionSettings, DEFAULT_COMPRESSION_OPTIONS, DEFAULT_IMAGE_SETTINGS } from './types';
import { allMethodsEnabled } from './method-categories';

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
  // 10% → quality 10, 25% → quality 20, 50% → quality 45, 100% → quality 95
  // More aggressive at the low end than before
  const quality = clamp(lerp(10, 95, (pct - 10) / 90), 5, 100);

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
  const enableMaxCompression = pct <= 30;
  const enableNuclear = pct <= 15;

  // At extreme low targets (≤15%), enable every single method
  if (enableNuclear) {
    return {
      options: allMethodsEnabled(),
      imageSettings: {
        quality: Math.max(5, quality),
        targetDpi: 72,
        enableDownsampling: true,
        minSizeThreshold: 1024,
      },
    };
  }

  const options: CompressionOptions = {
    ...DEFAULT_COMPRESSION_OPTIONS,
    useObjectStreams: true,
    stripMetadata: true,
    recompressImages: true,
    downsampleImages: enableDownsampling,
    removeDuplicateResources: pct <= 80,
    removeColorProfiles: pct <= 85,
    deepCleanMetadata: pct <= 80,
    // Aggressive methods (enabled at ≤50%)
    pngToJpeg: enableAggressiveMethods,
    removeAlphaChannels: enableAggressiveMethods,
    removeAttachments: enableAggressiveMethods,
    removeAlternateContent: enableAggressiveMethods,
    removeInvisibleText: enableAggressiveMethods,
    // Maximum compression methods (enabled at ≤30%)
    removeBookmarks: enableMaxCompression,
    removeNamedDestinations: enableMaxCompression,
    removeHiddenLayers: enableMaxCompression,
    removePageLabels: enableMaxCompression,
    flattenForms: enableMaxCompression,
    flattenAnnotations: enableMaxCompression,
    cmykToRgb: enableMaxCompression,
    // Vector optimization (safe methods always on, precision at aggressive)
    deduplicateShadings: true,
    removeUnusedShadings: true,
    reduceVectorPrecision: enableAggressiveMethods,
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
 * Escalation tiers for when compression doesn't reach target.
 * Each tier returns progressively more aggressive settings.
 *
 * Tier 0: Initial settings from settingsForTargetPercent()
 * Tier 1: Lower quality, enable all risky image/content methods
 * Tier 2: Enable all structural methods, flatten everything
 * Tier 3: Nuclear — minimum quality, grayscale, everything enabled
 */
export function getEscalationTier(
  tier: number,
  baseOptions: CompressionOptions,
  baseImageSettings: ImageCompressionSettings,
): TargetSizeResult {
  switch (tier) {
    case 1: {
      // Tier 1: Drop quality further, enable all risky image methods
      const quality = Math.max(5, Math.round(baseImageSettings.quality * 0.5));
      return {
        options: {
          ...baseOptions,
          pngToJpeg: true,
          removeAlphaChannels: true,
          removeColorProfiles: true,
          removeAttachments: true,
          removeAlternateContent: true,
          removeInvisibleText: true,
          cmykToRgb: true,
          removeDuplicateResources: true,
          removeUnusedFonts: true,
          deepCleanMetadata: true,
          downsampleImages: true,
          deduplicateShadings: true,
          removeUnusedShadings: true,
          reduceVectorPrecision: true,
        },
        imageSettings: {
          ...baseImageSettings,
          quality,
          targetDpi: 72,
          enableDownsampling: true,
        },
      };
    }
    case 2: {
      // Tier 2: Enable all structural cleanup + flatten everything
      const quality = Math.max(5, Math.round(baseImageSettings.quality * 0.3));
      return {
        options: {
          ...baseOptions,
          // All image methods
          pngToJpeg: true,
          removeAlphaChannels: true,
          removeColorProfiles: true,
          cmykToRgb: true,
          // All resource methods
          removeDuplicateResources: true,
          removeUnusedFonts: true,
          removeAttachments: true,
          removeThumbnails: true,
          // All content methods
          removeAlternateContent: true,
          removeInvisibleText: true,
          inlineToXObject: true,
          compressContentStreams: true,
          // All structural cleanup
          removeJavaScript: true,
          removeBookmarks: true,
          removeNamedDestinations: true,
          removeArticleThreads: true,
          removeWebCaptureInfo: true,
          removeHiddenLayers: true,
          removePageLabels: true,
          deepCleanMetadata: true,
          // Flatten everything
          flattenForms: true,
          flattenAnnotations: true,
          // Vector optimization
          deduplicateShadings: true,
          removeUnusedShadings: true,
          reduceVectorPrecision: true,
        },
        imageSettings: {
          ...baseImageSettings,
          quality,
          targetDpi: 72,
          enableDownsampling: true,
        },
      };
    }
    case 3:
    default: {
      // Tier 3: Nuclear — absolute minimum quality, every method enabled
      return {
        options: allMethodsEnabled(),
        imageSettings: {
          quality: 5,
          targetDpi: 72,
          enableDownsampling: true,
          minSizeThreshold: 1024, // Process even small images (1KB threshold)
        },
      };
    }
  }
}

/** Maximum number of escalation tiers */
export const MAX_ESCALATION_TIERS = 3;

/**
 * Snap target percent to nearest preset steps for clean UX.
 * Returns step values suitable for the slider.
 */
export const TARGET_SIZE_STEPS = {
  min: 10,
  max: 100,
  step: 1,
} as const;
