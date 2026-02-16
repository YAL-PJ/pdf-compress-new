/**
 * Image Processor for PDF Compression
 * Handles JPEG recompression, downsampling, grayscale conversion,
 * monochrome conversion, PNG to JPEG, alpha removal, ICC profile removal,
 * and CMYK to RGB conversion.
 */

import { PDFDocument, PDFName, PDFDict, PDFArray, PDFStream, PDFRawStream, PDFRef } from 'pdf-lib';
import type { ImageCompressionSettings, ExtractedImage, RecompressedImage } from './types';
import { IMAGE_COMPRESSION, DPI_OPTIONS } from './constants';
import pako from 'pako';

// Extended image settings for Phase 2 methods
export interface ExtendedImageSettings extends ImageCompressionSettings {
  convertToGrayscale?: boolean;
  pngToJpeg?: boolean;
  convertToMonochrome?: boolean;
  removeAlphaChannels?: boolean;
  removeColorProfiles?: boolean;
  cmykToRgb?: boolean;
  monochromeThreshold?: number; // 0-255, default 128
}

// Result for PNG to JPEG conversion
export interface PngConversionResult {
  converted: number;
  savedBytes: number;
}

// Result for alpha channel removal
export interface AlphaRemovalResult {
  processed: number;
  savedBytes: number;
}

// Result for ICC profile removal
export interface IccRemovalResult {
  removed: number;
  savedBytes: number;
}

// Result for CMYK to RGB conversion
export interface CmykConversionResult {
  converted: number;
  savedBytes: number;
}

