/**
 * Resource Processor - Handles resource optimization
 * - Duplicate resource removal (images, embedded font files, etc.)
 * - Unused font removal
 * - Font subsetting (glyph-level)
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
import {
  subsetTrueTypeFont,
  isTrueTypeFont,
  getFontCmap,
  winAnsiToUnicode,
} from './font-subsetter';

export interface DuplicateRemovalResult {
  duplicatesFound: number;
  bytesEstimatedSaved: number;
}

export interface UnusedFontResult {
  fontsRemoved: number;
  fontNames: string[];
}

export interface FontUnicodeMapRemovalResult {
  mapsRemoved: number;
  estimatedSavedBytes: number;
}

export interface StreamCompressionResult {
  streamsCompressed: number;
  savedBytes: number;
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
 * Check if an object is a FontDescriptor dictionary
 */
const isFontDescriptor = (dict: PDFDict): boolean => {
  const type = dict.get(PDFName.of('Type'));
  return type instanceof PDFName && type.toString() === '/FontDescriptor';
};

/**
 * Deduplicate embedded font program streams referenced by FontDescriptor
 * dictionaries (/FontFile, /FontFile2, /FontFile3).
 */
const dedupeEmbeddedFontPrograms = (
  pdfDoc: PDFDocument,
  hashToRef: Map<string, { ref: PDFRef; size: number }>,
  refRemapping: Map<string, PDFRef>,
  result: DuplicateRemovalResult,
): void => {
  const context = pdfDoc.context;

  for (const [, obj] of context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFDict) || !isFontDescriptor(obj)) {
      continue;
    }

    for (const key of ['FontFile', 'FontFile2', 'FontFile3']) {
      const fontFileKey = PDFName.of(key);
      const fontFile = obj.get(fontFileKey);
      if (!(fontFile instanceof PDFRef)) continue;

      const fontStream = context.lookup(fontFile);
      if (!(fontStream instanceof PDFRawStream) && !(fontStream instanceof PDFStream)) {
        continue;
      }

      const bytes = getStreamBytes(fontStream);
      if (!bytes || bytes.length < 1024) continue;

      const subtype = fontStream.dict.get(PDFName.of('Subtype'))?.toString() || 'unknown';
      const length1 = fontStream.dict.get(PDFName.of('Length1'))?.toString() || '0';
      const length2 = fontStream.dict.get(PDFName.of('Length2'))?.toString() || '0';
      const fullHash = `font:${key}:${subtype}:${length1}:${length2}:${hashBytes(bytes)}`;

      const refKey = `${fontFile.objectNumber}-${fontFile.generationNumber}`;
      const existing = hashToRef.get(fullHash);

      if (existing) {
        refRemapping.set(refKey, existing.ref);
        obj.set(fontFileKey, existing.ref);
        result.duplicatesFound++;
        result.bytesEstimatedSaved += bytes.length;
      } else {
        hashToRef.set(fullHash, { ref: fontFile, size: bytes.length });
      }
    }
  }
};

/**
 * Remove duplicate resources from PDF
 * Finds identical streams (images, embedded font files, etc.) and merges references
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

  // Also deduplicate identical embedded font programs
  dedupeEmbeddedFontPrograms(pdfDoc, hashToRef, refRemapping, result);

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


/**
 * Compress currently-unfiltered embedded font program streams referenced by
 * FontDescriptor dictionaries (/FontFile, /FontFile2, /FontFile3).
 *
 * This is intentionally conservative: page/content/image streams are handled by
 * dedicated processors and are not touched here.
 */
