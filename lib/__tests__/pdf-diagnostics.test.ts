import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import {
  extractPdfSafeMetadata,
  formatPdfSafeMetadata,
  describePdfForErrorReport,
} from '../pdf-diagnostics';

const SECRET_TITLE = 'Q3 Layoff List CONFIDENTIAL';
const SECRET_AUTHOR = 'Jane Q Employee';
const SECRET_SUBJECT = 'Severance terms for named staff';
const SECRET_KEYWORD = 'ssn-123-45-6789';

async function makeNormalPdf(pages = 3): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) {
    const page = doc.addPage([200, 200]);
    page.drawText(`page body text ${i}`, { x: 10, y: 100, size: 10 });
  }
  // Deliberately stuff the risky fields so the tests can prove we never read them.
  doc.setTitle(SECRET_TITLE);
  doc.setAuthor(SECRET_AUTHOR);
  doc.setSubject(SECRET_SUBJECT);
  doc.setKeywords([SECRET_KEYWORD]);
  doc.setProducer('Test Producer 9000');
  doc.setCreator('Test Creator Suite');
  return doc.save();
}

/** Minimal hand-built PDF whose trailer carries an /Encrypt dictionary. */
function makeEncryptedPdf(): Uint8Array {
  const body = [
    '%PDF-1.6',
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >> endobj',
    '4 0 obj << /Filter /Standard /V 2 /R 3 /Length 128 /P -1 >> endobj',
    'trailer << /Size 5 /Root 1 0 R /Encrypt 4 0 R >>',
    'startxref',
    '0',
    '%%EOF',
    '',
  ].join('\n');
  return new TextEncoder().encode(body);
}

const toBlob = (bytes: Uint8Array): Blob =>
  new Blob([bytes.slice().buffer as ArrayBuffer], { type: 'application/pdf' });

describe('extractPdfSafeMetadata', () => {
  it('extracts structural metadata from a normal PDF', async () => {
    const bytes = await makeNormalPdf(3);
    const meta = await extractPdfSafeMetadata(bytes);

    expect(meta).not.toBeNull();
    expect(meta!.pdfVersion).toMatch(/^1\.\d$/);
    expect(meta!.fileSize).toBe(bytes.byteLength);
    expect(meta!.pageCount).toBe(3);
    expect(meta!.pageCountApprox).toBe(false);
    expect(meta!.isEncrypted).toBe(false);
    expect(meta!.isLinearized).toBe(false);
    expect(meta!.objectCount).toBeGreaterThan(0);
    expect(meta!.hasAcroForm).toBe(false);
    expect(meta!.producer).toBe('Test Producer 9000');
    expect(meta!.creator).toBe('Test Creator Suite');
    expect(meta!.source).toBe('pdf-lib');
  });

  it('accepts a Blob/File as well as raw bytes', async () => {
    const bytes = await makeNormalPdf(2);
    const meta = await extractPdfSafeMetadata(toBlob(bytes));

    expect(meta?.pageCount).toBe(2);
    expect(meta?.fileSize).toBe(bytes.byteLength);
  });

  it('flags an encrypted PDF', async () => {
    const meta = await extractPdfSafeMetadata(makeEncryptedPdf());

    expect(meta).not.toBeNull();
    expect(meta!.isEncrypted).toBe(true);
    expect(meta!.pdfVersion).toBe('1.6');
  });

  it('does not throw on a truncated PDF and still reports what it can', async () => {
    const full = await makeNormalPdf(4);
    const truncated = full.slice(0, Math.floor(full.byteLength / 3));

    const meta = await extractPdfSafeMetadata(truncated);

    // Never throws; may or may not resolve details.
    expect(meta === null || typeof meta === 'object').toBe(true);
    if (meta) {
      expect(meta.pdfVersion).toMatch(/^1\.\d$/);
      expect(meta.fileSize).toBe(truncated.byteLength);
    }
  });

  it('does not throw on garbage, empty or non-PDF input', async () => {
    const garbage = new Uint8Array(512).fill(0xab);
    await expect(extractPdfSafeMetadata(garbage)).resolves.not.toThrow();
    await expect(extractPdfSafeMetadata(new Uint8Array(0))).resolves.not.toThrow();
    await expect(extractPdfSafeMetadata(null)).resolves.toBeNull();
    await expect(extractPdfSafeMetadata(undefined)).resolves.toBeNull();
    await expect(extractPdfSafeMetadata('not a pdf')).resolves.toBeNull();
    await expect(extractPdfSafeMetadata(42)).resolves.toBeNull();
    await expect(extractPdfSafeMetadata({ nope: true })).resolves.toBeNull();
  });

  it('never reads a huge file whole — only a head and a tail slice', async () => {
    const HUGE = 600 * 1024 * 1024;
    const head = new TextEncoder().encode('%PDF-1.5\n/Linearized 1\n');
    const tail = new TextEncoder().encode(
      'trailer << /Size 4211 /Root 1 0 R >>\nstartxref\n9\n%%EOF\n'
    );
    const reads: Array<[number, number]> = [];

    // Blob-like stub: if anything asked for the whole 600MB this would record it.
    const fakeBlob = {
      size: HUGE,
      slice(start: number, end: number) {
        reads.push([start, end]);
        const bytes = start === 0 ? head : tail;
        return { arrayBuffer: async () => bytes.slice().buffer };
      },
      arrayBuffer: async () => {
        throw new Error('whole-file read attempted');
      },
    };

    const meta = await extractPdfSafeMetadata(fakeBlob);

    expect(meta).not.toBeNull();
    expect(meta!.fileSize).toBe(HUGE);
    expect(meta!.pdfVersion).toBe('1.5');
    expect(meta!.isLinearized).toBe(true);
    expect(meta!.objectCount).toBe(4210);
    expect(meta!.source).toBe('scan-partial');
    // Unknowns stay null rather than being guessed from a partial read.
    expect(meta!.isEncrypted).toBeNull();
    expect(meta!.hasAcroForm).toBeNull();
    // Two bounded slices, nothing larger than the tail window.
    expect(reads).toHaveLength(2);
    for (const [start, end] of reads) {
      expect(end - start).toBeLessThanOrEqual(256 * 1024);
    }
  });

  it('detects an AcroForm', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([200, 200]);
    const form = doc.getForm();
    form.createTextField('some.field').addToPage(doc.getPage(0), { x: 10, y: 10 });
    const meta = await extractPdfSafeMetadata(await doc.save());

    expect(meta?.hasAcroForm).toBe(true);
  });
});