export interface ImageStats {
  totalImages: number;
  jpegCount: number;
  pngCount: number;
  otherCount: number;
  totalOriginalSize: number;
  highDpiCount: number;  // Images that could benefit from downsampling
  cmykCount: number;     // Images with CMYK colorspace
  iccCount: number;      // Images with ICC profiles
  alphaCount: number;    // Images with alpha/SMask
  avgDpi: number;        // Average estimated DPI across all images
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

/**
 * Check if stream uses FlateDecode (PNG-like)
 */
const isPngStream = (dict: PDFDict): boolean => {
  const filter = dict.get(PDFName.of('Filter'));

  if (filter instanceof PDFName) {
    return filter.toString() === '/FlateDecode';
  }

  if (filter instanceof PDFArray) {
    // Check if FlateDecode is the only filter (not combined with others)
    if (filter.size() === 1) {
      const f = filter.get(0);
      return f instanceof PDFName && f.toString() === '/FlateDecode';
    }
  }

  return false;
};

/**
 * Check if colorspace is CMYK
 */
const isCmykColorSpace = (dict: PDFDict): boolean => {
  const cs = dict.get(PDFName.of('ColorSpace'));
  if (cs instanceof PDFName) {
    return cs.toString() === '/DeviceCMYK';
  }
  if (cs instanceof PDFArray && cs.size() > 0) {
    const first = cs.get(0);
    if (first instanceof PDFName) {
      return first.toString() === '/DeviceCMYK';
    }
  }
  return false;
};

/**
 * Check if colorspace has ICC profile
 */
const hasIccProfile = (dict: PDFDict): boolean => {
  const cs = dict.get(PDFName.of('ColorSpace'));
  if (cs instanceof PDFArray && cs.size() > 0) {
    const first = cs.get(0);
    if (first instanceof PDFName) {
      const name = first.toString();
      return name === '/ICCBased' || name === '/CalRGB' || name === '/CalGray';
    }
  }
  return false;
};

/**
 * Check if image has alpha/SMask
 */
const hasAlphaChannel = (dict: PDFDict): boolean => {
  return dict.has(PDFName.of('SMask')) || dict.has(PDFName.of('Mask'));
};

/**
 * Get bits per component
 */
const getBitsPerComponent = (dict: PDFDict): number => {
  const bpc = dict.get(PDFName.of('BitsPerComponent'));
  return bpc ? Number(bpc.toString()) : 8;
};

/**
 * Get number of color components from colorspace
 */
const getColorComponents = (colorSpace: string): number => {
  switch (colorSpace) {
    case 'DeviceCMYK':
      return 4;
    case 'DeviceRGB':
    case 'CalRGB':
      return 3;
    case 'DeviceGray':
    case 'CalGray':
      return 1;
    default:
      return 3; // Default to RGB
  }
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
 * Extracts both JPEGs and PNGs for processing
 */
export const extractImages = async (
  pdfDoc: PDFDocument,
  onProgress?: (message: string, percent?: number) => void,
  targetDpi: number = DPI_OPTIONS.DEFAULT_TARGET_DPI,
  extractPng: boolean = false
): Promise<ImageExtractionResult> => {
  const images: ExtractedImage[] = [];
  const stats: ImageStats = {
    totalImages: 0,
    jpegCount: 0,
    pngCount: 0,
    otherCount: 0,
    totalOriginalSize: 0,
    highDpiCount: 0,
    cmykCount: 0,
    iccCount: 0,
    alphaCount: 0,
    avgDpi: 0,
  };

  let dpiSum = 0;
  let dpiCount = 0;

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
    const bitsPerComponent = getBitsPerComponent(dict);

    // Track special image types
    if (isCmykColorSpace(dict)) stats.cmykCount++;
    if (hasIccProfile(dict)) stats.iccCount++;
    if (hasAlphaChannel(dict)) stats.alphaCount++;

    // Get raw bytes (for PDFRawStream this is the encoded data)
    let bytes: Uint8Array | undefined;
    if (stream instanceof PDFRawStream) {
      bytes = stream.contents;
    } else {
      bytes = stream.getContents();
    }

    // Skip if bytes are undefined (can happen with corrupted or non-PDF streams)
    if (!bytes) {
      continue;
    }

    const originalSize = bytes.length;
    stats.totalOriginalSize += originalSize;

    // Store ref as string for later lookup
    const refStr = `${ref.objectNumber}-${ref.generationNumber}`;

    // Check for transparency
    const hasTransparency = hasAlphaChannel(dict);

    // Track DPI for all images
    const imgDpi = estimateImageDpi(width, height);
    dpiSum += imgDpi;
    dpiCount++;

    if (isJpegStream(dict)) {
      stats.jpegCount++;

      // Estimate DPI and check if high-DPI
      const estimatedDpi = imgDpi;
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
        bitsPerComponent,
        pageIndex: 0,
        originalSize,
        estimatedDpi,
        hasTransparency,
      });
    } else if (isPngStream(dict)) {
      stats.pngCount++;

      // Extract PNG if requested (for PNG to JPEG conversion)
      if (extractPng) {
        const estimatedDpi = imgDpi;
        if (shouldDownsample(width, height, targetDpi)) {
          stats.highDpiCount++;
        }

        images.push({
          ref: refStr,
          format: 'png',
          bytes,
          width,
          height,
          colorSpace,
          bitsPerComponent,
          pageIndex: 0,
          originalSize,
          estimatedDpi,
          hasTransparency,
        });
      }
    } else {
      stats.otherCount++;
    }
  }

  // Compute average DPI across all images
  stats.avgDpi = dpiCount > 0 ? Math.round(dpiSum / dpiCount) : 0;

  onProgress?.(`Found ${stats.jpegCount} JPEG, ${stats.pngCount} PNG images`, 100);

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

  // Process images in parallel batches for much better throughput
  // OffscreenCanvas operations are async and benefit from concurrent execution
  const BATCH_SIZE = 4;
  let processed = 0;

  for (let batchStart = 0; batchStart < total; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE, total);
    const batch = images.slice(batchStart, batchEnd);

    const batchResults = await Promise.all(
      batch.map(image => recompressJpeg(image, settings))
    );

    for (const result of batchResults) {
      processed++;
      if (result) {
        results.push(result);

        // Track downsampling savings separately
        if (result.wasDownsampled && result.originalWidth && result.originalHeight) {
          const originalPixels = result.originalWidth * result.originalHeight;
          const newPixels = result.width * result.height;
          const pixelReductionRatio = 1 - (newPixels / originalPixels);
          downsampleSavings += Math.round(result.savedBytes * pixelReductionRatio);
        }
      }
    }

    const progress = Math.round((processed / total) * 100);
    onProgress?.(`Processed ${processed}/${total} images`, progress);
  }

  return { results, downsampleSavings };
};

