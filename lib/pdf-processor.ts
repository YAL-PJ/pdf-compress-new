/**
 * PDF Processor - Core compression logic using pdf-lib
 * Pure functions that can run in main thread or Web Worker
 */

import { PDFDocument } from 'pdf-lib';
import type { PdfInfo, CompressionOptions, MethodResult } from './types';

/**
 * Load a PDF from ArrayBuffer and extract info
 */
export const loadPdf = async (
  arrayBuffer: ArrayBuffer
): Promise<{ pdfDoc: PDFDocument; info: PdfInfo }> => {
  const pdfDoc = await PDFDocument.load(arrayBuffer, {
    ignoreEncryption: false,
  });

  const info: PdfInfo = {
    pageCount: pdfDoc.getPageCount(),
    title: pdfDoc.getTitle(),
    author: pdfDoc.getAuthor(),
  };

  return { pdfDoc, info };
};

/**
 * Strip all metadata from PDF
 */
const stripMetadata = (pdfDoc: PDFDocument): void => {
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
 * Analyze PDF - calculate each method's contribution independently
 */
export const analyzePdf = async (
  arrayBuffer: ArrayBuffer,
  onProgress?: (message: string) => void
): Promise<{
  originalSize: number;
  pageCount: number;
  baselineSize: number;
  fullCompressedBytes: Uint8Array;
  methodResults: MethodResult[];
}> => {
  const originalSize = arrayBuffer.byteLength;

  onProgress?.('Reading PDF...');
  
  // 1. Get baseline (no optimizations)
  const { pdfDoc: baseDoc, info } = await loadPdf(arrayBuffer);
  const baselineBytes = await baseDoc.save({ useObjectStreams: false });
  const baselineSize = baselineBytes.byteLength;

  onProgress?.('Analyzing Object Streams...');
  
  // 2. Test Object Streams only
  const { pdfDoc: osDoc } = await loadPdf(arrayBuffer);
  const osBytes = await osDoc.save({ useObjectStreams: true });
  const osSaved = baselineSize - osBytes.byteLength;

  onProgress?.('Analyzing Metadata...');
  
  // 3. Test Metadata stripping only
  const { pdfDoc: metaDoc } = await loadPdf(arrayBuffer);
  stripMetadata(metaDoc);
  const metaBytes = await metaDoc.save({ useObjectStreams: false });
  const metaSaved = baselineSize - metaBytes.byteLength;

  onProgress?.('Creating compressed file...');
  
  // 4. Full compression (all methods ON) - this is what user downloads
  const { pdfDoc: fullDoc } = await loadPdf(arrayBuffer);
  stripMetadata(fullDoc);
  const fullCompressedBytes = await fullDoc.save({ useObjectStreams: true });

  const methodResults: MethodResult[] = [
    {
      key: 'useObjectStreams',
      savedBytes: osSaved,
      compressedSize: osBytes.byteLength,
    },
    {
      key: 'stripMetadata',
      savedBytes: metaSaved,
      compressedSize: metaBytes.byteLength,
    },
  ];

  onProgress?.('Done!');

  return {
    originalSize,
    pageCount: info.pageCount,
    baselineSize,
    fullCompressedBytes,
    methodResults,
  };
};
