/**
 * TrueType Font Subsetter
 *
 * Removes unused glyphs from TrueType font programs (FontFile2 in PDFs).
 * This is the key technique that online PDF compressors use to dramatically
 * reduce text-heavy PDFs — often achieving 5-10x reduction in font data.
 *
 * Algorithm:
 * 1. Parse TrueType table directory
 * 2. Parse loca/glyf tables for glyph data and composite dependencies
 * 3. Keep only glyphs that are actually used (+ glyph 0 / .notdef)
 * 4. Rebuild glyf/loca tables with unused glyphs zeroed out
 * 5. Reassemble font file with updated tables
 */

// ─── Binary helpers ──────────────────────────────────────────────────

const readUint16 = (d: Uint8Array, o: number): number =>
  (d[o] << 8) | d[o + 1];

const readInt16 = (d: Uint8Array, o: number): number => {
  const v = readUint16(d, o);
  return v >= 0x8000 ? v - 0x10000 : v;
};

const readUint32 = (d: Uint8Array, o: number): number =>
  ((d[o] << 24) | (d[o + 1] << 16) | (d[o + 2] << 8) | d[o + 3]) >>> 0;

const writeUint16 = (d: Uint8Array, o: number, v: number): void => {
  d[o] = (v >> 8) & 0xff;
  d[o + 1] = v & 0xff;
};

const writeUint32 = (d: Uint8Array, o: number, v: number): void => {
  d[o] = (v >>> 24) & 0xff;
  d[o + 1] = (v >> 16) & 0xff;
  d[o + 2] = (v >> 8) & 0xff;
  d[o + 3] = v & 0xff;
};

// ─── TrueType structures ────────────────────────────────────────────

interface TableRecord {
  tag: string;
  checksum: number;
  offset: number;
  length: number;
}

interface FontDirectory {
  sfVersion: number;
  numTables: number;
  tables: Map<string, TableRecord>;
}

// ─── Font parsing ───────────────────────────────────────────────────

/**
 * Parse the TrueType table directory.
 */
const parseDirectory = (data: Uint8Array): FontDirectory | null => {
  if (data.length < 12) return null;

  const sfVersion = readUint32(data, 0);
  // Accept TrueType (0x00010000) and TTC-extracted or "true" (0x74727565)
  if (sfVersion !== 0x00010000 && sfVersion !== 0x74727565) {
    return null; // Not a TrueType font (could be CFF/OpenType)
  }

  const numTables = readUint16(data, 4);
  if (data.length < 12 + numTables * 16) return null;

  const tables = new Map<string, TableRecord>();
  for (let i = 0; i < numTables; i++) {
    const off = 12 + i * 16;
    const tag = String.fromCharCode(data[off], data[off + 1], data[off + 2], data[off + 3]);
    tables.set(tag, {
      tag,
      checksum: readUint32(data, off + 4),
      offset: readUint32(data, off + 8),
      length: readUint32(data, off + 12),
    });
  }

  return { sfVersion, numTables, tables };
};

/**
 * Get the number of glyphs from the maxp table.
 */
const getNumGlyphs = (data: Uint8Array, tables: Map<string, TableRecord>): number => {
  const maxp = tables.get('maxp');
  if (!maxp) return 0;
  return readUint16(data, maxp.offset + 4);
};

/**
 * Get the loca format (0 = short/uint16, 1 = long/uint32) from head table.
 */
const getLocaFormat = (data: Uint8Array, tables: Map<string, TableRecord>): number => {
  const head = tables.get('head');
  if (!head) return 0;
  return readInt16(data, head.offset + 50);
};

/**
 * Parse the loca table to get byte offsets into the glyf table.
 * Returns numGlyphs+1 entries (last entry marks end of last glyph).
 */
const parseLoca = (
  data: Uint8Array,
  tables: Map<string, TableRecord>,
  numGlyphs: number,
  isLong: boolean,
): number[] => {
  const loca = tables.get('loca');
  if (!loca) return [];

  const offsets: number[] = [];
  const count = numGlyphs + 1;

  for (let i = 0; i < count; i++) {
    if (isLong) {
      offsets.push(readUint32(data, loca.offset + i * 4));
    } else {
      // Short format stores offset/2
      offsets.push(readUint16(data, loca.offset + i * 2) * 2);
    }
  }

  return offsets;
};

