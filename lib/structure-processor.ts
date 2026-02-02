/**
 * Structure Processor - PDF structure cleanup methods
 * Each method modifies the PDF in place and returns actual bytes saved
 */

import {
  PDFDocument,
  PDFName,
  PDFDict,
  PDFArray,
  PDFRef,
} from 'pdf-lib';

/**
 * Helper to measure size change from an operation
 */
const measureSizeChange = async (
  pdfDoc: PDFDocument,
  operation: () => void
): Promise<number> => {
  const beforeBytes = await pdfDoc.save({ useObjectStreams: false });
  const beforeSize = beforeBytes.byteLength;

  operation();

  const afterBytes = await pdfDoc.save({ useObjectStreams: false });
  const afterSize = afterBytes.byteLength;

  return Math.max(0, beforeSize - afterSize);
};

/**
 * Remove JavaScript and Actions from PDF
 */
export const removeJavaScript = (pdfDoc: PDFDocument): void => {
  const catalog = pdfDoc.catalog;

  // Remove OpenAction (runs on document open)
  if (catalog.has(PDFName.of('OpenAction'))) {
    catalog.delete(PDFName.of('OpenAction'));
  }

  // Remove AA (Additional Actions) from catalog
  if (catalog.has(PDFName.of('AA'))) {
    catalog.delete(PDFName.of('AA'));
  }

  // Remove Names/JavaScript name tree
  const names = catalog.get(PDFName.of('Names'));
  if (names instanceof PDFDict) {
    if (names.has(PDFName.of('JavaScript'))) {
      names.delete(PDFName.of('JavaScript'));
    }
  }

  // Remove AA from each page
  const pages = pdfDoc.getPages();
  for (const page of pages) {
    const pageDict = page.node;
    if (pageDict.has(PDFName.of('AA'))) {
      pageDict.delete(PDFName.of('AA'));
    }
  }
};

/**
 * Remove Bookmarks/Outlines from PDF
 */
export const removeBookmarks = (pdfDoc: PDFDocument): void => {
  const catalog = pdfDoc.catalog;
  if (catalog.has(PDFName.of('Outlines'))) {
    catalog.delete(PDFName.of('Outlines'));
  }
};

/**
 * Remove Named Destinations from PDF
 */
export const removeNamedDestinations = (pdfDoc: PDFDocument): void => {
  const catalog = pdfDoc.catalog;

  // Remove Dests dictionary (older style)
  if (catalog.has(PDFName.of('Dests'))) {
    catalog.delete(PDFName.of('Dests'));
  }

  // Remove from Names tree
  const names = catalog.get(PDFName.of('Names'));
  if (names instanceof PDFDict) {
    if (names.has(PDFName.of('Dests'))) {
      names.delete(PDFName.of('Dests'));
    }
  }
};

/**
 * Remove Article Threads from PDF
 */
export const removeArticleThreads = (pdfDoc: PDFDocument): void => {
  const catalog = pdfDoc.catalog;
  if (catalog.has(PDFName.of('Threads'))) {
    catalog.delete(PDFName.of('Threads'));
  }
};

/**
 * Remove Web Capture Info from PDF
 */
export const removeWebCaptureInfo = (pdfDoc: PDFDocument): void => {
  const catalog = pdfDoc.catalog;

  if (catalog.has(PDFName.of('SpiderInfo'))) {
    catalog.delete(PDFName.of('SpiderInfo'));
  }

  if (catalog.has(PDFName.of('IDS'))) {
    catalog.delete(PDFName.of('IDS'));
  }

  if (catalog.has(PDFName.of('URLS'))) {
    catalog.delete(PDFName.of('URLS'));
  }
};

/**
 * Remove Hidden Layers (Optional Content Groups)
 * Only removes the OFF array, doesn't delete layer content
 */
export const removeHiddenLayers = (pdfDoc: PDFDocument): void => {
  const catalog = pdfDoc.catalog;

  const ocProps = catalog.get(PDFName.of('OCProperties'));
  if (ocProps instanceof PDFDict) {
    const d = ocProps.get(PDFName.of('D'));
    if (d instanceof PDFDict) {
      if (d.has(PDFName.of('OFF'))) {
        d.delete(PDFName.of('OFF'));
      }
    }
  }
};

/**
 * Remove Page Labels from PDF
 */
