/**
 * PDF Compression Web Worker
 * Runs heavy PDF processing off the main thread
 */

import { analyzePdf } from '../lib/pdf-processor';
import type { WorkerMessage, WorkerResponse } from '../lib/types';

const postResponse = (response: WorkerResponse) => {
  self.postMessage(response);
};

const postProgress = (message: string) => {
  postResponse({
    type: 'progress',
    payload: { stage: 'analyzing', message },
  });
};

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { type, payload } = event.data;

  if (type !== 'start') return;

  try {
    const analysis = await analyzePdf(payload.arrayBuffer, postProgress);

    const buffer = new Uint8Array(analysis.fullCompressedBytes).buffer as ArrayBuffer;

    postResponse({
      type: 'success',
      payload: {
        originalSize: analysis.originalSize,
        pageCount: analysis.pageCount,
        baselineSize: analysis.baselineSize,
        fullCompressedBuffer: buffer,
        methodResults: analysis.methodResults,
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
