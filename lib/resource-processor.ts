/**
 * Resource Processor - Handles resource optimization
 * - Duplicate resource removal (images, fonts, etc.)
 * - Unused font removal
 */

import {
  PDFDocument,
  PDFName,
  PDFDict,
  PDFArray,
  PDFRef,
  PDFStream,
  PDFRawStream,
  PDFHexString,
  PDFString,
} from 'pdf-lib';
import pako from 'pako';

export interface DuplicateRemovalResult {
  duplicatesFound: number;
  bytesEstimatedSaved: number;
}

export interface UnusedFontResult {
  fontsRemoved: number;
  fontNames: string[];
}

/**
 * Calculate a simple hash for binary data
 * Uses FNV-1a algorithm for speed
 */
const hashBytes = (bytes: Uint8Array): string => {
  let hash = 2166136261; // FNV offset basis
  for (let i = 0; i < bytes.length; i++) {
    hash ^= bytes[i];
    hash = (hash * 16777619) >>> 0; // FNV prime, keep as 32-bit
  }
  return hash.toString(16);
};

/**
 * Get raw content bytes from a stream object (without decompression).
 * Used for hashing/deduplication where we compare raw bytes.
 */
const getStreamBytes = (stream: PDFStream | PDFRawStream): Uint8Array | null => {
  try {
    if (stream instanceof PDFRawStream) {
      return stream.contents;
    }
    return stream.getContents();
  } catch {
    return null;
  }
};

/**
 * Get decompressed content bytes from a stream object.
 * Content streams are often Flate-compressed; we must decompress
 * before scanning for PDF operators like Tf.
 */
const getDecompressedStreamBytes = (stream: PDFStream | PDFRawStream): Uint8Array | null => {
  try {
    let rawBytes: Uint8Array;
    if (stream instanceof PDFRawStream) {
      rawBytes = stream.contents;
    } else {
      rawBytes = stream.getContents();
    }

    // Check if the stream has a Filter that needs decompression
    const filter = stream.dict.get(PDFName.of('Filter'));
    if (!filter) {
      return rawBytes;
    }

    let filterName: string | undefined;
    if (filter instanceof PDFName) {
      filterName = filter.toString();
    } else if (filter instanceof PDFArray && filter.size() > 0) {
      const first = filter.get(0);
      if (first instanceof PDFName) {
        filterName = first.toString();
      }
    }

    if (filterName === '/FlateDecode') {
      try {
        return pako.inflate(rawBytes);
      } catch {
        // Decompression failed, return raw bytes as fallback
        return rawBytes;
      }
    }

    // For other filters, return raw bytes
    return rawBytes;
  } catch {
    return null;
  }
};

/**
 * Check if an object is an image XObject
 */
const isImageXObject = (dict: PDFDict): boolean => {
  const subtype = dict.get(PDFName.of('Subtype'));
  return subtype instanceof PDFName && subtype.toString() === '/Image';
};

/**
 * Remove duplicate resources from PDF
 * Finds identical streams (images, etc.) and merges references
 */
export const removeDuplicateResources = (pdfDoc: PDFDocument): DuplicateRemovalResult => {
  const result: DuplicateRemovalResult = {
    duplicatesFound: 0,
    bytesEstimatedSaved: 0,
  };

  const context = pdfDoc.context;
  const allRefs = context.enumerateIndirectObjects();

  // Map: hash -> { ref, size }
  const hashToRef = new Map<string, { ref: PDFRef; size: number }>();
  // Map: duplicate ref -> canonical ref
  const refRemapping = new Map<string, PDFRef>();

  // First pass: find duplicates
  for (const [ref, obj] of allRefs) {
    if (!(obj instanceof PDFRawStream) && !(obj instanceof PDFStream)) {
      continue;
    }

    const stream = obj;
    const dict = stream.dict;

    // Only process image XObjects for now (safest)
    if (!isImageXObject(dict)) {
      continue;
    }

    const bytes = getStreamBytes(stream);
    if (!bytes || bytes.length < 1024) {
      // Skip tiny streams - not worth deduplicating
      continue;
    }

    // Create hash including dimensions to avoid false matches
    const width = dict.get(PDFName.of('Width'))?.toString() || '0';
    const height = dict.get(PDFName.of('Height'))?.toString() || '0';
    const contentHash = hashBytes(bytes);
    const fullHash = `${width}x${height}-${contentHash}`;

    const refKey = `${ref.objectNumber}-${ref.generationNumber}`;

    const existing = hashToRef.get(fullHash);
    if (existing) {
      // Found a duplicate
      refRemapping.set(refKey, existing.ref);
      result.duplicatesFound++;
      result.bytesEstimatedSaved += bytes.length;
    } else {
      hashToRef.set(fullHash, { ref, size: bytes.length });
    }
  }

  if (refRemapping.size === 0) {
    return result;
  }

  // Second pass: update references in page resources
  const pages = pdfDoc.getPages();
  for (const page of pages) {
    const pageDict = page.node;
    const resources = pageDict.get(PDFName.of('Resources'));

    if (!(resources instanceof PDFDict)) {
      continue;
    }

    const xobject = resources.get(PDFName.of('XObject'));
    if (!(xobject instanceof PDFDict)) {
      continue;
    }

    // Check each XObject reference
    const entries = xobject.entries();
    for (const [name, value] of entries) {
      if (value instanceof PDFRef) {
        const refKey = `${value.objectNumber}-${value.generationNumber}`;
        const newRef = refRemapping.get(refKey);
        if (newRef) {
          xobject.set(name, newRef);
        }
      }
    }
  }

  return result;
};

