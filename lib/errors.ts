/**
 * Custom error types for PDF processing
 * Enables specific error handling and user-friendly messages
 */

export class PdfError extends Error {
  constructor(
    message: string,
    public readonly code: PdfErrorCode,
    public readonly userMessage: string
  ) {
    super(message);
    this.name = 'PdfError';
  }
}

export type PdfErrorCode =
  | 'FILE_TOO_LARGE'
  | 'INVALID_FILE_TYPE'
  | 'ENCRYPTED_PDF'
  | 'CORRUPTED_PDF'
  | 'PROCESSING_FAILED'
  | 'WORKER_ERROR';

export const createPdfError = (code: PdfErrorCode, details?: string): PdfError => {
  const errors: Record<PdfErrorCode, { message: string; userMessage: string }> = {
    FILE_TOO_LARGE: {
      message: `File exceeds size limit${details ? `: ${details}` : ''}`,
      userMessage: 'File is too large. Maximum size is 100MB.',
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
    WORKER_ERROR: {
      message: `Worker error${details ? `: ${details}` : ''}`,
      userMessage: 'An unexpected error occurred. Please try again.',
    },
  };

  const { message, userMessage } = errors[code];
  return new PdfError(message, code, userMessage);
};

/**
 * Type guard to check if an error is a PdfError
 */
export const isPdfError = (error: unknown): error is PdfError => {
  return error instanceof PdfError;
};