export const compressUncompressedStreams = (pdfDoc: PDFDocument): StreamCompressionResult => {
  const result: StreamCompressionResult = {
    streamsCompressed: 0,
    savedBytes: 0,
  };

  const context = pdfDoc.context;
  const processedRefs = new Set<string>();

  for (const [, obj] of context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFDict) || !isFontDescriptor(obj)) {
      continue;
    }

    for (const key of ['FontFile', 'FontFile2', 'FontFile3']) {
      const fontFile = obj.get(PDFName.of(key));
      if (!(fontFile instanceof PDFRef)) {
        continue;
      }

      const refKey = `${fontFile.objectNumber}-${fontFile.generationNumber}`;
      if (processedRefs.has(refKey)) {
        continue;
      }
      processedRefs.add(refKey);

      const streamObj = context.lookup(fontFile);
      if (!(streamObj instanceof PDFRawStream) && !(streamObj instanceof PDFStream)) {
        continue;
      }

      // Compress only currently unfiltered streams.
      if (streamObj.dict.has(PDFName.of('Filter'))) {
        continue;
      }

      const bytes = getStreamBytes(streamObj);
      if (!bytes || bytes.length < 256) {
        continue;
      }

      const compressed = pako.deflate(bytes, { level: 9 });
      if (compressed.length + 12 >= bytes.length) {
        continue;
      }

      const newDict = streamObj.dict.clone(context);
      newDict.set(PDFName.of('Length'), context.obj(compressed.length));
      newDict.set(PDFName.of('Filter'), PDFName.of('FlateDecode'));
      newDict.delete(PDFName.of('DecodeParms'));

      const newStream = PDFRawStream.of(newDict, compressed);
      context.assign(fontFile, newStream);

      result.streamsCompressed++;
      result.savedBytes += bytes.length - compressed.length;
    }
  }

  return result;
};


/**
 * Remove ToUnicode maps from embedded fonts.
 *
 * This can save noticeable space on text-heavy PDFs but will reduce text
 * extraction/search/copy quality in many viewers. Rendering is usually unchanged.
 */
export const removeFontUnicodeMaps = (pdfDoc: PDFDocument): FontUnicodeMapRemovalResult => {
  const result: FontUnicodeMapRemovalResult = {
    mapsRemoved: 0,
    estimatedSavedBytes: 0,
  };

  const context = pdfDoc.context;

  for (const [, obj] of context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFDict)) continue;

    const type = obj.get(PDFName.of('Type'));
    if (!(type instanceof PDFName) || type.toString() !== '/Font') {
      continue;
    }

    const toUnicode = obj.get(PDFName.of('ToUnicode'));
    if (!toUnicode) continue;

    if (toUnicode instanceof PDFRef) {
      const cmapObj = context.lookup(toUnicode);
      if (cmapObj instanceof PDFRawStream || cmapObj instanceof PDFStream) {
        const bytes = getStreamBytes(cmapObj);
        if (bytes) {
          result.estimatedSavedBytes += bytes.length;
        }
      }
    }

    obj.delete(PDFName.of('ToUnicode'));
    result.mapsRemoved++;
  }

  return result;
};


// ─── Font Subsetting ─────────────────────────────────────────────────

export interface FontSubsetResult {
  fontsSubsetted: number;
  totalOriginalSize: number;
  totalSubsettedSize: number;
  fontNames: string[];
}

/**
 * Information about a font in the PDF, collected from page resources.
 */
interface FontEntry {
  /** Resource name, e.g. "F1" */
  resourceName: string;
  /** Reference to the font dictionary */
  fontDictRef: PDFRef;
  /** The font dictionary */
  fontDict: PDFDict;
  /** Whether this is a CID font (Type0) vs simple TrueType */
  isCID: boolean;
  /** Reference to the FontFile2 stream (TrueType font data) */
  fontFileRef: PDFRef | null;
  /** Reference to the FontDescriptor */
  descriptorRef: PDFRef | null;
  /** The FontDescriptor dictionary */
  descriptor: PDFDict | null;
}

/**
 * Collect all font entries from all pages in the document.
 * Returns a map: fontResourceName → FontEntry (deduplicated by fontDictRef).
 */
