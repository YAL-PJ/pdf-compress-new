/**
 * PDF Processor - Core compression logic using pdf-lib
 * Supports all Phase 2 compression methods
 */

import { PDFDocument } from 'pdf-lib';
import type { PdfInfo, MethodResult, ImageCompressionSettings, CompressionOptions } from './types';
import { DEFAULT_IMAGE_SETTINGS, DEFAULT_COMPRESSION_OPTIONS } from './types';
import {
  extractImages,
  recompressImages,
  embedRecompressedImages,
  calculateImageSavings,
  type ImageStats,
  type ExtendedImageSettings,
  recompressImagesExtended,
} from './image-processor';
import {
  removeJavaScript,
  removeBookmarks,
  removeNamedDestinations,
  removeArticleThreads,
  removeWebCaptureInfo,
  removeHiddenLayers,
  removePageLabels,
  deepCleanMetadata,
  removeThumbnails,
  removeAttachments,
  flattenForms,
  flattenAnnotations,
  removeUnusedFonts,
  removeDuplicateResources,
  removeColorProfiles,
} from './structure-processor';

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
 * Analyze PDF - includes all Phase 2 compression methods
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

  // 1. Baseline
  const { pdfDoc: baseDoc, info } = await loadPdf(arrayBuffer);
  const baselineBytes = await baseDoc.save({ useObjectStreams: false });
  const baselineSize = baselineBytes.byteLength;

  onProgress?.('Analyzing Object Streams...');

  // 2. Object Streams
  const { pdfDoc: osDoc } = await loadPdf(arrayBuffer);
  const osBytes = await osDoc.save({ useObjectStreams: true });
  const osSaved = baselineSize - osBytes.byteLength;

  onProgress?.('Analyzing Metadata...');

  // 3. Basic Metadata
  const { pdfDoc: metaDoc } = await loadPdf(arrayBuffer);
  stripMetadata(metaDoc);
  const metaBytes = await metaDoc.save({ useObjectStreams: false });
  const metaSaved = baselineSize - metaBytes.byteLength;

  // 4. Image recompression and downsampling
  onProgress?.('Analyzing images...');
  const { pdfDoc: imgDoc } = await loadPdf(arrayBuffer);
  const { images, stats: imageStats } = await extractImages(imgDoc, onProgress, settings.targetDpi);

  let imageSaved = 0;
  let downsampleSaved = 0;
  let grayscaleSaved = 0;
  let monochromeSaved = 0;
  let recompressedImageBytes: Uint8Array | null = null;
  let imagesProcessed = 0;
  let imagesSkipped = 0;
  let imagesDownsampled = 0;

  if (images.length > 0) {
    onProgress?.(`Found ${images.length} JPEG images, processing...`);

    // Build extended settings
    const extendedSettings: ExtendedImageSettings = {
      ...settings,
      convertToGrayscale: options.convertToGrayscale,
      convertToMonochrome: options.convertToMonochrome,
      removeAlphaChannels: options.removeAlphaChannels,
    };

    const {
      results: recompressedImages,
      downsampleSavings,
      grayscaleSavings,
      monochromeSavings,
    } = await recompressImagesExtended(images, extendedSettings, onProgress);

    imagesProcessed = recompressedImages.length;
    imagesSkipped = images.length - imagesProcessed;
    imagesDownsampled = recompressedImages.filter(img => img.wasDownsampled).length;

    const totalSavings = calculateImageSavings(recompressedImages);

    // Separate savings by method
    downsampleSaved = downsampleSavings;
    grayscaleSaved = grayscaleSavings;
    monochromeSaved = monochromeSavings;
    imageSaved = totalSavings - downsampleSavings - grayscaleSavings - monochromeSavings;

    if (recompressedImages.length > 0) {
      onProgress?.('Building compressed PDF with optimized images...');
      recompressedImageBytes = await embedRecompressedImages(
        arrayBuffer,
        recompressedImages,
        onProgress
      );
    }
  }

  // 5. Structure cleanup methods
  onProgress?.('Analyzing structure...');

  // Analyze each structure method
  let jsSaved = 0;
  let bookmarksSaved = 0;
  let namedDestsSaved = 0;
  let articleThreadsSaved = 0;
  let webCaptureSaved = 0;
  let hiddenLayersSaved = 0;
  let pageLabelsSaved = 0;
  let deepMetadataSaved = 0;
  let thumbnailsSaved = 0;
  let attachmentsSaved = 0;
  let attachmentsCount = 0;
  let formsSaved = 0;
  let annotationsSaved = 0;
  let unusedFontsSaved = 0;
  let duplicateResourcesSaved = 0;
  let colorProfilesSaved = 0;

  // Analyze JavaScript removal
  if (options.removeJavaScript) {
    const { pdfDoc: jsDoc } = await loadPdf(arrayBuffer);
    jsSaved = removeJavaScript(jsDoc);
  }

  // Analyze Bookmarks removal
  if (options.removeBookmarks) {
    const { pdfDoc: bmDoc } = await loadPdf(arrayBuffer);
    bookmarksSaved = removeBookmarks(bmDoc);
  }

  // Analyze Named Destinations removal
  if (options.removeNamedDestinations) {
    const { pdfDoc: ndDoc } = await loadPdf(arrayBuffer);
    namedDestsSaved = removeNamedDestinations(ndDoc);
  }

  // Analyze Article Threads removal
  if (options.removeArticleThreads) {
    const { pdfDoc: atDoc } = await loadPdf(arrayBuffer);
    articleThreadsSaved = removeArticleThreads(atDoc);
  }

  // Analyze Web Capture removal
  if (options.removeWebCaptureInfo) {
    const { pdfDoc: wcDoc } = await loadPdf(arrayBuffer);
    webCaptureSaved = removeWebCaptureInfo(wcDoc);
  }

  // Analyze Hidden Layers removal
  if (options.removeHiddenLayers) {
    const { pdfDoc: hlDoc } = await loadPdf(arrayBuffer);
    hiddenLayersSaved = removeHiddenLayers(hlDoc);
  }

  // Analyze Page Labels removal
  if (options.removePageLabels) {
    const { pdfDoc: plDoc } = await loadPdf(arrayBuffer);
    pageLabelsSaved = removePageLabels(plDoc);
  }

  // Analyze Deep Metadata cleaning
  if (options.deepCleanMetadata) {
    const { pdfDoc: dmDoc } = await loadPdf(arrayBuffer);
    deepMetadataSaved = deepCleanMetadata(dmDoc);
  }

  // Analyze Thumbnails removal
  if (options.removeThumbnails) {
    const { pdfDoc: thDoc } = await loadPdf(arrayBuffer);
    thumbnailsSaved = removeThumbnails(thDoc);
  }

  // Analyze Attachments removal
  if (options.removeAttachments) {
    const { pdfDoc: attDoc } = await loadPdf(arrayBuffer);
    const result = removeAttachments(attDoc);
    attachmentsSaved = result.bytesRemoved;
    attachmentsCount = result.count;
  }

  // Analyze Form flattening
  if (options.flattenForms) {
    const { pdfDoc: formDoc } = await loadPdf(arrayBuffer);
    formsSaved = flattenForms(formDoc);
  }

  // Analyze Annotation flattening
  if (options.flattenAnnotations) {
    const { pdfDoc: annotDoc } = await loadPdf(arrayBuffer);
    annotationsSaved = flattenAnnotations(annotDoc);
  }

  // Analyze Unused Fonts
  if (options.removeUnusedFonts) {
    const { pdfDoc: fontDoc } = await loadPdf(arrayBuffer);
    unusedFontsSaved = removeUnusedFonts(fontDoc);
  }

  // Analyze Duplicate Resources
  if (options.removeDuplicateResources) {
    const { pdfDoc: dupDoc } = await loadPdf(arrayBuffer);
    duplicateResourcesSaved = await removeDuplicateResources(dupDoc, onProgress);
  }

  // Analyze Color Profiles
  if (options.removeColorProfiles) {
    const { pdfDoc: cpDoc } = await loadPdf(arrayBuffer);
    colorProfilesSaved = removeColorProfiles(cpDoc);
  }

  onProgress?.('Creating final compressed file...');

  // 6. Full compression - apply all enabled methods
  let fullCompressedBytes: Uint8Array;

  // Start with either recompressed images or original
  let workingBuffer = recompressedImageBytes
    ? recompressedImageBytes.buffer as ArrayBuffer
    : arrayBuffer;

  const { pdfDoc: fullDoc } = await loadPdf(workingBuffer);

  // Apply structure cleanup methods
  if (options.stripMetadata) {
    stripMetadata(fullDoc);
  }

  if (options.deepCleanMetadata) {
    deepCleanMetadata(fullDoc);
  }

  if (options.removeJavaScript) {
    removeJavaScript(fullDoc);
  }

  if (options.removeBookmarks) {
    removeBookmarks(fullDoc);
  }

  if (options.removeNamedDestinations) {
    removeNamedDestinations(fullDoc);
  }

  if (options.removeArticleThreads) {
    removeArticleThreads(fullDoc);
  }

  if (options.removeWebCaptureInfo) {
    removeWebCaptureInfo(fullDoc);
  }

  if (options.removeHiddenLayers) {
    removeHiddenLayers(fullDoc);
  }

  if (options.removePageLabels) {
    removePageLabels(fullDoc);
  }

  if (options.removeThumbnails) {
    removeThumbnails(fullDoc);
  }

  if (options.removeAttachments) {
    removeAttachments(fullDoc);
  }

  if (options.flattenForms) {
    flattenForms(fullDoc);
  }

  if (options.flattenAnnotations) {
    flattenAnnotations(fullDoc);
  }

  if (options.removeColorProfiles) {
    removeColorProfiles(fullDoc);
  }

  // Save with object streams optimization
  fullCompressedBytes = await fullDoc.save({
    useObjectStreams: options.useObjectStreams,
  });

  // Build method results for all methods
  const methodResults: MethodResult[] = [
    // Structure methods (Phase 1)
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

    // Image methods (Phase 2.1-2.2)
    {
      key: 'recompressImages',
      savedBytes: imageSaved,
      compressedSize: baselineSize - imageSaved,
      details: {
        imagesProcessed,
        imagesSkipped,
      },
    },
    {
      key: 'downsampleImages',
      savedBytes: downsampleSaved,
      compressedSize: baselineSize - downsampleSaved,
      details: {
        imagesProcessed: imagesDownsampled,
        imagesSkipped: imagesProcessed - imagesDownsampled,
      },
    },

    // Image methods (Phase 2.3-2.8)
    {
      key: 'convertToGrayscale',
      savedBytes: grayscaleSaved,
      compressedSize: baselineSize - grayscaleSaved,
    },
    {
      key: 'pngToJpeg',
      savedBytes: 0, // Not yet implemented
      compressedSize: baselineSize,
    },
    {
      key: 'convertToMonochrome',
      savedBytes: monochromeSaved,
      compressedSize: baselineSize - monochromeSaved,
    },
    {
      key: 'removeAlphaChannels',
      savedBytes: 0, // Savings included in image recompression
      compressedSize: baselineSize,
    },
    {
      key: 'removeColorProfiles',
      savedBytes: colorProfilesSaved,
      compressedSize: baselineSize - colorProfilesSaved,
    },
    {
      key: 'cmykToRgb',
      savedBytes: 0, // Not yet fully implemented
      compressedSize: baselineSize,
    },

    // Resources (Phase 2)
    {
      key: 'removeThumbnails',
      savedBytes: thumbnailsSaved,
      compressedSize: baselineSize - thumbnailsSaved,
    },
    {
      key: 'removeDuplicateResources',
      savedBytes: duplicateResourcesSaved,
      compressedSize: baselineSize - duplicateResourcesSaved,
    },
    {
      key: 'removeUnusedFonts',
      savedBytes: unusedFontsSaved,
      compressedSize: baselineSize - unusedFontsSaved,
    },
    {
      key: 'removeAttachments',
      savedBytes: attachmentsSaved,
      compressedSize: baselineSize - attachmentsSaved,
      details: {
        imagesProcessed: attachmentsCount,
      },
    },

    // Interactive (Phase 2.10-2.11)
    {
      key: 'flattenForms',
      savedBytes: formsSaved,
      compressedSize: baselineSize - formsSaved,
    },
    {
      key: 'flattenAnnotations',
      savedBytes: annotationsSaved,
      compressedSize: baselineSize - annotationsSaved,
    },

    // Structure cleanup (Phase 2.12-2.21)
    {
      key: 'removeJavaScript',
      savedBytes: jsSaved,
      compressedSize: baselineSize - jsSaved,
    },
    {
      key: 'removeBookmarks',
      savedBytes: bookmarksSaved,
      compressedSize: baselineSize - bookmarksSaved,
    },
    {
      key: 'removeNamedDestinations',
      savedBytes: namedDestsSaved,
      compressedSize: baselineSize - namedDestsSaved,
    },
    {
      key: 'removeArticleThreads',
      savedBytes: articleThreadsSaved,
      compressedSize: baselineSize - articleThreadsSaved,
    },
    {
      key: 'removeWebCaptureInfo',
      savedBytes: webCaptureSaved,
      compressedSize: baselineSize - webCaptureSaved,
    },
    {
      key: 'removeHiddenLayers',
      savedBytes: hiddenLayersSaved,
      compressedSize: baselineSize - hiddenLayersSaved,
    },
    {
      key: 'removePageLabels',
      savedBytes: pageLabelsSaved,
      compressedSize: baselineSize - pageLabelsSaved,
    },
    {
      key: 'deepCleanMetadata',
      savedBytes: deepMetadataSaved,
      compressedSize: baselineSize - deepMetadataSaved,
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
