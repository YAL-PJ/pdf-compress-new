/**
 * Image Processor for PDF Compression
 * Handles JPEG recompression, downsampling, grayscale conversion,
 * and monochrome conversion.
 */

import { PDFDocument, PDFName, PDFDict, PDFArray, PDFStream, PDFRawStream } from 'pdf-lib';
import type { ImageCompressionSettings, ExtractedImage, RecompressedImage } from './types';
import { IMAGE_COMPRESSION, DPI_OPTIONS } from './constants';

// Extended image settings for Phase 2 methods
export interface ExtendedImageSettings extends ImageCompressionSettings {
  convertToGrayscale?: boolean;
  pngToJpeg?: boolean;
  convertToMonochrome?: boolean;
  removeAlphaChannels?: boolean;
  monochromeThreshold?: number; // 0-255, default 128
}

export interface ImageStats {
  totalImages: number;
  jpegCount: number;
  pngCount: number;
  otherCount: number;
  totalOriginalSize: number;
  highDpiCount: number;  // Images that could benefit from downsampling
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
 * Estimate DPI based on image dimensions
 * Assumes a typical 8.5" wide page for reference
 * Larger images = higher assumed DPI
 */
const estimateImageDpi = (width: number, height: number): number => {
  const largerDimension = Math.max(width, height);
  // Reference: 8.5" page at various DPIs
  // 72 DPI = 612px, 150 DPI = 1275px, 300 DPI = 2550px
  // Simple linear estimate based on larger dimension
  const REFERENCE_PAGE_INCHES = 11; // 11" for the larger dimension (letter size)
  return Math.round(largerDimension / REFERENCE_PAGE_INCHES);
};

/**
 * Check if image would benefit from downsampling to target DPI
 */
const shouldDownsample = (width: number, height: number, targetDpi: number): boolean => {
  const estimatedDpi = estimateImageDpi(width, height);
  // Only downsample if estimated DPI is significantly higher than target (20% margin)
  return estimatedDpi > targetDpi * 1.2;
};

/**
 * Calculate new dimensions for target DPI
 */
const calculateDownsampledDimensions = (
  width: number,
  height: number,
  targetDpi: number
): { newWidth: number; newHeight: number; scale: number } => {
  const currentDpi = estimateImageDpi(width, height);
  const scale = targetDpi / currentDpi;

  // Don't scale up, only down
  if (scale >= 1) {
    return { newWidth: width, newHeight: height, scale: 1 };
  }

  const newWidth = Math.round(width * scale);
  const newHeight = Math.round(height * scale);

  // Ensure minimum dimensions
  if (newWidth < DPI_OPTIONS.MIN_DIMENSION_THRESHOLD || newHeight < DPI_OPTIONS.MIN_DIMENSION_THRESHOLD) {
    return { newWidth: width, newHeight: height, scale: 1 };
  }

  return { newWidth, newHeight, scale };
};


/**
 * Convert RGB image data to grayscale using luminance formula
 */
const convertToGrayscaleData = (
  ctx: OffscreenCanvasRenderingContext2D,
  width: number,
  height: number
): void => {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    // Luminance formula: 0.299*R + 0.587*G + 0.114*B
    const gray = Math.round(
      0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    );
    data[i] = gray;     // R
    data[i + 1] = gray; // G
    data[i + 2] = gray; // B
    // Alpha (data[i + 3]) stays unchanged
  }

  ctx.putImageData(imageData, 0, 0);
};

/**
 * Convert image to monochrome (1-bit black and white)
 */
const convertToMonochromeData = (
  ctx: OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
  threshold: number = 128
): void => {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    // Convert to grayscale first
    const gray = Math.round(
      0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    );
    // Apply threshold
    const bw = gray >= threshold ? 255 : 0;
    data[i] = bw;     // R
    data[i + 1] = bw; // G
    data[i + 2] = bw; // B
    // Alpha stays unchanged
  }

  ctx.putImageData(imageData, 0, 0);
};


/**
 * Extract all images from PDF, collecting stats
 * Only extracts JPEGs for recompression
 */
