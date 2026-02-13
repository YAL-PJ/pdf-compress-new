/**
 * Apply page operations (delete, rotate, reorder) to a PDF blob.
 * Uses pdf-lib to manipulate the PDF at download time.
 */

import { PDFDocument, degrees } from 'pdf-lib';
import type { PageState } from '@/hooks/usePageManager';

/**
 * Check whether the page states represent any actual modifications
 * (deletions, rotations, or reordering) compared to the original PDF.
 */
export const hasPageModifications = (pages: PageState[]): boolean => {
    const hasDeleted = pages.some(p => p.isDeleted);
    const hasRotated = pages.some(p => p.rotation !== 0);
    const hasReordered = pages.some((p, i) => p.index !== i + 1);
    return hasDeleted || hasRotated || hasReordered;
};

/**
 * Apply page operations to a PDF blob and return a new modified blob.
 * Operations applied: reorder, delete marked pages, rotate pages.
 */
export const applyPageOperations = async (
    sourceBlob: Blob,
    pages: PageState[],
): Promise<Blob> => {
    const arrayBuffer = await sourceBlob.arrayBuffer();
    const srcDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });

    // Create a new document and copy pages in the desired order
    const destDoc = await PDFDocument.create();

    // pages array is already in the user's desired order (via reorderPages)
    // Filter out deleted pages and get their original 0-based indices
    const activePages = pages.filter(p => !p.isDeleted);

    if (activePages.length === 0) {
        throw new Error('Cannot create a PDF with no pages');
    }

    // Copy pages in the reordered sequence
    const originalIndices = activePages.map(p => p.index - 1); // convert 1-based to 0-based
    const copiedPages = await destDoc.copyPages(srcDoc, originalIndices);

    for (let i = 0; i < copiedPages.length; i++) {
        const page = copiedPages[i];
        const pageState = activePages[i];

        // Apply rotation if needed
        if (pageState.rotation !== 0) {
            const currentRotation = page.getRotation().angle;
            page.setRotation(degrees(currentRotation + pageState.rotation));
        }

        destDoc.addPage(page);
    }

    const pdfBytes = await destDoc.save();
    return new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
};
