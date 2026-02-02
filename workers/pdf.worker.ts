/**
 * PDF Compression Web Worker
 * Supports all Phase 2 compression methods
 */

import { analyzePdf, type ExtendedProcessingSettings } from '../lib/pdf-processor';
import type { WorkerMessage, WorkerResponse, ImageCompressionSettings, CompressionOptions } from '../lib/types';
import { DEFAULT_IMAGE_SETTINGS, DEFAULT_COMPRESSION_OPTIONS } from '../lib/types';

const postResponse = (response: WorkerResponse) => {
  self.postMessage(response);
};

const postProgress = (message: string, percent?: number) => {
  postResponse({
    type: 'progress',
    payload: { stage: 'analyzing', message, percent },
  });
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

  try {
    const analysis = await analyzePdf(
      payload.arrayBuffer,
      postProgress,
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
    });
  }
};

export {};