// Composite glyph flags
const COMPOSITE_FLAG_MORE_COMPONENTS = 0x0020;
const COMPOSITE_FLAG_ARG_1_AND_2_ARE_WORDS = 0x0001;
const COMPOSITE_FLAG_WE_HAVE_A_SCALE = 0x0008;
const COMPOSITE_FLAG_WE_HAVE_AN_X_AND_Y_SCALE = 0x0040;
const COMPOSITE_FLAG_WE_HAVE_A_TWO_BY_TWO = 0x0080;

/**
 * Find all glyph IDs referenced by composite glyphs (recursively).
 * Composite glyphs are built from other glyphs, so we must keep those too.
 */
const resolveCompositeDeps = (
  data: Uint8Array,
  glyfOffset: number,
  locaOffsets: number[],
  usedGlyphs: Set<number>,
): void => {
  const queue = [...usedGlyphs];
  const visited = new Set<number>();

  while (queue.length > 0) {
    const gid = queue.pop()!;
    if (visited.has(gid)) continue;
    visited.add(gid);

    const glyphStart = glyfOffset + locaOffsets[gid];
    const glyphEnd = glyfOffset + locaOffsets[gid + 1];
    if (glyphEnd <= glyphStart) continue; // Empty glyph

    const numberOfContours = readInt16(data, glyphStart);
    if (numberOfContours >= 0) continue; // Simple glyph, no deps

    // Composite glyph — parse component records
    let pos = glyphStart + 10; // Skip header (numberOfContours + xMin/yMin/xMax/yMax)

    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (pos + 4 > data.length) break;

      const flags = readUint16(data, pos);
      const componentGid = readUint16(data, pos + 2);
      pos += 4;

      // Add referenced glyph
      if (componentGid < locaOffsets.length - 1) {
        if (!usedGlyphs.has(componentGid)) {
          usedGlyphs.add(componentGid);
          queue.push(componentGid);
        }
      }

      // Skip argument bytes
      if (flags & COMPOSITE_FLAG_ARG_1_AND_2_ARE_WORDS) {
        pos += 4; // Two int16 args
      } else {
        pos += 2; // Two uint8 args
      }

      // Skip transform data
      if (flags & COMPOSITE_FLAG_WE_HAVE_A_SCALE) {
        pos += 2; // One F2Dot14
      } else if (flags & COMPOSITE_FLAG_WE_HAVE_AN_X_AND_Y_SCALE) {
        pos += 4; // Two F2Dot14
      } else if (flags & COMPOSITE_FLAG_WE_HAVE_A_TWO_BY_TWO) {
        pos += 8; // Four F2Dot14
      }

      if (!(flags & COMPOSITE_FLAG_MORE_COMPONENTS)) break;
    }
  }
};

/**
 * Calculate a TrueType table checksum.
 */
const calcChecksum = (data: Uint8Array, offset: number, length: number): number => {
  let sum = 0;
  const nLongs = Math.ceil(length / 4);
  for (let i = 0; i < nLongs; i++) {
    const off = offset + i * 4;
    const b0 = off < data.length ? data[off] : 0;
    const b1 = off + 1 < data.length ? data[off + 1] : 0;
    const b2 = off + 2 < data.length ? data[off + 2] : 0;
    const b3 = off + 3 < data.length ? data[off + 3] : 0;
    sum = (sum + ((b0 << 24) | (b1 << 16) | (b2 << 8) | b3)) >>> 0;
  }
  return sum;
};

/**
 * Pad a length to 4-byte boundary.
 */
const pad4 = (n: number): number => (n + 3) & ~3;

// ─── Main subsetting function ───────────────────────────────────────

export interface SubsetResult {
  /** The subsetted font bytes */
  fontData: Uint8Array;
  /** Original font size */
  originalSize: number;
  /** Number of glyphs kept */
  glyphsKept: number;
  /** Total number of glyphs in the original font */
  totalGlyphs: number;
}

/**
 * Subset a TrueType font to include only the specified glyph IDs.
 *
 * Unused glyphs are replaced with zero-length entries in the glyf table.
 * This preserves the glyph-to-index mapping (critical for CID fonts)
 * while dramatically reducing the font's size.
 *
 * @param fontData Raw TrueType font bytes
 * @param usedGlyphIds Set of glyph IDs that are actually used
 * @returns SubsetResult with the new font bytes, or null if subsetting failed
 */
