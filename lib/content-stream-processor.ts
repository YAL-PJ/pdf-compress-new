/**
 * Content Stream Processor
 * Handles inline image extraction, content stream compression, and invisible text removal.
 * Phase 2 implementation: 2.2, 2.3, 2.6
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
  PDFHexString,
  PDFString,
} from 'pdf-lib';
import pako from 'pako';

// ============================================================================
// Types
// ============================================================================

export interface InlineImageResult {
  converted: number;
  savedBytes: number;
}

export interface ContentCompressionResult {
  streamsCompressed: number;
  savedBytes: number;
}

export interface InvisibleTextResult {
  pagesProcessed: number;
  savedBytes: number;
}

// ============================================================================
// 2.2 Inline Image to XObject Conversion
// ============================================================================

/**
 * Detect and extract inline images from content streams.
 * Inline images use BI/ID/EI operators and are embedded directly in content.
 * Converting them to XObjects enables deduplication and better compression.
 */
export const convertInlineImagesToXObjects = async (
  pdfDoc: PDFDocument,
  onProgress?: (message: string, percent?: number) => void
): Promise<InlineImageResult> => {
  const result: InlineImageResult = {
    converted: 0,
    savedBytes: 0,
  };

  const context = pdfDoc.context;
  const pages = pdfDoc.getPages();
  let xObjectCounter = 0;

  onProgress?.('Scanning for inline images...', 0);

  for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
    const page = pages[pageIdx];
    const pageDict = page.node;
    const contentsRef = pageDict.get(PDFName.of('Contents'));

    if (!contentsRef) continue;

    // Get content stream(s)
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
      if (!(contentObj instanceof PDFRawStream) && !(contentObj instanceof PDFStream)) {
        continue;
      }

      let contentBytes: Uint8Array | undefined;
      try {
        contentBytes = contentObj instanceof PDFRawStream
          ? contentObj.contents
          : contentObj.getContents();

        // Skip if bytes are undefined (can happen with corrupted or non-PDF streams)
        if (!contentBytes) {
          continue;
        }

        // Check if stream is compressed
        const filter = contentObj.dict.get(PDFName.of('Filter'));
        if (filter && (filter instanceof PDFName || filter instanceof PDFArray)) {
          contentBytes = decompressStream(contentBytes, filter);
        }
      } catch {
        continue;
      }

      const content = new TextDecoder('latin1').decode(contentBytes);

      // Find inline images: BI ... ID ... EI
      const inlineImagePattern = /\bBI\b([\s\S]*?)\bID\b([\s\S]*?)\bEI\b/g;
      let match;
      let newContent = content;
      let offset = 0;
      const imagesToConvert: Array<{
        start: number;
        end: number;
        dict: Record<string, string>;
        data: Uint8Array;
      }> = [];

      while ((match = inlineImagePattern.exec(content)) !== null) {
        const dictPart = match[1].trim();
        const dataPart = match[2];

        // Parse inline image dictionary
        const imageDict = parseInlineImageDict(dictPart);
        if (!imageDict) continue;

        // Extract image data (skip leading whitespace after ID)
        const dataStart = dataPart.startsWith('\n') ? 1 : (dataPart.startsWith('\r\n') ? 2 : 0);
        const imageData = new Uint8Array(
          dataPart.slice(dataStart).split('').map(c => c.charCodeAt(0))
        );

        imagesToConvert.push({
          start: match.index,
          end: match.index + match[0].length,
          dict: imageDict,
          data: imageData,
        });
      }

      if (imagesToConvert.length === 0) continue;

      // Get or create Resources dict
      let resources = pageDict.get(PDFName.of('Resources'));
      if (!(resources instanceof PDFDict)) {
        resources = context.obj({});
        pageDict.set(PDFName.of('Resources'), resources);
      }
      const resourcesDict = resources as PDFDict;

      // Get or create XObject dict
      let xobject = resourcesDict.get(PDFName.of('XObject'));
      if (!(xobject instanceof PDFDict)) {
        xobject = context.obj({});
        resourcesDict.set(PDFName.of('XObject'), xobject);
      }
      const xobjectDict = xobject as PDFDict;

      // Convert each inline image to XObject
      for (let i = imagesToConvert.length - 1; i >= 0; i--) {
        const img = imagesToConvert[i];
        const xobjName = `InImg${xObjectCounter++}`;

        // Create XObject stream
        const xobjDict = context.obj({
          Type: PDFName.of('XObject'),
          Subtype: PDFName.of('Image'),
          Width: context.obj(parseInt(img.dict['W'] || img.dict['Width'] || '1', 10)),
          Height: context.obj(parseInt(img.dict['H'] || img.dict['Height'] || '1', 10)),
          BitsPerComponent: context.obj(parseInt(img.dict['BPC'] || img.dict['BitsPerComponent'] || '8', 10)),
        });

        // Set colorspace
        const cs = img.dict['CS'] || img.dict['ColorSpace'];
        if (cs) {
          const csName = expandAbbreviation(cs);
          xobjDict.set(PDFName.of('ColorSpace'), PDFName.of(csName));
        } else {
          xobjDict.set(PDFName.of('ColorSpace'), PDFName.of('DeviceRGB'));
        }

        // Set filter if present
        const filter = img.dict['F'] || img.dict['Filter'];
        if (filter) {
          const filterName = expandAbbreviation(filter);
          xobjDict.set(PDFName.of('Filter'), PDFName.of(filterName));
        }

        // Create and register the XObject
        const xobjStream = PDFRawStream.of(xobjDict, img.data);
        const xobjRef = context.register(xobjStream);
        xobjectDict.set(PDFName.of(xobjName), xobjRef);

        // Replace inline image with XObject invocation
        const replacement = `q /${xobjName} Do Q`;
        newContent = newContent.slice(0, img.start + offset) + replacement + newContent.slice(img.end + offset);
        offset += replacement.length - (img.end - img.start);

        result.converted++;
        result.savedBytes += Math.max(0, img.data.length - replacement.length);
      }

      // Update content stream with new content
      const newContentBytes = new TextEncoder().encode(newContent);
      const compressedContent = pako.deflate(newContentBytes);

      const newDict = contentObj.dict.clone(context);
      newDict.set(PDFName.of('Length'), context.obj(compressedContent.length));
      newDict.set(PDFName.of('Filter'), PDFName.of('FlateDecode'));
      newDict.delete(PDFName.of('DecodeParms'));

      const newStream = PDFRawStream.of(newDict, compressedContent);
      context.assign(contentRef, newStream);
    }

    const progress = Math.round(((pageIdx + 1) / pages.length) * 100);
    onProgress?.(`Processed ${pageIdx + 1}/${pages.length} pages`, progress);
  }

  return result;
};

