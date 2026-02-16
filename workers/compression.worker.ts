/**
 * PDF Compression Web Worker
 * Supports all Phase 2 compression methods
 * - Fast result delivery
 * - Iterative escalation to meet target size
 * - Background per-method measurement
 * - Safe job cancellation handling
 */

import {
  analyzePdf,
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

    // === PASS 0: Initial compression ===
    let currentOptions = options;
    let currentImageSettings = imageSettings;

    let extendedSettings: ExtendedProcessingSettings = {
      ...currentImageSettings,
      options: currentOptions,
    };

    let analysis = await analyzePdf(
      safeOriginalBuffer,
      postProgress,
      extendedSettings
    );

    // Abort if job superseded
    if (activeJobId !== jobId) return;

    // === ITERATIVE ESCALATION ===
    if (
      hasTarget &&
      analysis.fullCompressedBytes.byteLength > targetBytes
    ) {
      for (let tier = 1; tier <= MAX_ESCALATION_TIERS; tier++) {
        if (activeJobId !== jobId) return;

        const compressedSize =
          analysis.fullCompressedBytes.byteLength;

        const currentPercent = Math.round(
          (compressedSize / originalSize) * 100
        );

        postProgress(
          `Target not met (${currentPercent}% > ${targetPercent}%). Escalating to tier ${tier}/${MAX_ESCALATION_TIERS}...`
        );

        const escalated = getEscalationTier(
          tier,
          currentOptions,
          currentImageSettings
        );

        currentOptions = escalated.options;
        currentImageSettings = escalated.imageSettings;

        extendedSettings = {
          ...currentImageSettings,
          options: currentOptions,
        };

        const escalatedAnalysis = await analyzePdf(
          safeOriginalBuffer.slice(0),
          (msg, pct) =>
            postProgress(`[Tier ${tier}] ${msg}`, pct),
          extendedSettings
        );

        if (activeJobId !== jobId) return;

        // Only adopt if actually smaller
        if (
          escalatedAnalysis.fullCompressedBytes.byteLength <
          analysis.fullCompressedBytes.byteLength
        ) {
          if (escalatedAnalysis.report && analysis.report) {
            escalatedAnalysis.report.logs = [
              ...analysis.report.logs,
              {
                timestamp: Date.now(),
                level: 'info' as const,
                message: `Escalated to tier ${tier} (target: ${targetPercent}%)`,
              },
              ...escalatedAnalysis.report.logs,
            ];
          }

          analysis = escalatedAnalysis;
        }

        if (
          analysis.fullCompressedBytes.byteLength <=
          targetBytes
        ) {
          postProgress(`Target met at tier ${tier}!`);
          break;
        }
      }

      // If still not met
      if (
        analysis.fullCompressedBytes.byteLength >
        targetBytes
      ) {
        const finalPercent = Math.round(
          (analysis.fullCompressedBytes.byteLength /
            originalSize) *
            100
        );

        if (analysis.report) {
          analysis.report.logs.push({
            timestamp: Date.now(),
            level: 'warning',
            message: `Could not reach target of ${targetPercent}% after ${MAX_ESCALATION_TIERS} tiers. Best result: ${finalPercent}%`,
          });
        }

        postProgress(
          `Best compression: ${finalPercent}% (target was ${targetPercent}%).`
        );
      }
    }

    // === FAST RESULT DELIVERY ===
    const buffer = analysis.fullCompressedBytes
      .slice()
      .buffer as ArrayBuffer;

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
