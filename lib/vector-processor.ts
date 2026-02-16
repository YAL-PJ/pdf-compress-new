/**
 * Vector Processor
 * Handles optimization of vector-heavy PDFs: gradient deduplication,
 * unused shading removal, and decimal precision reduction in content streams.
 * Targets InDesign/Illustrator exports with many shading objects and complex paths.
 */

import {
  PDFDocument,
  PDFName,
  PDFDict,
  PDFArray,
  PDFRef,
  PDFStream,
  PDFRawStream,
  PDFNumber,
} from 'pdf-lib';
import pako from 'pako';

// ============================================================================
// Types
// ============================================================================

export interface ShadingDeduplicationResult {
  duplicatesRemoved: number;
  shadingsAnalyzed: number;
}

export interface UnusedShadingResult {
  unusedRemoved: number;
  shadingsAnalyzed: number;
}

export interface DecimalPrecisionResult {
  pagesProcessed: number;
  operatorsSimplified: number;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Serialize a PDF object to a comparable string for deduplication.
 * Normalizes the shading dictionary content for comparison.
 */
function serializeShadingDict(dict: PDFDict, context: import('pdf-lib').PDFContext): string {
  const parts: string[] = [];
  const entries = dict.entries();
  // Sort entries for deterministic comparison
  const sorted = [...entries].sort((a, b) => a[0].toString().localeCompare(b[0].toString()));
  for (const [key, value] of sorted) {
    const keyStr = key.toString();
    // Skip /Length as it's derived
    if (keyStr === '/Length') continue;
    parts.push(`${keyStr}=${serializeValue(value, context)}`);
  }
  return parts.join('|');
}

function serializeValue(value: unknown, context: import('pdf-lib').PDFContext): string {
  if (value instanceof PDFRef) {
    const resolved = context.lookup(value);
    if (resolved instanceof PDFDict) {
      return `{${serializeShadingDict(resolved, context)}}`;
    }
    if (resolved instanceof PDFRawStream || resolved instanceof PDFStream) {
      const dictStr = serializeShadingDict(resolved.dict, context);
      const bytes = resolved instanceof PDFRawStream ? resolved.contents : resolved.getContents();
      // Use first 256 bytes + length as fingerprint for stream data
      const fingerprint = bytes
        ? `${bytes.length}:${Array.from(bytes.slice(0, 256)).join(',')}`
        : '0:';
      return `{${dictStr}}[${fingerprint}]`;
    }
    return value.toString();
  }
  if (value instanceof PDFDict) {
    return `{${serializeShadingDict(value, context)}}`;
  }
  if (value instanceof PDFArray) {
    const items: string[] = [];
    for (let i = 0; i < value.size(); i++) {
      items.push(serializeValue(value.get(i), context));
    }
    return `[${items.join(',')}]`;
  }
  if (value instanceof PDFName) {
    return value.toString();
  }
  return String(value);
}

/**
 * Decompress a content stream's bytes, handling FlateDecode.
 */
function decompressContentStream(
  stream: PDFRawStream | PDFStream
): Uint8Array | null {
  try {
    const bytes = stream instanceof PDFRawStream ? stream.contents : stream.getContents();
    if (!bytes) return null;

    const filter = stream.dict.get(PDFName.of('Filter'));
    if (filter instanceof PDFName && filter.toString() === '/FlateDecode') {
      return pako.inflate(bytes);
    }
    if (filter instanceof PDFArray && filter.size() > 0) {
      const first = filter.get(0);
      if (first instanceof PDFName && first.toString() === '/FlateDecode') {
        return pako.inflate(bytes);
      }
    }
    // Uncompressed or unknown filter — return raw
    if (!filter) return bytes;
    return null; // Unknown filter, skip
  } catch {
    return null;
  }
}

// ============================================================================
// 1. Deduplicate Shading Objects
// ============================================================================

/**
 * Find and deduplicate identical shading objects across pages.
 * InDesign often exports duplicate gradient definitions.
 * This replaces duplicate shading refs with a single canonical ref.
 */
export const deduplicateShadings = (
  pdfDoc: PDFDocument,
  onProgress?: (message: string, percent?: number) => void,
): ShadingDeduplicationResult => {
  const result: ShadingDeduplicationResult = {
    duplicatesRemoved: 0,
    shadingsAnalyzed: 0,
  };

  const context = pdfDoc.context;
  const pages = pdfDoc.getPages();

  // Phase 1: Collect all shading refs and their serialized forms
  const shadingMap = new Map<string, PDFRef>(); // serialized → canonical ref
  const refReplacements = new Map<string, PDFRef>(); // old ref string → new ref

  onProgress?.('Analyzing shading objects...', 0);

  for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
    const page = pages[pageIdx];
    const resources = page.node.get(PDFName.of('Resources'));
    if (!(resources instanceof PDFDict)) continue;

    const shadingDict = resources.get(PDFName.of('Shading'));
    if (!(shadingDict instanceof PDFDict)) continue;

    const entries = shadingDict.entries();
    for (const [, ref] of entries) {
      if (!(ref instanceof PDFRef)) continue;

      result.shadingsAnalyzed++;
      const obj = context.lookup(ref);
      if (!obj) continue;

      let serialized: string;
      if (obj instanceof PDFDict) {
        serialized = serializeShadingDict(obj, context);
      } else if (obj instanceof PDFRawStream || obj instanceof PDFStream) {
        serialized = serializeShadingDict(obj.dict, context);
        const bytes = obj instanceof PDFRawStream ? obj.contents : obj.getContents();
        if (bytes) {
          serialized += `|stream:${bytes.length}:${Array.from(bytes.slice(0, 256)).join(',')}`;
        }
      } else {
        continue;
      }

      const existing = shadingMap.get(serialized);
      if (existing) {
        // This is a duplicate — map it to the canonical ref
        const refStr = `${ref.objectNumber}-${ref.generationNumber}`;
        refReplacements.set(refStr, existing);
        result.duplicatesRemoved++;
      } else {
        shadingMap.set(serialized, ref);
      }
    }
  }