/**
 * Parse inline image dictionary from BI content
 */
function parseInlineImageDict(dictContent: string): Record<string, string> | null {
  const result: Record<string, string> = {};
  const tokens = dictContent.split(/\s+/).filter(t => t.length > 0);

  for (let i = 0; i < tokens.length - 1; i += 2) {
    const key = tokens[i].replace('/', '');
    const value = tokens[i + 1];
    result[key] = value.replace('/', '');
  }

  return Object.keys(result).length > 0 ? result : null;
}

/**
 * Expand inline image abbreviations to full names
 */
function expandAbbreviation(abbrev: string): string {
  const abbreviations: Record<string, string> = {
    // Color spaces
    'G': 'DeviceGray',
    'RGB': 'DeviceRGB',
    'CMYK': 'DeviceCMYK',
    'I': 'Indexed',
    // Filters
    'AHx': 'ASCIIHexDecode',
    'A85': 'ASCII85Decode',
    'LZW': 'LZWDecode',
    'Fl': 'FlateDecode',
    'RL': 'RunLengthDecode',
    'CCF': 'CCITTFaxDecode',
    'DCT': 'DCTDecode',
  };
  return abbreviations[abbrev] || abbrev;
}

// ============================================================================
// 2.3 Content Stream Compression
// ============================================================================

