/**
 * usePdfCompression Hook - manages compression state
 * Supports all Phase 2 compression methods
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { validateFile, validatePdfSignature } from '@/lib/utils';
import { createPdfError, PdfError } from '@/lib/errors';
import {
  trackFileUpload,
  trackCompressionCompleted,
  trackCompressionError,
} from '@/lib/analytics';
import {
  DEFAULT_COMPRESSION_OPTIONS,
  DEFAULT_IMAGE_SETTINGS,
} from '@/lib/types';
import type {
  CompressionAnalysis,
  WorkerResponse,
  WorkerSuccessPayload,
  WorkerErrorPayload,
  WorkerProgressPayload,
  ProcessingSettings,
} from '@/lib/types';

// Simple ID generator for job tracking
const generateJobId = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

export type CompressionState =
  | { status: 'idle' }
  | { status: 'validating' }
  | { status: 'processing'; progress: string; progressPercent?: number; fileName: string; originalFile: File }
  | { status: 'done'; analysis: CompressionAnalysis; fileName: string; originalFile: File; isUpdating?: boolean }
  | { status: 'error'; error: PdfError };

interface UsePdfCompressionReturn {
  state: CompressionState;
  processFile: (file: File, settings?: ProcessingSettings, isBackground?: boolean) => void;
  reset: () => void;
}

export const usePdfCompression = (): UsePdfCompressionReturn => {
  const [state, setState] = useState<CompressionState>({ status: 'idle' });
  const workerRef = useRef<Worker | null>(null);
  const isBackgroundRef = useRef<boolean>(false);
  const currentJobIdRef = useRef<string | null>(null);

  // Initialize worker immediately on mount
  useEffect(() => {
    try {
      if (!workerRef.current) {
        initWorker();
      }
    } catch (err) {
      console.error("Failed to init worker on mount:", err);
    }

    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  const initWorker = (retryCount = 0) => {
    // Terminate existing if any
    workerRef.current?.terminate();

    workerRef.current = new Worker(
      new URL('../workers/compression.worker.ts', import.meta.url)
    );

    workerRef.current.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const { type, payload, jobId } = event.data;

      // Ignore messages from old jobs (cancellation)
      if (jobId !== currentJobIdRef.current) {
        return;
      }

      switch (type) {
        case 'progress': {
          if (isBackgroundRef.current) return; // Suppress progress in background mode

          const p = payload as WorkerProgressPayload;
          setState(prev => ({
            ...prev,
            status: 'processing' as const,
            progress: p.message,
            progressPercent: p.percent,
            fileName: 'fileName' in prev ? prev.fileName : '',
            originalFile: 'originalFile' in prev ? prev.originalFile as File : new File([], ''),
          }));
          break;
        }

        case 'success': {
          const s = payload as WorkerSuccessPayload;
          isBackgroundRef.current = false; // Reset background flag

          // Track compression completion
          const savingsRatio = s.originalSize > 0
            ? ((s.originalSize - s.baselineSize) / s.originalSize) * 100
            : 0;
          trackCompressionCompleted(
            s.originalSize / 1024 / 1024,
            s.baselineSize / 1024 / 1024,
            savingsRatio
          );

          setState(prev => ({
            status: 'done',
            fileName: 'fileName' in prev ? prev.fileName : 'document.pdf',
            originalFile: 'originalFile' in prev ? prev.originalFile as File : new File([], 'error'),
            isUpdating: false,
            analysis: {
              originalSize: s.originalSize,
              pageCount: s.pageCount,
              baselineSize: s.baselineSize,
              fullBlob: new Blob([s.fullCompressedBuffer], { type: 'application/pdf' }),
              methodResults: s.methodResults,
              imageStats: s.imageStats,
              report: s.report,
              pdfFeatures: s.pdfFeatures,
            }
          }));
          break;
        }

        case 'error': {
          isBackgroundRef.current = false;
          const e = payload as WorkerErrorPayload;

          trackCompressionError(e.code);

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
      const msg = error.message || '';

      const isStale = msg.includes('importScripts') || msg.includes('NetworkError') || msg.includes('Failed to fetch') || msg.includes('404');

      if (isStale && retryCount < 3) {
        console.warn(`Worker start failed (attempt ${retryCount + 1}), retrying...`, msg);
        setTimeout(() => initWorker(retryCount + 1), 500 * (retryCount + 1));
        return;
      }

      isBackgroundRef.current = false;
      setState({
        status: 'error',
        error: createPdfError(
          isStale ? 'STALE_WORKER' : 'WORKER_ERROR',
          msg
        ),
      });

      // If the worker crashed, we should probably kill it so it resets next time
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  };

  const reset = useCallback(() => {
    // Do NOT terminate worker, keep it warm.
    // Just reset job ID so we ignore any trailing messages
    currentJobIdRef.current = null;
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
    const targetPercent = settings.targetPercent;

    // Generate new Job ID
    const jobId = generateJobId();
    currentJobIdRef.current = jobId;
    isBackgroundRef.current = isBackground;

    // Initialize state
    if (isBackground) {
      setState(prev => {
        if (prev.status === 'done') {
          return { ...prev, isUpdating: true, originalFile: file }; // Ensure we keep file ref
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
      setState({ status: 'processing', progress: 'Starting...', fileName: file.name, originalFile: file });
      trackFileUpload(file.size / 1024 / 1024);
    }

    const fileName = file.name;

    // Ensure worker is alive
    if (!workerRef.current) {
      try {
        initWorker();
      } catch (err) {
        setState({ status: 'error', error: createPdfError('WORKER_ERROR', "Failed to start worker") });
        return;
      }
    }

    file.arrayBuffer().then((arrayBuffer) => {
      // Validate PDF signature
      const signatureValidation = validatePdfSignature(arrayBuffer);
      if (!signatureValidation.valid) {
        setState({
          status: 'error',
          error: createPdfError('INVALID_FILE_TYPE', signatureValidation.error),
        });
        return;
      }

      workerRef.current?.postMessage(
        {
          type: 'start',
          payload: { arrayBuffer, fileName, imageSettings, options, targetPercent, jobId }
        },
        [arrayBuffer]
      );
    });
  }, []);

  return { state, processFile, reset };
};
