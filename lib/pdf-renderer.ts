
import * as pdfjsLib from 'pdfjs-dist';

// Make sure to copy the worker file to your public folder or configure the workerSrc correctly
// For next.js, it's often easiest to use a CDN or copy the worker during build
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export const renderPageToImage = async (file: File, pageIndex: number = 1, scale: number = 1.5): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
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
