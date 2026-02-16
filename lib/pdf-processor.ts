/**
 * PDF Processor - Core compression logic using pdf-lib
 * Full Phase 2 implementation with all compression methods
 */

import { PDFDocument, PDFName, PDFDict, PDFArray, PDFRef } from 'pdf-lib';
import type { PdfInfo, PdfFeatures, MethodResult, ImageCompressionSettings, CompressionOptions, RecompressedImage, CompressionReport, ProcessingLog } from './types';
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
  estimateImageSavingsRange,
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

/**
 * Detect which features are present in the PDF document
 * Used to indicate which compression methods are relevant
 */
const detectFeatures = (pdfDoc: PDFDocument, imageStats?: ImageStats): PdfFeatures => {
  const catalog = pdfDoc.catalog;

  // JavaScript detection
  let hasJavaScript = false;
  if (catalog.has(PDFName.of('OpenAction')) || catalog.has(PDFName.of('AA'))) {
    hasJavaScript = true;
  }
  if (!hasJavaScript) {
    const names = catalog.get(PDFName.of('Names'));
    if (names instanceof PDFDict && names.has(PDFName.of('JavaScript'))) {
      hasJavaScript = true;
    }
  }
  if (!hasJavaScript) {
    const pages = pdfDoc.getPages();
    for (const page of pages) {
      if (page.node.has(PDFName.of('AA'))) {
        hasJavaScript = true;
        break;
      }
    }
  }

  // Forms detection
  let hasForms = false;
  try {
    const form = pdfDoc.getForm();
    hasForms = form.getFields().length > 0;
  } catch {
    // No forms
  }

  // Annotations detection
  let hasAnnotations = false;
  const pages = pdfDoc.getPages();
  for (const page of pages) {
    const annots = page.node.get(PDFName.of('Annots'));
    if (annots instanceof PDFArray && annots.size() > 0) {
      hasAnnotations = true;
      break;
    }
  }

  // Thumbnails detection
  let hasThumbnails = false;
  for (const page of pages) {
    if (page.node.has(PDFName.of('Thumb'))) {
      hasThumbnails = true;
      break;
    }
  }

  // Attachments detection
  let hasAttachments = false;
  const namesDict = catalog.get(PDFName.of('Names'));
  if (namesDict instanceof PDFDict && namesDict.has(PDFName.of('EmbeddedFiles'))) {
    hasAttachments = true;
  }
  if (!hasAttachments && catalog.has(PDFName.of('AF'))) {
    hasAttachments = true;
  }

  // Metadata detection
  const hasMetadata = !!(
    pdfDoc.getTitle() || pdfDoc.getAuthor() || pdfDoc.getSubject() ||
    pdfDoc.getProducer() || pdfDoc.getCreator() ||
    catalog.has(PDFName.of('Metadata'))
  );

  return {
    hasImages: (imageStats?.totalImages ?? 0) > 0,
    hasJpegImages: (imageStats?.jpegCount ?? 0) > 0,
    hasPngImages: (imageStats?.pngCount ?? 0) > 0,
    hasAlphaImages: (imageStats?.alphaCount ?? 0) > 0,
    hasIccProfiles: (imageStats?.iccCount ?? 0) > 0,
    hasCmykImages: (imageStats?.cmykCount ?? 0) > 0,
    hasHighDpiImages: (imageStats?.highDpiCount ?? 0) > 0,
    hasJavaScript,
    hasBookmarks: catalog.has(PDFName.of('Outlines')),
    hasNamedDestinations: catalog.has(PDFName.of('Dests')) ||
      (namesDict instanceof PDFDict && namesDict.has(PDFName.of('Dests'))),
    hasArticleThreads: catalog.has(PDFName.of('Threads')),
    hasWebCaptureInfo: catalog.has(PDFName.of('SpiderInfo')) ||
      catalog.has(PDFName.of('IDS')) || catalog.has(PDFName.of('URLS')),
    hasHiddenLayers: catalog.has(PDFName.of('OCProperties')),
    hasPageLabels: catalog.has(PDFName.of('PageLabels')),
    hasForms,
    hasAnnotations,
    hasAttachments,
    hasThumbnails,
    hasMetadata,
  };
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
  pdfFeatures?: PdfFeatures;
  report: CompressionReport;
  /** The working buffer (post-image, pre-structural methods) for background measurement */
  workingBuffer: ArrayBuffer;
}> => {
  const originalSize = arrayBuffer.byteLength;
  const options = settings.options ?? DEFAULT_COMPRESSION_OPTIONS;

  onProgress?.('Reading PDF...');

  // Load PDF ONCE for info, baseline, and image extraction
  const { pdfDoc: baseDoc, info } = await loadPdf(arrayBuffer);
  // Establish baseline size
  const baselineBytes = await baseDoc.save({ useObjectStreams: false });
  const baselineSize = baselineBytes.byteLength;

  // Detect PDF features (will be enriched with image stats later)
  let pdfFeatures: PdfFeatures | undefined;

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
  let imageSavingsRange: { min: number; max: number } | undefined;
  let imagesProcessed = 0;
  let imagesSkipped = 0;
  let imagesDownsampled = 0;
  let pngsConverted = 0;
  let images: import('./types').ExtractedImage[] = [];
  let imageStats: ImageStats | undefined;
  let jpegImages: import('./types').ExtractedImage[] = [];
  let pngImages: import('./types').ExtractedImage[] = [];

  try {
    // Reuse baseDoc instead of loading PDF again — saves a full parse
    const extractPng = options.pngToJpeg;
    const extracted = await extractImages(baseDoc, onProgress, settings.targetDpi, extractPng);
    images = extracted.images;
    imageStats = extracted.stats;

    log('info', `Found ${images.length} images`, imageStats);

    // Detect PDF features for method availability indicators
    pdfFeatures = detectFeatures(baseDoc, imageStats);

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

      // Estimate savings range at boundary quality levels (for UI display)
      if (totalSavings > 0) {
        try {
          imageSavingsRange = await estimateImageSavingsRange(
            jpegImages, settings, totalSavings
          );
        } catch {
          // Non-critical, skip range estimation
        }
      }
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

    // Embed all processed images — reuse baseDoc to avoid re-parsing
    if (allRecompressedImages.length > 0) {
      onProgress?.('Embedding optimized images...');
      recompressedImageBytes = await embedRecompressedImages(
        baseDoc,
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

  // Load document ONCE for all in-place mutation methods
  // (alpha, ICC, CMYK, dedup, fonts, inline, streams, orphans, alternate, invisible, structure)
  // This eliminates 12+ redundant PDFDocument.load() calls
  onProgress?.('Applying optimizations...');
  let workDoc: PDFDocument;
  try {
    const loaded = await loadPdf(workingBuffer);
    workDoc = loaded.pdfDoc;
  } catch (err) {
    // If recompressed image buffer is corrupt, fall back to original
    const msg = err instanceof Error ? err.message : String(err);
    log('warning', `Failed to load working buffer, falling back to original: ${msg}`);
    report.errors.push('loadWorkingBuffer');
    const loaded = await loadPdf(arrayBuffer);
    workDoc = loaded.pdfDoc;
  }

  // Helper: apply a method on the shared document WITHOUT intermediate save.
  // We batch all methods and do a single save at the end for massive speedup.
  // Orphan cleanup is deferred to a single pass after all methods (line ~545).
  const applyMethod = async (
    key: string,
    enabled: boolean,
    apply: (doc: PDFDocument) => void | number | Promise<void | { savedBytes: number; [k: string]: unknown }>,
  ) => {
    if (!enabled) {
      savings[key] = 0;
      return;
    }
    report.methodsUsed.push(key);
    try {
      const result = await apply(workDoc);
      report.methodsSuccessful.push(key);
      return result;
    } catch (err) {
      savings[key] = 0;
      const msg = err instanceof Error ? err.message : String(err);
      log('warning', `Method ${key} failed: ${msg}`);
      report.errors.push(key);
    }
  };

  // Run orphan removal FIRST to clean pre-existing orphans before other methods
  if (options.removeOrphanObjects) {
    onProgress?.('Removing orphan objects...');
    await applyMethod('removeOrphanObjects', true, async (doc) => {
      const r = await removeOrphanObjects(doc, onProgress);
      if (r.orphansRemoved > 0) log('success', `Removed ${r.orphansRemoved} orphan objects`);
    });
  }

  // Image-related in-place mutations
  if (options.removeAlphaChannels) {
    await applyMethod('removeAlphaChannels', true, (doc) => {
      const r = removeAlphaChannels(doc);
      if (r.processed > 0) log('success', `Removed alpha channels from ${r.processed} images`);
    });
  }

  if (options.removeColorProfiles) {
    await applyMethod('removeColorProfiles', true, (doc) => {
      const r = removeIccProfiles(doc);
      if (r.removed > 0) log('success', `Removed ${r.removed} ICC profiles`);
    });
  }

  if (options.cmykToRgb) {
    await applyMethod('cmykToRgb', true, async (doc) => {
      const r = await convertCmykToRgb(doc, settings.quality, onProgress);
      if (r.converted > 0) log('success', `Converted ${r.converted} CMYK images to RGB`);
    });
  }

  // Resource optimization
  if (options.removeDuplicateResources) {
    onProgress?.('Removing duplicate resources...');
    await applyMethod('removeDuplicateResources', true, (doc) => {
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
    await applyMethod('removeUnusedFonts', true, (doc) => {
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
    await applyMethod('inlineToXObject', true, async (doc) => {
      const r = await convertInlineImagesToXObjects(doc, onProgress);
      if (r.converted > 0) log('success', `Converted ${r.converted} inline images to XObjects`);
    });
  }

  if (options.compressContentStreams) {
    await applyMethod('compressContentStreams', true, async (doc) => {
      const r = await compressContentStreams(doc, onProgress);
      if (r.streamsCompressed > 0) log('success', `Compressed ${r.streamsCompressed} content streams`);
    });
  }

  if (options.removeAlternateContent) {
    await applyMethod('removeAlternateContent', true, async (doc) => {
      const r = await removeAlternateContent(doc, onProgress);
      if (r.alternatesRemoved > 0 || r.printOnlyRemoved > 0 || r.screenOnlyRemoved > 0) {
        log('success', 'Removed alternate content objects');
      }
    });
  }

  if (options.removeInvisibleText) {
    await applyMethod('removeInvisibleText', true, async (doc) => {
      const r = await removeInvisibleText(doc, onProgress);
      if (r.pagesProcessed > 0) log('success', `Removed invisible text from ${r.pagesProcessed} pages`);
    });
  }

  onProgress?.('Applying structure cleanup...');

  // Structure cleanup — applied on the same shared document, NO intermediate saves
  let structAttachmentsRemoved = 0;
  const structDoc = workDoc; // Alias for clarity — same document instance

  // Helper: apply a structure method without saving (batched).
  // Orphan cleanup is deferred to a single pass after all struct methods.
  const applyStructMethod = (
    key: string,
    enabled: boolean,
    apply: (doc: PDFDocument) => void | number,
  ): number | void => {
    if (!enabled) {
      return;
    }
    report.methodsUsed.push(key);
    try {
      const result = apply(structDoc);
      report.methodsSuccessful.push(key);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log('warning', `Method ${key} failed: ${msg}`);
      report.errors.push(key);
    }
  };

  // Apply all structure methods WITHOUT intermediate saves (massive speedup)
  applyStructMethod('removeJavaScript', options.removeJavaScript, removeJS);
  applyStructMethod('removeBookmarks', options.removeBookmarks, removeBM);
  applyStructMethod('removeNamedDestinations', options.removeNamedDestinations, removeND);
  applyStructMethod('removeArticleThreads', options.removeArticleThreads, removeAT);
  applyStructMethod('removeWebCaptureInfo', options.removeWebCaptureInfo, removeWC);
  applyStructMethod('removeHiddenLayers', options.removeHiddenLayers, removeHL);
  applyStructMethod('removePageLabels', options.removePageLabels, removePL);
  applyStructMethod('deepCleanMetadata', options.deepCleanMetadata, deepCleanMD);
  applyStructMethod('removeThumbnails', options.removeThumbnails, removeTN);
  const attResult = applyStructMethod('removeAttachments', options.removeAttachments, removeATT);
  if (typeof attResult === 'number') structAttachmentsRemoved = attResult;
  applyStructMethod('flattenForms', options.flattenForms, flattenFM);
  applyStructMethod('flattenAnnotations', options.flattenAnnotations, flattenAN);

  // Single orphan cleanup pass after ALL methods (non-struct + struct).
  // Per-method orphan cleanup is only needed in background measurement
  // where each method is tested independently on a fresh document.
  await removeOrphanObjects(structDoc);

  onProgress?.('Creating final compressed file...');

  // Apply metadata stripping
  if (options.stripMetadata) {
    report.methodsUsed.push('stripMetadata');
    try {
      stripMetadata(structDoc);
      report.methodsSuccessful.push('stripMetadata');
      log('success', 'Stripped standard metadata');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log('warning', `Metadata stripping failed: ${msg}`);
      report.errors.push('stripMetadata');
    }
  }

  // Single final save — this replaces ~20+ intermediate saves
  let fullCompressedBytes: Uint8Array;
  let withoutOsBytes: Uint8Array | undefined;
  try {
    // If object streams enabled, save once without to measure its contribution
    if (options.useObjectStreams) {
      withoutOsBytes = await structDoc.save({ useObjectStreams: false });
    }
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

  const osSaved = (options.useObjectStreams && withoutOsBytes)
    ? Math.max(0, withoutOsBytes.byteLength - fullCompressedBytes.byteLength)
    : 0;

  if (options.useObjectStreams && osSaved > 0) {
    report.methodsUsed.push('useObjectStreams');
    report.methodsSuccessful.push('useObjectStreams');
    log('success', 'Applied Object Streams compression', { saved: osSaved });
  }

  // Image methods have real savings from the fast pass.
  // Non-image methods are marked as pending — exact per-method savings will
  // be calculated in the background by measureMethodSavings() without
  // blocking the user.
  const s = (key: string) => savings[key] ?? 0;

  // Keys whose savings we already know (image-related + object streams)
  // These keys have real savings from the fast pass (image pipeline or measured directly).
  // convertToGrayscale/convertToMonochrome are applied inside recompressJpeg, not standalone methods.
  const knownKeys = new Set([
    'recompressImages', 'downsampleImages', 'pngToJpeg', 'useObjectStreams',
    'convertToGrayscale', 'convertToMonochrome',
  ]);

  const mkResult = (key: keyof CompressionOptions, extra?: Partial<MethodResult>): MethodResult => {
    const known = knownKeys.has(key);
    return {
      key,
      savedBytes: known ? (s(key)) : 0,
      compressedSize: known ? (baselineSize - s(key)) : baselineSize,
      pending: !known, // non-image methods will be measured in background
      ...extra,
    };
  };

  const methodResults: MethodResult[] = [
    mkResult('useObjectStreams', { savedBytes: osSaved, compressedSize: originalSize - osSaved, pending: false }),
    mkResult('stripMetadata'),
    mkResult('recompressImages', { details: { imagesProcessed, imagesSkipped }, savingsRange: imageSavingsRange }),
    mkResult('downsampleImages', { details: { imagesProcessed: imagesDownsampled, imagesSkipped: imagesProcessed - imagesDownsampled } }),
    mkResult('convertToGrayscale'),
    mkResult('pngToJpeg', { details: { imagesProcessed: pngsConverted, imagesSkipped: pngImages.length - pngsConverted } }),
    mkResult('convertToMonochrome'),
    mkResult('removeAlphaChannels'),
    mkResult('removeColorProfiles'),
    mkResult('cmykToRgb'),
    mkResult('removeThumbnails'),
    mkResult('removeDuplicateResources'),
    mkResult('removeUnusedFonts'),
    mkResult('removeAttachments', { details: { imagesProcessed: structAttachmentsRemoved } }),
    mkResult('flattenForms'),
    mkResult('flattenAnnotations'),
    mkResult('removeJavaScript'),
    mkResult('removeBookmarks'),
    mkResult('removeNamedDestinations'),
    mkResult('removeArticleThreads'),
    mkResult('removeWebCaptureInfo'),
    mkResult('removeHiddenLayers'),
    mkResult('removePageLabels'),
    mkResult('deepCleanMetadata'),
    mkResult('inlineToXObject'),
    mkResult('compressContentStreams'),
    mkResult('removeOrphanObjects'),
    mkResult('removeAlternateContent'),
    mkResult('removeInvisibleText'),
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
    pdfFeatures,
    report,
    workingBuffer,
  };
};

/**
 * Background measurement: calculate exact per-method savings individually.
 * Called AFTER the fast result is already sent to the user.
 * Tests every method (enabled or not) to show potential savings.
 * Calls onMethodUpdate after each method completes so the UI can update progressively.
 */
export const measureMethodSavings = async (
  workingBuffer: ArrayBuffer,
  settings: ExtendedProcessingSettings,
  onMethodUpdate: (results: MethodResult[]) => void,
  shouldAbort?: () => boolean,
): Promise<void> => {
  const options = settings.options ?? DEFAULT_COMPRESSION_OPTIONS;

  // Load once to get baseline size for the working buffer
  let baseDoc: PDFDocument;
  let baseSize: number;
  try {
    baseDoc = (await loadPdf(workingBuffer)).pdfDoc;
    baseSize = (await baseDoc.save({ useObjectStreams: false })).byteLength;
  } catch {
    return; // Can't measure, silently fail
  }

  // All non-image methods to measure individually
  // Each entry: [key, apply function, needsOrphanCleanup]
  const methods: Array<[keyof CompressionOptions, (doc: PDFDocument) => void | Promise<void>, boolean]> = [
    ['stripMetadata', (doc) => stripMetadata(doc), false],
    ['removeOrphanObjects', async (doc) => { await removeOrphanObjects(doc); }, false],
    ['removeAlphaChannels', (doc) => { removeAlphaChannels(doc); }, true],
    ['removeColorProfiles', (doc) => { removeIccProfiles(doc); }, true],
    ['cmykToRgb', async (doc) => { await convertCmykToRgb(doc, settings.quality); }, true],
    ['removeDuplicateResources', (doc) => { removeDuplicateResources(doc); }, true],
    ['removeUnusedFonts', (doc) => { removeUnusedFonts(doc); }, true],
    ['inlineToXObject', async (doc) => { await convertInlineImagesToXObjects(doc); }, false],
    ['compressContentStreams', async (doc) => { await compressContentStreams(doc); }, false],
    ['removeAlternateContent', async (doc) => { await removeAlternateContent(doc); }, true],
    ['removeInvisibleText', async (doc) => { await removeInvisibleText(doc); }, false],
    ['removeJavaScript', (doc) => { removeJS(doc); }, true],
    ['removeBookmarks', (doc) => { removeBM(doc); }, true],
    ['removeNamedDestinations', (doc) => { removeND(doc); }, true],
    ['removeArticleThreads', (doc) => { removeAT(doc); }, true],
    ['removeWebCaptureInfo', (doc) => { removeWC(doc); }, true],
    ['removeHiddenLayers', (doc) => { removeHL(doc); }, true],
    ['removePageLabels', (doc) => { removePL(doc); }, false],
    ['deepCleanMetadata', (doc) => { deepCleanMD(doc); }, true],
    ['removeThumbnails', (doc) => { removeTN(doc); }, true],
    ['removeAttachments', (doc) => { removeATT(doc); }, true],
    ['flattenForms', (doc) => { flattenFM(doc); }, true],
    ['flattenAnnotations', (doc) => { flattenAN(doc); }, true],
  ];

  // Object streams is measured separately (it's a save option, not a mutation)
  // and is already measured in the fast pass, so skip it here.

  const results: MethodResult[] = [];

  for (const [key, apply, cleanOrphans] of methods) {
    // Yield to the event loop so the worker can process new messages (e.g. a new 'start').
    // Without this, the entire loop runs without ever checking for new messages,
    // blocking re-compression when the user changes settings.
    await new Promise(resolve => setTimeout(resolve, 0));

    // Check if a new compression job has started — abort if so
    if (shouldAbort?.()) return;

    try {
      // Load a fresh copy for each method to measure independently
      const { pdfDoc: freshDoc } = await loadPdf(workingBuffer);
      await apply(freshDoc);
      if (cleanOrphans) {
        await removeOrphanObjects(freshDoc);
      }
      const afterBytes = await freshDoc.save({ useObjectStreams: false });
      const saved = Math.max(0, baseSize - afterBytes.byteLength);
      results.push({
        key,
        savedBytes: saved,
        compressedSize: baseSize - saved,
        pending: false,
      });
    } catch {
      results.push({
        key,
        savedBytes: 0,
        compressedSize: baseSize,
        pending: false,
      });
    }

    // Check again after the expensive work
    if (shouldAbort?.()) return;

    // Send progressive update after each method
    onMethodUpdate([...results]);
  }
};
