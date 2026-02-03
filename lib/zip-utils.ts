/**
 * Minimal ZIP file creator using pako for deflate compression
 * Creates valid ZIP files without external dependencies
 */

import pako from 'pako';

interface ZipEntry {
    name: string;
    data: Uint8Array;
}

/**
 * Creates a ZIP file from multiple file entries
 */
export async function createZipBlob(entries: ZipEntry[]): Promise<Blob> {
    const localFileHeaders: Uint8Array[] = [];
    const centralDirectoryEntries: Uint8Array[] = [];
    let offset = 0;

    for (const entry of entries) {
        // Compress the data
        const compressedData = pako.deflate(entry.data);
        const fileName = new TextEncoder().encode(entry.name);

        // Calculate CRC32
        const crc32 = calculateCrc32(entry.data);

        // Local file header
        const localHeader = createLocalFileHeader(
            fileName,
            compressedData,
            entry.data.length,
            crc32
        );

        localFileHeaders.push(localHeader);
        localFileHeaders.push(compressedData);

        // Central directory entry
        const centralEntry = createCentralDirectoryEntry(
            fileName,
            compressedData,
            entry.data.length,
            crc32,
            offset
        );

        centralDirectoryEntries.push(centralEntry);

        offset += localHeader.length + compressedData.length;
    }

    // End of central directory
    const centralDirectorySize = centralDirectoryEntries.reduce((sum, e) => sum + e.length, 0);
    const endOfCentralDirectory = createEndOfCentralDirectory(
        entries.length,
        centralDirectorySize,
        offset
    );

    // Combine all parts into a single buffer
    const totalSize = localFileHeaders.reduce((sum, arr) => sum + arr.length, 0)
        + centralDirectoryEntries.reduce((sum, arr) => sum + arr.length, 0)
        + endOfCentralDirectory.length;

    const result = new Uint8Array(totalSize);
    let position = 0;

    for (const arr of localFileHeaders) {
        result.set(arr, position);
        position += arr.length;
    }

    for (const arr of centralDirectoryEntries) {
        result.set(arr, position);
        position += arr.length;
    }

    result.set(endOfCentralDirectory, position);

    return new Blob([result.buffer], { type: 'application/zip' });
}

function createLocalFileHeader(
    fileName: Uint8Array,
    compressedData: Uint8Array,
    uncompressedSize: number,
    crc32: number
): Uint8Array {
    const header = new ArrayBuffer(30 + fileName.length);
    const view = new DataView(header);
    const uint8 = new Uint8Array(header);

    // Local file header signature
    view.setUint32(0, 0x04034b50, true);
    // Version needed to extract
    view.setUint16(4, 20, true);
    // General purpose bit flag
    view.setUint16(6, 0, true);
    // Compression method (8 = deflate)
    view.setUint16(8, 8, true);
    // Last mod file time
    view.setUint16(10, 0, true);
    // Last mod file date
    view.setUint16(12, 0, true);
    // CRC-32
    view.setUint32(14, crc32, true);
    // Compressed size
    view.setUint32(18, compressedData.length, true);
    // Uncompressed size
    view.setUint32(22, uncompressedSize, true);
    // File name length
    view.setUint16(26, fileName.length, true);
    // Extra field length
    view.setUint16(28, 0, true);
    // File name
    uint8.set(fileName, 30);

    return uint8;
}

function createCentralDirectoryEntry(
    fileName: Uint8Array,
    compressedData: Uint8Array,
    uncompressedSize: number,
    crc32: number,
    localHeaderOffset: number
): Uint8Array {
    const entry = new ArrayBuffer(46 + fileName.length);
    const view = new DataView(entry);
    const uint8 = new Uint8Array(entry);

    // Central file header signature
    view.setUint32(0, 0x02014b50, true);
    // Version made by
    view.setUint16(4, 20, true);
    // Version needed to extract
    view.setUint16(6, 20, true);
    // General purpose bit flag
    view.setUint16(8, 0, true);
    // Compression method (8 = deflate)
    view.setUint16(10, 8, true);
    // Last mod file time
    view.setUint16(12, 0, true);
    // Last mod file date
    view.setUint16(14, 0, true);
    // CRC-32
    view.setUint32(16, crc32, true);
    // Compressed size
    view.setUint32(20, compressedData.length, true);
    // Uncompressed size
    view.setUint32(24, uncompressedSize, true);
    // File name length
    view.setUint16(28, fileName.length, true);
    // Extra field length
    view.setUint16(30, 0, true);
    // File comment length
    view.setUint16(32, 0, true);
    // Disk number start
    view.setUint16(34, 0, true);
    // Internal file attributes
    view.setUint16(36, 0, true);
    // External file attributes
    view.setUint32(38, 0, true);
    // Relative offset of local header
    view.setUint32(42, localHeaderOffset, true);
    // File name
    uint8.set(fileName, 46);

    return uint8;
}

function createEndOfCentralDirectory(
    entryCount: number,
    centralDirectorySize: number,
    centralDirectoryOffset: number
): Uint8Array {
    const record = new ArrayBuffer(22);
    const view = new DataView(record);

    // End of central dir signature
    view.setUint32(0, 0x06054b50, true);
    // Number of this disk
    view.setUint16(4, 0, true);
    // Disk where central directory starts
    view.setUint16(6, 0, true);
    // Number of central directory records on this disk
    view.setUint16(8, entryCount, true);
    // Total number of central directory records
    view.setUint16(10, entryCount, true);
    // Size of central directory
    view.setUint32(12, centralDirectorySize, true);
    // Offset of start of central directory
    view.setUint32(16, centralDirectoryOffset, true);
    // Comment length
    view.setUint16(20, 0, true);

    return new Uint8Array(record);
}

// CRC32 calculation
function calculateCrc32(data: Uint8Array): number {
    let crc = 0xFFFFFFFF;
    const table = getCrc32Table();

    for (let i = 0; i < data.length; i++) {
        crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
    }

    return (crc ^ 0xFFFFFFFF) >>> 0;
}

// Memoized CRC32 lookup table
let crc32Table: Uint32Array | null = null;

function getCrc32Table(): Uint32Array {
    if (crc32Table) return crc32Table;

    crc32Table = new Uint32Array(256);

    for (let i = 0; i < 256; i++) {
        let crc = i;
        for (let j = 0; j < 8; j++) {
            crc = (crc & 1) ? (0xEDB88320 ^ (crc >>> 1)) : (crc >>> 1);
        }
        crc32Table[i] = crc >>> 0;
    }

    return crc32Table;
}

/**
 * Download helper - triggers browser download
 */
export function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Get output filename for compressed file
 */
export function getCompressedFilename(originalName: string): string {
    const lastDot = originalName.lastIndexOf('.');
    if (lastDot === -1) {
        return `${originalName}_compressed`;
    }
    const name = originalName.slice(0, lastDot);
    const ext = originalName.slice(lastDot);
    return `${name}_compressed${ext}`;
}
