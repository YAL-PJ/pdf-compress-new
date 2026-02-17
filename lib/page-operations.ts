/**
 * Apply page operations (delete, rotate, reorder) to a PDF blob.
 * Uses pdf-lib to manipulate the PDF at download time.
 */

import { PDFDocument, degrees } from 'pdf-lib';
import type { PageState } from '@/hooks/usePageManager';

/**
 * Check whether the page states represent any actual modifications
 * (deletions, rotations, reordering, or keep-original) compared to the original PDF.
 */
export const hasPageModifications = (pages: PageState[]): boolean => {
    const hasDeleted = pages.some(p => p.isDeleted);
    const hasKeepOriginal = pages.some(p => p.keepOriginal);
    const hasRotated = pages.some(p => p.rotation !== 0);
    const hasReordered = pages.some((p, i) => p.index !== i + 1);
    return hasDeleted || hasKeepOriginal || hasRotated || hasReordered;
};

/**
 * Apply page operations to a PDF blob and return a new modified blob.
 * Operations applied: reorder, delete marked pages, keep-original pages, rotate pages.
 *
 * @param compressedBlob - The compressed PDF blob
 * @param pages - Page states with user modifications
 * @param originalFile - The original uncompressed file (needed for keep-original pages)
 */
export const applyPageOperations = async (
    compressedBlob: Blob,
    pages: PageState[],
    originalFile?: File,
): Promise<Blob> => {
    const compressedBuffer = await compressedBlob.arrayBuffer();
    const compressedDoc = await PDFDocument.load(compressedBuffer, { ignoreEncryption: true });

    // Load original document if any pages need to keep their original version
    const hasKeepOriginal = originalFile && pages.some(p => p.keepOriginal && !p.isDeleted);
    let originalDoc: PDFDocument | null = null;
    if (hasKeepOriginal) {
        const originalBuffer = await originalFile.arrayBuffer();
        originalDoc = await PDFDocument.load(originalBuffer, { ignoreEncryption: true });
    }

    // Create a new document and copy pages in the desired order
    const destDoc = await PDFDocument.create();

    // pages array is already in the user's desired order (via reorderPages)
    // Filter out deleted pages and get their original 0-based indices
    const activePages = pages.filter(p => !p.isDeleted);

    if (activePages.length === 0) {
        throw new Error('Cannot create a PDF with no pages');
    }

    for (const pageState of activePages) {
        const zeroIndex = pageState.index - 1; // convert 1-based to 0-based

        // Choose source: original doc for keep-original pages, compressed for others
        const sourceDoc = (pageState.keepOriginal && originalDoc) ? originalDoc : compressedDoc;
        const [copiedPage] = await destDoc.copyPages(sourceDoc, [zeroIndex]);

        // Apply rotation if needed
        if (pageState.rotation !== 0) {
            const currentRotation = copiedPage.getRotation().angle;
            copiedPage.setRotation(degrees(currentRotation + pageState.rotation));
        }

        destDoc.addPage(copiedPage);
    }

    const pdfBytes = await destDoc.save();
    return new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
};

/**
 * Estimate the byte contribution of each page in a PDF.
 * Creates a single-page PDF for each page and measures its size minus baseline overhead.
 * Returns a Map from 1-based page index to estimated byte size.
 */
export const estimatePageSizes = async (
    pdfBlob: Blob,
): Promise<Map<number, number>> => {
    const buffer = await pdfBlob.arrayBuffer();
    const srcDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    const pageCount = srcDoc.getPageCount();

    // Measure empty PDF overhead once
    const emptyDoc = await PDFDocument.create();
    const emptyBytes = await emptyDoc.save();
    const baselineSize = emptyBytes.length;

    const pageSizes = new Map<number, number>();

    for (let i = 0; i < pageCount; i++) {
        const singleDoc = await PDFDocument.create();
        const [copiedPage] = await singleDoc.copyPages(srcDoc, [i]);
        singleDoc.addPage(copiedPage);
        const singleBytes = await singleDoc.save();
        pageSizes.set(i + 1, Math.max(0, singleBytes.length - baselineSize));
    }

    return pageSizes;
};
