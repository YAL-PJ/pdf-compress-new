/**
 * Image Processor for PDF Compression
 * JPEG-only recompression (safe, no transparency issues)
 */

import { PDFDocument, PDFName, PDFDict, PDFArray, PDFStream, PDFRawStream, PDFRef } from 'pdf-lib';
import type { ImageCompressionSettings, ExtractedImage, RecompressedImage } from './types';
import { IMAGE_COMPRESSION } from './constants';

export interface ImageStats {
  totalImages: number;
  jpegCount: number;
  pngCount: number;
  otherCount: number;
  totalOriginalSize: number;
}

export interface ImageExtractionResult {
  images: ExtractedImage[];
  stats: ImageStats;
}

/**
 * Check if stream uses DCTDecode (JPEG)
 */
const isJpegStream = (dict: PDFDict): boolean => {
  const filter = dict.get(PDFName.of('Filter'));

  if (filter instanceof PDFName) {
    return filter.toString() === '/DCTDecode';
  }

  if (filter instanceof PDFArray) {
    for (let i = 0; i < filter.size(); i++) {
      const f = filter.get(i);
      if (f instanceof PDFName && f.toString() === '/DCTDecode') {
        return true;
      }
    }
  }

  return false;
};

const getImageDimensions = (dict: PDFDict): { width: number; height: number } => {
  const width = dict.get(PDFName.of('Width'));
  const height = dict.get(PDFName.of('Height'));

  return {
    width: width ? Number(width.toString()) : 0,
    height: height ? Number(height.toString()) : 0,
  };
};

const getColorSpace = (dict: PDFDict): string => {
  const cs = dict.get(PDFName.of('ColorSpace'));
  if (cs instanceof PDFName) {
    return cs.toString().replace('/', '');
  }
  if (cs instanceof PDFArray && cs.size() > 0) {
    const first = cs.get(0);
    if (first instanceof PDFName) {
      return first.toString().replace('/', '');
    }
  }
  return 'DeviceRGB';
};

/**
 * Extract all images from PDF, collecting stats
 * Only extracts JPEGs for recompression
 */
export const extractImages = async (
  pdfDoc: PDFDocument,
  onProgress?: (message: string, percent?: number) => void
): Promise<ImageExtractionResult> => {
  const images: ExtractedImage[] = [];
  const stats: ImageStats = {
    totalImages: 0,
    jpegCount: 0,
    pngCount: 0,
    otherCount: 0,
    totalOriginalSize: 0,
  };

  onProgress?.('Scanning for images...', 0);

  // Get all indirect objects and find images
  const context = pdfDoc.context;
  const allRefs = context.enumerateIndirectObjects();

  for (const [ref, obj] of allRefs) {
    // Check if it's a stream
    if (!(obj instanceof PDFRawStream) && !(obj instanceof PDFStream)) {
      continue;
    }

    const stream = obj;
    const dict = stream.dict;

    // Check if it's an image XObject
    const type = dict.get(PDFName.of('Type'));
    const subtype = dict.get(PDFName.of('Subtype'));

    const isXObject = !type || (type instanceof PDFName && type.toString() === '/XObject');
    const isImage = subtype instanceof PDFName && subtype.toString() === '/Image';

    if (!isXObject || !isImage) {
      continue;
    }

    stats.totalImages++;
    const { width, height } = getImageDimensions(dict);
    const colorSpace = getColorSpace(dict);

    // Get raw bytes (for PDFRawStream this is the encoded data)
    let bytes: Uint8Array;
    if (stream instanceof PDFRawStream) {
      bytes = stream.contents;
    } else {
      bytes = stream.getContents();
    }

    const originalSize = bytes.length;
    stats.totalOriginalSize += originalSize;

    if (isJpegStream(dict)) {
      stats.jpegCount++;

      // Store ref as string for later lookup
      const refStr = `${ref.objectNumber}-${ref.generationNumber}`;

      images.push({
        ref: refStr,
        format: 'jpeg',
        bytes,
        width,
        height,
        colorSpace,
        bitsPerComponent: 8,
        pageIndex: 0,
        originalSize,
      });
    } else {
      // Count as PNG/other but don't extract for recompression
      const filter = dict.get(PDFName.of('Filter'));
      if (filter instanceof PDFName && filter.toString() === '/FlateDecode') {
        stats.pngCount++;
      } else {
        stats.otherCount++;
      }
    }
  }

  onProgress?.(`Found ${stats.jpegCount} JPEG images`, 100);

  return { images, stats };
};

/**
 * Recompress a JPEG image
 */