/**
 * Embed recompressed images back into PDF
 * Can accept either an ArrayBuffer (loads new doc) or an existing PDFDocument (avoids re-parse)
 */
export const embedRecompressedImages = async (
  source: ArrayBuffer | PDFDocument,
  recompressedImages: RecompressedImage[],
  onProgress?: (message: string) => void
): Promise<Uint8Array> => {
  // Load or reuse document
  const pdfDoc = source instanceof ArrayBuffer
    ? await PDFDocument.load(source)
    : source;

  if (recompressedImages.length === 0) {
    return pdfDoc.save({ useObjectStreams: false });
  }

  onProgress?.('Embedding recompressed images...');

  // Map ref string to recompressed data
  const imageMap = new Map<string, RecompressedImage>();
  for (const img of recompressedImages) {
    imageMap.set(img.ref, img);
  }

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

  return pdfDoc.save({ useObjectStreams: false });
};

/**
 * Calculate total savings
 */
export const calculateImageSavings = (recompressedImages: RecompressedImage[]): number => {
  return recompressedImages.reduce((total, img) => total + img.savedBytes, 0);
};

/**
 * Decode PNG/FlateDecode image data to raw pixels
 */
const decodePngImage = (
  bytes: Uint8Array,
  width: number,
  height: number,
  colorSpace: string,
  bitsPerComponent: number
): Uint8Array | null => {
  try {
    // Decompress FlateDecode data
    const decompressed = pako.inflate(bytes);

    const components = getColorComponents(colorSpace);
    const bytesPerPixel = (components * bitsPerComponent) / 8;
    const rowBytes = width * bytesPerPixel;

    // Check if PNG predictor was used (adds 1 byte per row for filter type)
    const expectedWithPredictor = height * (rowBytes + 1);
    const expectedWithoutPredictor = height * rowBytes;

    if (decompressed.length === expectedWithPredictor) {
      // Remove PNG predictor bytes and apply filter
      const result = new Uint8Array(width * height * components);
      let srcOffset = 0;
      let dstOffset = 0;

      for (let y = 0; y < height; y++) {
        const filterType = decompressed[srcOffset++];

        // For simplicity, handle filter type 0 (None) and 1 (Sub)
        // Most PDF images use these simple filters
        for (let x = 0; x < rowBytes; x++) {
          let value = decompressed[srcOffset++];

          if (filterType === 1 && x >= bytesPerPixel) {
            // Sub filter: add left pixel
            value = (value + result[dstOffset - bytesPerPixel]) & 0xff;
          } else if (filterType === 2 && y > 0) {
            // Up filter: add above pixel
            value = (value + result[dstOffset - rowBytes]) & 0xff;
          }

          result[dstOffset++] = value;
        }
      }

      return result;
    } else if (decompressed.length === expectedWithoutPredictor) {
      // No predictor, raw data
      return decompressed;
    }

    return null;
  } catch {
    return null;
  }
};

/**
 * Convert raw pixel data to ImageData for canvas
 */
