/**
 * Application constants
 */

export const FILE_CONSTRAINTS = {
  MAX_SIZE_BYTES: 100 * 1024 * 1024,
  MAX_SIZE_DISPLAY: '100MB',
  ACCEPTED_TYPES: ['application/pdf'],
  ACCEPTED_EXTENSIONS: ['.pdf'],
} as const;

export const COMPRESSION_DEFAULTS = {
  USE_OBJECT_STREAMS: true,
} as const;

// NEW - Image compression settings
export const IMAGE_COMPRESSION = {
  DEFAULT_QUALITY: 75,
  MIN_QUALITY: 10,
  MAX_QUALITY: 95,
  QUALITY_PRESETS: {
    low: { value: 50, label: 'Low (smaller files)' },
    medium: { value: 75, label: 'Medium (balanced)' },
    high: { value: 85, label: 'High (better quality)' },
  },
  MIN_SIZE_THRESHOLD: 10 * 1024,  // 10KB
  MAX_CANVAS_DIMENSION: 16384,
} as const;

// DPI downsampling settings
export const DPI_OPTIONS = {
  DEFAULT_TARGET_DPI: 150,
  PRESETS: [
    { value: 72, label: '72 DPI (screen)' },
    { value: 96, label: '96 DPI (web)' },
    { value: 150, label: '150 DPI (ebook)' },
    { value: 200, label: '200 DPI (balanced)' },
    { value: 300, label: '300 DPI (print)' },
  ],
  // Skip downsampling if image is already below this threshold (with some margin)
  MIN_DIMENSION_THRESHOLD: 100,  // pixels - don't downsample tiny images
  // Assume images smaller than this are already low-res
  LOW_RES_THRESHOLD: 500,  // pixels in largest dimension
} as const;

export const UI = {
  DEBOUNCE_MS: 150,
} as const;
