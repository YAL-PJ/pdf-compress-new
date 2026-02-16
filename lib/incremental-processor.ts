/**
 * Incremental PDF Compression with Budget-Aware Streaming Escalation
 *
 * Instead of compressing the entire PDF then retrying with harsher settings,
 * this module processes images progressively and escalates compression
 * mid-stream when the budget is being exceeded.
 *
 * Two levels of escalation:
 * 1. Progressive: Track cumulative size, escalate settings for remaining images
 * 2. Object-level: Recompress individual oversized images at lower quality
 *
 * CPU complexity: ~O(n) instead of O(n × tiers)
 */

import { PDFDocument } from 'pdf-lib';
import type {
  ImageCompressionSettings,
  CompressionOptions,
  ExtractedImage,
  RecompressedImage,
  ProcessingLog,
} from './types';
import { DEFAULT_IMAGE_SETTINGS } from './types';
import {
  recompressJpeg,
  recompressImages,
  convertPngsToJpeg,
  calculateImageSavings,
  type ExtendedImageSettings,
} from './image-processor';
import { getEscalationTier } from './target-size';

type ProgressCallback = (message: string, percent?: number) => void;
type LogFn = (level: ProcessingLog['level'], message: string, details?: string | object) => void;

/** Budget state tracked during incremental processing */
export interface CompressionBudget {
  /** Original file size in bytes */
  originalSize: number;
  /** Target size in bytes */
  targetBytes: number;
  /** Baseline (uncompressed save) size */
  baselineSize: number;
  /** Estimated non-image overhead (structure, metadata, fonts, etc.) */
  estimatedOverhead: number;
  /** Budget available for all images combined */
  imageBudgetBytes: number;
  /** Bytes consumed so far by processed images */
  imageBytesSoFar: number;
  /** Number of images processed so far */
  imagesProcessed: number;
  /** Total number of images to process */
  totalImages: number;
  /** Whether we've escalated mid-stream */
  escalated: boolean;
  /** Current escalation tier (0 = initial, 1-3 = escalated) */
  currentTier: number;
}

/**
 * Estimate how much of the PDF budget should be allocated to images.
 * Images typically account for 60-90% of PDF size in image-heavy docs.
 */
function estimateImageBudget(
  targetBytes: number,
  baselineSize: number,
  totalImageOriginalSize: number,
  originalSize: number,
): number {
  // Estimate what fraction of the file is images
  const imageRatio = Math.min(totalImageOriginalSize / originalSize, 0.95);

  // Non-image content (structure, fonts, streams, etc.) is roughly fixed
  const nonImageSize = originalSize * (1 - imageRatio);

  // The image budget is target minus the non-image overhead
  // Apply a 0.9 safety factor to leave room for PDF overhead from embedding
  const imageBudget = Math.max(0, (targetBytes - nonImageSize) * 0.9);

  return Math.round(imageBudget);
}

/**
 * Calculate escalated image settings based on how far over budget we are.
 * Returns progressively harsher settings based on overshoot ratio.
 */
export function escalateImageSettings(
  currentSettings: ImageCompressionSettings,
  budget: CompressionBudget,
): ImageCompressionSettings {
  const remaining = budget.totalImages - budget.imagesProcessed;
  const budgetRemaining = Math.max(0, budget.imageBudgetBytes - budget.imageBytesSoFar);

  if (remaining <= 0) return currentSettings;

  // Average budget per remaining image
  const avgBudgetPerImage = budgetRemaining / remaining;

  // How much we've been using per image so far
  const avgUsedPerImage = budget.imagesProcessed > 0
    ? budget.imageBytesSoFar / budget.imagesProcessed
    : 0;

  // Overshoot ratio: > 1 means we're on track to exceed budget
  const overshootRatio = avgUsedPerImage > 0
    ? avgUsedPerImage / Math.max(avgBudgetPerImage, 1)
    : 1;

  if (overshootRatio <= 1.1) {
    // Within 10% of budget — no escalation needed
    return currentSettings;
  }

  // Scale quality inversely with overshoot
  // overshoot 1.5x → quality * 0.67, overshoot 2x → quality * 0.5, etc.
  const qualityScale = Math.max(0.1, 1 / overshootRatio);
  const newQuality = Math.max(5, Math.round(currentSettings.quality * qualityScale));

  // More aggressive downsampling when significantly over budget
  const newDpi = overshootRatio > 2
    ? 72
    : overshootRatio > 1.5
      ? Math.min(currentSettings.targetDpi, 96)
      : currentSettings.targetDpi;

  return {
    ...currentSettings,
    quality: newQuality,
    targetDpi: newDpi,
    enableDownsampling: overshootRatio > 1.3 ? true : currentSettings.enableDownsampling,
  };
}

