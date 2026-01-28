/**
 * Shared TypeScript types
 */

export interface CompressionOptions {
  useObjectStreams: boolean;
  stripMetadata: boolean;
}

export const DEFAULT_COMPRESSION_OPTIONS: CompressionOptions = {
  useObjectStreams: true,
  stripMetadata: true,
};

/** Result for a single compression method */
export interface MethodResult {
  key: keyof CompressionOptions;
  savedBytes: number;
  compressedSize: number;
}

/** Analysis results after processing */
export interface CompressionAnalysis {
  originalSize: number;
  pageCount: number;
  /** Baseline (no compression) */
  baselineSize: number;
  /** The fully compressed blob (all methods ON) */
  fullBlob: Blob;
  /** Individual method contributions */
  methodResults: MethodResult[];
}

export interface PdfInfo {
  pageCount: number;
  title?: string;
  author?: string;
}

export interface WorkerMessage {
  type: 'start';
  payload: {
    arrayBuffer: ArrayBuffer;
    fileName: string;
  };
}

export interface WorkerResponse {
  type: 'success' | 'error' | 'progress';
  payload: WorkerSuccessPayload | WorkerErrorPayload | WorkerProgressPayload;
}

export interface WorkerSuccessPayload {
  originalSize: number;
  pageCount: number;
  baselineSize: number;
  fullCompressedBuffer: ArrayBuffer;
  methodResults: MethodResult[];
}

export interface WorkerErrorPayload {
  code: string;
  message: string;
}

export interface WorkerProgressPayload {
  stage: string;
  message: string;
}