const collectFontEntries = (pdfDoc: PDFDocument): Map<string, FontEntry> => {
  const context = pdfDoc.context;
  const entries = new Map<string, FontEntry>();
  const pages = pdfDoc.getPages();

  for (const page of pages) {
    const resources = page.node.get(PDFName.of('Resources'));
    if (!(resources instanceof PDFDict)) continue;

    const fonts = resources.get(PDFName.of('Font'));
    if (!(fonts instanceof PDFDict)) continue;

    for (const [fontKey, fontValue] of fonts.entries()) {
      const resourceName = fontKey.toString().replace('/', '');
      if (entries.has(resourceName)) continue;

      const fontDictRef = fontValue instanceof PDFRef ? fontValue : null;
      if (!fontDictRef) continue;

      const fontDictObj = context.lookup(fontDictRef);
      if (!(fontDictObj instanceof PDFDict)) continue;

      const subtype = fontDictObj.get(PDFName.of('Subtype'));
      const subtypeStr = subtype instanceof PDFName ? subtype.toString() : '';

      let isCID = false;
      let targetFontDict = fontDictObj;

      // For Type0 (CID) fonts, the actual font info is in DescendantFonts
      if (subtypeStr === '/Type0') {
        isCID = true;
        const descendants = fontDictObj.get(PDFName.of('DescendantFonts'));
        if (descendants instanceof PDFArray && descendants.size() > 0) {
          const descRef = descendants.get(0);
          const descObj = descRef instanceof PDFRef
            ? context.lookup(descRef)
            : descRef;
          if (descObj instanceof PDFDict) {
            targetFontDict = descObj;
          }
        }
      } else if (subtypeStr !== '/TrueType') {
        continue; // Skip non-TrueType fonts (Type1, etc.)
      }

      // Get FontDescriptor
      const descriptorVal = targetFontDict.get(PDFName.of('FontDescriptor'));
      const descriptorRef = descriptorVal instanceof PDFRef ? descriptorVal : null;
      const descriptor = descriptorRef
        ? context.lookup(descriptorRef)
        : null;

      if (!(descriptor instanceof PDFDict)) continue;

      // Get FontFile2 (TrueType font data)
      const fontFileVal = descriptor.get(PDFName.of('FontFile2'));
      const fontFileRef = fontFileVal instanceof PDFRef ? fontFileVal : null;

      entries.set(resourceName, {
        resourceName,
        fontDictRef,
        fontDict: fontDictObj,
        isCID,
        fontFileRef,
        descriptorRef,
        descriptor,
      });
    }
  }

  return entries;
};

// ─── Content stream text scanner ─────────────────────────────────────

/**
 * Simple PDF content stream scanner that extracts raw text bytes per font.
 *
 * Tracks Tf (set font) operators and collects bytes from Tj, TJ, ', " operators.
 * Returns: fontResourceName → array of raw byte values used in text-showing ops.
 */