export const subsetTrueTypeFont = (
  fontData: Uint8Array,
  usedGlyphIds: Set<number>,
): SubsetResult | null => {
  try {
    const dir = parseDirectory(fontData);
    if (!dir) return null;

    const { tables } = dir;
    const glyfTable = tables.get('glyf');
    const locaTable = tables.get('loca');
    if (!glyfTable || !locaTable) return null;

    const numGlyphs = getNumGlyphs(fontData, tables);
    if (numGlyphs === 0) return null;

    const locaFormat = getLocaFormat(fontData, tables);
    const isLong = locaFormat === 1;
    const locaOffsets = parseLoca(fontData, tables, numGlyphs, isLong);
    if (locaOffsets.length !== numGlyphs + 1) return null;

    // Always keep glyph 0 (.notdef)
    const keepGlyphs = new Set(usedGlyphIds);
    keepGlyphs.add(0);

    // Resolve composite glyph dependencies
    resolveCompositeDeps(fontData, glyfTable.offset, locaOffsets, keepGlyphs);

    // Check if subsetting would actually save space
    let keptGlyphBytes = 0;
    let totalGlyphBytes = 0;
    for (let gid = 0; gid < numGlyphs; gid++) {
      const glyphLen = locaOffsets[gid + 1] - locaOffsets[gid];
      totalGlyphBytes += glyphLen;
      if (keepGlyphs.has(gid)) {
        keptGlyphBytes += glyphLen;
      }
    }

    // If we'd keep most of the glyph data, skip subsetting
    if (keptGlyphBytes >= totalGlyphBytes * 0.9) {
      return null; // Not worth subsetting
    }

    // ── Build new glyf table ──
    // Calculate new glyf size: only kept glyphs have data
    let newGlyfSize = 0;
    for (let gid = 0; gid < numGlyphs; gid++) {
      if (keepGlyphs.has(gid)) {
        const glyphLen = locaOffsets[gid + 1] - locaOffsets[gid];
        newGlyfSize += pad4(glyphLen); // Align each glyph to 4 bytes
      }
    }

    const newGlyf = new Uint8Array(newGlyfSize);
    const newLocaOffsets: number[] = [];
    let writePos = 0;

    for (let gid = 0; gid < numGlyphs; gid++) {
      newLocaOffsets.push(writePos);

      if (keepGlyphs.has(gid)) {
        const srcStart = glyfTable.offset + locaOffsets[gid];
        const glyphLen = locaOffsets[gid + 1] - locaOffsets[gid];
        if (glyphLen > 0) {
          newGlyf.set(fontData.subarray(srcStart, srcStart + glyphLen), writePos);
          writePos += pad4(glyphLen);
        }
      }
      // Else: unused glyph → offset stays the same as previous (zero-length)
    }
    newLocaOffsets.push(writePos); // Final entry

    // ── Build new loca table ──
    // Use long format for safety (simpler and avoids overflow issues)
    const newLocaSize = (numGlyphs + 1) * 4;
    const newLoca = new Uint8Array(newLocaSize);
    for (let i = 0; i <= numGlyphs; i++) {
      writeUint32(newLoca, i * 4, newLocaOffsets[i]);
    }

    // ── Reassemble font ──
    // Collect all tables, replacing glyf and loca with new versions
    const newTableData = new Map<string, Uint8Array>();

    for (const [tag, record] of tables) {
      if (tag === 'glyf') {
        newTableData.set(tag, newGlyf);
      } else if (tag === 'loca') {
        newTableData.set(tag, newLoca);
      } else {
        // Copy original table data
        const tableBytes = fontData.subarray(record.offset, record.offset + record.length);
        // For head table, update indexToLocFormat to long (1)
        if (tag === 'head') {
          const headCopy = new Uint8Array(tableBytes.length);
          headCopy.set(tableBytes);
          writeInt16(headCopy, 50, 1); // indexToLocFormat = 1 (long)
          // Clear checkSumAdjustment (will be computed later)
          writeUint32(headCopy, 8, 0);
          newTableData.set(tag, headCopy);
        } else {
          newTableData.set(tag, new Uint8Array(tableBytes));
        }
      }
    }

    // Calculate total font size
    const numTablesOut = newTableData.size;
    const headerSize = 12 + numTablesOut * 16;
    let totalSize = headerSize;
    for (const [, data] of newTableData) {
      totalSize += pad4(data.length);
    }

    const output = new Uint8Array(totalSize);

    // Write offset table header
    writeUint32(output, 0, 0x00010000); // sfVersion
    writeUint16(output, 4, numTablesOut);
    // searchRange, entrySelector, rangeShift
    let searchRange = 1;
    let entrySelector = 0;
    while (searchRange * 2 <= numTablesOut) {
      searchRange *= 2;
      entrySelector++;
    }
    searchRange *= 16;
    writeUint16(output, 6, searchRange);
    writeUint16(output, 8, entrySelector);
    writeUint16(output, 10, numTablesOut * 16 - searchRange);

    // Write table records and data
    let dataOffset = headerSize;
    let recordOffset = 12;

    // Sort tables alphabetically for proper font structure
    const sortedTags = [...newTableData.keys()].sort();

    for (const tag of sortedTags) {
      const tableData = newTableData.get(tag)!;

      // Write table record
      output[recordOffset] = tag.charCodeAt(0);
      output[recordOffset + 1] = tag.charCodeAt(1);
      output[recordOffset + 2] = tag.charCodeAt(2);
      output[recordOffset + 3] = tag.charCodeAt(3);

      // Copy table data first so we can calculate checksum
      output.set(tableData, dataOffset);

      const checksum = calcChecksum(output, dataOffset, tableData.length);
      writeUint32(output, recordOffset + 4, checksum);
      writeUint32(output, recordOffset + 8, dataOffset);
      writeUint32(output, recordOffset + 12, tableData.length);

      dataOffset += pad4(tableData.length);
      recordOffset += 16;
    }

    // Calculate and write head.checkSumAdjustment
    const headTable = tables.get('head');
    if (headTable) {
      const wholeChecksum = calcChecksum(output, 0, output.length);
      const adjustment = (0xB1B0AFBA - wholeChecksum) >>> 0;
      // Find head table offset in new font
      const headTag = sortedTags.indexOf('head');
      if (headTag >= 0) {
        const headRecordOff = 12 + headTag * 16;
        const headDataOff = readUint32(output, headRecordOff + 8);
        writeUint32(output, headDataOff + 8, adjustment);
      }
    }

    return {
      fontData: output,
      originalSize: fontData.length,
      glyphsKept: keepGlyphs.size,
      totalGlyphs: numGlyphs,
    };
  } catch {
    return null; // Any parse error → skip subsetting for this font
  }
};

