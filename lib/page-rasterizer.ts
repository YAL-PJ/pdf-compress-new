/**
 * Page Rasterizer
 * Renders PDF pages to JPEG images and rebuilds a new image-only PDF.
 * Uses PDF.js for rendering and OffscreenCanvas for Web Worker compatibility.
 *
 * This is the "nuclear" compression option for vector-heavy PDFs:
 * it replaces all vector content, gradients, transparency, and text
 * with flat JPEG images. Produces massive savings but destroys
 * text selectability, searchability, and vector zoom quality.
 */

import { PDFDocument } from 'pdf-lib';

// ============================================================================
// Types
// ============================================================================

export interface RasterizeResult {
  /** New PDF bytes with rasterized pages */
  pdfBytes: Uint8Array;
  pagesRasterized: number;
  totalOriginalContentSize: number;
  totalRasterizedSize: number;
}

export interface RasterizeSettings {
  /** Target DPI for rasterization (default: 150) */
  dpi: number;
  /** JPEG quality 0-1 (default: 0.75) */
  quality: number;
}

// ============================================================================
// PDF.js Initialization (Worker-safe)
// ============================================================================

let pdfjsLib: typeof import('pdfjs-dist') | null = null;

const getPdfjs = async () => {
  if (pdfjsLib) return pdfjsLib;
  pdfjsLib = await import('pdfjs-dist');

  // In a Web Worker, PDF.js needs its own worker disabled
  // (we're already in a worker, so PDF.js should process inline)
  pdfjsLib.GlobalWorkerOptions.workerSrc = '';

  return pdfjsLib;
};

// ============================================================================
// Core Implementation
// ============================================================================

/**
 * Rasterize all pages of a PDF to JPEG images and rebuild as an image-only PDF.
 *
 * Pipeline:
 * 1. Load PDF with PDF.js (for rendering)
 * 2. Render each page to OffscreenCanvas at target DPI
 * 3. Convert canvas to JPEG blob
 * 4. Build new PDF with pdf-lib, embedding JPEGs as full-page images
 *
 * @param arrayBuffer - Original PDF bytes
 * @param settings - DPI and quality settings
 * @param onProgress - Progress callback
 * @returns New PDF bytes with rasterized pages
 */
export const rasterizePages = async (
  arrayBuffer: ArrayBuffer,
  settings: RasterizeSettings = { dpi: 150, quality: 0.75 },
  onProgress?: (message: string, percent?: number) => void,
): Promise<RasterizeResult> => {
  const pdfjs = await getPdfjs();

  onProgress?.('Loading PDF for rasterization...', 0);

  // Load with PDF.js for rendering
  const loadingTask = pdfjs.getDocument({
    data: arrayBuffer.slice(0), // PDF.js may transfer the buffer
    // Disable unnecessary features to improve performance
    disableFontFace: true,
    verbosity: 0, // ERRORS only
  });
  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;

  // Create new PDF with pdf-lib
  const newPdf = await PDFDocument.create();

  let totalRasterizedSize = 0;
  const scale = settings.dpi / 72; // PDF units are 72 DPI

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const percent = Math.round(((pageNum - 1) / numPages) * 100);
    onProgress?.(`Rasterizing page ${pageNum}/${numPages}...`, percent);

    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale });

    const width = Math.round(viewport.width);
    const height = Math.round(viewport.height);

    // Render to OffscreenCanvas (Web Worker compatible)
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('OffscreenCanvas 2d context not available');
    }

    // Fill white background (JPEG has no transparency)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Render the PDF page
    await page.render({
      canvasContext: ctx as unknown as CanvasRenderingContext2D,
      viewport,
      canvas: canvas as unknown as HTMLCanvasElement,
    }).promise;

    // Convert to JPEG
    const blob = await canvas.convertToBlob({
      type: 'image/jpeg',
      quality: settings.quality,
    });
    const jpegBytes = new Uint8Array(await blob.arrayBuffer());
    totalRasterizedSize += jpegBytes.length;

    // Embed JPEG into new PDF
    const jpegImage = await newPdf.embedJpg(jpegBytes);

    // Create page with original PDF dimensions (in points, 72 DPI)
    const originalViewport = page.getViewport({ scale: 1 });
    const pageWidth = originalViewport.width;
    const pageHeight = originalViewport.height;

    const newPage = newPdf.addPage([pageWidth, pageHeight]);
    newPage.drawImage(jpegImage, {
      x: 0,
      y: 0,
      width: pageWidth,
      height: pageHeight,
    });

    // Clean up the page to free memory
    page.cleanup();
  }

  onProgress?.('Saving rasterized PDF...', 95);

  const pdfBytes = await newPdf.save({
    useObjectStreams: true,
  });

  // Clean up PDF.js document
  await pdfDoc.destroy();

  onProgress?.('Rasterization complete', 100);

  return {
    pdfBytes,
    pagesRasterized: numPages,
    totalOriginalContentSize: arrayBuffer.byteLength,
    totalRasterizedSize,
  };
};