const scanContentForTextBytes = (contentBytes: Uint8Array): Map<string, number[]> => {
  const result = new Map<string, number[]>();
  const content = new TextDecoder('latin1').decode(contentBytes);
  const len = content.length;
  let pos = 0;
  let currentFont: string | null = null;

  const addBytes = (bytes: number[]) => {
    if (!currentFont || bytes.length === 0) return;
    let arr = result.get(currentFont);
    if (!arr) { arr = []; result.set(currentFont, arr); }
    for (const b of bytes) arr.push(b);
  };

  const isWS = (c: string) => c === ' ' || c === '\t' || c === '\r' || c === '\n';
  const isDelim = (c: string) => '()<>[]{}/%'.includes(c);

  const skipWS = () => {
    while (pos < len && isWS(content[pos])) pos++;
  };

  /** Parse a hex string <...> and return bytes. pos should be at '<'. */
  const parseHexString = (): number[] => {
    pos++; // skip '<'
    const hexChars: string[] = [];
    while (pos < len && content[pos] !== '>') {
      const c = content[pos];
      if (!isWS(c)) hexChars.push(c);
      pos++;
    }
    if (pos < len) pos++; // skip '>'
    const hex = hexChars.join('');
    const bytes: number[] = [];
    for (let i = 0; i + 1 < hex.length; i += 2) {
      const b = parseInt(hex.substring(i, i + 2), 16);
      if (!isNaN(b)) bytes.push(b);
    }
    // If odd number of hex digits, last nibble is padded with 0
    if (hex.length % 2 === 1) {
      const b = parseInt(hex[hex.length - 1] + '0', 16);
      if (!isNaN(b)) bytes.push(b);
    }
    return bytes;
  };

  /** Parse a literal string (...) and return bytes. pos should be at '('. */
  const parseLiteralString = (): number[] => {
    pos++; // skip '('
    const bytes: number[] = [];
    let depth = 1;
    while (pos < len && depth > 0) {
      const c = content[pos];
      if (c === '(') {
        depth++;
        bytes.push(c.charCodeAt(0));
        pos++;
      } else if (c === ')') {
        depth--;
        if (depth > 0) bytes.push(c.charCodeAt(0));
        pos++;
      } else if (c === '\\') {
        pos++;
        if (pos >= len) break;
        const esc = content[pos];
        if (esc === 'n') { bytes.push(0x0A); pos++; }
        else if (esc === 'r') { bytes.push(0x0D); pos++; }
        else if (esc === 't') { bytes.push(0x09); pos++; }
        else if (esc === 'b') { bytes.push(0x08); pos++; }
        else if (esc === 'f') { bytes.push(0x0C); pos++; }
        else if (esc === '(') { bytes.push(0x28); pos++; }
        else if (esc === ')') { bytes.push(0x29); pos++; }
        else if (esc === '\\') { bytes.push(0x5C); pos++; }
        else if (esc >= '0' && esc <= '7') {
          // Octal escape (up to 3 digits)
          let oct = esc;
          pos++;
          if (pos < len && content[pos] >= '0' && content[pos] <= '7') {
            oct += content[pos]; pos++;
          }
          if (pos < len && content[pos] >= '0' && content[pos] <= '7') {
            oct += content[pos]; pos++;
          }
          bytes.push(parseInt(oct, 8) & 0xFF);
        } else if (esc === '\r' || esc === '\n') {
          // Line continuation
          pos++;
          if (esc === '\r' && pos < len && content[pos] === '\n') pos++;
        } else {
          bytes.push(esc.charCodeAt(0));
          pos++;
        }
      } else {
        bytes.push(c.charCodeAt(0));
        pos++;
      }
    }
    return bytes;
  };

  // Operand stack (simplified — just tracks strings and names)
  type Operand =
    | { t: 'name'; v: string }
    | { t: 'num'; v: number }
    | { t: 'str'; bytes: number[] }
    | { t: 'arr'; items: Operand[] }
    | { t: 'other' };

  const stack: Operand[] = [];

  while (pos < len) {
    skipWS();
    if (pos >= len) break;

    const ch = content[pos];

    // Comment
    if (ch === '%') {
      while (pos < len && content[pos] !== '\n' && content[pos] !== '\r') pos++;
      continue;
    }

    // Name: /xyz
    if (ch === '/') {
      pos++;
      const start = pos;
      while (pos < len && !isWS(content[pos]) && !isDelim(content[pos])) pos++;
      stack.push({ t: 'name', v: content.substring(start, pos) });
      continue;
    }

    // Literal string: (...)
    if (ch === '(') {
      const bytes = parseLiteralString();
      stack.push({ t: 'str', bytes });
      continue;
    }

    // Hex string: <...> (but not dict <<)
    if (ch === '<' && pos + 1 < len && content[pos + 1] !== '<') {
      const bytes = parseHexString();
      stack.push({ t: 'str', bytes });
      continue;
    }

    // Dict start/end << >> — just skip
    if (ch === '<' && pos + 1 < len && content[pos + 1] === '<') {
      stack.push({ t: 'other' });
      pos += 2;
      continue;
    }
    if (ch === '>' && pos + 1 < len && content[pos + 1] === '>') {
      stack.push({ t: 'other' });
      pos += 2;
      continue;
    }

    // Array start
    if (ch === '[') {
      stack.push({ t: 'other' }); // marker
      pos++;
      continue;
    }

    // Array end — collect items
    if (ch === ']') {
      pos++;
      const items: Operand[] = [];
      while (stack.length > 0) {
        const item = stack[stack.length - 1];
        if (item.t === 'other') { stack.pop(); break; }
        items.unshift(stack.pop()!);
      }
      stack.push({ t: 'arr', items });
      continue;
    }

    // Number
    if (ch === '-' || ch === '+' || ch === '.' || (ch >= '0' && ch <= '9')) {
      const start = pos;
      if (ch === '-' || ch === '+') pos++;
      while (pos < len && ((content[pos] >= '0' && content[pos] <= '9') || content[pos] === '.')) pos++;
      stack.push({ t: 'num', v: parseFloat(content.substring(start, pos)) });
      continue;
    }

    // Operator (keyword)
    const start = pos;
    while (pos < len && !isWS(content[pos]) && !isDelim(content[pos])) pos++;
    const op = content.substring(start, pos);

    if (op === 'Tf') {
      // /FontName size Tf
      if (stack.length >= 2) {
        stack.pop(); // size
        const nameOp = stack.pop();
        if (nameOp?.t === 'name') {
          currentFont = nameOp.v;
        }
      }
    } else if (op === 'Tj' || op === "'") {
      const strOp = stack.pop();
      if (strOp?.t === 'str') addBytes(strOp.bytes);
    } else if (op === '"') {
      const strOp = stack.pop();
      stack.pop(); // ac
      stack.pop(); // aw
      if (strOp?.t === 'str') addBytes(strOp.bytes);
    } else if (op === 'TJ') {
      const arrOp = stack.pop();
      if (arrOp?.t === 'arr') {
        for (const item of arrOp.items) {
          if (item.t === 'str') addBytes(item.bytes);
        }
      }
    }
    // All other operators: don't clear stack (operands stay for next op)
  }

  return result;
};

