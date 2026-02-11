/**
 * PDF Processor - Core compression logic using pdf-lib
 * Full Phase 2 implementation with all compression methods
 */

import { PDFDocument } from 'pdf-lib';
import type { PdfInfo, MethodResult, ImageCompressionSettings, CompressionOptions, RecompressedImage, CompressionReport, ProcessingLog } from './types';
import { DEFAULT_IMAGE_SETTINGS, DEFAULT_COMPRESSION_OPTIONS } from './types';
import { formatBytes } from './utils';
import {
  extractImages,
  recompressImages,
  embedRecompressedImages,
  calculateImageSavings,
  convertPngsToJpeg,
  removeAlphaChannels,
  removeIccProfiles,
  convertCmykToRgb,
  type ImageStats,
  type ExtendedImageSettings,
} from './image-processor';
import {
  removeJavaScript as removeJS,
  removeBookmarks as removeBM,
  removeNamedDestinations as removeND,
  removeArticleThreads as removeAT,
  removeWebCaptureInfo as removeWC,
  removeHiddenLayers as removeHL,
  removePageLabels as removePL,
  deepCleanMetadata as deepCleanMD,
  removeThumbnails as removeTN,
  removeAttachments as removeATT,
  flattenForms as flattenFM,
  flattenAnnotations as flattenAN,
} from './structure-processor';
import {
  removeDuplicateResources,
  removeUnusedFonts,
} from './resource-processor';
import {
  convertInlineImagesToXObjects,
  compressContentStreams,
  removeInvisibleText,
} from './content-stream-processor';
import {
  removeOrphanObjects,
  removeAlternateContent,
} from './pdf-optimizer';

export const loadPdf = async (
  arrayBuffer: ArrayBuffer
): Promise<{ pdfDoc: PDFDocument; info: PdfInfo }> => {
  const pdfDoc = await PDFDocument.load(arrayBuffer, {
    ignoreEncryption: false,
  });

  const info: PdfInfo = {
    pageCount: pdfDoc.getPageCount(),
    title: pdfDoc.getTitle(),
    author: pdfDoc.getAuthor(),
  };

  return { pdfDoc, info };
};

const stripMetadata = (pdfDoc: PDFDocument): void => {
  pdfDoc.setTitle('');
  pdfDoc.setAuthor('');
  pdfDoc.setSubject('');
  pdfDoc.setKeywords([]);
  pdfDoc.setProducer('');
  pdfDoc.setCreator('');
  pdfDoc.setCreationDate(new Date(0));
  pdfDoc.setModificationDate(new Date(0));
};

type ProgressCallback = (message: string, percent?: number) => void;

// Extended settings that include compression options
export interface ExtendedProcessingSettings extends ImageCompressionSettings {
  options?: CompressionOptions;
}

/**
 * Analyze and compress PDF with all enabled methods
 */