/**
 * Apply Flate compression to uncompressed content streams.
 * Re-compress poorly compressed streams for better compression.
 */
export const compressContentStreams = async (
  pdfDoc: PDFDocument,
  onProgress?: (message: string, percent?: number) => void
): Promise<ContentCompressionResult> => {
  const result: ContentCompressionResult = {
    streamsCompressed: 0,
    savedBytes: 0,
  };

  const context = pdfDoc.context;
  // Iterate directly instead of materializing into array (saves memory for large PDFs)
  const allRefs = context.enumerateIndirectObjects();

  onProgress?.('Analyzing content streams...', 0);

  let processed = 0;

  for (const [ref, obj] of allRefs) {
    if (!(obj instanceof PDFRawStream) && !(obj instanceof PDFStream)) {
      processed++;
      continue;
    }

    const stream = obj;
    const dict = stream.dict;

    // Skip image XObjects - they have specialized compression
    const subtype = dict.get(PDFName.of('Subtype'));
    if (subtype instanceof PDFName && subtype.toString() === '/Image') {
      processed++;
      continue;
    }

    // Skip font streams - they may have special encoding
    const type = dict.get(PDFName.of('Type'));
    if (type instanceof PDFName && type.toString() === '/FontFile') {
      processed++;
      continue;
    }

    const filter = dict.get(PDFName.of('Filter'));
    let originalBytes: Uint8Array | undefined;
    let isCompressed = false;

    try {
      if (stream instanceof PDFRawStream) {
        originalBytes = stream.contents;
      } else {
        originalBytes = stream.getContents();
      }
    } catch {
      processed++;
      continue;
    }

    if (!originalBytes) {
      processed++;
      continue;
    }

    const originalSize = originalBytes.length;

    // Skip tiny streams
    if (originalSize < 100) {
      processed++;
      continue;
    }

    let decompressedBytes: Uint8Array;

    if (filter && (filter instanceof PDFName || filter instanceof PDFArray)) {
      isCompressed = true;
      // Try to decompress to check compression efficiency
      try {
        decompressedBytes = decompressStream(originalBytes, filter);
      } catch {
        processed++;
        continue;
      }
    } else {
      decompressedBytes = originalBytes;
    }

    // Compress with Flate
    const compressedBytes = pako.deflate(decompressedBytes, { level: 9 });

    // Only use if we save space
    if (compressedBytes.length < originalSize) {
      const savings = originalSize - compressedBytes.length;

      const newDict = dict.clone(context);
      newDict.set(PDFName.of('Length'), context.obj(compressedBytes.length));
      newDict.set(PDFName.of('Filter'), PDFName.of('FlateDecode'));
      newDict.delete(PDFName.of('DecodeParms'));

      const newStream = PDFRawStream.of(newDict, compressedBytes);
      context.assign(ref, newStream);

      result.streamsCompressed++;
      result.savedBytes += savings;
    }

    processed++;
    if (processed % 100 === 0) {
      onProgress?.(`Compressed ${result.streamsCompressed} streams (${processed} objects scanned)`);
    }
  }

  return result;
};

/**
 * Decompress a stream based on its filter
 */