/**
 * Process images incrementally with budget tracking.
 * Escalates compression settings mid-stream when budget is being exceeded.
 *
 * This replaces the pattern of: compress all → check → retry all → check → retry all
 * With: compress each → track budget → escalate remaining if needed
 */
export async function processImagesIncrementally(
  jpegImages: ExtractedImage[],
  pngImages: ExtractedImage[],
  initialSettings: ImageCompressionSettings,
  options: CompressionOptions,
  budget: CompressionBudget,
  onProgress?: ProgressCallback,
  log?: LogFn,
): Promise<{
  recompressedImages: RecompressedImage[];
  finalBudget: CompressionBudget;
  settingsUsed: ImageCompressionSettings;
  jpegSavings: number;
  downsampleSavings: number;
  pngSavings: number;
}> {
  const recompressedImages: RecompressedImage[] = [];
  let currentSettings = { ...initialSettings };
  let jpegSavings = 0;
  let downsampleSavings = 0;
  let pngSavings = 0;

  const totalImages = jpegImages.length + pngImages.length;
  budget.totalImages = totalImages;
  budget.imagesProcessed = 0;
  budget.imageBytesSoFar = 0;

  // === Phase 1: Process JPEG images with adaptive quality ===
  if (jpegImages.length > 0 && options.recompressImages) {
    onProgress?.(`Processing ${jpegImages.length} JPEG images incrementally...`, 0);
    log?.('info', `Starting incremental JPEG processing (budget: ${Math.round(budget.imageBudgetBytes / 1024)}KB for ${totalImages} images)`);

    // Sort images by size (largest first) for better budget prediction
    const sortedJpegs = [...jpegImages].sort((a, b) => b.originalSize - a.originalSize);

    // Process in small batches for parallelism, but check budget between batches
    const BATCH_SIZE = 2; // Smaller batches for more granular budget tracking

    for (let batchStart = 0; batchStart < sortedJpegs.length; batchStart += BATCH_SIZE) {
      // Check if we need to escalate before this batch
      if (budget.imagesProcessed > 0 && !budget.escalated) {
        const escalated = escalateImageSettings(currentSettings, budget);
        if (escalated.quality < currentSettings.quality) {
          budget.escalated = true;
          budget.currentTier++;
          log?.('info', `Mid-stream escalation at image ${budget.imagesProcessed}/${totalImages}: quality ${currentSettings.quality} → ${escalated.quality}, DPI ${currentSettings.targetDpi} → ${escalated.targetDpi}`);
          onProgress?.(`Budget pressure detected — escalating compression (quality: ${escalated.quality})...`);
          currentSettings = escalated;
        }
      }

      // Re-check after first escalation: allow further escalation if still overshooting
      if (budget.escalated && budget.imagesProcessed > 0) {
        const furtherEscalated = escalateImageSettings(currentSettings, budget);
        if (furtherEscalated.quality < currentSettings.quality) {
          budget.currentTier++;
          log?.('info', `Further escalation: quality ${currentSettings.quality} → ${furtherEscalated.quality}`);
          currentSettings = furtherEscalated;
        }
      }

      const batchEnd = Math.min(batchStart + BATCH_SIZE, sortedJpegs.length);
      const batch = sortedJpegs.slice(batchStart, batchEnd);

      const extendedSettings: ExtendedImageSettings = {
        ...currentSettings,
        convertToGrayscale: options.convertToGrayscale,
        convertToMonochrome: options.convertToMonochrome,
      };

      // Process batch in parallel
      const batchResults = await Promise.all(
        batch.map(image => recompressJpeg(image, extendedSettings))
      );

      for (const result of batchResults) {
        budget.imagesProcessed++;
        if (result) {
          recompressedImages.push(result);
          jpegSavings += result.savedBytes;

          // Track the new size against budget (original minus savings = new size)
          const newImageSize = result.originalSize - result.savedBytes;
          budget.imageBytesSoFar += newImageSize;

          // Track downsampling savings separately
          if (result.wasDownsampled && result.originalWidth && result.originalHeight) {
            const originalPixels = result.originalWidth * result.originalHeight;
            const newPixels = result.width * result.height;
            const pixelReductionRatio = 1 - (newPixels / originalPixels);
            downsampleSavings += Math.round(result.savedBytes * pixelReductionRatio);
          }
        } else {
          // Image wasn't compressed (too small, or no savings)
          // Still count it against budget at original size
          const originalImage = batch[batchResults.indexOf(result)];
          if (originalImage) {
            budget.imageBytesSoFar += originalImage.originalSize;
          }
        }
      }

      const progress = Math.round((budget.imagesProcessed / totalImages) * 100);
      onProgress?.(`Processed ${budget.imagesProcessed}/${totalImages} images`, progress);
    }
  }

  // === Phase 2: Process PNG images (convert to JPEG) ===
  if (pngImages.length > 0 && options.pngToJpeg) {
    onProgress?.(`Converting ${pngImages.length} PNG images to JPEG...`);

    // Use the current (possibly escalated) quality for PNG conversion
    const { results: convertedPngs, savings } = await convertPngsToJpeg(
      pngImages,
      currentSettings.quality,
      onProgress
    );

    for (const result of convertedPngs) {
      recompressedImages.push(result);
      budget.imagesProcessed++;
      budget.imageBytesSoFar += result.newSize;
    }
    pngSavings = savings;
  }

  // === Phase 3: Object-level re-escalation for oversized images ===
  // If we're still over budget, find the largest images and recompress them harder
  if (budget.imageBytesSoFar > budget.imageBudgetBytes && recompressedImages.length > 0) {
    log?.('info', `Still over budget after initial pass. Attempting object-level re-escalation...`);
    onProgress?.('Re-compressing oversized images...');

    // Sort recompressed images by new size (largest first)
    const oversized = [...recompressedImages]
      .map((img, idx) => ({ img, idx }))
      .sort((a, b) => b.img.newSize - a.img.newSize);

    // Try to recompress the top N largest images at much lower quality
    const recompressCount = Math.min(
      Math.ceil(oversized.length * 0.3), // Top 30%
      10 // Max 10 images for performance
    );

    const harshQuality = Math.max(5, Math.round(currentSettings.quality * 0.5));
    const harshSettings: ExtendedImageSettings = {
      ...currentSettings,
      quality: harshQuality,
      targetDpi: 72,
      enableDownsampling: true,
      convertToGrayscale: options.convertToGrayscale,
      convertToMonochrome: options.convertToMonochrome,
    };

    log?.('info', `Re-compressing top ${recompressCount} images at quality ${harshQuality}`);

    for (let i = 0; i < recompressCount; i++) {
      const { img, idx } = oversized[i];

      // Find the original image to recompress from source
      const originalImage = jpegImages.find(j => j.ref === img.ref)
        || pngImages.find(p => p.ref === img.ref);

      if (!originalImage || originalImage.format !== 'jpeg') continue;

      const reResult = await recompressJpeg(originalImage, harshSettings);
      if (reResult && reResult.newSize < img.newSize) {
        // Update savings tracking
        const additionalSavings = img.newSize - reResult.newSize;
        jpegSavings += additionalSavings;
        budget.imageBytesSoFar -= additionalSavings;

        // Replace in the results array
        recompressedImages[idx] = reResult;
        log?.('info', `Re-compressed image ${img.ref}: ${img.newSize} → ${reResult.newSize} bytes`);
      }

      // Check if we're now within budget
      if (budget.imageBytesSoFar <= budget.imageBudgetBytes) {
        log?.('success', `Budget met after re-compressing ${i + 1} images`);
        break;
      }
    }
  }

  return {
    recompressedImages,
    finalBudget: budget,
    settingsUsed: currentSettings,
    jpegSavings,
    downsampleSavings,
    pngSavings,
  };
}