/**
 * Scan all content streams, form XObjects, and annotation appearances
 * for text byte usage per font resource name.
 */
const extractAllTextBytes = (pdfDoc: PDFDocument): Map<string, number[]> => {
  const combined = new Map<string, number[]>();
  const visited = new Set<string>();

  const mergeResults = (partial: Map<string, number[]>) => {
    for (const [fontName, bytes] of partial) {
      let arr = combined.get(fontName);
      if (!arr) { arr = []; combined.set(fontName, arr); }
      for (const b of bytes) arr.push(b);
    }
  };

  const scanStream = (stream: PDFRawStream | PDFStream) => {
    const bytes = getDecompressedStreamBytes(stream);
    if (bytes) mergeResults(scanContentForTextBytes(bytes));
  };

  const scanContentRef = (ref: PDFRef | PDFArray) => {
    if (ref instanceof PDFRef) {
      const obj = pdfDoc.context.lookup(ref);
      if (obj instanceof PDFRawStream || obj instanceof PDFStream) {
        scanStream(obj);
      }
    } else if (ref instanceof PDFArray) {
      for (let i = 0; i < ref.size(); i++) {
        const item = ref.get(i);
        if (item instanceof PDFRef) scanContentRef(item);
      }
    }
  };

  const scanXObjects = (resources: PDFDict) => {
    const xobjects = resources.get(PDFName.of('XObject'));
    if (!(xobjects instanceof PDFDict)) return;

    for (const [, value] of xobjects.entries()) {
      const ref = value instanceof PDFRef ? value : null;
      if (!ref) continue;

      const refKey = `${ref.objectNumber}-${ref.generationNumber}`;
      if (visited.has(refKey)) continue;
      visited.add(refKey);

      const obj = pdfDoc.context.lookup(ref);
      if (!(obj instanceof PDFRawStream) && !(obj instanceof PDFStream)) continue;
      const dict = obj.dict;
      const subtype = dict.get(PDFName.of('Subtype'));
      if (!(subtype instanceof PDFName) || subtype.toString() !== '/Form') continue;

      scanStream(obj);
      const formRes = dict.get(PDFName.of('Resources'));
      if (formRes instanceof PDFDict) scanXObjects(formRes);
    }
  };

  const pages = pdfDoc.getPages();
  for (const page of pages) {
    const pageDict = page.node;

    // Page content streams
    const contents = pageDict.get(PDFName.of('Contents'));
    if (contents instanceof PDFRef || contents instanceof PDFArray) {
      scanContentRef(contents);
    }

    // Form XObjects
    const resources = pageDict.get(PDFName.of('Resources'));
    if (resources instanceof PDFDict) {
      scanXObjects(resources);
    }

    // Annotation appearance streams
    const annots = pageDict.get(PDFName.of('Annots'));
    if (annots) {
      const annotArray = annots instanceof PDFRef
        ? pdfDoc.context.lookup(annots) : annots;
      if (annotArray instanceof PDFArray) {
        for (let i = 0; i < annotArray.size(); i++) {
          const annotRef = annotArray.get(i);
          const annotObj = annotRef instanceof PDFRef
            ? pdfDoc.context.lookup(annotRef) : annotRef;
          if (!(annotObj instanceof PDFDict)) continue;
          const ap = annotObj.get(PDFName.of('AP'));
          if (!(ap instanceof PDFDict)) continue;
          for (const apKey of ['N', 'R', 'D']) {
            const appearance = ap.get(PDFName.of(apKey));
            if (!appearance) continue;
            const appObj = appearance instanceof PDFRef
              ? pdfDoc.context.lookup(appearance) : appearance;
            if (appObj instanceof PDFRawStream || appObj instanceof PDFStream) {
              scanStream(appObj);
            }
          }
        }
      }
    }
  }

  return combined;
};