  if (result.duplicatesRemoved === 0) return result;

  // Phase 2: Replace duplicate refs in page Shading dictionaries
  onProgress?.(`Replacing ${result.duplicatesRemoved} duplicate shadings...`, 50);

  for (const page of pages) {
    const resources = page.node.get(PDFName.of('Resources'));
    if (!(resources instanceof PDFDict)) continue;

    const shadingDict = resources.get(PDFName.of('Shading'));
    if (!(shadingDict instanceof PDFDict)) continue;

    const entries = shadingDict.entries();
    for (const [name, ref] of entries) {
      if (!(ref instanceof PDFRef)) continue;
      const refStr = `${ref.objectNumber}-${ref.generationNumber}`;
      const replacement = refReplacements.get(refStr);
      if (replacement) {
        shadingDict.set(name as PDFName, replacement);
      }
    }
  }

  onProgress?.('Shading deduplication complete', 100);
  return result;
};

// ============================================================================
// 2. Remove Unused Shading Objects
// ============================================================================

/**
 * Remove shading objects that are defined in page resources but never
 * referenced in the page's content stream (e.g., leftover from editing).
 */
export const removeUnusedShadings = (
  pdfDoc: PDFDocument,
  onProgress?: (message: string, percent?: number) => void,
): UnusedShadingResult => {
  const result: UnusedShadingResult = {
    unusedRemoved: 0,
    shadingsAnalyzed: 0,
  };

  const context = pdfDoc.context;
  const pages = pdfDoc.getPages();

  onProgress?.('Scanning for unused shadings...', 0);

  for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
    const page = pages[pageIdx];
    const resources = page.node.get(PDFName.of('Resources'));
    if (!(resources instanceof PDFDict)) continue;

    const shadingDict = resources.get(PDFName.of('Shading'));
    if (!(shadingDict instanceof PDFDict)) continue;

    // Get all shading names defined in resources
    const shadingNames = new Set<string>();
    const entries = shadingDict.entries();
    for (const [name] of entries) {
      shadingNames.add(name.toString().replace('/', ''));
      result.shadingsAnalyzed++;
    }

    if (shadingNames.size === 0) continue;

    // Parse content stream(s) to find which shadings are actually used
    const usedShadings = new Set<string>();
    const contentsRef = page.node.get(PDFName.of('Contents'));
    if (!contentsRef) continue;

    const contentRefs: PDFRef[] = [];
    if (contentsRef instanceof PDFRef) {
      contentRefs.push(contentsRef);
    } else if (contentsRef instanceof PDFArray) {
      for (let i = 0; i < contentsRef.size(); i++) {
        const ref = contentsRef.get(i);
        if (ref instanceof PDFRef) contentRefs.push(ref);
      }
    }

    for (const contentRef of contentRefs) {
      const contentObj = context.lookup(contentRef);
      if (!(contentObj instanceof PDFRawStream) && !(contentObj instanceof PDFStream)) continue;

      const decompressed = decompressContentStream(contentObj);
      if (!decompressed) continue;

      const content = new TextDecoder('latin1').decode(decompressed);

      // Find shading references: /ShName sh (paint shading operator)
      // Also check for /ShName in BDC/BMC marked content
      for (const name of shadingNames) {
        // The 'sh' operator: /ShName sh
        if (content.includes(`/${name} sh`) || content.includes(`/${name}\nsh`) || content.includes(`/${name}\rsh`)) {
          usedShadings.add(name);
        }
        // Also check for general reference (e.g., in Do operators or nested)
        if (content.includes(`/${name} `)) {
          usedShadings.add(name);
        }
      }
    }

    // Remove unused shadings
    const toRemove: PDFName[] = [];
    for (const [name] of entries) {
      const cleanName = name.toString().replace('/', '');
      if (!usedShadings.has(cleanName)) {
        toRemove.push(name as PDFName);
      }
    }

    for (const name of toRemove) {
      const ref = shadingDict.get(name);
      shadingDict.delete(name);
      result.unusedRemoved++;

      // Also delete the shading object itself if it's a ref
      if (ref instanceof PDFRef) {
        try {
          context.delete(ref);
        } catch {
          // May be referenced elsewhere
        }
      }
    }

    const progress = Math.round(((pageIdx + 1) / pages.length) * 100);
    onProgress?.(`Processed page ${pageIdx + 1}/${pages.length}`, progress);
  }

  return result;
};

