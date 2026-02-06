/**
 * PDF Processor - Core compression logic using pdf-lib
 * Full Phase 2 implementation with all compression methods
 */

import { PDFDocument } from 'pdf-lib';
import type { PdfInfo, MethodResult, ImageCompressionSettings, CompressionOptions, RecompressedImage } from './types';
import { DEFAULT_IMAGE_SETTINGS, DEFAULT_COMPRESSION_OPTIONS } from './types';
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
  applyStructureCleanup,
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
}> => {
  const originalSize = arrayBuffer.byteLength;
  const options = settings.options ?? DEFAULT_COMPRESSION_OPTIONS;

  onProgress?.('Reading PDF...');

  // Load PDF once for info and baseline
  const { pdfDoc: baseDoc, info } = await loadPdf(arrayBuffer);
  const baselineBytes = await baseDoc.save({ useObjectStreams: false });
  const baselineSize = baselineBytes.byteLength;

  // Image processing - extract both JPEG and PNG if needed
  onProgress?.('Analyzing images...');
  const { pdfDoc: imgDoc } = await loadPdf(arrayBuffer);
  const extractPng = options.pngToJpeg;
  const { images, stats: imageStats } = await extractImages(imgDoc, onProgress, settings.targetDpi, extractPng);

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
    onProgress?.(`Processing ${jpegImages.length} JPEG images...`);

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

    allRecompressedImages.push(...recompressedImages);
  }

  // Convert PNG to JPEG
  const pngImages = images.filter(img => img.format === 'png');
  if (pngImages.length > 0 && options.pngToJpeg) {
    onProgress?.(`Converting ${pngImages.length} PNG images to JPEG...`);

    const { results: convertedPngs, savings } = await convertPngsToJpeg(
      pngImages,
      settings.quality,
      onProgress
    );

    pngsConverted = convertedPngs.length;
    pngToJpegSaved = savings;
    allRecompressedImages.push(...convertedPngs);
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
    onProgress?.('Removing alpha channels...');
    const { pdfDoc: alphaDoc } = await loadPdf(workingBuffer);
    const alphaResult = removeAlphaChannels(alphaDoc);
    alphaSaved = alphaResult.savedBytes;
    if (alphaResult.processed > 0) {
      const alphaBytes = await alphaDoc.save({ useObjectStreams: false });
      workingBuffer = alphaBytes.buffer as ArrayBuffer;
    }
  }

  // Remove ICC profiles
  if (options.removeColorProfiles) {
    onProgress?.('Removing ICC color profiles...');
    const { pdfDoc: iccDoc } = await loadPdf(workingBuffer);
    const iccResult = removeIccProfiles(iccDoc);
    iccSaved = iccResult.savedBytes;
    if (iccResult.removed > 0) {
      const iccBytes = await iccDoc.save({ useObjectStreams: false });
      workingBuffer = iccBytes.buffer as ArrayBuffer;
    }
  }

  // Convert CMYK to RGB
  if (options.cmykToRgb) {
    onProgress?.('Converting CMYK images to RGB...');
    const { pdfDoc: cmykDoc } = await loadPdf(workingBuffer);
    const cmykResult = await convertCmykToRgb(cmykDoc, settings.quality, onProgress);
    cmykSaved = cmykResult.savedBytes;
    if (cmykResult.converted > 0) {
      const cmykBytes = await cmykDoc.save({ useObjectStreams: false });
      workingBuffer = cmykBytes.buffer as ArrayBuffer;
    }
  }

  // Remove duplicate resources
  if (options.removeDuplicateResources) {
    onProgress?.('Removing duplicate resources...');
    const { pdfDoc: dedupDoc } = await loadPdf(workingBuffer);
    const dedupResult = removeDuplicateResources(dedupDoc);
    duplicateSaved = dedupResult.bytesEstimatedSaved;
    if (dedupResult.duplicatesFound > 0) {
      const dedupBytes = await dedupDoc.save({ useObjectStreams: false });
      workingBuffer = dedupBytes.buffer as ArrayBuffer;
    }
  }

  // Remove unused fonts
  if (options.removeUnusedFonts) {
    onProgress?.('Removing unused fonts...');
    const { pdfDoc: fontDoc } = await loadPdf(workingBuffer);
    const sizeBefore = (await fontDoc.save({ useObjectStreams: false })).byteLength;
    const fontResult = removeUnusedFonts(fontDoc);
    if (fontResult.fontsRemoved > 0) {
      const fontBytes = await fontDoc.save({ useObjectStreams: false });
      fontSaved = Math.max(0, sizeBefore - fontBytes.byteLength);
      workingBuffer = fontBytes.buffer as ArrayBuffer;
    }
  }

  // Convert inline images to XObjects (2.2)
  if (options.inlineToXObject) {
    onProgress?.('Converting inline images to XObjects...');
    const { pdfDoc: inlineDoc } = await loadPdf(workingBuffer);
    const inlineResult = await convertInlineImagesToXObjects(inlineDoc, onProgress);
    inlineToXObjectSaved = inlineResult.savedBytes;
    if (inlineResult.converted > 0) {
      const inlineBytes = await inlineDoc.save({ useObjectStreams: false });
      workingBuffer = inlineBytes.buffer as ArrayBuffer;
    }
  }

  // Compress content streams (2.3)
  if (options.compressContentStreams) {
    onProgress?.('Compressing content streams...');
    const { pdfDoc: streamDoc } = await loadPdf(workingBuffer);
    const streamResult = await compressContentStreams(streamDoc, onProgress);
    contentStreamSaved = streamResult.savedBytes;
    if (streamResult.streamsCompressed > 0) {
      const streamBytes = await streamDoc.save({ useObjectStreams: false });
      workingBuffer = streamBytes.buffer as ArrayBuffer;
    }
  }

  // Remove orphan objects (2.4)
  if (options.removeOrphanObjects) {
    onProgress?.('Removing orphan objects...');
    const { pdfDoc: orphanDoc } = await loadPdf(workingBuffer);
    const orphanResult = await removeOrphanObjects(orphanDoc, onProgress);
    orphansSaved = orphanResult.savedBytes;
    if (orphanResult.orphansRemoved > 0) {
      const orphanBytes = await orphanDoc.save({ useObjectStreams: false });
      workingBuffer = orphanBytes.buffer as ArrayBuffer;
    }
  }

  // Remove alternate content (2.5)
  if (options.removeAlternateContent) {
    onProgress?.('Removing alternate content...');
    const { pdfDoc: altDoc } = await loadPdf(workingBuffer);
    const altResult = await removeAlternateContent(altDoc, onProgress);
    alternateSaved = altResult.savedBytes;
    if (altResult.alternatesRemoved > 0 || altResult.printOnlyRemoved > 0 || altResult.screenOnlyRemoved > 0) {
      const altBytes = await altDoc.save({ useObjectStreams: false });
      workingBuffer = altBytes.buffer as ArrayBuffer;
    }
  }

  // Remove invisible text (2.6)
  if (options.removeInvisibleText) {
    onProgress?.('Removing invisible text...');
    const { pdfDoc: invisDoc } = await loadPdf(workingBuffer);
    const invisResult = await removeInvisibleText(invisDoc, onProgress);
    invisibleTextSaved = invisResult.savedBytes;
    if (invisResult.pagesProcessed > 0) {
      const invisBytes = await invisDoc.save({ useObjectStreams: false });
      workingBuffer = invisBytes.buffer as ArrayBuffer;
    }
  }

  onProgress?.('Applying structure cleanup...');

  // Measure each structure cleanup method individually for accurate per-method savings
  const structSavings: Record<string, number> = {};
  let structAttachmentsRemoved = 0;

  const { pdfDoc: structDoc } = await loadPdf(workingBuffer);

  // Helper: measure a single structure method's incremental savings
  const measureStructMethod = async (
    key: string,
    enabled: boolean,
    apply: (doc: PDFDocument) => void | number
  ) => {
    if (!enabled) {
      structSavings[key] = 0;
      return;
    }
    const before = (await structDoc.save({ useObjectStreams: false })).byteLength;
    const result = apply(structDoc);
    const after = (await structDoc.save({ useObjectStreams: false })).byteLength;
    structSavings[key] = Math.max(0, before - after);
    return result;
  };

  // Apply each method incrementally, measuring the delta
  await measureStructMethod('removeJavaScript', options.removeJavaScript, (doc) => removeJS(doc));
  await measureStructMethod('removeBookmarks', options.removeBookmarks, (doc) => removeBM(doc));
  await measureStructMethod('removeNamedDestinations', options.removeNamedDestinations, (doc) => removeND(doc));
  await measureStructMethod('removeArticleThreads', options.removeArticleThreads, (doc) => removeAT(doc));
  await measureStructMethod('removeWebCaptureInfo', options.removeWebCaptureInfo, (doc) => removeWC(doc));
  await measureStructMethod('removeHiddenLayers', options.removeHiddenLayers, (doc) => removeHL(doc));
  await measureStructMethod('removePageLabels', options.removePageLabels, (doc) => removePL(doc));
  await measureStructMethod('deepCleanMetadata', options.deepCleanMetadata, (doc) => deepCleanMD(doc));
  await measureStructMethod('removeThumbnails', options.removeThumbnails, (doc) => removeTN(doc));
  const attResult = await measureStructMethod('removeAttachments', options.removeAttachments, (doc) => removeATT(doc));
  if (typeof attResult === 'number') structAttachmentsRemoved = attResult;
  await measureStructMethod('flattenForms', options.flattenForms, (doc) => flattenFM(doc));
  await measureStructMethod('flattenAnnotations', options.flattenAnnotations, (doc) => flattenAN(doc));

  // Save struct doc state as the working buffer for final save
  const structBytes = await structDoc.save({ useObjectStreams: false });
  workingBuffer = structBytes.buffer as ArrayBuffer;

  onProgress?.('Creating final compressed file...');

  // Build final compressed PDF and measure metadata + object streams savings
  const { pdfDoc: fullDoc } = await loadPdf(workingBuffer);

  // Measure metadata savings on the fully processed document
  let metaSaved = 0;
  if (options.stripMetadata) {
    const preMetaSize = (await fullDoc.save({ useObjectStreams: false })).byteLength;
    stripMetadata(fullDoc);
    const postMetaSize = (await fullDoc.save({ useObjectStreams: false })).byteLength;
    metaSaved = Math.max(0, preMetaSize - postMetaSize);
  }

  // Save without object streams to measure OS savings accurately
  const withoutOsSize = (await fullDoc.save({ useObjectStreams: false })).byteLength;

  const fullCompressedBytes = await fullDoc.save({
    useObjectStreams: options.useObjectStreams,
  });

  // Measure object streams savings on the fully processed document
  const osSaved = options.useObjectStreams
    ? Math.max(0, withoutOsSize - fullCompressedBytes.byteLength)
    : 0;

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

  return {
    originalSize,
    pageCount: info.pageCount,
    baselineSize,
    fullCompressedBytes,
    methodResults,
    imageStats,
  };
};