function decompressStream(data: Uint8Array, filter: PDFName | PDFArray): Uint8Array {
  if (!data) {
    return new Uint8Array(0);
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

  if (!filterName) {
    // Empty or unrecognized filter array — return data as-is
    return data;
  }

  switch (filterName) {
    case '/FlateDecode':
      return pako.inflate(data);
    case '/LZWDecode':
      return decodeLzw(data);
    default:
      // Return as-is for unsupported filters
      return data;
  }
}

/**
 * Basic LZW decoder for PDF streams.
 * Uses chunked output to avoid stack overflow from spread operator on large entries
 * and reduces intermediate array allocations.
 */
function decodeLzw(data: Uint8Array): Uint8Array {
  // Use chunked output buffer to avoid push(...entry) stack overflow
  const chunks: Uint8Array[] = [];
  let currentChunk = new Uint8Array(65536);
  let chunkOffset = 0;

  const writeBytes = (entry: Uint8Array) => {
    let srcOffset = 0;
    let remaining = entry.length;
    while (remaining > 0) {
      const space = currentChunk.length - chunkOffset;
      const toCopy = Math.min(remaining, space);
      currentChunk.set(entry.subarray(srcOffset, srcOffset + toCopy), chunkOffset);
      chunkOffset += toCopy;
      srcOffset += toCopy;
      remaining -= toCopy;
      if (chunkOffset === currentChunk.length) {
        chunks.push(currentChunk);
        currentChunk = new Uint8Array(65536);
        chunkOffset = 0;
      }
    }
  };

  // Use Uint8Array for dictionary entries to reduce memory overhead
  const dictionary: Uint8Array[] = [];
  for (let i = 0; i < 256; i++) {
    dictionary[i] = new Uint8Array([i]);
  }

  const CLEAR_CODE = 256;
  const EOD_CODE = 257;
  let nextCode = 258;
  let codeSize = 9;

  let bitBuffer = 0;
  let bitsInBuffer = 0;
  let dataIndex = 0;

  const readCode = (): number => {
    while (bitsInBuffer < codeSize && dataIndex < data.length) {
      bitBuffer = (bitBuffer << 8) | data[dataIndex++];
      bitsInBuffer += 8;
    }
    if (bitsInBuffer < codeSize) return EOD_CODE;
    bitsInBuffer -= codeSize;
    return (bitBuffer >> bitsInBuffer) & ((1 << codeSize) - 1);
  };

  let prevEntry: Uint8Array | null = null;

  while (true) {
    const code = readCode();

    if (code === EOD_CODE) break;

    if (code === CLEAR_CODE) {
      dictionary.length = 258;
      nextCode = 258;
      codeSize = 9;
      prevEntry = null;
      continue;
    }

    let entry: Uint8Array;

    if (code < dictionary.length) {
      entry = dictionary[code];
    } else if (code === nextCode && prevEntry) {
      entry = new Uint8Array(prevEntry.length + 1);
      entry.set(prevEntry);
      entry[prevEntry.length] = prevEntry[0];
    } else {
      break;
    }

    writeBytes(entry);

    if (prevEntry) {
      const newEntry = new Uint8Array(prevEntry.length + 1);
      newEntry.set(prevEntry);
      newEntry[prevEntry.length] = entry[0];
      dictionary[nextCode++] = newEntry;

      if (nextCode >= (1 << codeSize) && codeSize < 12) {
        codeSize++;
      }
    }

    prevEntry = entry;
  }

  // Flush remaining bytes and concatenate chunks
  if (chunkOffset > 0) {
    chunks.push(currentChunk.subarray(0, chunkOffset));
  }

  const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

// ============================================================================
// 2.6 Remove Invisible Text
// ============================================================================

/**
 * Remove invisible text from content streams.
 * Invisible text uses rendering mode 3 (Tr 3), commonly found in OCR'd PDFs.
 */
export const removeInvisibleText = async (
  pdfDoc: PDFDocument,
  onProgress?: (message: string, percent?: number) => void
): Promise<InvisibleTextResult> => {
  const result: InvisibleTextResult = {
    pagesProcessed: 0,
    savedBytes: 0,
  };

  const context = pdfDoc.context;
  const pages = pdfDoc.getPages();

  onProgress?.('Scanning for invisible text...', 0);

  for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
    const page = pages[pageIdx];
    const pageDict = page.node;
    const contentsRef = pageDict.get(PDFName.of('Contents'));

    if (!contentsRef) continue;

    // Get content stream(s)
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
      if (!(contentObj instanceof PDFRawStream) && !(contentObj instanceof PDFStream)) {
        continue;
      }

      let contentBytes: Uint8Array | undefined;
      let wasCompressed = false;

      try {
        contentBytes = contentObj instanceof PDFRawStream
          ? contentObj.contents
          : contentObj.getContents();

        if (!contentBytes) {
          continue;
        }

        const filter = contentObj.dict.get(PDFName.of('Filter'));
        if (filter && (filter instanceof PDFName || filter instanceof PDFArray)) {
          contentBytes = decompressStream(contentBytes, filter);
          wasCompressed = true;
        }
      } catch {
        continue;
      }

      if (!contentBytes) {
        continue;
      }

      const originalSize = contentBytes.length;
      const content = new TextDecoder('latin1').decode(contentBytes);

      // Remove invisible text blocks
      // Pattern: 3 Tr (set rendering mode to invisible) followed by text operations
      const newContent = removeInvisibleTextBlocks(content);

      if (newContent.length === content.length) {
        continue; // No changes made
      }

      const newContentBytes = new TextEncoder().encode(newContent);
      const compressedContent = pako.deflate(newContentBytes, { level: 9 });

      const newDict = contentObj.dict.clone(context);
      newDict.set(PDFName.of('Length'), context.obj(compressedContent.length));
      newDict.set(PDFName.of('Filter'), PDFName.of('FlateDecode'));
      newDict.delete(PDFName.of('DecodeParms'));

      const newStream = PDFRawStream.of(newDict, compressedContent);
      context.assign(contentRef, newStream);

      result.savedBytes += Math.max(0, originalSize - compressedContent.length);
      result.pagesProcessed++;
    }

    const progress = Math.round(((pageIdx + 1) / pages.length) * 100);
    onProgress?.(`Processed ${pageIdx + 1}/${pages.length} pages`, progress);
  }

  return result;
};