// ============================================================================
// 3. Reduce Decimal Precision in Vector Paths
// ============================================================================

/**
 * Reduce excessive decimal precision in PDF content stream path operators.
 * InDesign exports coordinates with 6+ decimal places; 2-3 is sufficient for
 * print quality (300 DPI). This can significantly shrink large content streams.
 *
 * Targets operators: m (moveto), l (lineto), c (curveto), v/y (curve variants),
 * re (rectangle), cm (transform matrix).
 */
export const reduceVectorPrecision = (
  pdfDoc: PDFDocument,
  onProgress?: (message: string, percent?: number) => void,
  maxDecimals: number = 2,
): DecimalPrecisionResult => {
  const result: DecimalPrecisionResult = {
    pagesProcessed: 0,
    operatorsSimplified: 0,
  };

  const context = pdfDoc.context;
  const pages = pdfDoc.getPages();

  onProgress?.('Reducing vector precision...', 0);

  // Regex to match numbers with excessive decimal precision in path operators.
  // Matches floating-point numbers with more than maxDecimals decimal places.
  const decimalPattern = new RegExp(
    `(-?\\d+\\.\\d{${maxDecimals + 1},})`,
    'g'
  );

  for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
    const page = pages[pageIdx];
    const contentsRef = page.node.get(PDFName.of('Contents'));
    if (!contentsRef) continue;

    const contentRefs: PDFRef[] = [];
    if (contentsRef instanceof PDFRef) {
      contentRefs.push(contentsRef);
    } else if (contentsRef instanceof PDFArray) {
      for (let i = 0; i < contentsRef.size(); i++) {
        const ref = contentsRef.get(i);
        if (ref instanceof PDFRef) contentRefs.push(ref);
      }
    }

    let pageModified = false;

    for (const contentRef of contentRefs) {
      const contentObj = context.lookup(contentRef);
      if (!(contentObj instanceof PDFRawStream) && !(contentObj instanceof PDFStream)) continue;

      const decompressed = decompressContentStream(contentObj);
      if (!decompressed) continue;

      const content = new TextDecoder('latin1').decode(decompressed);
      let modified = false;
      let opsSimplified = 0;

      // Replace excessive precision numbers throughout the stream.
      // This is safe because PDF numbers with fewer decimals render identically
      // at normal zoom levels (the difference is sub-pixel at 300 DPI).
      const newContent = content.replace(decimalPattern, (match) => {
        const rounded = parseFloat(match).toFixed(maxDecimals);
        // Remove trailing zeros: "1.50" → "1.5", "2.00" → "2"
        const trimmed = rounded.replace(/\.?0+$/, '');
        if (trimmed !== match) {
          modified = true;
          opsSimplified++;
        }
        return trimmed;
      });

      if (!modified) continue;

      result.operatorsSimplified += opsSimplified;

      // Re-encode and compress
      const newBytes = new TextEncoder().encode(newContent);
      const compressed = pako.deflate(newBytes, { level: 9 });

      const newDict = contentObj.dict.clone(context);
      newDict.set(PDFName.of('Length'), context.obj(compressed.length));
      newDict.set(PDFName.of('Filter'), PDFName.of('FlateDecode'));
      newDict.delete(PDFName.of('DecodeParms'));

      const newStream = PDFRawStream.of(newDict, compressed);
      context.assign(contentRef, newStream);
      pageModified = true;
    }

    if (pageModified) {
      result.pagesProcessed++;
    }

    const progress = Math.round(((pageIdx + 1) / pages.length) * 100);
    onProgress?.(`Processed page ${pageIdx + 1}/${pages.length}`, progress);
  }

  return result;
};

