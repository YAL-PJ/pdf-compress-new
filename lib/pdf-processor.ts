/**
 * PDF Processor - Core compression logic using pdf-lib
 */

import { PDFDocument } from 'pdf-lib';
import type { PdfInfo, MethodResult, ImageCompressionSettings } from './types';
import { DEFAULT_IMAGE_SETTINGS } from './types';
import {
  extractImages,
  recompressImages,
  embedRecompressedImages,
  calculateImageSavings,
  type ImageStats,
} from './image-processor';

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

/**
 * Analyze PDF - now includes image recompression
 */
export const analyzePdf = async (
  arrayBuffer: ArrayBuffer,
  onProgress?: ProgressCallback,
  imageSettings: ImageCompressionSettings = DEFAULT_IMAGE_SETTINGS
): Promise<{
  originalSize: number;
  pageCount: number;
  baselineSize: number;
  fullCompressedBytes: Uint8Array;
  methodResults: MethodResult[];
  imageStats?: ImageStats;
}> => {
  const originalSize = arrayBuffer.byteLength;

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

  // 3. Metadata
  const { pdfDoc: metaDoc } = await loadPdf(arrayBuffer);
  stripMetadata(metaDoc);
  const metaBytes = await metaDoc.save({ useObjectStreams: false });
  const metaSaved = baselineSize - metaBytes.byteLength;

  // 4. Image recompression and downsampling
  onProgress?.('Analyzing images...');
  const { pdfDoc: imgDoc } = await loadPdf(arrayBuffer);
  const { images, stats: imageStats } = await extractImages(imgDoc, onProgress, imageSettings.targetDpi);

  let imageSaved = 0;
  let downsampleSaved = 0;
  let recompressedImageBytes: Uint8Array | null = null;
  let imagesProcessed = 0;
  let imagesSkipped = 0;
  let imagesDownsampled = 0;

  if (images.length > 0) {
    onProgress?.(`Found ${images.length} JPEG images, recompressing...`);

    const { results: recompressedImages, downsampleSavings } = await recompressImages(images, imageSettings, onProgress);

    imagesProcessed = recompressedImages.length;
    imagesSkipped = images.length - imagesProcessed;
    imagesDownsampled = recompressedImages.filter(img => img.wasDownsampled).length;

    const totalSavings = calculateImageSavings(recompressedImages);

    // Separate downsampling savings from recompression savings
    downsampleSaved = downsampleSavings;
    imageSaved = totalSavings - downsampleSavings; // Recompression-only savings

    if (recompressedImages.length > 0) {
      onProgress?.('Building compressed PDF with optimized images...');
      recompressedImageBytes = await embedRecompressedImages(
        arrayBuffer,
        recompressedImages,
        onProgress
      );
    }
  }

  onProgress?.('Creating final compressed file...');

  // 5. Full compression
  let fullCompressedBytes: Uint8Array;

  if (recompressedImageBytes) {
    const { pdfDoc: fullDoc } = await loadPdf(recompressedImageBytes.buffer as ArrayBuffer);
    stripMetadata(fullDoc);
    fullCompressedBytes = await fullDoc.save({ useObjectStreams: true });
  } else {
    const { pdfDoc: fullDoc } = await loadPdf(arrayBuffer);
    stripMetadata(fullDoc);
    fullCompressedBytes = await fullDoc.save({ useObjectStreams: true });
  }

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
