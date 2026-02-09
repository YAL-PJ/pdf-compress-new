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

  const { pdfDoc: imgDoc } = await loadPdf(arrayBuffer);
  const extractPng = options.pngToJpeg;
  const { images, stats: imageStats } = await extractImages(imgDoc, onProgress, settings.targetDpi, extractPng);

  log('info', `Found ${images.length} images`, imageStats);

  // Track savings for each method
  let imageSaved = 0;
  let downsampleSaved = 0;
  let pngToJpegSaved = 0;
  let alphaSaved = 0;
  let iccSaved = 0;
  let cmykSaved = 0;
  let duplicateSaved = 0;
  let fontSaved = 0;
  let inlineToXObjectSaved = 0;
  let contentStreamSaved = 0;
  let orphansSaved = 0;
  let alternateSaved = 0;
  let invisibleTextSaved = 0;

  let recompressedImageBytes: Uint8Array | null = null;
  let imagesProcessed = 0;
  let imagesSkipped = 0;
  let imagesDownsampled = 0;
  let pngsConverted = 0;

  // Collect all recompressed images
  const allRecompressedImages: RecompressedImage[] = [];

  // Process JPEG images
  const jpegImages = images.filter(img => img.format === 'jpeg');
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
    downsampleSaved = downsampleSavings;
    imageSaved = totalSavings - downsampleSavings;

    if (totalSavings > 0) {
      report.methodsSuccessful.push('recompressImages');
      log('success', `Recompressed ${imagesProcessed} JPEGs`, { savedBytes: totalSavings, downsampled: imagesDownsampled });
    } else {
      log('info', 'No savings from JPEG recompression');
    }

    allRecompressedImages.push(...recompressedImages);
  }

  // Convert PNG to JPEG
  const pngImages = images.filter(img => img.format === 'png');
  if (pngImages.length > 0 && options.pngToJpeg) {
    report.methodsUsed.push('pngToJpeg');
    onProgress?.(`Converting ${pngImages.length} PNG images to JPEG...`);
    log('info', `Converting ${pngImages.length} PNGs to JPEG...`);

    const { results: convertedPngs, savings } = await convertPngsToJpeg(
      pngImages,
      settings.quality,
      onProgress
    );

    pngsConverted = convertedPngs.length;
    pngToJpegSaved = savings;
    allRecompressedImages.push(...convertedPngs);

    if (savings > 0) {
      report.methodsSuccessful.push('pngToJpeg');
      log('success', `Converted ${pngsConverted} PNGs`, { savedBytes: savings });
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

  // Working buffer for further processing
  let workingBuffer = recompressedImageBytes
    ? (recompressedImageBytes.buffer as ArrayBuffer)
    : arrayBuffer;

  // Remove alpha channels
  if (options.removeAlphaChannels) {
    report.methodsUsed.push('removeAlphaChannels');
    const { pdfDoc: alphaDoc } = await loadPdf(workingBuffer);
    const alphaResult = removeAlphaChannels(alphaDoc);
    alphaSaved = alphaResult.savedBytes;
    if (alphaResult.processed > 0) {
      log('success', `Removed alpha channels from ${alphaResult.processed} images`);
      const alphaBytes = await alphaDoc.save({ useObjectStreams: false });
      workingBuffer = alphaBytes.buffer as ArrayBuffer;
    }
  }

  // Remove ICC profiles
  if (options.removeColorProfiles) {
    report.methodsUsed.push('removeColorProfiles');
    const { pdfDoc: iccDoc } = await loadPdf(workingBuffer);
    const iccResult = removeIccProfiles(iccDoc);
    iccSaved = iccResult.savedBytes;
    if (iccResult.removed > 0) {
      log('success', `Removed ${iccResult.removed} ICC profiles`);
      const iccBytes = await iccDoc.save({ useObjectStreams: false });
      workingBuffer = iccBytes.buffer as ArrayBuffer;
    }
  }

  // Convert CMYK to RGB
  if (options.cmykToRgb) {
    report.methodsUsed.push('cmykToRgb');
    const { pdfDoc: cmykDoc } = await loadPdf(workingBuffer);
    const cmykResult = await convertCmykToRgb(cmykDoc, settings.quality, onProgress);
    cmykSaved = cmykResult.savedBytes;
    if (cmykResult.converted > 0) {
      log('success', `Converted ${cmykResult.converted} CMYK images to RGB`);
      const cmykBytes = await cmykDoc.save({ useObjectStreams: false });
      workingBuffer = cmykBytes.buffer as ArrayBuffer;
    }
  }

  // Remove duplicate resources
  if (options.removeDuplicateResources) {
    report.methodsUsed.push('removeDuplicateResources');
    onProgress?.('Removing duplicate resources...');
    const { pdfDoc: dedupDoc } = await loadPdf(workingBuffer);
    const dedupResult = removeDuplicateResources(dedupDoc);
    duplicateSaved = dedupResult.bytesEstimatedSaved;
    if (dedupResult.duplicatesFound > 0) {
      report.methodsSuccessful.push('removeDuplicateResources');
      log('success', `Removed ${dedupResult.duplicatesFound} duplicate resources`, { saved: duplicateSaved });
      const dedupBytes = await dedupDoc.save({ useObjectStreams: false });
      workingBuffer = dedupBytes.buffer as ArrayBuffer;
    } else {
      log('info', 'No duplicate resources found');
    }
  }

  // Remove unused fonts
  if (options.removeUnusedFonts) {
    report.methodsUsed.push('removeUnusedFonts');
    onProgress?.('Removing unused fonts...');
    const { pdfDoc: fontDoc } = await loadPdf(workingBuffer);
    const sizeBefore = (await fontDoc.save({ useObjectStreams: false })).byteLength;
    const fontResult = removeUnusedFonts(fontDoc);
    if (fontResult.fontsRemoved > 0) {
      report.methodsSuccessful.push('removeUnusedFonts');
      log('success', `Removed ${fontResult.fontsRemoved} unused fonts`, { fonts: fontResult.fontNames });
      const fontBytes = await fontDoc.save({ useObjectStreams: false });
      fontSaved = Math.max(0, sizeBefore - fontBytes.byteLength);
      workingBuffer = fontBytes.buffer as ArrayBuffer;
    } else {
      log('info', 'No unused fonts found');
    }
  }

  // Convert inline images to XObjects (2.2)
  if (options.inlineToXObject) {
    report.methodsUsed.push('inlineToXObject');
    const { pdfDoc: inlineDoc } = await loadPdf(workingBuffer);
    const inlineResult = await convertInlineImagesToXObjects(inlineDoc, onProgress);
    inlineToXObjectSaved = inlineResult.savedBytes;
    if (inlineResult.converted > 0) {
      log('success', `Converted ${inlineResult.converted} inline images to XObjects`);
      const inlineBytes = await inlineDoc.save({ useObjectStreams: false });
      workingBuffer = inlineBytes.buffer as ArrayBuffer;
    }
  }

  // Compress content streams (2.3)
  if (options.compressContentStreams) {
    report.methodsUsed.push('compressContentStreams');
    const { pdfDoc: streamDoc } = await loadPdf(workingBuffer);
    const streamResult = await compressContentStreams(streamDoc, onProgress);
    contentStreamSaved = streamResult.savedBytes;
    if (streamResult.streamsCompressed > 0) {
      log('success', `Compressed ${streamResult.streamsCompressed} content streams`);
      const streamBytes = await streamDoc.save({ useObjectStreams: false });
      workingBuffer = streamBytes.buffer as ArrayBuffer;
    }
  }

  // Remove orphan objects (2.4)
  if (options.removeOrphanObjects) {
    report.methodsUsed.push('removeOrphanObjects');
    const { pdfDoc: orphanDoc } = await loadPdf(workingBuffer);
    const orphanResult = await removeOrphanObjects(orphanDoc, onProgress);
    orphansSaved = orphanResult.savedBytes;
    if (orphanResult.orphansRemoved > 0) {
      report.methodsSuccessful.push('removeOrphanObjects');
      log('success', `Removed ${orphanResult.orphansRemoved} orphan objects`);
      const orphanBytes = await orphanDoc.save({ useObjectStreams: false });
      workingBuffer = orphanBytes.buffer as ArrayBuffer;
    }
  }

  // Remove alternate content (2.5)
  if (options.removeAlternateContent) {
    report.methodsUsed.push('removeAlternateContent');
    const { pdfDoc: altDoc } = await loadPdf(workingBuffer);
    const altResult = await removeAlternateContent(altDoc, onProgress);
    alternateSaved = altResult.savedBytes;
    if (altResult.alternatesRemoved > 0 || altResult.printOnlyRemoved > 0 || altResult.screenOnlyRemoved > 0) {
      log('success', `Removed alternate content objects`);
      const altBytes = await altDoc.save({ useObjectStreams: false });
      workingBuffer = altBytes.buffer as ArrayBuffer;
    }
  }

  // Remove invisible text (2.6)
  if (options.removeInvisibleText) {
    report.methodsUsed.push('removeInvisibleText');
    const { pdfDoc: invisDoc } = await loadPdf(workingBuffer);
    const invisResult = await removeInvisibleText(invisDoc, onProgress);
    invisibleTextSaved = invisResult.savedBytes;
    if (invisResult.pagesProcessed > 0) {
      log('success', `Removed invisible text from ${invisResult.pagesProcessed} pages`);
      const invisBytes = await invisDoc.save({ useObjectStreams: false });
      workingBuffer = invisBytes.buffer as ArrayBuffer;
    }
  }

  onProgress?.('Applying structure cleanup...');

  // Measure each structure cleanup method individually for accurate per-method savings
  // Uses a cached size to avoid redundant save() calls (1 save per method instead of 2)
  const structSavings: Record<string, number> = {};
  let structAttachmentsRemoved = 0;

  const { pdfDoc: structDoc } = await loadPdf(workingBuffer);
  let lastStructSize = (await structDoc.save({ useObjectStreams: false })).byteLength;

  // Helper: measure a single method's incremental savings, reusing the previous size
  const measureStructMethod = async (
    key: string,
    enabled: boolean,
    apply: (doc: PDFDocument) => void | number
  ) => {
    if (!enabled) {
      structSavings[key] = 0;
      return;
    }
    report.methodsUsed.push(key);
    const before = lastStructSize;
    const result = apply(structDoc);
    lastStructSize = (await structDoc.save({ useObjectStreams: false })).byteLength;
    const saved = Math.max(0, before - lastStructSize);
    structSavings[key] = saved;
    if (saved > 0) {
      report.methodsSuccessful.push(key);
      // Clean key for display (camelCase to words approx)
      log('success', `Applied cleanup: ${key}`, { saved });
    }
    return result;
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

  // Measure metadata savings and build final PDF on the same document
  // (avoids an extra load+save round-trip by reusing structDoc)
  let metaSaved = 0;
  if (options.stripMetadata) {
    report.methodsUsed.push('stripMetadata');
    const preMetaSize = lastStructSize;
    stripMetadata(structDoc);
    lastStructSize = (await structDoc.save({ useObjectStreams: false })).byteLength;
    metaSaved = Math.max(0, preMetaSize - lastStructSize);
    if (metaSaved > 0) log('success', 'Stripped standard metadata');
  }

  // Final save — measure object streams savings by comparing with/without
  const withoutOsSize = lastStructSize;
  const fullCompressedBytes = await structDoc.save({
    useObjectStreams: options.useObjectStreams,
  });

  const osSaved = options.useObjectStreams
    ? Math.max(0, withoutOsSize - fullCompressedBytes.byteLength)
    : 0;

  if (options.useObjectStreams && osSaved > 0) {
    report.methodsUsed.push('useObjectStreams');
    report.methodsSuccessful.push('useObjectStreams');
    log('success', 'Applied Object Streams compression', { saved: osSaved });
  }

  // Build method results with actual measured savings
  const methodResults: MethodResult[] = [
    {
      key: 'useObjectStreams',
      savedBytes: osSaved,
      compressedSize: originalSize - osSaved,
    },
    {
      key: 'stripMetadata',
      savedBytes: metaSaved,
      compressedSize: originalSize - metaSaved,
    },
    {
      key: 'recompressImages',
      savedBytes: imageSaved,
      compressedSize: baselineSize - imageSaved,
      details: { imagesProcessed, imagesSkipped },
    },
    {
      key: 'downsampleImages',
      savedBytes: downsampleSaved,
      compressedSize: baselineSize - downsampleSaved,
      details: { imagesProcessed: imagesDownsampled, imagesSkipped: imagesProcessed - imagesDownsampled },
    },
    { key: 'convertToGrayscale', savedBytes: 0, compressedSize: baselineSize }, // Savings included in recompressImages
    {
      key: 'pngToJpeg',
      savedBytes: pngToJpegSaved,
      compressedSize: baselineSize - pngToJpegSaved,
      details: { imagesProcessed: pngsConverted, imagesSkipped: pngImages.length - pngsConverted },
    },
    { key: 'convertToMonochrome', savedBytes: 0, compressedSize: baselineSize }, // Savings included in recompressImages
    {
      key: 'removeAlphaChannels',
      savedBytes: alphaSaved,
      compressedSize: baselineSize - alphaSaved,
    },
    {
      key: 'removeColorProfiles',
      savedBytes: iccSaved,
      compressedSize: baselineSize - iccSaved,
    },
    {
      key: 'cmykToRgb',
      savedBytes: cmykSaved,
      compressedSize: baselineSize - cmykSaved,
    },
    // Structure cleanup with individually measured savings
    {
      key: 'removeThumbnails',
      savedBytes: structSavings['removeThumbnails'] ?? 0,
      compressedSize: baselineSize - (structSavings['removeThumbnails'] ?? 0),
    },
    {
      key: 'removeDuplicateResources',
      savedBytes: duplicateSaved,
      compressedSize: baselineSize - duplicateSaved,
    },
    {
      key: 'removeUnusedFonts',
      savedBytes: fontSaved,
      compressedSize: baselineSize - fontSaved,
    },
    {
      key: 'removeAttachments',
      savedBytes: structSavings['removeAttachments'] ?? 0,
      compressedSize: baselineSize - (structSavings['removeAttachments'] ?? 0),
      details: { imagesProcessed: structAttachmentsRemoved },
    },
    {
      key: 'flattenForms',
      savedBytes: structSavings['flattenForms'] ?? 0,
      compressedSize: baselineSize - (structSavings['flattenForms'] ?? 0),
    },
    {
      key: 'flattenAnnotations',
      savedBytes: structSavings['flattenAnnotations'] ?? 0,
      compressedSize: baselineSize - (structSavings['flattenAnnotations'] ?? 0),
    },
    {
      key: 'removeJavaScript',
      savedBytes: structSavings['removeJavaScript'] ?? 0,
      compressedSize: baselineSize - (structSavings['removeJavaScript'] ?? 0),
    },
    {
      key: 'removeBookmarks',
      savedBytes: structSavings['removeBookmarks'] ?? 0,
      compressedSize: baselineSize - (structSavings['removeBookmarks'] ?? 0),
    },
    {
      key: 'removeNamedDestinations',
      savedBytes: structSavings['removeNamedDestinations'] ?? 0,
      compressedSize: baselineSize - (structSavings['removeNamedDestinations'] ?? 0),
    },
    {
      key: 'removeArticleThreads',
      savedBytes: structSavings['removeArticleThreads'] ?? 0,
      compressedSize: baselineSize - (structSavings['removeArticleThreads'] ?? 0),
    },
    {
      key: 'removeWebCaptureInfo',
      savedBytes: structSavings['removeWebCaptureInfo'] ?? 0,
      compressedSize: baselineSize - (structSavings['removeWebCaptureInfo'] ?? 0),
    },
    {
      key: 'removeHiddenLayers',
      savedBytes: structSavings['removeHiddenLayers'] ?? 0,
      compressedSize: baselineSize - (structSavings['removeHiddenLayers'] ?? 0),
    },
    {
      key: 'removePageLabels',
      savedBytes: structSavings['removePageLabels'] ?? 0,
      compressedSize: baselineSize - (structSavings['removePageLabels'] ?? 0),
    },
    {
      key: 'deepCleanMetadata',
      savedBytes: structSavings['deepCleanMetadata'] ?? 0,
      compressedSize: baselineSize - (structSavings['deepCleanMetadata'] ?? 0),
    },
    // Advanced optimization methods
    {
      key: 'inlineToXObject',
      savedBytes: inlineToXObjectSaved,
      compressedSize: baselineSize - inlineToXObjectSaved,
    },
    {
      key: 'compressContentStreams',
      savedBytes: contentStreamSaved,
      compressedSize: baselineSize - contentStreamSaved,
    },
    {
      key: 'removeOrphanObjects',
      savedBytes: orphansSaved,
      compressedSize: baselineSize - orphansSaved,
    },
    {
      key: 'removeAlternateContent',
      savedBytes: alternateSaved,
      compressedSize: baselineSize - alternateSaved,
    },
    {
      key: 'removeInvisibleText',
      savedBytes: invisibleTextSaved,
      compressedSize: baselineSize - invisibleTextSaved,
    },
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