const pixelsToImageData = (
  pixels: Uint8Array,
  width: number,
  height: number,
  colorSpace: string
): ImageData => {
  const imageData = new ImageData(width, height);
  const data = imageData.data;
  const components = getColorComponents(colorSpace);

  let srcIdx = 0;
  let dstIdx = 0;

  for (let i = 0; i < width * height; i++) {
    if (colorSpace === 'DeviceCMYK') {
      // Convert CMYK to RGB
      const c = pixels[srcIdx++] / 255;
      const m = pixels[srcIdx++] / 255;
      const y = pixels[srcIdx++] / 255;
      const k = pixels[srcIdx++] / 255;

      data[dstIdx++] = Math.round(255 * (1 - c) * (1 - k)); // R
      data[dstIdx++] = Math.round(255 * (1 - m) * (1 - k)); // G
      data[dstIdx++] = Math.round(255 * (1 - y) * (1 - k)); // B
      data[dstIdx++] = 255; // A
    } else if (components === 3) {
      // RGB
      data[dstIdx++] = pixels[srcIdx++]; // R
      data[dstIdx++] = pixels[srcIdx++]; // G
      data[dstIdx++] = pixels[srcIdx++]; // B
      data[dstIdx++] = 255; // A
    } else if (components === 1) {
      // Grayscale
      const gray = pixels[srcIdx++];
      data[dstIdx++] = gray; // R
      data[dstIdx++] = gray; // G
      data[dstIdx++] = gray; // B
      data[dstIdx++] = 255; // A
    } else {
      // Fallback - copy as is
      data[dstIdx++] = pixels[srcIdx++] || 0;
      data[dstIdx++] = pixels[srcIdx++] || 0;
      data[dstIdx++] = pixels[srcIdx++] || 0;
      data[dstIdx++] = 255;
    }
  }

  return imageData;
};

/**
 * Analyze image data to determine if it's a photo vs graphics.
 * Photos have high color variance, smooth gradients.
 * Graphics have solid colors, sharp edges, limited palette.
 *
 * Returns a score from 0 (graphics) to 1 (photo).
 */
const analyzeImageType = (imageData: ImageData): { isPhoto: boolean; score: number } => {
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  const pixelCount = width * height;

  // Sample pixels for analysis (max 10000 for performance)
  const sampleSize = Math.min(pixelCount, 10000);
  const stride = Math.max(1, Math.floor(pixelCount / sampleSize));

  // Track unique colors
  const colorSet = new Set<number>();
  let gradientScore = 0;
  let edgeScore = 0;
  let sampledPixels = 0;

  for (let i = 0; i < data.length && sampledPixels < sampleSize; i += stride * 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Quantize to reduce unique colors (5 bits per channel)
    const quantized = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    colorSet.add(quantized);

    // Check gradient smoothness (compare with neighbor if possible)
    if (i + 4 < data.length) {
      const dr = Math.abs(r - data[i + 4]);
      const dg = Math.abs(g - data[i + 5]);
      const db = Math.abs(b - data[i + 6]);
      const diff = dr + dg + db;

      // Small differences indicate smooth gradients (photos)
      if (diff < 30) {
        gradientScore++;
      }
      // Large differences indicate edges (graphics)
      if (diff > 100) {
        edgeScore++;
      }
    }

    sampledPixels++;
  }

  // Calculate metrics
  const uniqueColorRatio = colorSet.size / Math.min(sampleSize, 32768);
  const gradientRatio = gradientScore / Math.max(sampledPixels - 1, 1);
  const edgeRatio = edgeScore / Math.max(sampledPixels - 1, 1);

  // Photos: high unique colors, high gradients, low sharp edges
  // Graphics: low unique colors, low gradients, high sharp edges
  const photoScore =
    (uniqueColorRatio * 0.4) +
    (gradientRatio * 0.4) +
    ((1 - edgeRatio) * 0.2);

  // Threshold: 0.3 is a good balance
  const isPhoto = photoScore > 0.3;

  return { isPhoto, score: photoScore };
};

/**
 * Check if an image has meaningful transparency that should be preserved.
 * Returns true if the image has non-trivial alpha values.
 * Uses context.lookup with PDFRef.of() for O(1) access instead of enumerating all objects.
 */
