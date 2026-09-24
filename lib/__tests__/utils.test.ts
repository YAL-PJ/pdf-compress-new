import { describe, it, expect } from 'vitest';
import {
  formatBytes,
  calculateSavings,
  validateFile,
  validatePdfSignature,
  getOutputFilename,
} from '../utils';

describe('formatBytes', () => {
  it('formats zero bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('formats negative bytes as 0 B', () => {
    expect(formatBytes(-100)).toBe('0 B');
  });

  it('formats bytes under 1KB', () => {
    expect(formatBytes(500)).toBe('500 B');
  });

  it('formats kilobytes', () => {
    expect(formatBytes(1536)).toBe('1.5 KB');
  });

  it('formats megabytes', () => {
    expect(formatBytes(2.5 * 1024 * 1024)).toBe('2.50 MB');
  });
});

describe('calculateSavings', () => {
  it('calculates correct savings', () => {
    const result = calculateSavings(1000, 700);
    expect(result.savedBytes).toBe(300);
    expect(result.savedPercent).toBeCloseTo(30);
    expect(result.isSmaller).toBe(true);
  });

  it('handles no savings', () => {
    const result = calculateSavings(1000, 1000);
    expect(result.savedBytes).toBe(0);
    expect(result.savedPercent).toBe(0);
    expect(result.isSmaller).toBe(false);
  });

  it('handles size increase', () => {
    const result = calculateSavings(1000, 1200);
    expect(result.savedBytes).toBe(-200);
    expect(result.savedPercent).toBeCloseTo(-20);
    expect(result.isSmaller).toBe(false);
  });

  it('handles zero original size', () => {
    const result = calculateSavings(0, 0);
    expect(result.savedPercent).toBe(0);
  });
});

describe('validateFile', () => {
  it('accepts a valid PDF file', () => {
    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    const result = validateFile(file);
    expect(result.valid).toBe(true);
  });

  it('rejects files that are too large', () => {
    // Create a file-like object that reports a large size
    const file = new File(['x'], 'big.pdf', { type: 'application/pdf' });
    Object.defineProperty(file, 'size', { value: 201 * 1024 * 1024 });
    const result = validateFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('too large');
  });

  it('rejects non-PDF extensions', () => {
    const file = new File(['content'], 'test.txt', { type: 'text/plain' });
    const result = validateFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('valid PDF');
  });

  it('accepts .PDF extension (case insensitive)', () => {
    const file = new File(['content'], 'test.PDF', { type: 'application/pdf' });
    const result = validateFile(file);
    expect(result.valid).toBe(true);
  });
});

describe('validatePdfSignature', () => {
  it('accepts valid PDF signature', () => {
    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
    const result = validatePdfSignature(bytes.buffer);
    expect(result.valid).toBe(true);
  });

  it('rejects invalid PDF signature', () => {
    const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04]); // ZIP signature
    const result = validatePdfSignature(bytes.buffer);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('not a valid PDF');
  });

  // Real report (Aug 2026): a 53-page hospital record rejected as "not a valid
  // PDF". The PDF spec, Acrobat, pdf.js and pdf-lib all accept a header that
  // is preceded by a few bytes (a BOM, whitespace, a document-system prefix),
  // as long as it starts within the first 1024 bytes.
  const withPrefix = (prefix: number[]) =>
    new Uint8Array([...prefix, 0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]).buffer;

  it('accepts a header preceded by a UTF-8 BOM and a newline', () => {
    expect(validatePdfSignature(withPrefix([0xef, 0xbb, 0xbf, 0x0d, 0x0a])).valid).toBe(true);
  });

  it('accepts a header that starts inside the first 1024 bytes', () => {
    expect(validatePdfSignature(withPrefix(new Array(1000).fill(0x20))).valid).toBe(true);
  });

  it('rejects a header that starts after the first 1024 bytes', () => {
    expect(validatePdfSignature(withPrefix(new Array(1100).fill(0x20))).valid).toBe(false);
  });

  it('rejects an empty file', () => {
    expect(validatePdfSignature(new ArrayBuffer(0)).valid).toBe(false);
  });
});

describe('getOutputFilename', () => {
  it('appends -compressed to the base name', () => {
    expect(getOutputFilename('report.pdf')).toBe('report-compressed.pdf');
  });

  it('handles case-insensitive .PDF extension', () => {
    expect(getOutputFilename('report.PDF')).toBe('report-compressed.pdf');
  });

  it('handles filenames without extension', () => {
    expect(getOutputFilename('report')).toBe('report-compressed.pdf');
  });
});