export const extractImages = async (
  pdfDoc: PDFDocument,
  onProgress?: (message: string, percent?: number) => void,
  targetDpi: number = DPI_OPTIONS.DEFAULT_TARGET_DPI
): Promise<ImageExtractionResult> => {
  const images: ExtractedImage[] = [];
  const stats: ImageStats = {
    totalImages: 0,
    jpegCount: 0,
    pngCount: 0,
    otherCount: 0,
    totalOriginalSize: 0,
    highDpiCount: 0,
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

      // Estimate DPI and check if high-DPI
      const estimatedDpi = estimateImageDpi(width, height);
      if (shouldDownsample(width, height, targetDpi)) {
        stats.highDpiCount++;
      }

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
        estimatedDpi,
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
 * Recompress and optionally downsample a JPEG image
 * Supports extended settings for grayscale and monochrome conversion
 */
export const recompressJpeg = async (
  image: ExtractedImage,
  settings: ImageCompressionSettings | ExtendedImageSettings
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

    // Store dimensions before closing (accessing after close is undefined behavior)
    const bitmapWidth = imageBitmap.width;
    const bitmapHeight = imageBitmap.height;

    // Calculate target dimensions (with potential downsampling)
    let targetWidth = bitmapWidth;
    let targetHeight = bitmapHeight;
    let wasDownsampled = false;

    if (settings.enableDownsampling && shouldDownsample(bitmapWidth, bitmapHeight, settings.targetDpi)) {
      const { newWidth, newHeight, scale } = calculateDownsampledDimensions(
        bitmapWidth,
        bitmapHeight,
        settings.targetDpi
      );
      if (scale < 1) {
        targetWidth = newWidth;
        targetHeight = newHeight;
        wasDownsampled = true;
      }
    }

    // Create canvas at target dimensions
    const canvas = new OffscreenCanvas(targetWidth, targetHeight);
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      imageBitmap.close();
      return null;
    }

    // Use high-quality image smoothing for downsampling
    if (wasDownsampled) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
    }

    ctx.drawImage(imageBitmap, 0, 0, targetWidth, targetHeight);
    imageBitmap.close();

    // Apply extended image processing if settings are provided
    const extSettings = settings as ExtendedImageSettings;

    // Apply monochrome conversion (takes priority over grayscale)
    if (extSettings.convertToMonochrome) {
      convertToMonochromeData(ctx, targetWidth, targetHeight, extSettings.monochromeThreshold ?? 128);
    }
    // Apply grayscale conversion
    else if (extSettings.convertToGrayscale) {
      convertToGrayscaleData(ctx, targetWidth, targetHeight);
    }

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
        width: targetWidth,
        height: targetHeight,
        newSize: newBytes.length,
        originalSize: image.originalSize,
        savedBytes,
        wasDownsampled,
        originalWidth: bitmapWidth,
        originalHeight: bitmapHeight,
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
 * Supports extended settings for grayscale/monochrome conversion
 * Returns results and separate stats for downsampling
 */
export const recompressImages = async (
  images: ExtractedImage[],
  settings: ImageCompressionSettings | ExtendedImageSettings,
  onProgress?: (message: string, percent?: number) => void
): Promise<{ results: RecompressedImage[]; downsampleSavings: number }> => {
  const results: RecompressedImage[] = [];
  const total = images.length;
  let downsampleSavings = 0;

  if (total === 0) {
    return { results, downsampleSavings };
  }

  onProgress?.(`Recompressing ${total} JPEG images...`, 0);

  // Process one at a time for stability
  for (let i = 0; i < total; i++) {
    const image = images[i];
    const result = await recompressJpeg(image, settings);

    if (result) {
      results.push(result);

      // Track downsampling savings separately
      if (result.wasDownsampled && result.originalWidth && result.originalHeight) {
        // Estimate how much of the savings came from downsampling
        // by comparing the dimension reduction ratio
        const originalPixels = result.originalWidth * result.originalHeight;
        const newPixels = result.width * result.height;
        const pixelReductionRatio = 1 - (newPixels / originalPixels);

        // Attribute proportional savings to downsampling
        downsampleSavings += Math.round(result.savedBytes * pixelReductionRatio);
      }
    }

    const progress = Math.round(((i + 1) / total) * 100);
    onProgress?.(`Processed ${i + 1}/${total} images`, progress);
  }

  return { results, downsampleSavings };
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

