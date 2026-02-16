/**
 * Shared TypeScript types
 */

export interface CompressionOptions {
  // Structure (Phase 1)
  useObjectStreams: boolean;
  stripMetadata: boolean;

  // Images (Phase 2.1-2.2)
  recompressImages: boolean;
  downsampleImages: boolean;

  // Images (Phase 2.3-2.8)
  convertToGrayscale: boolean;
  pngToJpeg: boolean;
  convertToMonochrome: boolean;
  removeAlphaChannels: boolean;
  removeColorProfiles: boolean;
  cmykToRgb: boolean;

  // Resources (Phase 2)
  removeThumbnails: boolean;
  removeDuplicateResources: boolean;
  removeUnusedFonts: boolean;
  removeAttachments: boolean;

  // Interactive (Phase 2.10-2.11)
  flattenForms: boolean;
  flattenAnnotations: boolean;

  // Structure Cleanup (Phase 2.12-2.21)
  removeJavaScript: boolean;
  removeBookmarks: boolean;
  removeNamedDestinations: boolean;
  removeArticleThreads: boolean;
  removeWebCaptureInfo: boolean;
  removeHiddenLayers: boolean;
  removePageLabels: boolean;
  deepCleanMetadata: boolean;

  // Advanced Optimization (Phase 2 - New)
  inlineToXObject: boolean;       // 2.2 Convert inline images to XObjects
  compressContentStreams: boolean; // 2.3 Compress/recompress content streams
  removeOrphanObjects: boolean;   // 2.4 Remove unreferenced objects
  removeAlternateContent: boolean; // 2.5 Remove alternate images, print/screen-only
  removeInvisibleText: boolean;   // 2.6 Remove invisible OCR text
}

export interface ImageCompressionSettings {
  quality: number;  // 0-100
  minSizeThreshold: number;  // Skip images smaller than this (bytes)
  targetDpi: number;  // Target DPI for downsampling (72, 96, 150, 200, 300)
  enableDownsampling: boolean;  // Whether to downsample high-DPI images
}

export const DEFAULT_COMPRESSION_OPTIONS: CompressionOptions = {
  // Structure (Phase 1) - on by default
  useObjectStreams: true,
  stripMetadata: true,

  // Images (Phase 2.1-2.2)
  recompressImages: true,
  downsampleImages: false,  // Off by default - destructive operation

  // Images (Phase 2.3-2.8) - off by default, destructive
  convertToGrayscale: false,
  pngToJpeg: false,
  convertToMonochrome: false,
  removeAlphaChannels: false,
  removeColorProfiles: true,  // Safe — strips ICC profiles, colors render fine in sRGB
  cmykToRgb: false,

  // Resources (Phase 2) - safe to enable by default
  removeThumbnails: true,
  removeDuplicateResources: true,  // Safe — only removes exact duplicates, no quality impact
  removeUnusedFonts: true,  // Safe — only removes fonts with zero Tf references, fail-safe on parse errors
  removeAttachments: false,  // User may want to keep attachments

  // Interactive (Phase 2.10-2.11) - off by default, destructive
  flattenForms: false,
  flattenAnnotations: false,

  // Structure Cleanup (Phase 2.12-2.21) - mostly safe
  removeJavaScript: true,  // Security benefit
  removeBookmarks: false,  // User may need navigation
  removeNamedDestinations: false,  // User may need internal links
  removeArticleThreads: true,  // Rarely used
  removeWebCaptureInfo: true,  // Rarely needed
  removeHiddenLayers: false,  // Can affect content
  removePageLabels: false,  // May affect pagination display
  deepCleanMetadata: true,  // Safe — removes XMP metadata streams, no visual impact

  // Advanced Optimization (Phase 2 - New)
  inlineToXObject: true,         // On - safe, enables deduplication of inline images
  compressContentStreams: true,  // On - safe and beneficial
  removeOrphanObjects: true,     // On - safe cleanup
  removeAlternateContent: false, // Off - may affect print quality
  removeInvisibleText: false,    // Off - may affect searchability/accessibility
};

export const DEFAULT_IMAGE_SETTINGS: ImageCompressionSettings = {
  quality: 75,
  minSizeThreshold: 10 * 1024,  // 10KB
  targetDpi: 150,
  enableDownsampling: false,
};


export interface ProcessingSettings {
  options?: CompressionOptions;
  imageSettings?: ImageCompressionSettings;
  targetPercent?: number;  // Target size as % of original (10-100), enables iterative compression
}

/** Features detected in the PDF document - used to indicate method relevance */
export interface PdfFeatures {
  hasImages: boolean;
  hasJpegImages: boolean;
  hasPngImages: boolean;
  hasAlphaImages: boolean;
  hasIccProfiles: boolean;
  hasCmykImages: boolean;
  hasHighDpiImages: boolean;
  hasJavaScript: boolean;
  hasBookmarks: boolean;
  hasNamedDestinations: boolean;
  hasArticleThreads: boolean;
  hasWebCaptureInfo: boolean;
  hasHiddenLayers: boolean;
  hasPageLabels: boolean;
  hasForms: boolean;
  hasAnnotations: boolean;
  hasAttachments: boolean;
  hasThumbnails: boolean;
  hasMetadata: boolean;
}

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
  /** true when savings are still being calculated in the background */
  pending?: boolean;
  /** For image methods: estimated savings range at min/max quality or DPI */
  savingsRange?: { min: number; max: number };
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
    cmykCount: number;
    iccCount: number;
    alphaCount: number;
    avgDpi: number;
  };
  report?: CompressionReport;
  pdfFeatures?: PdfFeatures;
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
  // Whether image has transparency (SMask/Mask) that should be preserved
  hasTransparency?: boolean;
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
    imageSettings?: ImageCompressionSettings;
    options?: CompressionOptions;
    targetPercent?: number;  // Target size as % of original, enables iterative compression
    jobId: string;
  };
}

export interface WorkerMethodUpdatePayload {
  methodResults: MethodResult[];
}

export interface WorkerResponse {
  type: 'success' | 'error' | 'progress' | 'method-update';
  payload: WorkerSuccessPayload | WorkerErrorPayload | WorkerProgressPayload | WorkerMethodUpdatePayload;
  jobId: string;
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
    cmykCount: number;
    iccCount: number;
    alphaCount: number;
    avgDpi: number;
  };
  report?: CompressionReport;
  pdfFeatures?: PdfFeatures;
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

export interface ProcessingLog {
  timestamp: number;
  level: 'info' | 'success' | 'warning' | 'error';
  message: string;
  details?: string | object;
}

export interface CompressionReport {
  timestamp: number;
  originalSize: number;
  compressedSize: number;
  pageCount: number;
  methodsUsed: string[];
  methodsSuccessful: string[];
  errors: string[];
  logs: ProcessingLog[];
  userAgent?: string;
}
