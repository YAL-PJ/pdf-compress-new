/**
 * Custom error types for PDF processing
 * Enables specific error handling and user-friendly messages
 */

export const MAX_FILE_SIZE_MB = 200;

export class PdfError extends Error {
  constructor(
    message: string,
    public readonly code: PdfErrorCode,
    public readonly userMessage: string
  ) {
    super(message);
    this.name = 'PdfError';
    Object.setPrototypeOf(this, PdfError.prototype);
  }
}

export type PdfErrorCode =
  | 'FILE_TOO_LARGE'
  | 'INVALID_FILE_TYPE'
  | 'ENCRYPTED_PDF'
  | 'CORRUPTED_PDF'
  | 'PROCESSING_FAILED'
  | 'FILE_UNAVAILABLE'
  | 'WORKER_ERROR'
  | 'STALE_WORKER'
  | 'OUT_OF_MEMORY';

export const createPdfError = (code: PdfErrorCode, details?: string): PdfError => {
  const errors: Record<PdfErrorCode, { message: string; userMessage: string }> = {
    FILE_TOO_LARGE: {
      message: `File exceeds size limit${details ? `: ${details}` : ''}`,
      userMessage: `File is too large. Maximum size is ${MAX_FILE_SIZE_MB}MB.`,
    },
    INVALID_FILE_TYPE: {
      message: `Invalid file type${details ? `: ${details}` : ''}`,
      userMessage: 'Please select a valid PDF file.',
    },
    ENCRYPTED_PDF: {
      message: 'PDF is encrypted',
      userMessage: 'This PDF is password-protected and cannot be processed.',
    },
    CORRUPTED_PDF: {
      message: `PDF structure invalid${details ? `: ${details}` : ''}`,
      userMessage: 'This PDF appears to be corrupted.',
    },
    PROCESSING_FAILED: {
      message: `Processing failed${details ? `: ${details}` : ''}`,
      userMessage: 'Failed to process the PDF. Please try a different file.',
    },
    FILE_UNAVAILABLE: {
      message: `File unavailable${details ? `: ${details}` : ''}`,
      userMessage: 'Your browser could not access the selected file anymore. Please choose the PDF again and keep the file available until compression finishes.',
    },
    WORKER_ERROR: {
      message: `Worker error${details ? `: ${details}` : ''}`,
      userMessage: 'An unexpected error occurred. Please try again.',
    },
    STALE_WORKER: {
      message: `Stale worker script${details ? `: ${details}` : ''}`,
      userMessage: 'The app was updated. Please refresh the page.',
    },
    OUT_OF_MEMORY: {
      message: `Out of memory${details ? `: ${details}` : ''}`,
      userMessage: 'Your browser ran out of memory while compressing this PDF. Close other tabs and try again, or try on a computer with more memory.',
    },
  };

  // Codes arrive from the worker as plain strings; an unknown one must still
  // produce a readable error rather than a crash while building it.
  const { message, userMessage } = errors[code] ?? errors.PROCESSING_FAILED;
  return new PdfError(message, code, userMessage);
};

/**
 * Type guard to check if an error is a PdfError
 */
export const isPdfError = (error: unknown): error is PdfError => {
  return error instanceof PdfError;
};

/**
 * Map an error thrown while processing a PDF to the code the user sees.
 * Order matters: memory errors are checked before the generic "Invalid"
 * match, since V8 reports some of them as "Invalid array length".
 */
export const classifyProcessingError = (error: unknown): PdfErrorCode => {
  if (isPdfError(error)) return error.code;

  const message = error instanceof Error ? error.message : String(error ?? '');

  if (/array buffer allocation failed|out of memory|invalid array length|invalid typed array length/i.test(message)) {
    return 'OUT_OF_MEMORY';
  }
  if (message.includes('encrypt') || message.includes('password')) {
    return 'ENCRYPTED_PDF';
  }
  if (
    message.includes('Invalid') ||
    message.includes('corrupt') ||
    message.includes('Expected instance') ||
    // pdf-lib found no page tree at all, even after lib/pdf-repair.ts tried.
    message.includes("reading 'Pages'")
  ) {
    return 'CORRUPTED_PDF';
  }
  return 'PROCESSING_FAILED';
};