export const analyzePdf = async (
  arrayBuffer: ArrayBuffer,
  onProgress?: ProgressCallback,
  settings: ExtendedProcessingSettings = DEFAULT_IMAGE_SETTINGS
): Promise<{
  originalSize: number;
  pageCount: number;
  baselineSize: number;
  fullCompressedBytes: Uint8Array;
  methodResults: MethodResult[];
  imageStats?: ImageStats;
  report: CompressionReport;
}> => {
  const originalSize = arrayBuffer.byteLength;
  const options = settings.options ?? DEFAULT_COMPRESSION_OPTIONS;

  onProgress?.('Reading PDF...');

  // Load PDF once for info and baseline
  const { pdfDoc: baseDoc, info } = await loadPdf(arrayBuffer);
  // Establish baseline size
  const baselineBytes = await baseDoc.save({ useObjectStreams: false });
  const baselineSize = baselineBytes.byteLength;

  // Tracking Report
  const report: CompressionReport = {
    timestamp: Date.now(),
    originalSize,
    compressedSize: 0, // Set at end
    pageCount: info.pageCount,
    methodsUsed: [],
    methodsSuccessful: [],
    errors: [],
    logs: [],
  };

  const log = (level: ProcessingLog['level'], message: string, details?: string | object) => {
    report.logs.push({
      timestamp: Date.now(),
      level,
      message,
      details,
    });
  };

  log('info', `Started analysis of ${info.title || 'PDF'}`, {
    originalSize: formatBytes(originalSize),
    pageCount: info.pageCount,
    settings: options
  });

  // Image processing - extract both JPEG and PNG if needed
  onProgress?.('Analyzing images...');
  log('info', 'Analyzing document images...');

  // Track savings for each method using a record instead of individual variables
  const savings: Record<string, number> = {};

  let recompressedImageBytes: Uint8Array | null = null;
  let imagesProcessed = 0;
  let imagesSkipped = 0;
  let imagesDownsampled = 0;
  let pngsConverted = 0;
  let images: import('./types').ExtractedImage[] = [];
  let imageStats: ImageStats | undefined;
  let jpegImages: import('./types').ExtractedImage[] = [];
  let pngImages: import('./types').ExtractedImage[] = [];

  try {
    const { pdfDoc: imgDoc } = await loadPdf(arrayBuffer);
    const extractPng = options.pngToJpeg;
    const extracted = await extractImages(imgDoc, onProgress, settings.targetDpi, extractPng);
    images = extracted.images;
    imageStats = extracted.stats;

    log('info', `Found ${images.length} images`, imageStats);

    // Collect all recompressed images
    const allRecompressedImages: RecompressedImage[] = [];

    // Process JPEG images
    jpegImages = images.filter(img => img.format === 'jpeg');
    if (jpegImages.length > 0 && options.recompressImages) {
      report.methodsUsed.push('recompressImages');
      onProgress?.(`Processing ${jpegImages.length} JPEG images...`);
      log('info', `Recompressing ${jpegImages.length} JPEG images...`);

      const extendedSettings: ExtendedImageSettings = {
        ...settings,
        convertToGrayscale: options.convertToGrayscale,
        convertToMonochrome: options.convertToMonochrome,
      };

      const { results: recompressedImages, downsampleSavings } = await recompressImages(
        jpegImages,
        extendedSettings,
        onProgress
      );

      imagesProcessed = recompressedImages.length;
      imagesSkipped = jpegImages.length - imagesProcessed;
      imagesDownsampled = recompressedImages.filter(img => img.wasDownsampled).length;

      const totalSavings = calculateImageSavings(recompressedImages);
      savings.downsampleImages = downsampleSavings;
      savings.recompressImages = totalSavings - downsampleSavings;

      if (totalSavings > 0) {
        report.methodsSuccessful.push('recompressImages');
        log('success', `Recompressed ${imagesProcessed} JPEGs`, { savedBytes: totalSavings, downsampled: imagesDownsampled });
      } else {
        log('info', 'No savings from JPEG recompression');
      }

      allRecompressedImages.push(...recompressedImages);
    }

    // Convert PNG to JPEG
    pngImages = images.filter(img => img.format === 'png');
    if (pngImages.length > 0 && options.pngToJpeg) {
      report.methodsUsed.push('pngToJpeg');
      onProgress?.(`Converting ${pngImages.length} PNG images to JPEG...`);
      log('info', `Converting ${pngImages.length} PNGs to JPEG...`);

      const { results: convertedPngs, savings: pngSavings } = await convertPngsToJpeg(
        pngImages,
        settings.quality,
        onProgress
      );

      pngsConverted = convertedPngs.length;
      savings.pngToJpeg = pngSavings;
      allRecompressedImages.push(...convertedPngs);

      if (pngSavings > 0) {
        report.methodsSuccessful.push('pngToJpeg');
        log('success', `Converted ${pngsConverted} PNGs`, { savedBytes: pngSavings });
      }
    }

    // Embed all processed images
    if (allRecompressedImages.length > 0) {
      onProgress?.('Embedding optimized images...');
      recompressedImageBytes = await embedRecompressedImages(
        arrayBuffer,
        allRecompressedImages,
        onProgress
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log('warning', `Image processing failed, skipping: ${msg}`);
    report.errors.push('imageProcessing');
  }

  // Working buffer for further processing
  // IMPORTANT: Use .slice().buffer to avoid reading garbage data from larger underlying ArrayBuffers
  let workingBuffer = recompressedImageBytes
    ? recompressedImageBytes.slice().buffer as ArrayBuffer
    : arrayBuffer;

  // Helper to safely convert Uint8Array save result to ArrayBuffer
  const toSafeBuffer = (bytes: Uint8Array): ArrayBuffer => bytes.slice().buffer as ArrayBuffer;

  // Load document ONCE for all in-place mutation methods
  // (alpha, ICC, CMYK, dedup, fonts, inline, streams, orphans, alternate, invisible, structure)
  // This eliminates 12+ redundant PDFDocument.load() calls
  onProgress?.('Applying optimizations...');
  let workDoc: PDFDocument;
  let lastSize: number;
  try {
    const loaded = await loadPdf(workingBuffer);
    workDoc = loaded.pdfDoc;
    lastSize = (await workDoc.save({ useObjectStreams: false })).byteLength;
  } catch (err) {
    // If recompressed image buffer is corrupt, fall back to original
    const msg = err instanceof Error ? err.message : String(err);
    log('warning', `Failed to load working buffer, falling back to original: ${msg}`);
    report.errors.push('loadWorkingBuffer');
    const loaded = await loadPdf(arrayBuffer);
    workDoc = loaded.pdfDoc;
    lastSize = (await workDoc.save({ useObjectStreams: false })).byteLength;
  }

  // Helper: apply a method on the shared document, measure incremental savings
  const measureMethod = async (
    key: string,
    enabled: boolean,
    apply: (doc: PDFDocument) => void | number | Promise<void | { savedBytes: number; [k: string]: unknown }>,
  ) => {
    if (!enabled) {
      savings[key] = 0;
      return;
    }
    report.methodsUsed.push(key);
    const before = lastSize;
    try {
      const result = await apply(workDoc);
      const afterBytes = await workDoc.save({ useObjectStreams: false });
      lastSize = afterBytes.byteLength;
      const saved = Math.max(0, before - lastSize);
      savings[key] = saved;
      if (saved > 0) {
        report.methodsSuccessful.push(key);
        log('success', `Applied: ${key}`, { saved });
      }
      return result;
    } catch (err) {
      savings[key] = 0;
      const msg = err instanceof Error ? err.message : String(err);
      log('warning', `Method ${key} failed: ${msg}`);
      report.errors.push(key);
    }
  };

  // Image-related in-place mutations
  if (options.removeAlphaChannels) {
    await measureMethod('removeAlphaChannels', true, (doc) => {
      const r = removeAlphaChannels(doc);
      if (r.processed > 0) log('success', `Removed alpha channels from ${r.processed} images`);
    });
  }

  if (options.removeColorProfiles) {
    await measureMethod('removeColorProfiles', true, (doc) => {
      const r = removeIccProfiles(doc);
      if (r.removed > 0) log('success', `Removed ${r.removed} ICC profiles`);
    });
  }

  if (options.cmykToRgb) {
    await measureMethod('cmykToRgb', true, async (doc) => {
      const r = await convertCmykToRgb(doc, settings.quality, onProgress);
      if (r.converted > 0) log('success', `Converted ${r.converted} CMYK images to RGB`);
    });
  }

  // Resource optimization
  if (options.removeDuplicateResources) {
    onProgress?.('Removing duplicate resources...');
    await measureMethod('removeDuplicateResources', true, (doc) => {
      const r = removeDuplicateResources(doc);
      if (r.duplicatesFound > 0) {
        log('success', `Removed ${r.duplicatesFound} duplicate resources`);
      } else {
        log('info', 'No duplicate resources found');
      }
    });
  }

  if (options.removeUnusedFonts) {
    onProgress?.('Removing unused fonts...');
    await measureMethod('removeUnusedFonts', true, (doc) => {
      const r = removeUnusedFonts(doc);
      if (r.fontsRemoved > 0) {
        log('success', `Removed ${r.fontsRemoved} unused fonts`, { fonts: r.fontNames });
      } else {
        log('info', 'No unused fonts found');
      }
    });
  }

  // Content stream optimization
  if (options.inlineToXObject) {
    await measureMethod('inlineToXObject', true, async (doc) => {
      const r = await convertInlineImagesToXObjects(doc, onProgress);
      if (r.converted > 0) log('success', `Converted ${r.converted} inline images to XObjects`);
    });
  }

  if (options.compressContentStreams) {
    await measureMethod('compressContentStreams', true, async (doc) => {
      const r = await compressContentStreams(doc, onProgress);
      if (r.streamsCompressed > 0) log('success', `Compressed ${r.streamsCompressed} content streams`);
    });
  }

  if (options.removeOrphanObjects) {
    await measureMethod('removeOrphanObjects', true, async (doc) => {
      const r = await removeOrphanObjects(doc, onProgress);
      if (r.orphansRemoved > 0) log('success', `Removed ${r.orphansRemoved} orphan objects`);
    });
  }

  if (options.removeAlternateContent) {
    await measureMethod('removeAlternateContent', true, async (doc) => {
      const r = await removeAlternateContent(doc, onProgress);
      if (r.alternatesRemoved > 0 || r.printOnlyRemoved > 0 || r.screenOnlyRemoved > 0) {
        log('success', 'Removed alternate content objects');
      }
    });
  }

  if (options.removeInvisibleText) {
    await measureMethod('removeInvisibleText', true, async (doc) => {
      const r = await removeInvisibleText(doc, onProgress);
      if (r.pagesProcessed > 0) log('success', `Removed invisible text from ${r.pagesProcessed} pages`);
    });
  }

  onProgress?.('Applying structure cleanup...');

  // Structure cleanup — applied on the same shared document
  const structSavings: Record<string, number> = {};
  let structAttachmentsRemoved = 0;
  const structDoc = workDoc; // Alias for clarity — same document instance

  // Helper: measure a single structure method's incremental savings
  const measureStructMethod = async (
    key: string,
    enabled: boolean,
    apply: (doc: PDFDocument) => void | number
  ): Promise<number | void> => {
    if (!enabled) {
      structSavings[key] = 0;
      return;
    }
    report.methodsUsed.push(key);
    const before = lastSize;
    try {
      const result = apply(structDoc);
      const afterBytes = await structDoc.save({ useObjectStreams: false });
      lastSize = afterBytes.byteLength;
      const saved = Math.max(0, before - lastSize);
      structSavings[key] = saved;
      if (saved > 0) {
        report.methodsSuccessful.push(key);
        log('success', `Applied cleanup: ${key}`, { saved });
      }
      return result;
    } catch (err) {
      structSavings[key] = 0;
      const msg = err instanceof Error ? err.message : String(err);
      log('warning', `Method ${key} failed: ${msg}`);
      report.errors.push(key);
    }
  };

  // Apply each method incrementally, measuring the delta
  await measureStructMethod('removeJavaScript', options.removeJavaScript, removeJS);
  // ... rest of calls follow original order
  await measureStructMethod('removeBookmarks', options.removeBookmarks, removeBM);
  await measureStructMethod('removeNamedDestinations', options.removeNamedDestinations, removeND);
  await measureStructMethod('removeArticleThreads', options.removeArticleThreads, removeAT);
  await measureStructMethod('removeWebCaptureInfo', options.removeWebCaptureInfo, removeWC);
  await measureStructMethod('removeHiddenLayers', options.removeHiddenLayers, removeHL);
  await measureStructMethod('removePageLabels', options.removePageLabels, removePL);
  await measureStructMethod('deepCleanMetadata', options.deepCleanMetadata, deepCleanMD);
  await measureStructMethod('removeThumbnails', options.removeThumbnails, removeTN);
  const attResult = await measureStructMethod('removeAttachments', options.removeAttachments, removeATT);
  if (typeof attResult === 'number') structAttachmentsRemoved = attResult;
  await measureStructMethod('flattenForms', options.flattenForms, flattenFM);
  await measureStructMethod('flattenAnnotations', options.flattenAnnotations, flattenAN);

  onProgress?.('Creating final compressed file...');

  // Measure metadata savings on the same shared document
  let metaSaved = 0;
  if (options.stripMetadata) {
    report.methodsUsed.push('stripMetadata');
    const preMetaSize = lastSize;
    try {
      stripMetadata(structDoc);
      const afterMeta = await structDoc.save({ useObjectStreams: false });
      lastSize = afterMeta.byteLength;
      metaSaved = Math.max(0, preMetaSize - lastSize);
      if (metaSaved > 0) log('success', 'Stripped standard metadata');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log('warning', `Metadata stripping failed: ${msg}`);
      report.errors.push('stripMetadata');
    }
  }

  // Final save — measure object streams savings by comparing with/without
  const withoutOsSize = lastSize;
  let fullCompressedBytes: Uint8Array;
  try {
    fullCompressedBytes = await structDoc.save({
      useObjectStreams: options.useObjectStreams,
    });
  } catch (err) {
    // If the mutated document can't be saved, fall back to baseline
    const msg = err instanceof Error ? err.message : String(err);
    log('warning', `Final save failed, returning baseline: ${msg}`);
    report.errors.push('finalSave');
    fullCompressedBytes = baselineBytes;
  }

  const osSaved = options.useObjectStreams
    ? Math.max(0, withoutOsSize - fullCompressedBytes.byteLength)
    : 0;

  if (options.useObjectStreams && osSaved > 0) {
    report.methodsUsed.push('useObjectStreams');
    report.methodsSuccessful.push('useObjectStreams');
    log('success', 'Applied Object Streams compression', { saved: osSaved });
  }

  // Helper to get savings for a method key
  const s = (key: string) => savings[key] ?? structSavings[key] ?? 0;

  // Build method results with actual measured savings
  const methodResults: MethodResult[] = [
    { key: 'useObjectStreams', savedBytes: osSaved, compressedSize: originalSize - osSaved },
    { key: 'stripMetadata', savedBytes: metaSaved, compressedSize: originalSize - metaSaved },
    { key: 'recompressImages', savedBytes: s('recompressImages'), compressedSize: baselineSize - s('recompressImages'), details: { imagesProcessed, imagesSkipped } },
    { key: 'downsampleImages', savedBytes: s('downsampleImages'), compressedSize: baselineSize - s('downsampleImages'), details: { imagesProcessed: imagesDownsampled, imagesSkipped: imagesProcessed - imagesDownsampled } },
    { key: 'convertToGrayscale', savedBytes: 0, compressedSize: baselineSize },
    { key: 'pngToJpeg', savedBytes: s('pngToJpeg'), compressedSize: baselineSize - s('pngToJpeg'), details: { imagesProcessed: pngsConverted, imagesSkipped: pngImages.length - pngsConverted } },
    { key: 'convertToMonochrome', savedBytes: 0, compressedSize: baselineSize },
    { key: 'removeAlphaChannels', savedBytes: s('removeAlphaChannels'), compressedSize: baselineSize - s('removeAlphaChannels') },
    { key: 'removeColorProfiles', savedBytes: s('removeColorProfiles'), compressedSize: baselineSize - s('removeColorProfiles') },
    { key: 'cmykToRgb', savedBytes: s('cmykToRgb'), compressedSize: baselineSize - s('cmykToRgb') },
    { key: 'removeThumbnails', savedBytes: s('removeThumbnails'), compressedSize: baselineSize - s('removeThumbnails') },
    { key: 'removeDuplicateResources', savedBytes: s('removeDuplicateResources'), compressedSize: baselineSize - s('removeDuplicateResources') },
    { key: 'removeUnusedFonts', savedBytes: s('removeUnusedFonts'), compressedSize: baselineSize - s('removeUnusedFonts') },
    { key: 'removeAttachments', savedBytes: s('removeAttachments'), compressedSize: baselineSize - s('removeAttachments'), details: { imagesProcessed: structAttachmentsRemoved } },
    { key: 'flattenForms', savedBytes: s('flattenForms'), compressedSize: baselineSize - s('flattenForms') },
    { key: 'flattenAnnotations', savedBytes: s('flattenAnnotations'), compressedSize: baselineSize - s('flattenAnnotations') },
    { key: 'removeJavaScript', savedBytes: s('removeJavaScript'), compressedSize: baselineSize - s('removeJavaScript') },
    { key: 'removeBookmarks', savedBytes: s('removeBookmarks'), compressedSize: baselineSize - s('removeBookmarks') },
    { key: 'removeNamedDestinations', savedBytes: s('removeNamedDestinations'), compressedSize: baselineSize - s('removeNamedDestinations') },
    { key: 'removeArticleThreads', savedBytes: s('removeArticleThreads'), compressedSize: baselineSize - s('removeArticleThreads') },
    { key: 'removeWebCaptureInfo', savedBytes: s('removeWebCaptureInfo'), compressedSize: baselineSize - s('removeWebCaptureInfo') },
    { key: 'removeHiddenLayers', savedBytes: s('removeHiddenLayers'), compressedSize: baselineSize - s('removeHiddenLayers') },
    { key: 'removePageLabels', savedBytes: s('removePageLabels'), compressedSize: baselineSize - s('removePageLabels') },
    { key: 'deepCleanMetadata', savedBytes: s('deepCleanMetadata'), compressedSize: baselineSize - s('deepCleanMetadata') },
    { key: 'inlineToXObject', savedBytes: s('inlineToXObject'), compressedSize: baselineSize - s('inlineToXObject') },
    { key: 'compressContentStreams', savedBytes: s('compressContentStreams'), compressedSize: baselineSize - s('compressContentStreams') },
    { key: 'removeOrphanObjects', savedBytes: s('removeOrphanObjects'), compressedSize: baselineSize - s('removeOrphanObjects') },
    { key: 'removeAlternateContent', savedBytes: s('removeAlternateContent'), compressedSize: baselineSize - s('removeAlternateContent') },
    { key: 'removeInvisibleText', savedBytes: s('removeInvisibleText'), compressedSize: baselineSize - s('removeInvisibleText') },
  ];

  onProgress?.('Done!');

  report.compressedSize = fullCompressedBytes.byteLength;
  report.logs.push({
    timestamp: Date.now(),
    level: 'success',
    message: 'Compression completed successfully',
    details: {
      methodCount: report.methodsUsed.length,
      original: formatBytes(report.originalSize),
      compressed: formatBytes(report.compressedSize)
    }
  });

  return {
    originalSize,
    pageCount: info.pageCount,
    baselineSize,
    fullCompressedBytes,
    methodResults,
    imageStats,
    report,
  };
};
