/**
 * Single source of truth for method risk categorization.
 *
 * These arrays define which compression methods belong to each risk tier.
 * They mirror the tab organization in CompressionMethods.tsx so the UI tabs,
 * potential calculator, and progressive method selection all stay in sync.
 */

import type { CompressionOptions } from './types';

export type RiskLevel = 'safe' | 'medium' | 'high';

/** Methods that cause no visual or functional loss */
export const SAFE_METHOD_KEYS: (keyof CompressionOptions)[] = [
  'useObjectStreams',
  'stripMetadata',
  'deepCleanMetadata',
  'compressContentStreams',
  'removeOrphanObjects',
  'removeDuplicateResources',
  'compressUncompressedStreams',
  'removeThumbnails',
  'removeJavaScript',
  'removeArticleThreads',
  'removeWebCaptureInfo',
  'removeColorProfiles',
  'removeUnusedFonts',
  'inlineToXObject',
  'deduplicateShadings',
  'removeUnusedShadings',
];

/** Methods with some quality or content loss */
export const MEDIUM_METHOD_KEYS: (keyof CompressionOptions)[] = [
  'recompressImages',
  'downsampleImages',
  'pngToJpeg',
  'removeAlphaChannels',
  'cmykToRgb',
  'removeBookmarks',
  'removeNamedDestinations',
  'removePageLabels',
  'removeAttachments',
  'removeAlternateContent',
  'removeHiddenLayers',
  'reduceVectorPrecision',
];

/** Methods with significant / destructive changes */
export const HIGH_METHOD_KEYS: (keyof CompressionOptions)[] = [
  'convertToGrayscale',
  'convertToMonochrome',
  'flattenForms',
  'flattenAnnotations',
  'removeInvisibleText',
  'removeFontUnicodeMaps',
  'rasterizePages',
];

/** All method keys across all risk levels */
export const ALL_METHOD_KEYS: (keyof CompressionOptions)[] = [
  ...SAFE_METHOD_KEYS,
  ...MEDIUM_METHOD_KEYS,
  ...HIGH_METHOD_KEYS,
];

/** Lookup: method key → risk level (derived from the arrays above) */
export const METHOD_RISK_LEVELS: Record<keyof CompressionOptions, RiskLevel> =
  Object.fromEntries([
    ...SAFE_METHOD_KEYS.map(k => [k, 'safe' as RiskLevel]),
    ...MEDIUM_METHOD_KEYS.map(k => [k, 'medium' as RiskLevel]),
    ...HIGH_METHOD_KEYS.map(k => [k, 'high' as RiskLevel]),
  ]) as Record<keyof CompressionOptions, RiskLevel>;

/** Returns an options object with every method enabled */
export function allMethodsEnabled(): CompressionOptions {
  return Object.fromEntries(
    ALL_METHOD_KEYS.map(k => [k, true]),
  ) as unknown as CompressionOptions;
}
