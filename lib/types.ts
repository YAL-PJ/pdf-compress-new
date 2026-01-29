/**
 * Shared TypeScript types
 */

export interface CompressionOptions {
  useObjectStreams: boolean;
  stripMetadata: boolean;
  recompressImages: boolean;  // NEW
}

// NEW
export interface ImageCompressionSettings {
  quality: number;  // 0-100
  minSizeThreshold: number;  // Skip images smaller than this (bytes)
}

export const DEFAULT_COMPRESSION_OPTIONS: CompressionOptions = {
  useObjectStreams: true,
  stripMetadata: true,
  recompressImages: true,  // NEW
};

// NEW
export const DEFAULT_IMAGE_SETTINGS: ImageCompressionSettings = {
  quality: 75,
  minSizeThreshold: 10 * 1024,  // 10KB
};

/** Result for a single compression method */
export interface MethodResult {
  key: keyof CompressionOptions;
  savedBytes: number;
  compressedSize: number;
  details?: {
    imagesProcessed?: number;
    imagesSkipped?: number;
  };
  displaySavedBytes?: number; // Logic for display vs calculation
}

/** Analysis results after processing */
export interface CompressionAnalysis {
  originalSize: number;
  pageCount: number;
  baselineSize: number;
  fullBlob: Blob;
  methodResults: MethodResult[];
  imageStats?: {  // NEW
    totalImages: number;
    jpegCount: number;
    pngCount: number;
    otherCount: number;
  };
}

export interface PdfInfo {
  pageCount: number;
  title?: string;
  author?: string;
}

// NEW - Extracted image data
export interface ExtractedImage {
  ref: string;
  format: 'jpeg' | 'png' | 'other';
  bytes: Uint8Array;
  width: number;
  height: number;
  colorSpace: string;
  bitsPerComponent: number;
  pageIndex: number;
  originalSize: number;
}

// NEW - Recompressed image
export interface RecompressedImage {
  ref: string;
  bytes: Uint8Array;
  width: number;
  height: number;
  newSize: number;
  originalSize: number;
  savedBytes: number;
}

export interface WorkerMessage {
  type: 'start';
  payload: {
    arrayBuffer: ArrayBuffer;
    fileName: string;
    imageSettings?: ImageCompressionSettings;  // NEW
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
  imageStats?: {  // NEW
    totalImages: number;
    jpegCount: number;
    pngCount: number;
    otherCount: number;
  };
}

export interface WorkerErrorPayload {
  code: string;
  message: string;
}

export interface WorkerProgressPayload {
  stage: string;
  message: string;
  percent?: number;  // NEW - for progress bar
}
