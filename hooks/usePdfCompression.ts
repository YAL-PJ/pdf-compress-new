/**
 * usePdfCompression Hook - manages compression state
 * Supports all Phase 2 compression methods
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { validateFile } from '@/lib/utils';
import { createPdfError, PdfError } from '@/lib/errors';
import type {
  CompressionAnalysis,
  WorkerResponse,
  WorkerSuccessPayload,
  WorkerErrorPayload,
  WorkerProgressPayload,
  ImageCompressionSettings,
  CompressionOptions,
} from '@/lib/types';
import { DEFAULT_IMAGE_SETTINGS, DEFAULT_COMPRESSION_OPTIONS } from '@/lib/types';

export type CompressionState =
  | { status: 'idle' }
  | { status: 'validating' }
  | { status: 'processing'; progress: string; progressPercent?: number; fileName: string }
  | { status: 'done'; analysis: CompressionAnalysis; fileName: string; originalFile: File; isUpdating?: boolean }
  | { status: 'error'; error: PdfError };

export interface ProcessingSettings {
  imageSettings?: ImageCompressionSettings;
  options?: CompressionOptions;
}

interface UsePdfCompressionReturn {
  state: CompressionState;
  processFile: (file: File, settings?: ProcessingSettings, isBackground?: boolean) => void;
  reset: () => void;
}

export const usePdfCompression = (): UsePdfCompressionReturn => {
  const [state, setState] = useState<CompressionState>({ status: 'idle' });
  const workerRef = useRef<Worker | null>(null);
  const isBackgroundRef = useRef<boolean>(false);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const reset = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    isBackgroundRef.current = false;
    setState({ status: 'idle' });
  }, []);

  const processFile = useCallback((
    file: File,
    settings: ProcessingSettings = {},
    isBackground: boolean = false
  ) => {
    const imageSettings = settings.imageSettings ?? DEFAULT_IMAGE_SETTINGS;
    const options = settings.options ?? DEFAULT_COMPRESSION_OPTIONS;

    isBackgroundRef.current = isBackground;

    if (isBackground) {
      setState(prev => {
        // Only set isUpdating if we are already done, otherwise fallback to normal processing
        if (prev.status === 'done') {
          return { ...prev, isUpdating: true };
        }
        return prev;
      });
    } else {
      setState({ status: 'validating' });

      const validation = validateFile(file);
      if (!validation.valid) {
        setState({
          status: 'error',
          error: createPdfError('INVALID_FILE_TYPE', validation.error),
        });
        return;
      }

      setState({ status: 'processing', progress: 'Starting...', fileName: file.name });
    }

    // We always need the filename for the worker logs/state
    const fileName = file.name;

    workerRef.current?.terminate();
    workerRef.current = new Worker(
      new URL('../workers/pdf.worker.ts', import.meta.url)
    );

    workerRef.current.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const { type, payload } = event.data;

      switch (type) {
        case 'progress': {
          if (isBackgroundRef.current) return; // Suppress progress in background mode

          const p = payload as WorkerProgressPayload;
          setState({
            status: 'processing',
            progress: p.message,
            progressPercent: p.percent,
            fileName
          });
          break;
        }

        case 'success': {
          const s = payload as WorkerSuccessPayload;
          isBackgroundRef.current = false; // Reset background flag

          setState({
            status: 'done',
            fileName,
            originalFile: file,
            isUpdating: false,
            analysis: {
              originalSize: s.originalSize,
              pageCount: s.pageCount,
              baselineSize: s.baselineSize,
              fullBlob: new Blob([s.fullCompressedBuffer], { type: 'application/pdf' }),
              methodResults: s.methodResults,
              imageStats: s.imageStats,
            },
          });
          break;
        }

        case 'error': {
          isBackgroundRef.current = false;
          const e = payload as WorkerErrorPayload;
          setState({
            status: 'error',
            error: createPdfError(
              e.code as Parameters<typeof createPdfError>[0],
              e.message
            ),
          });
          break;
        }
      }
    };

    workerRef.current.onerror = (error) => {
      isBackgroundRef.current = false;
      setState({
        status: 'error',
        error: createPdfError('WORKER_ERROR', error.message),
      });
    };

    file.arrayBuffer().then((arrayBuffer) => {
      workerRef.current?.postMessage(
        {
          type: 'start',
          payload: { arrayBuffer, fileName, imageSettings, options }
        },
        [arrayBuffer]
      );
    });
  }, []);

  return { state, processFile, reset };
};
