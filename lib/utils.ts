/**
 * Pure utility functions
 * All functions are stateless and have no side effects
 */

import { FILE_CONSTRAINTS } from './constants';

/**
 * Format bytes to human-readable string
 */
export const formatBytes = (bytes: number): string => {
  if (bytes < 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

/**
 * Calculate compression savings
 */
export interface CompressionSavings {
  savedBytes: number;
  savedPercent: number;
  isSmaller: boolean;
}

export const calculateSavings = (
  originalSize: number,
  compressedSize: number
): CompressionSavings => {
  const savedBytes = originalSize - compressedSize;
  const savedPercent = originalSize > 0 
    ? (savedBytes / originalSize) * 100 
    : 0;

  return {
    savedBytes,
    savedPercent,
    isSmaller: savedBytes > 0,
  };
};

/**
 * Validate file before processing
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * PDF magic bytes - all PDFs start with "%PDF"
 */
const PDF_MAGIC_BYTES = [0x25, 0x50, 0x44, 0x46]; // %PDF

/**
 * Basic file validation (size and extension)
 * This is a quick check before reading file contents
 */
export const validateFile = (file: File): ValidationResult => {
  // Check file size
  if (file.size > FILE_CONSTRAINTS.MAX_SIZE_BYTES) {
    return {
      valid: false,
      error: `File too large. Maximum size is ${FILE_CONSTRAINTS.MAX_SIZE_DISPLAY}.`,
    };
  }

  // Check file extension
  const hasValidExtension = FILE_CONSTRAINTS.ACCEPTED_EXTENSIONS.some(ext =>
    file.name.toLowerCase().endsWith(ext)
  );

  if (!hasValidExtension) {
    return {
      valid: false,
      error: 'Please select a valid PDF file.',
    };
  }

  return { valid: true };
};

/**
 * Validate PDF signature (magic bytes)
 * Checks that the file content actually starts with %PDF
 * This catches renamed non-PDF files (like ODF documents renamed to .pdf)
 */
export const validatePdfSignature = (arrayBuffer: ArrayBuffer): ValidationResult => {
  const bytes = new Uint8Array(arrayBuffer, 0, Math.min(4, arrayBuffer.byteLength));

  // Check for PDF magic bytes
  const isPdf = PDF_MAGIC_BYTES.every((byte, index) => bytes[index] === byte);

  if (!isPdf) {
    return {
      valid: false,
      error: 'This file is not a valid PDF. It may have been renamed or corrupted.',
    };
  }

  return { valid: true };
};

/**
 * Generate output filename
 */
export const getOutputFilename = (originalName: string): string => {
  const baseName = originalName.replace(/\.pdf$/i, '');
  return `${baseName}-compressed.pdf`;
};

/**
 * Check if running in browser environment
 */
export const isBrowser = (): boolean => {
  return typeof window !== 'undefined';
};

