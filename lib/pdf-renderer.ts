/**
 * PDF Renderer - Renders PDF pages to images using PDF.js
 * Uses dynamic imports to avoid SSR issues
 */

// Lazy-loaded pdfjs-dist module
let pdfjsLib: typeof import('pdfjs-dist') | null = null;

/**
 * Lazily initialize PDF.js
 */
const getPdfjs = async () => {
  if (pdfjsLib) return pdfjsLib;

  // Dynamic import to avoid SSR issues
  pdfjsLib = await import('pdfjs-dist');

  // Configure worker
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

  return pdfjsLib;
};

/**
 * Render a PDF page to a JPEG data URL
 */
export const renderPageToImage = async (
  file: File,
  pageIndex: number = 1,
  scale: number = 1.5
): Promise<string> => {
  // Get PDF.js lazily
  const pdfjs = await getPdfjs();

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  // Validate page index
  const numPages = pdf.numPages;
  if (pageIndex < 1 || pageIndex > numPages) {
    throw new Error(`Invalid page index ${pageIndex}. PDF has ${numPages} pages.`);
  }

  const page = await pdf.getPage(pageIndex);
  const viewport = page.getViewport({ scale });

  // Create canvas
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Canvas context not available');
  }

  canvas.height = viewport.height;
  canvas.width = viewport.width;

  await page.render({
    canvasContext: context,
    viewport: viewport,
    canvas: canvas,
  }).promise;

  return canvas.toDataURL('image/jpeg', 0.9);
};

/**
 * Get total number of pages in a PDF
 */
export const getPdfPageCount = async (file: File): Promise<number> => {
  const pdfjs = await getPdfjs();
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  return pdf.numPages;
};