export const removePageLabels = (pdfDoc: PDFDocument): void => {
  const catalog = pdfDoc.catalog;
  if (catalog.has(PDFName.of('PageLabels'))) {
    catalog.delete(PDFName.of('PageLabels'));
  }
};

/**
 * Deep Clean Metadata - removes XMP metadata and other hidden data
 */
export const deepCleanMetadata = (pdfDoc: PDFDocument): void => {
  const catalog = pdfDoc.catalog;

  // Remove XMP Metadata stream
  if (catalog.has(PDFName.of('Metadata'))) {
    catalog.delete(PDFName.of('Metadata'));
  }

  // Remove MarkInfo (marked content)
  if (catalog.has(PDFName.of('MarkInfo'))) {
    catalog.delete(PDFName.of('MarkInfo'));
  }

  // Remove StructTreeRoot (tagged PDF structure)
  if (catalog.has(PDFName.of('StructTreeRoot'))) {
    catalog.delete(PDFName.of('StructTreeRoot'));
  }

  // Remove PieceInfo (private application data)
  if (catalog.has(PDFName.of('PieceInfo'))) {
    catalog.delete(PDFName.of('PieceInfo'));
  }

  // Remove from each page as well
  const pages = pdfDoc.getPages();
  for (const page of pages) {
    const pageDict = page.node;
    if (pageDict.has(PDFName.of('PieceInfo'))) {
      pageDict.delete(PDFName.of('PieceInfo'));
    }
    if (pageDict.has(PDFName.of('Metadata'))) {
      pageDict.delete(PDFName.of('Metadata'));
    }
  }

  // Also clear standard metadata
  pdfDoc.setTitle('');
  pdfDoc.setAuthor('');
  pdfDoc.setSubject('');
  pdfDoc.setKeywords([]);
  pdfDoc.setProducer('');
  pdfDoc.setCreator('');
  pdfDoc.setCreationDate(new Date(0));
  pdfDoc.setModificationDate(new Date(0));
};

/**
 * Remove Embedded Thumbnails from pages
 */
export const removeThumbnails = (pdfDoc: PDFDocument): void => {
  const pages = pdfDoc.getPages();
  for (const page of pages) {
    const pageDict = page.node;
    if (pageDict.has(PDFName.of('Thumb'))) {
      pageDict.delete(PDFName.of('Thumb'));
    }
  }
};

/**
 * Remove Embedded Files/Attachments
 * Returns count of removed attachments
 */
export const removeAttachments = (pdfDoc: PDFDocument): number => {
  let count = 0;
  const catalog = pdfDoc.catalog;

  // Check Names tree for EmbeddedFiles
  const names = catalog.get(PDFName.of('Names'));
  if (names instanceof PDFDict) {
    if (names.has(PDFName.of('EmbeddedFiles'))) {
      names.delete(PDFName.of('EmbeddedFiles'));
      count++;
    }
  }

  // Check for AF (Associated Files) - PDF 2.0
  if (catalog.has(PDFName.of('AF'))) {
    catalog.delete(PDFName.of('AF'));
    count++;
  }

  // Remove page-level file attachments
  const pages = pdfDoc.getPages();
  for (const page of pages) {
    const pageDict = page.node;
    const annots = pageDict.get(PDFName.of('Annots'));

    if (annots instanceof PDFArray) {
      const newAnnots: PDFRef[] = [];
      for (let i = 0; i < annots.size(); i++) {
        const annotRef = annots.get(i);
        if (annotRef instanceof PDFRef) {
          const annot = pdfDoc.context.lookup(annotRef);
          if (annot instanceof PDFDict) {
            const subtype = annot.get(PDFName.of('Subtype'));
            if (subtype instanceof PDFName && subtype.toString() === '/FileAttachment') {
              count++;
              continue;
            }
          }
          newAnnots.push(annotRef);
        }
      }

      if (newAnnots.length !== annots.size()) {
        if (newAnnots.length === 0) {
          pageDict.delete(PDFName.of('Annots'));
        } else {
          pageDict.set(PDFName.of('Annots'), pdfDoc.context.obj(newAnnots));
        }
      }
    }
  }

  return count;
};

/**
 * Flatten Form Fields - convert interactive forms to static content
 */