export const recompressJpeg = async (
  image: ExtractedImage,
  settings: ImageCompressionSettings
): Promise<RecompressedImage | null> => {
  // Skip tiny images
  if (image.originalSize < settings.minSizeThreshold) {
    return null;
  }

  // Skip oversized images
  if (
    image.width > IMAGE_COMPRESSION.MAX_CANVAS_DIMENSION ||
    image.height > IMAGE_COMPRESSION.MAX_CANVAS_DIMENSION ||
    image.width <= 0 ||
    image.height <= 0
  ) {
    return null;
  }

  try {
    // Create blob from JPEG bytes
    const blob = new Blob([image.bytes as any], { type: 'image/jpeg' });

    // Decode image
    const imageBitmap = await createImageBitmap(blob);

    // Create canvas at actual decoded dimensions (might differ from PDF dimensions)
    const canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      imageBitmap.close();
      return null;
    }

    ctx.drawImage(imageBitmap, 0, 0);
    imageBitmap.close();

    // Re-encode at target quality
    const quality = settings.quality / 100;
    const newBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
    const newBytes = new Uint8Array(await newBlob.arrayBuffer());

    const savedBytes = image.originalSize - newBytes.length;

    // Only use if we actually saved space (any amount)
    if (savedBytes > 0) {
      return {
        ref: image.ref,
        bytes: newBytes,
        width: imageBitmap.width,
        height: imageBitmap.height,
        newSize: newBytes.length,
        originalSize: image.originalSize,
        savedBytes,
      };
    }

    return null;
  } catch (err) {
    // Log error for debugging but don't crash
    console.warn('Failed to recompress image:', image.ref, err);
    return null;
  }
};

/**
 * Recompress all JPEG images
 */
export const recompressImages = async (
  images: ExtractedImage[],
  settings: ImageCompressionSettings,
  onProgress?: (message: string, percent?: number) => void
): Promise<RecompressedImage[]> => {
  const results: RecompressedImage[] = [];
  const total = images.length;

  if (total === 0) {
    return results;
  }

  onProgress?.(`Recompressing ${total} JPEG images...`, 0);

  // Process one at a time for stability
  for (let i = 0; i < total; i++) {
    const image = images[i];
    const result = await recompressJpeg(image, settings);

    if (result) {
      results.push(result);
    }

    const progress = Math.round(((i + 1) / total) * 100);
    onProgress?.(`Processed ${i + 1}/${total} images`, progress);
  }

  return results;
};

/**
 * Embed recompressed images back into PDF
 */
export const embedRecompressedImages = async (
  originalBuffer: ArrayBuffer,
  recompressedImages: RecompressedImage[],
  onProgress?: (message: string) => void
): Promise<Uint8Array> => {
  if (recompressedImages.length === 0) {
    const pdfDoc = await PDFDocument.load(originalBuffer);
    return pdfDoc.save({ useObjectStreams: true });
  }

  onProgress?.('Embedding recompressed images...');

  // Map ref string to recompressed data
  const imageMap = new Map<string, RecompressedImage>();
  for (const img of recompressedImages) {
    imageMap.set(img.ref, img);
  }

  const pdfDoc = await PDFDocument.load(originalBuffer);
  const context = pdfDoc.context;

  // Find and replace image streams
  const allRefs = context.enumerateIndirectObjects();

  for (const [ref, obj] of allRefs) {
    if (!(obj instanceof PDFRawStream) && !(obj instanceof PDFStream)) {
      continue;
    }

    const refStr = `${ref.objectNumber}-${ref.generationNumber}`;
    const recompressed = imageMap.get(refStr);

    if (!recompressed) {
      continue;
    }

    // Create new stream with recompressed JPEG
    const stream = obj;
    const oldDict = stream.dict;

    // Clone dictionary and update
    const newDict = oldDict.clone(context);
    newDict.set(PDFName.of('Length'), context.obj(recompressed.bytes.length));
    newDict.set(PDFName.of('Width'), context.obj(recompressed.width));
    newDict.set(PDFName.of('Height'), context.obj(recompressed.height));
    newDict.set(PDFName.of('Filter'), PDFName.of('DCTDecode'));
    newDict.set(PDFName.of('ColorSpace'), PDFName.of('DeviceRGB'));
    newDict.set(PDFName.of('BitsPerComponent'), context.obj(8));

    // Remove any decode params that might conflict
    newDict.delete(PDFName.of('DecodeParms'));
    newDict.delete(PDFName.of('SMask'));

    const newStream = PDFRawStream.of(newDict, recompressed.bytes);
    context.assign(ref, newStream);
  }

  return pdfDoc.save({ useObjectStreams: true });
};

/**
 * Calculate total savings
 */
export const calculateImageSavings = (recompressedImages: RecompressedImage[]): number => {
  return recompressedImages.reduce((total, img) => total + img.savedBytes, 0);
};
