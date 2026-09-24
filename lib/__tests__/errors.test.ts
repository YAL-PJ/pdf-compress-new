import { describe, it, expect } from 'vitest';
import { classifyProcessingError, createPdfError, type PdfErrorCode } from '../errors';

describe('classifyProcessingError', () => {
  // Real report (Aug 2026): "Array buffer allocation failed" reached the user
  // as "Failed to process the PDF. Please try a different file." The file was
  // fine; the browser had run out of memory.
  it.each([
    'Array buffer allocation failed',
    'Out of memory',
    'Invalid array length',
    'Invalid typed array length: 4294967296',
  ])('reports %j as OUT_OF_MEMORY, not a bad file', (message) => {
    const error = message.startsWith('Invalid') ? new RangeError(message) : new Error(message);
    expect(classifyProcessingError(error)).toBe('OUT_OF_MEMORY');
  });

  it('keeps the existing corrupted-PDF mapping', () => {
    expect(classifyProcessingError(new Error('Expected instance of PDFDict, but got instance of undefined'))).toBe('CORRUPTED_PDF');
    expect(classifyProcessingError(new Error('Invalid object ref: 12 0 R'))).toBe('CORRUPTED_PDF');
  });

  it('treats a missing page tree as a corrupted PDF', () => {
    expect(classifyProcessingError(new TypeError("Cannot read properties of undefined (reading 'Pages')"))).toBe('CORRUPTED_PDF');
  });

  it('keeps the existing encrypted-PDF mapping', () => {
    expect(classifyProcessingError(new Error('Input document to `PDFDocument.load` is encrypted'))).toBe('ENCRYPTED_PDF');
  });

  it('passes a PdfError code through unchanged', () => {
    expect(classifyProcessingError(createPdfError('FILE_TOO_LARGE'))).toBe('FILE_TOO_LARGE');
  });

  it('falls back to PROCESSING_FAILED', () => {
    expect(classifyProcessingError(new Error('something else'))).toBe('PROCESSING_FAILED');
    expect(classifyProcessingError('not an error')).toBe('PROCESSING_FAILED');
  });
});

describe('createPdfError', () => {
  it('gives out-of-memory its own user message', () => {
    expect(createPdfError('OUT_OF_MEMORY').userMessage).toMatch(/ran out of memory/);
  });

  it('does not crash on a code it does not know', () => {
    const error = createPdfError('SOMETHING_NEW' as PdfErrorCode, 'x');
    expect(error.userMessage).toBe(createPdfError('PROCESSING_FAILED').userMessage);
  });
});