describe('privacy boundary', () => {
  it('never exposes Title, Author, Subject, Keywords or page text', async () => {
    const bytes = await makeNormalPdf(2);
    const meta = await extractPdfSafeMetadata(bytes);
    const serialized = JSON.stringify(meta) + '\n' + formatPdfSafeMetadata(meta);

    for (const secret of [SECRET_TITLE, SECRET_AUTHOR, SECRET_SUBJECT, SECRET_KEYWORD]) {
      expect(serialized).not.toContain(secret);
    }
    expect(serialized).not.toContain('page body text');

    // And no field is even named after those metadata keys.
    const keys = Object.keys(meta ?? {}).map(k => k.toLowerCase());
    for (const banned of ['title', 'author', 'subject', 'keywords']) {
      expect(keys).not.toContain(banned);
    }
  });

  it('only ever returns the documented safe fields', async () => {
    const meta = await extractPdfSafeMetadata(await makeNormalPdf(1));

    expect(Object.keys(meta ?? {}).sort()).toEqual(
      [
        'creator',
        'fileSize',
        'hasAcroForm',
        'isEncrypted',
        'isLinearized',
        'objectCount',
        'pageCount',
        'pageCountApprox',
        'pdfVersion',
        'producer',
        'source',
      ].sort()
    );
  });
});

describe('formatPdfSafeMetadata', () => {
  it('renders a compact key=value breadcrumb', async () => {
    const meta = await extractPdfSafeMetadata(await makeNormalPdf(2));
    const line = formatPdfSafeMetadata(meta);

    expect(line).toContain('pdfVersion=');
    expect(line).toContain('pages=2');
    expect(line).toContain('encrypted=false');
    expect(line).toContain('acroForm=false');
    expect(line).toContain('metaSource=pdf-lib');
    expect(line).not.toContain('\n');
  });

  it('marks an approximate page count with ~', () => {
    const line = formatPdfSafeMetadata({
      pdfVersion: '1.4',
      fileSize: 10,
      pageCount: 61,
      pageCountApprox: true,
      isEncrypted: null,
      isLinearized: true,
      objectCount: 120,
      hasAcroForm: null,
      producer: null,
      creator: null,
      source: 'scan-partial',
    });

    expect(line).toContain('pages=~61');
    expect(line).not.toContain('encrypted=');
    expect(line).not.toContain('producer=');
  });

  it('returns an empty string for missing metadata', () => {
    expect(formatPdfSafeMetadata(null)).toBe('');
    expect(formatPdfSafeMetadata(undefined)).toBe('');
  });
});

describe('describePdfForErrorReport', () => {
  it('returns a breadcrumb for a good PDF and an empty string for junk', async () => {
    const line = await describePdfForErrorReport(await makeNormalPdf(1));
    expect(line).toContain('pages=1');

    await expect(describePdfForErrorReport(null)).resolves.toBe('');
    await expect(describePdfForErrorReport('nope')).resolves.toBe('');
  });
});