const hasSignificantTransparency = (
  pdfDoc: PDFDocument,
  imageRef: string
): boolean => {
  const context = pdfDoc.context;
  const [objNum, genNum] = imageRef.split('-').map(Number);

  // Direct lookup by ref — O(1) instead of iterating all objects
  const ref = PDFRef.of(objNum, genNum);
  const obj = context.lookup(ref);

  if (obj instanceof PDFRawStream || obj instanceof PDFStream) {
    const dict = obj.dict;
    if (dict.get(PDFName.of('SMask'))) return true;
    if (dict.get(PDFName.of('Mask'))) return true;
  }

  return false;
};

/**
 * Convert a PNG image to JPEG with photo detection and transparency check.
 * Only converts photographic images without transparency.
 */
const convertPngToJpeg = async (
  image: ExtractedImage,
  quality: number,
  skipPhotoDetection: boolean = false
): Promise<RecompressedImage | null> => {
  if (image.format !== 'png') return null;

  // Skip tiny or oversized images
  if (
    image.originalSize < 1024 ||
    image.width > IMAGE_COMPRESSION.MAX_CANVAS_DIMENSION ||
    image.height > IMAGE_COMPRESSION.MAX_CANVAS_DIMENSION ||
    image.width <= 0 ||
    image.height <= 0
  ) {
    return null;
  }

  // Skip images marked as needing transparency
  if (image.hasTransparency) {
    return null;
  }

  try {
    // Decode PNG data
    const pixels = decodePngImage(
      image.bytes,
      image.width,
      image.height,
      image.colorSpace,
      image.bitsPerComponent
    );

    if (!pixels) return null;

    // Create canvas and draw
    const canvas = new OffscreenCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const imageData = pixelsToImageData(pixels, image.width, image.height, image.colorSpace);

    // Photo detection - only convert photos, not graphics
    if (!skipPhotoDetection) {
      const analysis = analyzeImageType(imageData);
      if (!analysis.isPhoto) {
        // Skip graphics - they don't compress well as JPEG
        return null;
      }
    }

    ctx.putImageData(imageData, 0, 0);

    // Convert to JPEG
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: quality / 100 });
    const newBytes = new Uint8Array(await blob.arrayBuffer());
    const savedBytes = image.originalSize - newBytes.length;

    // Only use if we saved space
    if (savedBytes > 0) {
      return {
        ref: image.ref,
        bytes: newBytes,
        width: image.width,
        height: image.height,
        newSize: newBytes.length,
        originalSize: image.originalSize,
        savedBytes,
      };
    }

    return null;
  } catch (err) {
    console.warn('Failed to convert PNG to JPEG:', image.ref, err);
    return null;
  }
};

/**
 * Convert PNG images to JPEG
 */
export const convertPngsToJpeg = async (
  images: ExtractedImage[],
  quality: number,
  onProgress?: (message: string, percent?: number) => void
): Promise<{ results: RecompressedImage[]; savings: number }> => {
  const pngImages = images.filter(img => img.format === 'png');
  const results: RecompressedImage[] = [];
  let savings = 0;

  if (pngImages.length === 0) {
    return { results, savings };
  }

  onProgress?.(`Converting ${pngImages.length} PNG images to JPEG...`, 0);

  // Process PNG conversions in parallel batches
  const BATCH_SIZE = 4;
  let processed = 0;

  for (let batchStart = 0; batchStart < pngImages.length; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE, pngImages.length);
    const batch = pngImages.slice(batchStart, batchEnd);

    const batchResults = await Promise.all(
      batch.map(img => convertPngToJpeg(img, quality))
    );

    for (const result of batchResults) {
      processed++;
      if (result) {
        results.push(result);
        savings += result.savedBytes;
      }
    }

    const progress = Math.round((processed / pngImages.length) * 100);
    onProgress?.(`Converted ${processed}/${pngImages.length} PNGs`, progress);
  }

  return { results, savings };
};

/**
 * Remove alpha channels (SMask) from images
 */