/**
 * Convert raw text bytes to glyph IDs based on font type.
 *
 * For CID fonts (Identity-H): 2-byte big-endian pairs → glyph IDs.
 * For simple TrueType fonts: 1-byte codes → Unicode → GID via cmap.
 */
const mapBytesToGlyphIds = (
  bytes: number[],
  isCID: boolean,
  fontData: Uint8Array | null,
): Set<number> => {
  const glyphIds = new Set<number>();
  glyphIds.add(0); // Always keep .notdef

  if (isCID) {
    // CID fonts with Identity-H: bytes are 2-byte big-endian glyph IDs
    for (let i = 0; i + 1 < bytes.length; i += 2) {
      const gid = (bytes[i] << 8) | bytes[i + 1];
      glyphIds.add(gid);
    }
  } else {
    // Simple TrueType font: bytes are character codes
    // Map character code → Unicode → GID via cmap
    if (fontData) {
      const cmap = getFontCmap(fontData);
      if (cmap) {
        for (const code of bytes) {
          const unicode = winAnsiToUnicode(code);
          const gid = cmap.get(unicode);
          if (gid !== undefined) glyphIds.add(gid);
        }
      } else {
        // No cmap found — can't map codes to glyphs, skip subsetting
        // Return a large set to signal "keep all"
        return new Set<number>([-1]);
      }
    }
  }

  return glyphIds;
};

/**
 * Get the decompressed font program bytes from a FontFile2 stream.
 * Handles both compressed and uncompressed streams.
 */
const getFontProgramBytes = (
  context: PDFDocument['context'],
  fontFileRef: PDFRef,
): Uint8Array | null => {
  const stream = context.lookup(fontFileRef);
  if (!(stream instanceof PDFRawStream) && !(stream instanceof PDFStream)) {
    return null;
  }
  return getDecompressedStreamBytes(stream);
};

/**
 * Subset all embedded TrueType fonts in the PDF.
 *
 * This is the key optimization for text-heavy PDFs. It removes unused glyphs
 * from embedded font programs, often reducing font data by 5-20x.
 *
 * The approach:
 * 1. Collect all font entries from page resources
 * 2. Scan all content streams for text byte usage per font
 * 3. Map text bytes to glyph IDs based on font encoding
 * 4. Subset each TrueType font program to include only used glyphs
 * 5. Re-embed the subsetted font with proper compression
 */