export const flattenForms = (pdfDoc: PDFDocument): number => {
  let fieldsFlattened = 0;

  try {
    const form = pdfDoc.getForm();
    const fields = form.getFields();

    if (fields.length > 0) {
      fieldsFlattened = fields.length;
      form.flatten();
    }
  } catch {
    // PDF may not have forms or forms are invalid
  }

  return fieldsFlattened;
};

/**
 * Flatten Annotations - removes non-essential annotations
 * NOTE: Does NOT remove /Link to preserve hyperlinks
 */
export const flattenAnnotations = (pdfDoc: PDFDocument): number => {
  let removedCount = 0;
  const pages = pdfDoc.getPages();

  // Annotation types that can be safely removed (non-visual or rarely needed)
  const removableTypes = new Set([
    '/Popup',       // Popup notes (orphaned)
    '/Sound',       // Sound annotations
    '/Movie',       // Movie annotations
    '/Screen',      // Screen annotations
    '/PrinterMark', // Printer marks
    '/TrapNet',     // Trap network annotations
    '/3D',          // 3D annotations
    '/RichMedia',   // Rich media
  ]);

  for (const page of pages) {
    const pageDict = page.node;
    const annots = pageDict.get(PDFName.of('Annots'));

    if (annots instanceof PDFArray) {
      const newAnnots: PDFRef[] = [];

      for (let i = 0; i < annots.size(); i++) {
        const annotRef = annots.get(i);
        if (annotRef instanceof PDFRef) {
          const annot = pdfDoc.context.lookup(annotRef);
          if (annot instanceof PDFDict) {
            const subtype = annot.get(PDFName.of('Subtype'));
            if (subtype instanceof PDFName && removableTypes.has(subtype.toString())) {
              removedCount++;
              continue;
            }
          }
          newAnnots.push(annotRef);
        }
      }

      if (newAnnots.length !== annots.size()) {
        if (newAnnots.length === 0) {
          pageDict.delete(PDFName.of('Annots'));
        } else {
          pageDict.set(PDFName.of('Annots'), pdfDoc.context.obj(newAnnots));
        }
      }
    }
  }

  return removedCount;
};

/**
 * Apply all enabled structure cleanup methods to a PDF document
 * Returns object with count/details for each method
 */
export interface StructureCleanupOptions {
  removeJavaScript?: boolean;
  removeBookmarks?: boolean;
  removeNamedDestinations?: boolean;
  removeArticleThreads?: boolean;
  removeWebCaptureInfo?: boolean;
  removeHiddenLayers?: boolean;
  removePageLabels?: boolean;
  deepCleanMetadata?: boolean;
  removeThumbnails?: boolean;
  removeAttachments?: boolean;
  flattenForms?: boolean;
  flattenAnnotations?: boolean;
}

export interface StructureCleanupResult {
  attachmentsRemoved: number;
  formsFlattened: number;
  annotationsRemoved: number;
}

export const applyStructureCleanup = (
  pdfDoc: PDFDocument,
  options: StructureCleanupOptions
): StructureCleanupResult => {
  const result: StructureCleanupResult = {
    attachmentsRemoved: 0,
    formsFlattened: 0,
    annotationsRemoved: 0,
  };

  if (options.removeJavaScript) {
    removeJavaScript(pdfDoc);
  }

  if (options.removeBookmarks) {
    removeBookmarks(pdfDoc);
  }

  if (options.removeNamedDestinations) {
    removeNamedDestinations(pdfDoc);
  }

  if (options.removeArticleThreads) {
    removeArticleThreads(pdfDoc);
  }

  if (options.removeWebCaptureInfo) {
    removeWebCaptureInfo(pdfDoc);
  }

  if (options.removeHiddenLayers) {
    removeHiddenLayers(pdfDoc);
  }

  if (options.removePageLabels) {
    removePageLabels(pdfDoc);
  }

  if (options.deepCleanMetadata) {
    deepCleanMetadata(pdfDoc);
  }

  if (options.removeThumbnails) {
    removeThumbnails(pdfDoc);
  }

  if (options.removeAttachments) {
    result.attachmentsRemoved = removeAttachments(pdfDoc);
  }

  if (options.flattenForms) {
    result.formsFlattened = flattenForms(pdfDoc);
  }

  if (options.flattenAnnotations) {
    result.annotationsRemoved = flattenAnnotations(pdfDoc);
  }

  return result;
};
