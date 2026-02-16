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
  type ImageStats,
  type ExtendedImageSettings,
} from './image-processor';
import {
  processImagesIncrementally,
  type CompressionBudget,
} from './incremental-processor';
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

  // Helper: apply a method on the shared document WITHOUT intermediate save.
  // We batch all methods and do a single save at the end for massive speedup.
  const applyMethod = async (
    key: string,
    enabled: boolean,
    apply: (doc: PDFDocument) => void | number | Promise<void | { savedBytes: number; [k: string]: unknown }>,
    cleanOrphans: boolean = false,
  ) => {
    if (!enabled) {
      savings[key] = 0;
      return;
    }
    report.methodsUsed.push(key);
    try {
      const result = await apply(workDoc);
      if (cleanOrphans) {
        await removeOrphanObjects(workDoc);
      }
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
    }, true);
  }

  if (options.removeColorProfiles) {
    await applyMethod('removeColorProfiles', true, (doc) => {
      const r = removeIccProfiles(doc);
      if (r.removed > 0) log('success', `Removed ${r.removed} ICC profiles`);
    }, true);
  }

  if (options.cmykToRgb) {
    await applyMethod('cmykToRgb', true, async (doc) => {
      const r = await convertCmykToRgb(doc, settings.quality, onProgress);
      if (r.converted > 0) log('success', `Converted ${r.converted} CMYK images to RGB`);
    }, true);
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
    }, true);
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
    }, true);
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
    }, true);
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

  // Helper: apply a structure method without saving (batched)
  const applyStructMethod = (
    key: string,
    enabled: boolean,
    apply: (doc: PDFDocument) => void | number,
    cleanOrphans: boolean = false,
  ): number | void => {
    if (!enabled) {
      return;
    }
    report.methodsUsed.push(key);
    try {
      const result = apply(structDoc);
      // Note: orphan cleanup is deferred to a single pass after all struct methods
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

  // Single orphan cleanup pass after all structure methods
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

  // Calculate total non-image savings and distribute proportionally across methods
  // Since we batch all methods into a single save, we can't measure individual deltas
  // without the expensive per-method save. Instead, attribute total structural savings
  // to the combined set of applied methods.
  const totalFinalSize = fullCompressedBytes.byteLength;
  const imageRelatedSavings = (savings.recompressImages ?? 0) + (savings.downsampleImages ?? 0) + (savings.pngToJpeg ?? 0);
  const sizeAfterImages = lastSize; // lastSize was set after loading workDoc
  const totalStructSavings = Math.max(0, sizeAfterImages - (totalFinalSize + osSaved));

  // Collect all applied non-image method keys for proportional attribution
  const appliedMethodKeys = report.methodsSuccessful.filter(
    k => !['recompressImages', 'downsampleImages', 'pngToJpeg', 'useObjectStreams'].includes(k)
  );

  // Distribute structural savings equally among applied methods
  if (appliedMethodKeys.length > 0 && totalStructSavings > 0) {
    const perMethodSavings = Math.floor(totalStructSavings / appliedMethodKeys.length);
    const remainder = totalStructSavings - (perMethodSavings * appliedMethodKeys.length);
    for (let i = 0; i < appliedMethodKeys.length; i++) {
      savings[appliedMethodKeys[i]] = perMethodSavings + (i === 0 ? remainder : 0);
    }
  }

  // Helper to get savings for a method key
  const s = (key: string) => savings[key] ?? 0;

  // Build method results with actual measured savings
  const methodResults: MethodResult[] = [
    { key: 'useObjectStreams', savedBytes: osSaved, compressedSize: originalSize - osSaved },
    { key: 'stripMetadata', savedBytes: s('stripMetadata'), compressedSize: originalSize - s('stripMetadata') },
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
    pdfFeatures,
    report,
  };
};

/**
 * Incremental PDF compression with streaming escalation.
 *
 * Instead of compressing the entire PDF then retrying with harsher settings
 * (O(n × tiers)), this processes images progressively and escalates
 * compression mid-stream when the budget is being exceeded (O(n)).
 *
 * The pipeline:
 * 1. Extract all images
 * 2. Calculate per-image budget based on target size
 * 3. Process images one-by-one, tracking cumulative size
 * 4. When over budget → escalate quality for remaining images
 * 5. If still over → recompress only the largest images harder
 * 6. Apply structural optimizations (same as analyzePdf)
 * 7. Single final save
 *
 * Falls back to analyzePdf behavior when no target size is specified.
 */
export const analyzePdfIncremental = async (
  arrayBuffer: ArrayBuffer,
  onProgress?: ProgressCallback,
  settings: ExtendedProcessingSettings = DEFAULT_IMAGE_SETTINGS,
  targetBytes?: number,
): Promise<{
  originalSize: number;
  pageCount: number;
  baselineSize: number;
  fullCompressedBytes: Uint8Array;
  methodResults: MethodResult[];
  imageStats?: ImageStats;
  pdfFeatures?: PdfFeatures;
  report: CompressionReport;
}> => {
  // If no target, fall back to standard processing
  if (!targetBytes || targetBytes <= 0) {
    return analyzePdf(arrayBuffer, onProgress, settings);
  }

  const originalSize = arrayBuffer.byteLength;
  const options = settings.options ?? DEFAULT_COMPRESSION_OPTIONS;

  onProgress?.('Reading PDF...');

  const { pdfDoc: baseDoc, info } = await loadPdf(arrayBuffer);
  const baselineBytes = await baseDoc.save({ useObjectStreams: false });
  const baselineSize = baselineBytes.byteLength;

  let pdfFeatures: PdfFeatures | undefined;

  const report: CompressionReport = {
    timestamp: Date.now(),
    originalSize,
    compressedSize: 0,
    pageCount: info.pageCount,
    methodsUsed: [],
    methodsSuccessful: [],
    errors: [],
    logs: [],
  };

  const log = (level: ProcessingLog['level'], message: string, details?: string | object) => {
    report.logs.push({ timestamp: Date.now(), level, message, details });
  };

  log('info', `Started incremental analysis of ${info.title || 'PDF'}`, {
    originalSize: formatBytes(originalSize),
    targetSize: formatBytes(targetBytes),
    pageCount: info.pageCount,
  });

  // === Image extraction ===
  onProgress?.('Analyzing images...');
  log('info', 'Analyzing document images...');

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
    const extractPng = options.pngToJpeg;
    const extracted = await extractImages(baseDoc, onProgress, settings.targetDpi, extractPng);
    images = extracted.images;
    imageStats = extracted.stats;

    log('info', `Found ${images.length} images`, imageStats);
    pdfFeatures = detectFeatures(baseDoc, imageStats);

    jpegImages = images.filter(img => img.format === 'jpeg');
    pngImages = images.filter(img => img.format === 'png');

    // === Incremental processing with budget tracking ===
    const totalImageOriginalSize = imageStats.totalOriginalSize;

    // Calculate image budget
    const estimatedOverhead = originalSize - totalImageOriginalSize;
    const imageBudgetBytes = Math.max(0, Math.round((targetBytes - estimatedOverhead) * 0.9));

    const budget: CompressionBudget = {
      originalSize,
      targetBytes,
      baselineSize,
      estimatedOverhead,
      imageBudgetBytes,
      imageBytesSoFar: 0,
      imagesProcessed: 0,
      totalImages: jpegImages.length + pngImages.length,
      escalated: false,
      currentTier: 0,
    };

    log('info', `Image budget: ${formatBytes(imageBudgetBytes)} for ${budget.totalImages} images (target: ${formatBytes(targetBytes)}, overhead: ${formatBytes(estimatedOverhead)})`);

    if (jpegImages.length > 0 || pngImages.length > 0) {
      report.methodsUsed.push('recompressImages');
      if (options.pngToJpeg && pngImages.length > 0) {
        report.methodsUsed.push('pngToJpeg');
      }

      const result = await processImagesIncrementally(
        jpegImages,
        pngImages,
        settings,
        options,
        budget,
        onProgress,
        log,
      );

      imagesProcessed = result.recompressedImages.filter(r =>
        jpegImages.some(j => j.ref === r.ref)
      ).length;
      imagesSkipped = jpegImages.length - imagesProcessed;
      imagesDownsampled = result.recompressedImages.filter(r => r.wasDownsampled).length;
      pngsConverted = result.recompressedImages.filter(r =>
        pngImages.some(p => p.ref === r.ref)
      ).length;

      savings.recompressImages = result.jpegSavings - result.downsampleSavings;
      savings.downsampleImages = result.downsampleSavings;
      savings.pngToJpeg = result.pngSavings;

      if (result.jpegSavings > 0) report.methodsSuccessful.push('recompressImages');
      if (result.pngSavings > 0) report.methodsSuccessful.push('pngToJpeg');

      if (budget.escalated) {
        log('info', `Streaming escalation used: reached tier ${budget.currentTier}, final quality: ${result.settingsUsed.quality}`);
      }

      // Embed all processed images
      if (result.recompressedImages.length > 0) {
        onProgress?.('Embedding optimized images...');
        recompressedImageBytes = await embedRecompressedImages(
          baseDoc,
          result.recompressedImages,
          onProgress
        );
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log('warning', `Image processing failed, skipping: ${msg}`);
    report.errors.push('imageProcessing');
  }

  // === Apply structural optimizations (same as analyzePdf) ===
  let workingBuffer = recompressedImageBytes
    ? recompressedImageBytes.slice().buffer as ArrayBuffer
    : arrayBuffer;

  onProgress?.('Applying optimizations...');
  let workDoc: PDFDocument;
  let lastSize: number;
  try {
    const loaded = await loadPdf(workingBuffer);
    workDoc = loaded.pdfDoc;
    lastSize = (await workDoc.save({ useObjectStreams: false })).byteLength;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log('warning', `Failed to load working buffer, falling back to original: ${msg}`);
    report.errors.push('loadWorkingBuffer');
    const loaded = await loadPdf(arrayBuffer);
    workDoc = loaded.pdfDoc;
    lastSize = (await workDoc.save({ useObjectStreams: false })).byteLength;
  }

  // Helper: apply a method on the shared document
  const applyMethod = async (
    key: string,
    enabled: boolean,
    apply: (doc: PDFDocument) => void | number | Promise<void | { savedBytes: number; [k: string]: unknown }>,
    cleanOrphans: boolean = false,
  ) => {
    if (!enabled) {
      savings[key] = 0;
      return;
    }
    report.methodsUsed.push(key);
    try {
      const result = await apply(workDoc);
      if (cleanOrphans) {
        await removeOrphanObjects(workDoc);
      }
      report.methodsSuccessful.push(key);
      return result;
    } catch (err) {
      savings[key] = 0;
      const msg = err instanceof Error ? err.message : String(err);
      log('warning', `Method ${key} failed: ${msg}`);
      report.errors.push(key);
    }
  };

  // Run orphan removal first
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
    }, true);
  }

  if (options.removeColorProfiles) {
    await applyMethod('removeColorProfiles', true, (doc) => {
      const r = removeIccProfiles(doc);
      if (r.removed > 0) log('success', `Removed ${r.removed} ICC profiles`);
    }, true);
  }

  if (options.cmykToRgb) {
    await applyMethod('cmykToRgb', true, async (doc) => {
      const r = await convertCmykToRgb(doc, settings.quality, onProgress);
      if (r.converted > 0) log('success', `Converted ${r.converted} CMYK images to RGB`);
    }, true);
  }

  // Resource optimization
  if (options.removeDuplicateResources) {
    onProgress?.('Removing duplicate resources...');
    await applyMethod('removeDuplicateResources', true, (doc) => {
      const r = removeDuplicateResources(doc);
      if (r.duplicatesFound > 0) log('success', `Removed ${r.duplicatesFound} duplicate resources`);
      else log('info', 'No duplicate resources found');
    }, true);
  }

  if (options.removeUnusedFonts) {
    onProgress?.('Removing unused fonts...');
    await applyMethod('removeUnusedFonts', true, (doc) => {
      const r = removeUnusedFonts(doc);
      if (r.fontsRemoved > 0) log('success', `Removed ${r.fontsRemoved} unused fonts`, { fonts: r.fontNames });
      else log('info', 'No unused fonts found');
    }, true);
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
    }, true);
  }

  if (options.removeInvisibleText) {
    await applyMethod('removeInvisibleText', true, async (doc) => {
      const r = await removeInvisibleText(doc, onProgress);
      if (r.pagesProcessed > 0) log('success', `Removed invisible text from ${r.pagesProcessed} pages`);
    });
  }

  onProgress?.('Applying structure cleanup...');

  // Structure cleanup
  let structAttachmentsRemoved = 0;
  const structDoc = workDoc;

  const applyStructMethod = (
    key: string,
    enabled: boolean,
    apply: (doc: PDFDocument) => void | number,
  ): number | void => {
    if (!enabled) return;
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

  await removeOrphanObjects(structDoc);

  onProgress?.('Creating final compressed file...');

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

  // Single final save
  let fullCompressedBytes: Uint8Array;
  let withoutOsBytes: Uint8Array | undefined;
  try {
    if (options.useObjectStreams) {
      withoutOsBytes = await structDoc.save({ useObjectStreams: false });
    }
    fullCompressedBytes = await structDoc.save({
      useObjectStreams: options.useObjectStreams,
    });
  } catch (err) {
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

  // Calculate savings attribution (same logic as analyzePdf)
  const totalFinalSize = fullCompressedBytes.byteLength;
  const sizeAfterImages = lastSize;
  const totalStructSavings = Math.max(0, sizeAfterImages - (totalFinalSize + osSaved));

  const appliedMethodKeys = report.methodsSuccessful.filter(
    k => !['recompressImages', 'downsampleImages', 'pngToJpeg', 'useObjectStreams'].includes(k)
  );

  if (appliedMethodKeys.length > 0 && totalStructSavings > 0) {
    const perMethodSavings = Math.floor(totalStructSavings / appliedMethodKeys.length);
    const remainder = totalStructSavings - (perMethodSavings * appliedMethodKeys.length);
    for (let i = 0; i < appliedMethodKeys.length; i++) {
      savings[appliedMethodKeys[i]] = perMethodSavings + (i === 0 ? remainder : 0);
    }
  }

  const s = (key: string) => savings[key] ?? 0;

  const methodResults: MethodResult[] = [
    { key: 'useObjectStreams', savedBytes: osSaved, compressedSize: originalSize - osSaved },
    { key: 'stripMetadata', savedBytes: s('stripMetadata'), compressedSize: originalSize - s('stripMetadata') },
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
    message: `Incremental compression completed${fullCompressedBytes.byteLength <= targetBytes ? ' — target met!' : ''}`,
    details: {
      methodCount: report.methodsUsed.length,
      original: formatBytes(report.originalSize),
      compressed: formatBytes(report.compressedSize),
      target: formatBytes(targetBytes),
      targetMet: fullCompressedBytes.byteLength <= targetBytes,
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
  };
};