export const removeAlphaChannels = (pdfDoc: PDFDocument): AlphaRemovalResult => {
  const result: AlphaRemovalResult = {
    processed: 0,
    savedBytes: 0,
  };

  const context = pdfDoc.context;
  const allRefs = context.enumerateIndirectObjects();

  for (const [ref, obj] of allRefs) {
    if (!(obj instanceof PDFRawStream) && !(obj instanceof PDFStream)) {
      continue;
    }

    const stream = obj;
    const dict = stream.dict;

    // Check if it's an image XObject
    const subtype = dict.get(PDFName.of('Subtype'));
    if (!(subtype instanceof PDFName) || subtype.toString() !== '/Image') {
      continue;
    }

    // Check for SMask or Mask
    const smask = dict.get(PDFName.of('SMask'));
    const mask = dict.get(PDFName.of('Mask'));

    if (smask || mask) {
      // Estimate savings from removing SMask
      if (smask instanceof PDFRef) {
        const smaskObj = context.lookup(smask);
        if (smaskObj instanceof PDFRawStream || smaskObj instanceof PDFStream) {
          const bytes = smaskObj instanceof PDFRawStream ? smaskObj.contents : smaskObj.getContents();
          if (bytes) {
            result.savedBytes += bytes.length;
          }
        }
      }

      // Remove SMask and Mask references
      dict.delete(PDFName.of('SMask'));
      dict.delete(PDFName.of('Mask'));
      result.processed++;
    }
  }

  return result;
};

/**
 * Remove ICC color profiles from images
 * Converts ICCBased colorspaces to Device colorspaces
 */
export const removeIccProfiles = (pdfDoc: PDFDocument): IccRemovalResult => {
  const result: IccRemovalResult = {
    removed: 0,
    savedBytes: 0,
  };

  const context = pdfDoc.context;
  const allRefs = context.enumerateIndirectObjects();

  for (const [ref, obj] of allRefs) {
    if (!(obj instanceof PDFRawStream) && !(obj instanceof PDFStream)) {
      continue;
    }

    const stream = obj;
    const dict = stream.dict;

    // Check if it's an image XObject
    const subtype = dict.get(PDFName.of('Subtype'));
    if (!(subtype instanceof PDFName) || subtype.toString() !== '/Image') {
      continue;
    }

    const colorSpace = dict.get(PDFName.of('ColorSpace'));

    if (colorSpace instanceof PDFArray && colorSpace.size() >= 2) {
      const csType = colorSpace.get(0);

      if (csType instanceof PDFName && csType.toString() === '/ICCBased') {
        // Get the ICC profile stream to estimate size
        const profileRef = colorSpace.get(1);
        if (profileRef instanceof PDFRef) {
          const profileObj = context.lookup(profileRef);
          if (profileObj instanceof PDFRawStream || profileObj instanceof PDFStream) {
            const bytes = profileObj instanceof PDFRawStream ? profileObj.contents : profileObj.getContents();
            if (bytes) {
              result.savedBytes += bytes.length;
            }
          }

          // Determine replacement colorspace based on component count
          const profileDict = profileObj instanceof PDFDict ? profileObj : (profileObj as PDFStream).dict;
          const n = profileDict?.get(PDFName.of('N'));
          const components = n ? Number(n.toString()) : 3;

          // Replace with appropriate Device colorspace
          let replacement: PDFName;
          if (components === 4) {
            replacement = PDFName.of('DeviceCMYK');
          } else if (components === 1) {
            replacement = PDFName.of('DeviceGray');
          } else {
            replacement = PDFName.of('DeviceRGB');
          }

          dict.set(PDFName.of('ColorSpace'), replacement);
          result.removed++;
        }
      } else if (csType instanceof PDFName && (csType.toString() === '/CalRGB' || csType.toString() === '/CalGray')) {
        // Replace calibrated colorspaces with device equivalents
        const replacement = csType.toString() === '/CalGray'
          ? PDFName.of('DeviceGray')
          : PDFName.of('DeviceRGB');

        dict.set(PDFName.of('ColorSpace'), replacement);
        result.removed++;
      }
    }
  }

  return result;
};