export const subsetEmbeddedFonts = (pdfDoc: PDFDocument): FontSubsetResult => {
  const result: FontSubsetResult = {
    fontsSubsetted: 0,
    totalOriginalSize: 0,
    totalSubsettedSize: 0,
    fontNames: [],
  };

  const context = pdfDoc.context;

  // Step 1: Collect font entries
  const fontEntries = collectFontEntries(pdfDoc);
  if (fontEntries.size === 0) return result;

  // Step 2: Scan content streams for text bytes per font
  const textBytesPerFont = extractAllTextBytes(pdfDoc);

  // Step 3: Group fonts by their FontFile2 reference
  // Multiple font entries may share the same font file (deduplication)
  const fontFileToGlyphs = new Map<string, {
    fontFileRef: PDFRef;
    glyphIds: Set<number>;
    entries: FontEntry[];
    fontData: Uint8Array | null;
  }>();

  for (const [, entry] of fontEntries) {
    if (!entry.fontFileRef) continue;

    const refKey = `${entry.fontFileRef.objectNumber}-${entry.fontFileRef.generationNumber}`;

    if (!fontFileToGlyphs.has(refKey)) {
      const fontData = getFontProgramBytes(context, entry.fontFileRef);
      fontFileToGlyphs.set(refKey, {
        fontFileRef: entry.fontFileRef,
        glyphIds: new Set([0]), // Always keep .notdef
        entries: [],
        fontData,
      });
    }

    const group = fontFileToGlyphs.get(refKey)!;
    group.entries.push(entry);

    // Get text bytes for this font resource name
    const bytes = textBytesPerFont.get(entry.resourceName);
    if (bytes && bytes.length > 0) {
      const glyphs = mapBytesToGlyphIds(bytes, entry.isCID, group.fontData);
      // If mapping failed (returned sentinel -1), mark as "keep all"
      if (glyphs.has(-1)) {
        group.glyphIds.add(-1);
      } else {
        for (const gid of glyphs) group.glyphIds.add(gid);
      }
    }
  }

  // Step 4: Subset each font file
  for (const [, group] of fontFileToGlyphs) {
    const { fontFileRef, glyphIds, entries, fontData } = group;

    // Skip if we couldn't read the font data
    if (!fontData || fontData.length < 256) continue;

    // Skip if not a valid TrueType font
    if (!isTrueTypeFont(fontData)) continue;

    // Skip if mapping failed (sentinel -1 means "keep all")
    if (glyphIds.has(-1)) continue;

    // Skip if no text bytes found (font might be used in XObjects we didn't scan)
    // Be conservative: if we found no usage, don't subset
    if (glyphIds.size <= 1) continue; // Only .notdef

    // Attempt subsetting
    const subsetResult = subsetTrueTypeFont(fontData, glyphIds);
    if (!subsetResult) continue;

    // Compress the subsetted font data
    const compressed = pako.deflate(subsetResult.fontData, { level: 9 });

    // Create new stream with the subsetted font
    const stream = context.lookup(fontFileRef);
    if (!(stream instanceof PDFRawStream) && !(stream instanceof PDFStream)) continue;

    const newDict = stream.dict.clone(context);
    newDict.set(PDFName.of('Length'), context.obj(compressed.length));
    newDict.set(PDFName.of('Length1'), context.obj(subsetResult.fontData.length));
    newDict.set(PDFName.of('Filter'), PDFName.of('FlateDecode'));
    newDict.delete(PDFName.of('DecodeParms'));

    const newStream = PDFRawStream.of(newDict, compressed);
    context.assign(fontFileRef, newStream);

    result.fontsSubsetted++;
    result.totalOriginalSize += subsetResult.originalSize;
    result.totalSubsettedSize += subsetResult.fontData.length;

    for (const entry of entries) {
      const name = getFontName(entry.fontDict);
      if (name) result.fontNames.push(name);
    }
  }

  return result;
};