const writeInt16 = (d: Uint8Array, o: number, v: number): void => {
  const uv = v < 0 ? v + 0x10000 : v;
  writeUint16(d, o, uv);
};

// ─── WinAnsi encoding table ─────────────────────────────────────────
// Maps WinAnsi character codes (128-159) to Unicode codepoints.
// Codes 0-127 and 160-255 map directly to Unicode.

const WINANSI_EXTRAS: Record<number, number> = {
  0x80: 0x20AC, // Euro sign
  0x82: 0x201A, // Single low-9 quotation mark
  0x83: 0x0192, // Latin small letter f with hook
  0x84: 0x201E, // Double low-9 quotation mark
  0x85: 0x2026, // Horizontal ellipsis
  0x86: 0x2020, // Dagger
  0x87: 0x2021, // Double dagger
  0x88: 0x02C6, // Modifier letter circumflex accent
  0x89: 0x2030, // Per mille sign
  0x8A: 0x0160, // Latin capital letter S with caron
  0x8B: 0x2039, // Single left-pointing angle quotation mark
  0x8C: 0x0152, // Latin capital ligature OE
  0x8E: 0x017D, // Latin capital letter Z with caron
  0x91: 0x2018, // Left single quotation mark
  0x92: 0x2019, // Right single quotation mark
  0x93: 0x201C, // Left double quotation mark
  0x94: 0x201D, // Right double quotation mark
  0x95: 0x2022, // Bullet
  0x96: 0x2013, // En dash
  0x97: 0x2014, // Em dash
  0x98: 0x02DC, // Small tilde
  0x99: 0x2122, // Trade mark sign
  0x9A: 0x0161, // Latin small letter s with caron
  0x9B: 0x203A, // Single right-pointing angle quotation mark
  0x9C: 0x0153, // Latin small ligature oe
  0x9E: 0x017E, // Latin small letter z with caron
  0x9F: 0x0178, // Latin capital letter Y with diaeresis
};

/**
 * Convert a WinAnsi character code to a Unicode codepoint.
 */
export const winAnsiToUnicode = (code: number): number => {
  if (code >= 0x80 && code <= 0x9F) {
    return WINANSI_EXTRAS[code] ?? code;
  }
  return code; // 0-127 and 160-255 map directly
};

// ─── cmap parsing for glyph ID lookup ───────────────────────────────

/**
 * Parse a TrueType cmap table and build a Unicode → GID mapping.
 * Handles format 4 (BMP) which covers virtually all embedded PDF fonts.
 */
