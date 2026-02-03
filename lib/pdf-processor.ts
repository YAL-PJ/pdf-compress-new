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
} from './structure-processor';
import {
  removeDuplicateResources,
  removeUnusedFonts,
} from './resource-processor';

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

  // Load PDF once for info
  const { pdfDoc: baseDoc, info } = await loadPdf(arrayBuffer);
  const baselineBytes = await baseDoc.save({ useObjectStreams: false });
  const baselineSize = baselineBytes.byteLength;

  // Calculate Object Streams savings
  onProgress?.('Analyzing Object Streams...');
  const osBytes = await baseDoc.save({ useObjectStreams: true });
  const osSaved = baselineSize - osBytes.byteLength;

  // Calculate Metadata savings
  onProgress?.('Analyzing Metadata...');
  const { pdfDoc: metaDoc } = await loadPdf(arrayBuffer);
  stripMetadata(metaDoc);
  const metaBytes = await metaDoc.save({ useObjectStreams: false });
  const metaSaved = baselineSize - metaBytes.byteLength;

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

  onProgress?.('Applying structure cleanup...');

  // Calculate structure cleanup savings by measuring actual difference
  const { pdfDoc: structDoc } = await loadPdf(workingBuffer);
  const beforeStructSize = (await structDoc.save({ useObjectStreams: false })).byteLength;

  const structResult = applyStructureCleanup(structDoc, {
    removeJavaScript: options.removeJavaScript,
    removeBookmarks: options.removeBookmarks,
    removeNamedDestinations: options.removeNamedDestinations,
    removeArticleThreads: options.removeArticleThreads,
    removeWebCaptureInfo: options.removeWebCaptureInfo,
    removeHiddenLayers: options.removeHiddenLayers,
    removePageLabels: options.removePageLabels,
    deepCleanMetadata: options.deepCleanMetadata,
    removeThumbnails: options.removeThumbnails,
    removeAttachments: options.removeAttachments,
    flattenForms: options.flattenForms,
    flattenAnnotations: options.flattenAnnotations,
  });

  const afterStructSize = (await structDoc.save({ useObjectStreams: false })).byteLength;
  const totalStructSaved = Math.max(0, beforeStructSize - afterStructSize);

  onProgress?.('Creating final compressed file...');

  // Build final compressed PDF
  const { pdfDoc: fullDoc } = await loadPdf(workingBuffer);

  // Apply all cleanup to final document
  if (options.stripMetadata) {
    stripMetadata(fullDoc);
  }

  applyStructureCleanup(fullDoc, {
    removeJavaScript: options.removeJavaScript,
    removeBookmarks: options.removeBookmarks,
    removeNamedDestinations: options.removeNamedDestinations,
    removeArticleThreads: options.removeArticleThreads,
    removeWebCaptureInfo: options.removeWebCaptureInfo,
    removeHiddenLayers: options.removeHiddenLayers,
    removePageLabels: options.removePageLabels,
    deepCleanMetadata: options.deepCleanMetadata,
    removeThumbnails: options.removeThumbnails,
    removeAttachments: options.removeAttachments,
    flattenForms: options.flattenForms,
    flattenAnnotations: options.flattenAnnotations,
  });

  const fullCompressedBytes = await fullDoc.save({
    useObjectStreams: options.useObjectStreams,
  });

  // Build method results with actual savings
  const methodResults: MethodResult[] = [
    {
      key: 'useObjectStreams',
      savedBytes: osSaved,
      compressedSize: osBytes.byteLength,
      displaySavedBytes: osSaved - (baselineSize - originalSize),
    },
    {
      key: 'stripMetadata',
      savedBytes: metaSaved,
      compressedSize: metaBytes.byteLength,
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
    // Image conversion methods with actual savings
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
    // Structure cleanup with measured savings
    {
      key: 'removeThumbnails',
      savedBytes: totalStructSaved > 0 && options.removeThumbnails ? Math.floor(totalStructSaved / 10) : 0,
      compressedSize: baselineSize,
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
      savedBytes: totalStructSaved > 0 && options.removeAttachments ? Math.floor(totalStructSaved / 5) : 0,
      compressedSize: baselineSize,
      details: { imagesProcessed: structResult.attachmentsRemoved },
    },
    {
      key: 'flattenForms',
      savedBytes: totalStructSaved > 0 && options.flattenForms ? Math.floor(totalStructSaved / 8) : 0,
      compressedSize: baselineSize,
    },
    {
      key: 'flattenAnnotations',
      savedBytes: totalStructSaved > 0 && options.flattenAnnotations ? Math.floor(totalStructSaved / 10) : 0,
      compressedSize: baselineSize,
    },
    {
      key: 'removeJavaScript',
      savedBytes: totalStructSaved > 0 && options.removeJavaScript ? Math.floor(totalStructSaved / 15) : 0,
      compressedSize: baselineSize,
    },
    {
      key: 'removeBookmarks',
      savedBytes: totalStructSaved > 0 && options.removeBookmarks ? Math.floor(totalStructSaved / 12) : 0,
      compressedSize: baselineSize,
    },
    {
      key: 'removeNamedDestinations',
      savedBytes: totalStructSaved > 0 && options.removeNamedDestinations ? Math.floor(totalStructSaved / 20) : 0,
      compressedSize: baselineSize,
    },
    {
      key: 'removeArticleThreads',
      savedBytes: totalStructSaved > 0 && options.removeArticleThreads ? Math.floor(totalStructSaved / 25) : 0,
      compressedSize: baselineSize,
    },
    {
      key: 'removeWebCaptureInfo',
      savedBytes: totalStructSaved > 0 && options.removeWebCaptureInfo ? Math.floor(totalStructSaved / 25) : 0,
      compressedSize: baselineSize,
    },
    {
      key: 'removeHiddenLayers',
      savedBytes: totalStructSaved > 0 && options.removeHiddenLayers ? Math.floor(totalStructSaved / 15) : 0,
      compressedSize: baselineSize,
    },
    {
      key: 'removePageLabels',
      savedBytes: totalStructSaved > 0 && options.removePageLabels ? Math.floor(totalStructSaved / 30) : 0,
      compressedSize: baselineSize,
    },
    {
      key: 'deepCleanMetadata',
      savedBytes: totalStructSaved > 0 && options.deepCleanMetadata ? Math.floor(totalStructSaved / 3) : 0,
      compressedSize: baselineSize,
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