/**
 * Extract font name from a font dictionary
 */
const getFontName = (fontDict: PDFDict): string | null => {
  // Try BaseFont first (most common)
  const baseFont = fontDict.get(PDFName.of('BaseFont'));
  if (baseFont instanceof PDFName) {
    return baseFont.toString().replace('/', '');
  }

  // Try FontName in FontDescriptor
  const descriptor = fontDict.get(PDFName.of('FontDescriptor'));
  if (descriptor instanceof PDFDict) {
    const fontName = descriptor.get(PDFName.of('FontName'));
    if (fontName instanceof PDFName) {
      return fontName.toString().replace('/', '');
    }
  }

  return null;
};

/**
 * Scan content stream for font usage (Tf operator)
 */
const extractUsedFonts = (contentBytes: Uint8Array): Set<string> => {
  const usedFonts = new Set<string>();

  try {
    // Convert to string for parsing
    const content = new TextDecoder('latin1').decode(contentBytes);

    // Match font references: /FontName Tf or /F1 Tf patterns
    // Font names appear before 'Tf' operator
    const fontRegex = /\/([A-Za-z0-9_+-]+)\s+[\d.]+\s+Tf/g;
    let match;

    while ((match = fontRegex.exec(content)) !== null) {
      usedFonts.add(match[1]);
    }
  } catch {
    // If parsing fails, return empty set (safe - won't remove fonts)
  }

  return usedFonts;
};

/**
 * Remove unused fonts from PDF
 * Analyzes content streams to find which fonts are actually used
 */
/**
 * Extract font references from a content stream (ref or array of refs)
 */
const extractFontsFromContentRef = (
  pdfDoc: PDFDocument,
  contents: PDFRef | PDFArray,
  usedFonts: Set<string>,
): void => {
  if (contents instanceof PDFRef) {
    const contentObj = pdfDoc.context.lookup(contents);
    if (contentObj instanceof PDFRawStream || contentObj instanceof PDFStream) {
      const bytes = getDecompressedStreamBytes(contentObj);
      if (bytes) {
        extractUsedFonts(bytes).forEach(f => usedFonts.add(f));
      }
    }
  } else if (contents instanceof PDFArray) {
    for (let i = 0; i < contents.size(); i++) {
      const contentRef = contents.get(i);
      if (contentRef instanceof PDFRef) {
        extractFontsFromContentRef(pdfDoc, contentRef, usedFonts);
      }
    }
  }
};

/**
 * Scan Form XObjects for font usage (they have their own content streams)
 */
const extractFontsFromXObjects = (
  pdfDoc: PDFDocument,
  resources: PDFDict,
  usedFonts: Set<string>,
  visited: Set<string>,
): void => {
  const xobjects = resources.get(PDFName.of('XObject'));
  if (!(xobjects instanceof PDFDict)) return;

  for (const [, value] of xobjects.entries()) {
    const ref = value instanceof PDFRef ? value : null;
    if (!ref) continue;

    // Avoid infinite recursion from circular references
    const refKey = `${ref.objectNumber}-${ref.generationNumber}`;
    if (visited.has(refKey)) continue;
    visited.add(refKey);

    const obj = pdfDoc.context.lookup(ref);
    if (!(obj instanceof PDFRawStream) && !(obj instanceof PDFStream)) continue;

    const stream = obj;
    const dict = stream.dict;

    // Only process Form XObjects (not Image XObjects)
    const subtype = dict.get(PDFName.of('Subtype'));
    if (!(subtype instanceof PDFName) || subtype.toString() !== '/Form') continue;

    // Scan the Form XObject's content stream for Tf operators
    const bytes = getDecompressedStreamBytes(stream);
    if (bytes) {
      extractUsedFonts(bytes).forEach(f => usedFonts.add(f));
    }

    // Recursively scan nested Form XObject resources
    const formResources = dict.get(PDFName.of('Resources'));
    if (formResources instanceof PDFDict) {
      extractFontsFromXObjects(pdfDoc, formResources, usedFonts, visited);
    }
  }
};