export const parseCmapTable = (
  fontData: Uint8Array,
  tables: Map<string, TableRecord>,
): Map<number, number> | null => {
  const cmap = tables.get('cmap');
  if (!cmap) return null;

  const cmapOff = cmap.offset;
  const numSubtables = readUint16(fontData, cmapOff + 2);

  // Find platform 3 (Windows), encoding 1 (Unicode BMP) — most common
  // Fallback to platform 0 (Unicode), encoding 3 or any
  let bestOffset = -1;
  let bestPriority = -1;

  for (let i = 0; i < numSubtables; i++) {
    const entryOff = cmapOff + 4 + i * 8;
    const platformId = readUint16(fontData, entryOff);
    const encodingId = readUint16(fontData, entryOff + 2);
    const subtableOffset = readUint32(fontData, entryOff + 4);

    let priority = -1;
    if (platformId === 3 && encodingId === 1) priority = 10; // Windows Unicode BMP
    else if (platformId === 0 && encodingId === 3) priority = 8; // Unicode BMP
    else if (platformId === 0) priority = 5; // Any Unicode
    else if (platformId === 1 && encodingId === 0) priority = 3; // Mac Roman

    if (priority > bestPriority) {
      bestPriority = priority;
      bestOffset = cmapOff + subtableOffset;
    }
  }

  if (bestOffset < 0) return null;

  const format = readUint16(fontData, bestOffset);

  if (format === 4) {
    return parseCmapFormat4(fontData, bestOffset);
  } else if (format === 12) {
    return parseCmapFormat12(fontData, bestOffset);
  }

  // Unsupported format
  return null;
};

/**
 * Parse cmap format 4 (Segment mapping to delta values).
 * This is the most common format for BMP characters.
 */
const parseCmapFormat4 = (data: Uint8Array, offset: number): Map<number, number> => {
  const segCount = readUint16(data, offset + 6) / 2;
  const endCountOff = offset + 14;
  const startCountOff = endCountOff + segCount * 2 + 2; // +2 for reservedPad
  const idDeltaOff = startCountOff + segCount * 2;
  const idRangeOffsetOff = idDeltaOff + segCount * 2;

  const map = new Map<number, number>();

  for (let i = 0; i < segCount; i++) {
    const endCode = readUint16(data, endCountOff + i * 2);
    const startCode = readUint16(data, startCountOff + i * 2);
    const idDelta = readInt16(data, idDeltaOff + i * 2);
    const idRangeOffset = readUint16(data, idRangeOffsetOff + i * 2);

    if (startCode === 0xFFFF) break;

    for (let code = startCode; code <= endCode; code++) {
      let gid: number;

      if (idRangeOffset === 0) {
        gid = (code + idDelta) & 0xFFFF;
      } else {
        const rangeOff = idRangeOffsetOff + i * 2 + idRangeOffset + (code - startCode) * 2;
        gid = readUint16(data, rangeOff);
        if (gid !== 0) {
          gid = (gid + idDelta) & 0xFFFF;
        }
      }

      if (gid !== 0) {
        map.set(code, gid);
      }
    }
  }

  return map;
};

/**
 * Parse cmap format 12 (Segmented coverage — full Unicode).
 */
const parseCmapFormat12 = (data: Uint8Array, offset: number): Map<number, number> => {
  const nGroups = readUint32(data, offset + 12);
  const map = new Map<number, number>();

  for (let i = 0; i < nGroups; i++) {
    const groupOff = offset + 16 + i * 12;
    const startCharCode = readUint32(data, groupOff);
    const endCharCode = readUint32(data, groupOff + 4);
    const startGlyphID = readUint32(data, groupOff + 8);

    for (let code = startCharCode; code <= endCharCode; code++) {
      const gid = startGlyphID + (code - startCharCode);
      if (gid !== 0) {
        map.set(code, gid);
      }
    }
  }

  return map;
};

/**
 * Parse TrueType font and return Unicode→GID mapping.
 * Convenience wrapper for use from the resource processor.
 */
export const getFontCmap = (fontData: Uint8Array): Map<number, number> | null => {
  const dir = parseDirectory(fontData);
  if (!dir) return null;
  return parseCmapTable(fontData, dir.tables);
};

/**
 * Check if font data is a valid TrueType font that can be subsetted.
 */
export const isTrueTypeFont = (fontData: Uint8Array): boolean => {
  if (fontData.length < 12) return false;
  const sfVersion = readUint32(fontData, 0);
  return sfVersion === 0x00010000 || sfVersion === 0x74727565;
};
