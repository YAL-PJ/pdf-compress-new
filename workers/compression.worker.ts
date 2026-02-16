/**
 * PDF Compression Web Worker
 *
 * Supports two compression modes:
 *
 * 1. Standard mode (no target): Single-pass analyzePdf()
 * 2. Incremental mode (with target): Uses analyzePdfIncremental() for
 *    streaming escalation — processes images progressively and adapts
 *    compression mid-stream instead of restarting entire PDF.
 *    Falls back to batch escalation only if incremental mode doesn't meet target.
 *
 * Features:
 * - Fast result delivery
 * - Background per-method measurement
 * - Safe job cancellation handling
 * - Incremental mode is ~O(n) vs batch mode's O(n × tiers)
 */

import {
  analyzePdf,
  analyzePdfIncremental,
  measureMethodSavings,
  type ExtendedProcessingSettings,
} from '../lib/pdf-processor';

import { getEscalationTier, MAX_ESCALATION_TIERS } from '../lib/target-size';
import { isPdfError } from '@/lib/errors';
import {
  DEFAULT_COMPRESSION_OPTIONS,
  DEFAULT_IMAGE_SETTINGS,
} from '@/lib/types';

import type {
  WorkerMessage,
  WorkerResponse,
  ImageCompressionSettings,
  CompressionOptions,
} from '@/lib/types';

// Track the active job so background measurement can abort when a new job starts
let activeJobId: string | null = null;

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { type, payload } = event.data;
  if (type !== 'start') return;

  const imageSettings: ImageCompressionSettings =
    payload.imageSettings ?? DEFAULT_IMAGE_SETTINGS;

  const options: CompressionOptions =
    payload.options ?? DEFAULT_COMPRESSION_OPTIONS;

  const targetPercent = payload.targetPercent;
  const { jobId } = payload;

  activeJobId = jobId;

  const postResponse = (
    response: WorkerResponse,
    transfer?: Transferable[]
  ) => {
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
    // SAFETY: clone original buffer immediately (analyzePdf may transfer it)
    const originalBuffer = payload.arrayBuffer;
    const safeOriginalBuffer = originalBuffer.slice(0);

    const originalSize = safeOriginalBuffer.byteLength;
    const targetBytes =
      targetPercent && targetPercent < 100
        ? Math.round(originalSize * (targetPercent / 100))
        : 0;

    const hasTarget =
      targetPercent !== undefined && targetPercent < 100;

    let currentOptions = options;
    let currentImageSettings = imageSettings;

    let extendedSettings: ExtendedProcessingSettings = {
      ...currentImageSettings,
      options: currentOptions,
    };

    let analysis;

    if (hasTarget) {
      // === Incremental mode: streaming escalation ===
      // Process images progressively with budget tracking.
      // Escalates compression mid-stream instead of restarting the entire PDF.
      postProgress('Starting incremental compression with budget tracking...');

      analysis = await analyzePdfIncremental(
        safeOriginalBuffer,
        postProgress,
        extendedSettings,
        targetBytes,
      );

      // Abort if job superseded
      if (activeJobId !== jobId) return;

      // If incremental mode didn't meet target, fall back to batch escalation
      if (analysis.fullCompressedBytes.byteLength > targetBytes) {
        const currentPercent = Math.round((analysis.fullCompressedBytes.byteLength / originalSize) * 100);
        postProgress(
          `Incremental compression reached ${currentPercent}% (target: ${targetPercent}%). Trying batch escalation fallback...`
        );

        // Try progressively harsher tiers as fallback
        for (let tier = 2; tier <= MAX_ESCALATION_TIERS; tier++) {
          if (activeJobId !== jobId) return;

          const escalated = getEscalationTier(tier, currentOptions, currentImageSettings);
          currentOptions = escalated.options;
          currentImageSettings = escalated.imageSettings;

          extendedSettings = {
            ...currentImageSettings,
            options: currentOptions,
          };

          const escalatedAnalysis = await analyzePdf(
            safeOriginalBuffer.slice(0),
            (msg, pct) => postProgress(`[Fallback tier ${tier}] ${msg}`, pct),
            extendedSettings
          );

          if (activeJobId !== jobId) return;

          if (escalatedAnalysis.fullCompressedBytes.byteLength < analysis.fullCompressedBytes.byteLength) {
            if (escalatedAnalysis.report && analysis.report) {
              escalatedAnalysis.report.logs = [
                ...analysis.report.logs,
                {
                  timestamp: Date.now(),
                  level: 'info' as const,
                  message: `Fallback escalation to tier ${tier} (target: ${targetPercent}%)`,
                },
                ...escalatedAnalysis.report.logs,
              ];
            }
            analysis = escalatedAnalysis;
          }

          if (analysis.fullCompressedBytes.byteLength <= targetBytes) {
            postProgress(`Target met at fallback tier ${tier}!`);
            break;
          }
        }

        if (analysis.fullCompressedBytes.byteLength > targetBytes) {
          const finalPercent = Math.round((analysis.fullCompressedBytes.byteLength / originalSize) * 100);
          if (analysis.report) {
            analysis.report.logs.push({
              timestamp: Date.now(),
              level: 'warning',
              message: `Could not reach target of ${targetPercent}% after incremental + fallback escalation. Best result: ${finalPercent}%`,
            });
          }
          postProgress(
            `Best compression: ${finalPercent}% (target was ${targetPercent}%). All methods exhausted.`
          );
        }
      }
    } else {
      // === Standard mode: single-pass, no target ===
      analysis = await analyzePdf(
        safeOriginalBuffer,
        postProgress,
        extendedSettings
      );

      // Abort if job superseded
      if (activeJobId !== jobId) return;
    }

    // === FAST RESULT DELIVERY ===
    // Avoid unnecessary copy: only slice if the Uint8Array is a view into a larger buffer
    const arr = analysis.fullCompressedBytes;
    const buffer = (arr.byteOffset === 0 && arr.byteLength === arr.buffer.byteLength)
      ? arr.buffer as ArrayBuffer
      : arr.slice().buffer as ArrayBuffer;

    postResponse(
      {
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
      },
      [buffer]
    );

    // === BACKGROUND METHOD MEASUREMENT ===
    if (analysis.workingBuffer) {
      try {
        await measureMethodSavings(
          analysis.workingBuffer,
          extendedSettings,
          (updatedResults) => {
            if (activeJobId !== jobId) return;

            postResponse({
              type: 'method-update',
              payload: { methodResults: updatedResults },
              jobId,
            });
          },
          () => activeJobId !== jobId
        );
      } catch {
        // Silent failure — user already received file
      }
    }
  } catch (error) {
    if (activeJobId !== jobId) return;

    const message =
      error instanceof Error
        ? error.message
        : 'Unknown error';

    let code = 'PROCESSING_FAILED';

    if (isPdfError(error)) {
      code = error.code;
    } else if (
      message.includes('encrypt') ||
      message.includes('password')
    ) {
      code = 'ENCRYPTED_PDF';
    } else if (
      message.includes('Invalid') ||
      message.includes('corrupt')
    ) {
      code = 'CORRUPTED_PDF';
    }

    postResponse({
      type: 'error',
      payload: { code, message },
      jobId,
    });
  }
};
