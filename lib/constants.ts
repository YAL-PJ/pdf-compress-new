/**
 * Application constants
 * Centralized configuration - no magic numbers in code
 */

export const FILE_CONSTRAINTS = {
  MAX_SIZE_BYTES: 100 * 1024 * 1024, // 100MB
  MAX_SIZE_DISPLAY: '100MB',
  ACCEPTED_TYPES: ['application/pdf'],
  ACCEPTED_EXTENSIONS: ['.pdf'],
} as const;

export const COMPRESSION_DEFAULTS = {
  USE_OBJECT_STREAMS: true,
} as const;

export const UI = {
  DEBOUNCE_MS: 150,
} as const;
