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

export const UI = {
  DEBOUNCE_MS: 150,
} as const;
