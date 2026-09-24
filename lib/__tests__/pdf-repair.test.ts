// @vitest-environment node
/**
 * Regression tests for PDFs whose catalog or page tree is broken.
 *
 * Real crash reports (Errors tab, Jun–Jul 2026):
 *   - "Expected instance of e, but got instance of undefined"  (x5)
 *   - "Cannot read properties of undefined (reading 'Pages')"   (x1)
 * Both are pdf-lib failing to find the page tree: the first when the catalog's
 * /Pages entry is missing or points at an object that does not exist, the
 * second when there is no usable /Root and no /Type /Catalog object at all.
 * Viewers such as Acrobat and pdf.js open these files by rebuilding the page
 * tree, so we should too instead of telling the user the file is corrupted.
 */
import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { loadPdf } from '../pdf-processor';

const toLatin1 = (bytes: Uint8Array) => Buffer.from(bytes).toString('latin1');
const toBuffer = (s: string): ArrayBuffer => {
  const b = Buffer.from(s, 'latin1');
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};

async function healthyPdf(pages = 2): Promise<string> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([200 + i, 200]);
  // No object streams, so the objects are plain text we can break precisely.
  return toLatin1(await doc.save({ useObjectStreams: false }));
}

const catalogNumber = (s: string) => s.match(/\/Root (\d+) 0 R/)![1];

describe('loadPdf repairs a broken page tree', () => {
  it('opens a PDF whose catalog has no /Pages entry', async () => {
    const s = await healthyPdf();
    const n = catalogNumber(s);
    const broken = s.replace(new RegExp(`(${n} 0 obj\\s*<<[^>]*?)/Pages \\d+ 0 R`), '$1');
    expect(broken).not.toBe(s);

    const { pdfDoc, info } = await loadPdf(toBuffer(broken));
    expect(info.pageCount).toBe(2);
    expect(pdfDoc.getPage(1).getWidth()).toBe(201);
  });

  it('opens a PDF whose catalog /Pages points at a missing object', async () => {
    const s = await healthyPdf();
    const n = catalogNumber(s);
    const broken = s.replace(new RegExp(`(${n} 0 obj\\s*<<[^>]*?)/Pages \\d+ 0 R`), '$1/Pages 99 0 R');

    const { info } = await loadPdf(toBuffer(broken));
    expect(info.pageCount).toBe(2);
  });

  it('opens a PDF with no usable /Root and no catalog object at all', async () => {
    const s = await healthyPdf();
    const broken = s
      .replace(/\/Root \d+ 0 R/, '/Root 99 0 R')
      .replace('/Type /Catalog', '/Type /Xatalog');

    const { info } = await loadPdf(toBuffer(broken));
    expect(info.pageCount).toBe(2);
  });

  it('rebuilds the page tree from page objects when no /Pages node survives', async () => {
    const s = await healthyPdf(3);
    const broken = s
      .replace(/\/Root \d+ 0 R/, '/Root 99 0 R')
      .replace('/Type /Catalog', '/Type /Xatalog')
      .replace('/Type /Pages', '/Type /Xages');

    const { pdfDoc, info } = await loadPdf(toBuffer(broken));
    expect(info.pageCount).toBe(3);
    // Page order follows object order, which is how pdf-lib wrote them.
    expect(pdfDoc.getPages().map((p) => p.getWidth())).toEqual([200, 201, 202]);
  });

  it('produces a document that saves and reloads cleanly', async () => {
    const s = await healthyPdf();
    const broken = s.replace(/\/Root \d+ 0 R/, '/Root 99 0 R').replace('/Type /Catalog', '/Type /Xatalog');
    const { pdfDoc } = await loadPdf(toBuffer(broken));

    const reloaded = await PDFDocument.load(await pdfDoc.save());
    expect(reloaded.getPageCount()).toBe(2);
  });

  it('leaves a healthy PDF untouched', async () => {
    const s = await healthyPdf();
    const { pdfDoc, info } = await loadPdf(toBuffer(s));
    expect(info.pageCount).toBe(2);
    expect(pdfDoc.context.trailerInfo.Root?.toString()).toBe(`${catalogNumber(s)} 0 R`);
  });

  it('still rejects a file with no pages at all', async () => {
    const s = await healthyPdf();
    const broken = s
      .replace(/\/Root \d+ 0 R/, '/Root 99 0 R')
      .replace('/Type /Catalog', '/Type /Xatalog')
      .replace('/Type /Pages', '/Type /Xages')
      .replace(/\/Type \/Page\b/g, '/Type /Xage');

    await expect(loadPdf(toBuffer(broken))).rejects.toThrow();
  });
});

describe('the full compression pipeline on a repaired PDF', () => {
  it('compresses a PDF with no catalog end to end', async () => {
    const { analyzePdf } = await import('../pdf-processor');
    const s = await healthyPdf(3);
    const broken = s.replace(/\/Root \d+ 0 R/, '/Root 99 0 R').replace('/Type /Catalog', '/Type /Xatalog');

    const result = await analyzePdf(toBuffer(broken), () => {});
    expect(result.pageCount).toBe(3);

    const out = await PDFDocument.load(result.fullCompressedBytes);
    expect(out.getPageCount()).toBe(3);
  });
});
