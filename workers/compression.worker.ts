/**
 * PDF Compression Web Worker
 * Supports all Phase 2 compression methods with iterative escalation
 * when target size is not met.
 */

import { analyzePdf, type ExtendedProcessingSettings } from '../lib/pdf-processor';
import { getEscalationTier, MAX_ESCALATION_TIERS } from '../lib/target-size';
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
  const targetPercent = payload.targetPercent;

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
    // Keep a copy of the original arrayBuffer for retries
    // (analyzePdf may transfer/consume the buffer)
    const originalBuffer = payload.arrayBuffer;
    const originalSize = originalBuffer.byteLength;
    const targetBytes = targetPercent ? Math.round(originalSize * (targetPercent / 100)) : 0;
    const hasTarget = targetPercent !== undefined && targetPercent < 100;

    // === Pass 0: Initial compression with user settings ===
    let currentOptions = options;
    let currentImageSettings = imageSettings;
    let extendedSettings: ExtendedProcessingSettings = {
      ...currentImageSettings,
      options: currentOptions,
    };

    let analysis = await analyzePdf(
      originalBuffer,
      postProgress,
      extendedSettings
    );

    // === Iterative escalation if target not met ===
    if (hasTarget && analysis.fullCompressedBytes.byteLength > targetBytes) {
      for (let tier = 1; tier <= MAX_ESCALATION_TIERS; tier++) {
        const compressedSize = analysis.fullCompressedBytes.byteLength;
        const currentPercent = Math.round((compressedSize / originalSize) * 100);

        postProgress(
          `Target not met (${currentPercent}% > ${targetPercent}%). Escalating to tier ${tier}/${MAX_ESCALATION_TIERS}...`
        );

        // Get escalated settings based on the current settings
        const escalated = getEscalationTier(tier, currentOptions, currentImageSettings);
        currentOptions = escalated.options;
        currentImageSettings = escalated.imageSettings;

        extendedSettings = {
          ...currentImageSettings,
          options: currentOptions,
        };

        // Re-run compression with escalated settings on original buffer
        // We need to re-create the buffer since it may have been transferred
        const retryBuffer = originalBuffer.byteLength > 0
          ? originalBuffer
          : analysis.fullCompressedBytes.slice().buffer as ArrayBuffer;

        const escalatedAnalysis = await analyzePdf(
          retryBuffer,
          (msg, pct) => postProgress(`[Tier ${tier}] ${msg}`, pct),
          extendedSettings
        );

        // Only use escalated result if it's actually smaller
        if (escalatedAnalysis.fullCompressedBytes.byteLength < analysis.fullCompressedBytes.byteLength) {
          // Merge report logs from escalation into original report
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

        // Check if we've met the target
        if (analysis.fullCompressedBytes.byteLength <= targetBytes) {
          postProgress(`Target met at tier ${tier}!`);
          break;
        }
      }

      // Log final result if target still not met
      if (analysis.fullCompressedBytes.byteLength > targetBytes) {
        const finalPercent = Math.round((analysis.fullCompressedBytes.byteLength / originalSize) * 100);
        if (analysis.report) {
          analysis.report.logs.push({
            timestamp: Date.now(),
            level: 'warning',
            message: `Could not reach target of ${targetPercent}% after all ${MAX_ESCALATION_TIERS} escalation tiers. Best result: ${finalPercent}%`,
          });
        }
        postProgress(
          `Best compression: ${finalPercent}% (target was ${targetPercent}%). All methods exhausted.`
        );
      }
    }

    // Avoid unnecessary copy: only slice if the Uint8Array is a view into a larger buffer
    const arr = analysis.fullCompressedBytes;
    const buffer = (arr.byteOffset === 0 && arr.byteLength === arr.buffer.byteLength)
      ? arr.buffer as ArrayBuffer
      : arr.slice().buffer as ArrayBuffer;

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
