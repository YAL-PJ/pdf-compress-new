/**
 * PDF Compression Web Worker
 * Supports all Phase 2 compression methods
 */

import { analyzePdf, type ExtendedProcessingSettings } from '../lib/pdf-processor';
import { isPdfError } from '@/lib/errors';
import {
  DEFAULT_COMPRESSION_OPTIONS,
  DEFAULT_IMAGE_SETTINGS,
} from '@/lib/types';
import type { WorkerMessage, WorkerResponse, ImageCompressionSettings, CompressionOptions } from '@/lib/types';

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { type, payload } = event.data;

  if (type !== 'start') return;

  const imageSettings: ImageCompressionSettings = payload.imageSettings ?? DEFAULT_IMAGE_SETTINGS;
  const options: CompressionOptions = payload.options ?? DEFAULT_COMPRESSION_OPTIONS;

  const extendedSettings: ExtendedProcessingSettings = {
    ...imageSettings,
    options,
  };

  const { jobId } = payload;

  const postResponse = (response: WorkerResponse, transfer?: Transferable[]) => {
    self.postMessage({ ...response, jobId }, { transfer: transfer ?? [] });
  };

  const postProgress = (message: string, percent?: number) => {
    postResponse({
      type: 'progress',
      payload: { stage: 'analyzing', message, percent },
      jobId,
    });
  };

  try {
    const analysis = await analyzePdf(
      payload.arrayBuffer,
      postProgress,
      extendedSettings
    );

    const buffer = analysis.fullCompressedBytes.slice().buffer as ArrayBuffer;

    postResponse({
      type: 'success',
      payload: {
        originalSize: analysis.originalSize,
        pageCount: analysis.pageCount,
        baselineSize: analysis.baselineSize,
        fullCompressedBuffer: buffer,
        methodResults: analysis.methodResults,
        imageStats: analysis.imageStats,
        pdfFeatures: analysis.pdfFeatures,
        report: analysis.report,
      },
      jobId,
    }, [buffer]); // Transfer ArrayBuffer instead of copying
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    let code = 'PROCESSING_FAILED';
    if (isPdfError(error)) {
      code = error.code;
    } else if (message.includes('encrypt') || message.includes('password')) {
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