/**
 * Convert CMYK images to RGB
 * This requires re-encoding the image data
 */
export const convertCmykToRgb = async (
  pdfDoc: PDFDocument,
  quality: number = 85,
  onProgress?: (message: string, percent?: number) => void
): Promise<CmykConversionResult> => {
  const result: CmykConversionResult = {
    converted: 0,
    savedBytes: 0,
  };

  const context = pdfDoc.context;
  const cmykImages: Array<{ ref: PDFRef; stream: PDFRawStream | PDFStream; dict: PDFDict }> = [];

  // Find all CMYK images — iterate directly without materializing full array
  for (const [ref, obj] of context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream) && !(obj instanceof PDFStream)) {
      continue;
    }

    const stream = obj;
    const dict = stream.dict;

    const subtype = dict.get(PDFName.of('Subtype'));
    if (!(subtype instanceof PDFName) || subtype.toString() !== '/Image') {
      continue;
    }

    if (isCmykColorSpace(dict) && !isJpegStream(dict)) {
      cmykImages.push({ ref, stream, dict });
    }
  }

  if (cmykImages.length === 0) {
    return result;
  }

  onProgress?.(`Converting ${cmykImages.length} CMYK images to RGB...`, 0);

  for (let i = 0; i < cmykImages.length; i++) {
    const { ref, stream, dict } = cmykImages[i];

    try {
      const { width, height } = getImageDimensions(dict);
      const bitsPerComponent = getBitsPerComponent(dict);

      if (width <= 0 || height <= 0 || width > IMAGE_COMPRESSION.MAX_CANVAS_DIMENSION || height > IMAGE_COMPRESSION.MAX_CANVAS_DIMENSION) {
        continue;
      }

      // Get image bytes
      let bytes: Uint8Array | undefined;
      if (stream instanceof PDFRawStream) {
        bytes = stream.contents;
      } else {
        bytes = stream.getContents();
      }

      // Skip if bytes are undefined (can happen with corrupted or non-PDF streams)
      if (!bytes) {
        continue;
      }

      const originalSize = bytes.length;

      // Decode if FlateDecode
      let pixelData: Uint8Array | null = null;
      if (isPngStream(dict)) {
        pixelData = decodePngImage(bytes, width, height, 'DeviceCMYK', bitsPerComponent);
      } else {
        // Raw uncompressed data
        pixelData = bytes;
      }

      if (!pixelData) continue;

      // Create canvas and convert CMYK to RGB
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;

      const imageData = pixelsToImageData(pixelData, width, height, 'DeviceCMYK');
      ctx.putImageData(imageData, 0, 0);

      // Encode as JPEG
      const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: quality / 100 });
      const newBytes = new Uint8Array(await blob.arrayBuffer());

      // Only replace if we actually save space
      if (newBytes.length < originalSize) {
        // Replace in PDF
        const newDict = dict.clone(context);
        newDict.set(PDFName.of('Length'), context.obj(newBytes.length));
        newDict.set(PDFName.of('Width'), context.obj(width));
        newDict.set(PDFName.of('Height'), context.obj(height));
        newDict.set(PDFName.of('Filter'), PDFName.of('DCTDecode'));
        newDict.set(PDFName.of('ColorSpace'), PDFName.of('DeviceRGB'));
        newDict.set(PDFName.of('BitsPerComponent'), context.obj(8));
        newDict.delete(PDFName.of('DecodeParms'));
        newDict.delete(PDFName.of('Decode'));

        const newStream = PDFRawStream.of(newDict, newBytes);
        context.assign(ref, newStream);

        result.converted++;
        result.savedBytes += originalSize - newBytes.length;
      }
    } catch (err) {
      console.warn('Failed to convert CMYK image:', err);
    }

    const progress = Math.round(((i + 1) / cmykImages.length) * 100);
    onProgress?.(`Converted ${i + 1}/${cmykImages.length} CMYK images`, progress);
  }

  return result;
};

