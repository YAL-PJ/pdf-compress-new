/**
 * Shared TypeScript types
 */

export interface CompressionOptions {
  useObjectStreams: boolean;
  stripMetadata: boolean;
  recompressImages: boolean;
  downsampleImages: boolean;
}

export interface ImageCompressionSettings {
  quality: number;  // 0-100
  minSizeThreshold: number;  // Skip images smaller than this (bytes)
  targetDpi: number;  // Target DPI for downsampling (72, 96, 150, 200, 300)
  enableDownsampling: boolean;  // Whether to downsample high-DPI images
}

export const DEFAULT_COMPRESSION_OPTIONS: CompressionOptions = {
  useObjectStreams: true,
  stripMetadata: true,
  recompressImages: true,
  downsampleImages: false,  // Off by default - destructive operation
};

export const DEFAULT_IMAGE_SETTINGS: ImageCompressionSettings = {
  quality: 75,
  minSizeThreshold: 10 * 1024,  // 10KB
  targetDpi: 150,
  enableDownsampling: false,
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
  imageStats?: {
    totalImages: number;
    jpegCount: number;
    pngCount: number;
    otherCount: number;
    highDpiCount: number;
  };
}

export interface PdfInfo {
  pageCount: number;
  title?: string;
  author?: string;
}

// Extracted image data
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
  // Estimated DPI based on typical PDF usage (larger images = higher DPI)
  estimatedDpi?: number;
}

// Recompressed/downsampled image
export interface RecompressedImage {
  ref: string;
  bytes: Uint8Array;
  width: number;
  height: number;
  newSize: number;
  originalSize: number;
  savedBytes: number;
  wasDownsampled?: boolean;
  originalWidth?: number;
  originalHeight?: number;
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
  imageStats?: {
    totalImages: number;
    jpegCount: number;
    pngCount: number;
    otherCount: number;
    highDpiCount: number;
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
