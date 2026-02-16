/**
 * Compression Potential Calculator
 *
 * Uses actual measured per-method savings to calculate how much a PDF
 * can be compressed at each risk tier (safe / medium / high).
 *
 * This data drives:
 * 1. Visual indicators on the target size slider showing achievable ranges
 * 2. Progressive method selection — safest methods first, escalating only as needed
 */

import type { CompressionOptions, MethodResult } from './types';

export type RiskLevel = 'safe' | 'medium' | 'high';

/** Classification of every compression method by risk level */
export const METHOD_RISK_LEVELS: Record<keyof CompressionOptions, RiskLevel> = {
  // Safe — no visual or functional loss
  useObjectStreams: 'safe',
  stripMetadata: 'safe',
  deepCleanMetadata: 'safe',
  compressContentStreams: 'safe',
  removeOrphanObjects: 'safe',
  removeDuplicateResources: 'safe',
  removeThumbnails: 'safe',
  removeJavaScript: 'safe',
  removeArticleThreads: 'safe',
  removeWebCaptureInfo: 'safe',
  removeColorProfiles: 'safe',
  removeUnusedFonts: 'safe',
  inlineToXObject: 'safe',
  deduplicateShadings: 'safe',
  removeUnusedShadings: 'safe',

  // Medium — some quality or content loss
  recompressImages: 'medium',
  downsampleImages: 'medium',
  pngToJpeg: 'medium',
  removeAlphaChannels: 'medium',
  cmykToRgb: 'medium',
  removeBookmarks: 'medium',
  removeNamedDestinations: 'medium',
  removePageLabels: 'medium',
  removeAttachments: 'medium',
  removeAlternateContent: 'medium',
  removeHiddenLayers: 'medium',
  reduceVectorPrecision: 'medium',

  // High — significant / destructive changes
  convertToGrayscale: 'high',
  convertToMonochrome: 'high',
  flattenForms: 'high',
  flattenAnnotations: 'high',
  removeInvisibleText: 'high',
};

export interface CompressionPotential {
  /** Bytes saveable using only safe methods */
  safeSavings: number;
  /** Bytes saveable using safe + medium methods */
  mediumSavings: number;
  /** Bytes saveable using all methods (safe + medium + high) */
  totalSavings: number;
  /** Minimum achievable size using safe methods only */
  safeFloor: number;
  /** Minimum achievable size using safe + medium methods */
  mediumFloor: number;
  /** Minimum achievable size using all methods */
  absoluteFloor: number;
  /** Whether measurements are still in progress */
  hasPending: boolean;
  /** Number of methods still being measured */
  pendingCount: number;
}

/**
 * Calculate the compression potential from measured method results.
 *
 * Uses the actual per-method savings measured in the background.
 * For image methods with savingsRange, uses `max` (most aggressive) for potential.
 */
export function calculateCompressionPotential(
  originalSize: number,
  methodResults: MethodResult[],
): CompressionPotential {
  let safeSavings = 0;
  let mediumSavings = 0;
  let highSavings = 0;
  let pendingCount = 0;

  for (const result of methodResults) {
    if (result.pending) {
      pendingCount++;
      continue;
    }

    const risk = METHOD_RISK_LEVELS[result.key];
    // For methods with a savings range, use the max (most aggressive potential)
    const savings = result.savingsRange
      ? result.savingsRange.max
      : result.savedBytes;

    if (savings <= 0) continue;

    switch (risk) {
      case 'safe':
        safeSavings += savings;
        break;
      case 'medium':
        mediumSavings += savings;
        break;
      case 'high':
        highSavings += savings;
        break;
    }
  }

  const totalSavings = safeSavings + mediumSavings + highSavings;

  return {
    safeSavings,
    mediumSavings: safeSavings + mediumSavings,
    totalSavings,
    safeFloor: Math.max(0, originalSize - safeSavings),
    mediumFloor: Math.max(0, originalSize - safeSavings - mediumSavings),
    absoluteFloor: Math.max(0, originalSize - totalSavings),
    hasPending: pendingCount > 0,
    pendingCount,
  };
}

/**
 * Given a target size in bytes and measured method results, returns which methods
 * should be enabled to reach the target — starting from safest to most aggressive.
 *
 * Methods within each tier are sorted by savings (biggest first) so we enable
 * only what's needed to reach the target.
 */
export function selectMethodsForTarget(
  originalSize: number,
  targetBytes: number,
  methodResults: MethodResult[],
): Set<keyof CompressionOptions> {
  const enabled = new Set<keyof CompressionOptions>();

  // Group methods by risk level with their measured savings
  const tiers: { risk: RiskLevel; methods: { key: keyof CompressionOptions; savings: number }[] }[] = [
    { risk: 'safe', methods: [] },
    { risk: 'medium', methods: [] },
    { risk: 'high', methods: [] },
  ];

  for (const result of methodResults) {
    if (result.pending) continue;
    const savings = result.savingsRange ? result.savingsRange.max : result.savedBytes;
    if (savings <= 0) continue;
    const risk = METHOD_RISK_LEVELS[result.key];
    const tierIndex = risk === 'safe' ? 0 : risk === 'medium' ? 1 : 2;
    tiers[tierIndex].methods.push({ key: result.key, savings });
  }

  // Sort each tier by savings descending (enable the most impactful first)
  for (const tier of tiers) {
    tier.methods.sort((a, b) => b.savings - a.savings);
  }

  let currentSize = originalSize;

  // Walk through tiers, enabling methods until we reach the target
  for (const tier of tiers) {
    if (currentSize <= targetBytes) break;

    for (const method of tier.methods) {
      enabled.add(method.key);
      currentSize -= method.savings;
      if (currentSize <= targetBytes) break;
    }
  }

  return enabled;
}
