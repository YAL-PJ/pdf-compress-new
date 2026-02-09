/**
 * PDF Compression Web Worker
 * Supports all Phase 2 compression methods
 */

import { analyzePdf, type ExtendedProcessingSettings } from '../lib/pdf-processor';
import type { WorkerMessage, WorkerResponse, ImageCompressionSettings, CompressionOptions } from '@/lib/types';

// Inline defaults to avoid import issues in worker environment
const DEFAULT_COMPRESSION_OPTIONS: CompressionOptions = {
  useObjectStreams: true,
  stripMetadata: true,
  recompressImages: true,
  downsampleImages: false,
  convertToGrayscale: false,
  pngToJpeg: false,
  convertToMonochrome: false,
  removeAlphaChannels: false,
  removeColorProfiles: false,
  cmykToRgb: false,
  removeThumbnails: true,
  removeDuplicateResources: false,
  removeUnusedFonts: false,
  removeAttachments: false,
  flattenForms: false,
  flattenAnnotations: false,
  removeJavaScript: true,
  removeBookmarks: false,
  removeNamedDestinations: false,
  removeArticleThreads: true,
  removeWebCaptureInfo: true,
  removeHiddenLayers: false,
  removePageLabels: false,
  deepCleanMetadata: false,
  inlineToXObject: false,
  compressContentStreams: true,
  removeOrphanObjects: true,
  removeAlternateContent: false,
  removeInvisibleText: false,
};

const DEFAULT_IMAGE_SETTINGS: ImageCompressionSettings = {
  quality: 75,
  minSizeThreshold: 10 * 1024,
  targetDpi: 150,
  enableDownsampling: false,
};



self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { type, payload } = event.data;

  if (type !== 'start') return;

  const imageSettings: ImageCompressionSettings = payload.imageSettings ?? DEFAULT_IMAGE_SETTINGS;
  const options: CompressionOptions = payload.options ?? DEFAULT_COMPRESSION_OPTIONS;

  // Build extended settings that include both image settings and compression options
  const extendedSettings: ExtendedProcessingSettings = {
    ...imageSettings,
    options,
  };

  const { jobId } = payload;

  const postResponse = (response: WorkerResponse) => {
    // Ensure jobId is attached to every response
    self.postMessage({ ...response, jobId });
  };

  const postProgressWithJob = (message: string, percent?: number) => {
    postResponse({
      type: 'progress',
      payload: { stage: 'analyzing', message, percent },
      jobId,
    });
  };

  try {
    const analysis = await analyzePdf(
      payload.arrayBuffer,
      postProgressWithJob,
      extendedSettings
    );

    const buffer = new Uint8Array(analysis.fullCompressedBytes).buffer as ArrayBuffer;

    postResponse({
      type: 'success',
      payload: {
        originalSize: analysis.originalSize,
        pageCount: analysis.pageCount,
        baselineSize: analysis.baselineSize,
        fullCompressedBuffer: buffer,
        methodResults: analysis.methodResults,
        imageStats: analysis.imageStats,
      },
      jobId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    let code = 'PROCESSING_FAILED';
    if (message.includes('encrypt') || message.includes('password')) {
      code = 'ENCRYPTED_PDF';
    } else if (message.includes('Invalid') || message.includes('corrupt')) {
      code = 'CORRUPTED_PDF';
    }

    postResponse({
      type: 'error',
      payload: { code, message },
      jobId,
    });
  }
};

export { };