/**
 * Scan annotation appearance streams for font usage
 */
const extractFontsFromAnnotations = (
  pdfDoc: PDFDocument,
  pageDict: PDFDict,
  usedFonts: Set<string>,
): void => {
  const annots = pageDict.get(PDFName.of('Annots'));
  if (!annots) return;

  const annotArray = annots instanceof PDFRef
    ? pdfDoc.context.lookup(annots)
    : annots;
  if (!(annotArray instanceof PDFArray)) return;

  for (let i = 0; i < annotArray.size(); i++) {
    const annotRef = annotArray.get(i);
    const annotObj = annotRef instanceof PDFRef
      ? pdfDoc.context.lookup(annotRef)
      : annotRef;
    if (!(annotObj instanceof PDFDict)) continue;

    const ap = annotObj.get(PDFName.of('AP'));
    if (!(ap instanceof PDFDict)) continue;

    // Check Normal, Rollover, and Down appearance streams
    for (const apKey of ['N', 'R', 'D']) {
      const appearance = ap.get(PDFName.of(apKey));
      if (!appearance) continue;

      const appearanceObj = appearance instanceof PDFRef
        ? pdfDoc.context.lookup(appearance)
        : appearance;

      if (appearanceObj instanceof PDFRawStream || appearanceObj instanceof PDFStream) {
        const bytes = getDecompressedStreamBytes(appearanceObj);
        if (bytes) {
          extractUsedFonts(bytes).forEach(f => usedFonts.add(f));
        }
      }
    }
  }
};

export const removeUnusedFonts = (pdfDoc: PDFDocument): UnusedFontResult => {
  const result: UnusedFontResult = {
    fontsRemoved: 0,
    fontNames: [],
  };

  // Collect all used font names across all pages, including XObjects and annotations
  const allUsedFonts = new Set<string>();
  const pages = pdfDoc.getPages();
  const visitedXObjects = new Set<string>();

  for (const page of pages) {
    const pageDict = page.node;

    // Scan page content streams
    const contents = pageDict.get(PDFName.of('Contents'));
    if (contents instanceof PDFRef || contents instanceof PDFArray) {
      extractFontsFromContentRef(pdfDoc, contents, allUsedFonts);
    }

    // Scan Form XObjects (which have their own content streams)
    const resources = pageDict.get(PDFName.of('Resources'));
    if (resources instanceof PDFDict) {
      extractFontsFromXObjects(pdfDoc, resources, allUsedFonts, visitedXObjects);
    }

    // Scan annotation appearance streams
    extractFontsFromAnnotations(pdfDoc, pageDict, allUsedFonts);
  }

  // Now check each page's font resources
  for (const page of pages) {
    const pageDict = page.node;
    const resources = pageDict.get(PDFName.of('Resources'));

    if (!(resources instanceof PDFDict)) {
      continue;
    }

    const fonts = resources.get(PDFName.of('Font'));
    if (!(fonts instanceof PDFDict)) {
      continue;
    }

    const fontEntries = fonts.entries();
    const fontsToRemove: PDFName[] = [];

    for (const [fontKey, fontValue] of fontEntries) {
      // fontKey is like /F1, /F2, etc.
      const fontKeyStr = fontKey.toString().replace('/', '');

      // Check if this font key is used in any content stream
      if (!allUsedFonts.has(fontKeyStr)) {
        // Get font name for logging
        let fontName = fontKeyStr;
        if (fontValue instanceof PDFRef) {
          const fontDict = pdfDoc.context.lookup(fontValue);
          if (fontDict instanceof PDFDict) {
            const name = getFontName(fontDict);
            if (name) fontName = name;
          }
        }

        fontsToRemove.push(fontKey);
        result.fontNames.push(fontName);
      }
    }

    // Remove unused fonts from this page's resources
    for (const fontKey of fontsToRemove) {
      fonts.delete(fontKey);
      result.fontsRemoved++;
    }
  }

  return result;
};