/**
 * Remove invisible text blocks from content stream.
 * Matches patterns where rendering mode 3 is set and text is drawn.
 */
function removeInvisibleTextBlocks(content: string): string {
  // Track rendering mode state
  let result = content;

  // Pattern 1: Remove complete invisible text blocks
  // BT ... 3 Tr ... text operators ... ET
  const invisibleBlockPattern = /BT[^]*?3\s+Tr[^]*?ET/g;

  // Check each text block for invisible rendering mode
  result = result.replace(/BT([^]*?)ET/g, (match, blockContent) => {
    // Check if this block sets rendering mode to 3 (invisible)
    if (/\b3\s+Tr\b/.test(blockContent)) {
      // Check if there's a visible mode set after (0, 1, 2)
      const trMatches = blockContent.match(/\b(\d+)\s+Tr\b/g);
      if (trMatches) {
        const lastTr = trMatches[trMatches.length - 1];
        const mode = parseInt(lastTr.match(/(\d+)/)?.[1] || '3', 10);
        if (mode === 3) {
          // Entire block is invisible, remove it
          return '';
        }
      }
      // Block starts invisible but switches to visible - keep it but clean
      return match;
    }
    return match;
  });

  // Pattern 2: Remove inline invisible text sequences
  // q ... 3 Tr ... text ... Q
  result = result.replace(/q([^Q]*?)\b3\s+Tr\b([^Q]*?)Q/g, (match, before, after) => {
    // Check if mode changes back to visible
    if (/\b[012]\s+Tr\b/.test(after)) {
      return match; // Keep - mode changes back
    }
    return ''; // Remove entire invisible block
  });

  // Clean up multiple newlines
  result = result.replace(/\n{3,}/g, '\n\n');

  return result;
}