// ============================================================================
// Feature Detection Helpers
// ============================================================================

/**
 * Count shading objects across all pages and detect vector-heavy features.
 */
export function detectVectorFeatures(pdfDoc: PDFDocument): {
  hasShadings: boolean;
  shadingCount: number;
  hasComplexPaths: boolean;
  largeContentStreams: boolean;
} {
  const context = pdfDoc.context;
  const pages = pdfDoc.getPages();

  let shadingCount = 0;
  let hasComplexPaths = false;
  let largeContentStreams = false;

  for (const page of pages) {
    const resources = page.node.get(PDFName.of('Resources'));
    if (resources instanceof PDFDict) {
      const shadingDict = resources.get(PDFName.of('Shading'));
      if (shadingDict instanceof PDFDict) {
        shadingCount += shadingDict.entries().length;
      }
    }

    // Check content stream size as indicator of vector complexity
    const contentsRef = page.node.get(PDFName.of('Contents'));
    if (contentsRef instanceof PDFRef) {
      const obj = context.lookup(contentsRef);
      if (obj instanceof PDFRawStream || obj instanceof PDFStream) {
        const bytes = obj instanceof PDFRawStream ? obj.contents : undefined;
        if (bytes && bytes.length > 500_000) {
          largeContentStreams = true;
          hasComplexPaths = true;
        }
      }
    }
  }

  return {
    hasShadings: shadingCount > 0,
    shadingCount,
    hasComplexPaths,
    largeContentStreams,
  };
}
