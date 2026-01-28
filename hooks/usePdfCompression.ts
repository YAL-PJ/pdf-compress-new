/**
 * usePdfCompression Hook
 * Manages Web Worker lifecycle and compression state
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
} from '@/lib/types';

export type CompressionState = 
  | { status: 'idle' }
  | { status: 'validating' }
  | { status: 'processing'; progress: string; fileName: string }
  | { status: 'done'; analysis: CompressionAnalysis; fileName: string }
  | { status: 'error'; error: PdfError };

interface UsePdfCompressionReturn {
  state: CompressionState;
  processFile: (file: File) => void;
  reset: () => void;
}

export const usePdfCompression = (): UsePdfCompressionReturn => {
  const [state, setState] = useState<CompressionState>({ status: 'idle' });
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const reset = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    setState({ status: 'idle' });
  }, []);

  const processFile = useCallback((file: File) => {
    setState({ status: 'validating' });
    
    const validation = validateFile(file);
    if (!validation.valid) {
      setState({
        status: 'error',
        error: createPdfError('INVALID_FILE_TYPE', validation.error),
      });
      return;
    }

    const fileName = file.name;
    setState({ status: 'processing', progress: 'Starting...', fileName });

    workerRef.current?.terminate();
    workerRef.current = new Worker(
      new URL('../workers/pdf.worker.ts', import.meta.url)
    );

    workerRef.current.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const { type, payload } = event.data;

      switch (type) {
        case 'progress': {
          const p = payload as WorkerProgressPayload;
          setState({ status: 'processing', progress: p.message, fileName });
          break;
        }

        case 'success': {
          const s = payload as WorkerSuccessPayload;
          
          setState({
            status: 'done',
            fileName,
            analysis: {
              originalSize: s.originalSize,
              pageCount: s.pageCount,
              baselineSize: s.baselineSize,
              fullBlob: new Blob([s.fullCompressedBuffer], { type: 'application/pdf' }),
              methodResults: s.methodResults,
            },
          });
          break;
        }

        case 'error': {
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
      setState({
        status: 'error',
        error: createPdfError('WORKER_ERROR', error.message),
      });
    };

    file.arrayBuffer().then((arrayBuffer) => {
      workerRef.current?.postMessage(
        { type: 'start', payload: { arrayBuffer, fileName } },
        [arrayBuffer]
      );
    });
  }, []);

  return { state, processFile, reset };
};
