/**
 * Safe PDF diagnostics for error reports.
 *
 * WHY THIS EXISTS
 * ---------------
 * Every tool on this site runs 100% in the browser: the user's PDF never leaves
 * their machine, and it never will. The downside is that when a crash depends on
 * one particular PDF, the error row in the Errors sheet (message + stack +
 * userAgent + a filename string) is not enough to reproduce it. This module
 * captures the *shape* of the input — never its content — so an equivalent PDF
 * can be rebuilt synthetically and the failure reproduced.
 *
 * WHAT IS CAPTURED (all structural / software-identifying):
 *   pdfVersion, fileSize, pageCount, isEncrypted, isLinearized,
 *   objectCount (approximate), hasAcroForm, producer, creator
 *
 * WHAT IS DELIBERATELY NEVER CAPTURED — do not add these:
 *   - file bytes, or any slice of them (nothing read here is ever returned)
 *   - page text, extracted strings, annotation or form field *values*
 *   - images, thumbnails, rendered pages
 *   - the PDF Info fields Title / Author / Subject / Keywords, and XMP
 *     dc:title / dc:creator / dc:description — these routinely contain real
 *     names, client names, case numbers and document subjects.
 *   - file paths (only the caller's existing fileName field is reported)
 * `producer` and `creator` are included because they name *software*
 * ("Microsoft Word", "Ghostscript 10.0"), which is the single most useful clue
 * for reproducing a generator-specific bug. They are truncated and stripped of
 * control characters before leaving this module. If you are unsure whether a
 * field is safe, leave it out.
 *
 * SAFETY CONTRACT
 * ---------------
 * This is best-effort diagnostics attached to an error report. It must never
 * throw, never reject and never hang: every path is wrapped, and the whole
 * extraction is bounded by a timeout. An error reporter that crashes while
 * reporting an error is worse than no metadata.
 *
 * COST CONTRACT
 * -------------
 * A 600MB PDF is never fully parsed. Files above MAX_FULL_PARSE_BYTES are
 * inspected by reading only a head and a tail slice (header + trailer), which
 * is where the version, the trailer /Size, /Encrypt and /Linearized live.
 */

/** Structural metadata safe to send with an error report. `null` means unknown. */
export interface PdfSafeMetadata {
  /** e.g. "1.7", from the `%PDF-1.x` header. */
  pdfVersion: string | null;
  /** Size of the input in bytes. */
  fileSize: number;
  /** Exact when `source` is "pdf-lib", otherwise a best-effort estimate. */
  pageCount: number | null;
  /** True when the page count could not be determined exactly. */
  pageCountApprox: boolean;
  isEncrypted: boolean | null;
  isLinearized: boolean | null;
  /** Approximate — from the trailer /Size or a count of `N G obj` markers. */
  objectCount: number | null;
  hasAcroForm: boolean | null;
  /** Producing software, never a person. Truncated. */
  producer: string | null;
  /** Creating software, never a person. Truncated. */
  creator: string | null;
  /** How the values were obtained, so the reader knows how much to trust them. */
  source: 'pdf-lib' | 'scan' | 'scan-partial';
}

/** Files at or below this size may be fully parsed with pdf-lib. */
const MAX_FULL_PARSE_BYTES = 16 * 1024 * 1024;
/** Bytes read from the start of a large file (header, linearization dict). */
const HEAD_BYTES = 64 * 1024;
/** Bytes read from the end of a large file (xref, trailer, Info dict). */
const TAIL_BYTES = 256 * 1024;
/** Hard ceiling on the whole extraction. */
const EXTRACT_TIMEOUT_MS = 2500;
/** Max characters kept from producer/creator. */
const MAX_STRING_LEN = 80;

type PdfInput = Blob | ArrayBuffer | ArrayBufferView;

/**
 * Structural type checks instead of `instanceof`: buffers and typed arrays that
 * cross a realm boundary (a Worker message, jsdom, an iframe) fail `instanceof`
 * against the local constructor even though they are perfectly usable.
 */
const isBlobLike = (value: unknown): value is Blob =>
  !!value &&
  typeof (value as Blob).slice === 'function' &&
  typeof (value as Blob).arrayBuffer === 'function' &&
  typeof (value as Blob).size === 'number';

const isArrayBufferLike = (value: unknown): value is ArrayBuffer =>
  !!value &&
  (value instanceof ArrayBuffer ||
    Object.prototype.toString.call(value) === '[object ArrayBuffer]');

const isBufferViewLike = (value: unknown): value is ArrayBufferView => {
  try {
    return ArrayBuffer.isView(value) && !(value instanceof DataView);
  } catch {
    return false;
  }
};

/** Wrap any typed-array view as a local Uint8Array over the same bytes. */
const asBytes = (view: ArrayBufferView): Uint8Array =>
  new Uint8Array(view.buffer as ArrayBuffer, view.byteOffset, view.byteLength);

/** Decode bytes as latin1 so byte offsets map 1:1 to string indices. */
const toLatin1 = (bytes: Uint8Array): string => {
  try {
    if (typeof TextDecoder !== 'undefined') {
      return new TextDecoder('latin1').decode(bytes);
    }
  } catch {
    // fall through to the manual decoder
  }
  let out = '';
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    out += String.fromCharCode(...Array.from(bytes.subarray(i, i + CHUNK)));
  }
  return out;
};

/**
 * Make a software name safe for a single-line breadcrumb: drop control
 * characters and the delimiters we use, and truncate hard.
 */
const sanitizeSoftwareName = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/[;=|]/g, ' ').trim();
  if (!cleaned) return null;
  return cleaned.length > MAX_STRING_LEN ? `${cleaned.slice(0, MAX_STRING_LEN)}…` : cleaned;
};

const matchLiteralString = (text: string, key: string): string | null => {
  // Only literal `(...)` strings are read. Hex strings are skipped rather than
  // decoded — not worth the code for a diagnostic hint.
  const re = new RegExp(`/${key}\\s*\\(((?:\\\\.|[^\\\\)])*)\\)`);
  const m = re.exec(text);
  if (!m) return null;
  return sanitizeSoftwareName(m[1].replace(/\\([()\\])/g, '$1'));
};

/**
 * Derive metadata from raw bytes using cheap regex scans. `head` and `tail` may
 * be the same buffer (small files); `complete` says whether they cover the file.
 */
function scanBytes(
  head: Uint8Array,
  tail: Uint8Array,
  fileSize: number,
  complete: boolean
): PdfSafeMetadata {
  const headText = toLatin1(head);
  const tailText = head === tail ? headText : toLatin1(tail);
  const both = head === tail ? headText : `${headText}\n${tailText}`;

  const versionMatch = /%PDF-(\d+\.\d+)/.exec(headText);

  // Trailer /Size is the highest object number + 1 — a good cheap approximation.
  let objectCount: number | null = null;
  const sizeMatches = Array.from(tailText.matchAll(/\/Size\s+(\d+)/g));
  if (sizeMatches.length > 0) {
    const largest = Math.max(...sizeMatches.map(m => Number(m[1])));
    if (Number.isFinite(largest) && largest > 0) objectCount = Math.max(1, largest - 1);
  }
  if (objectCount === null) {
    const objMatches = both.match(/\b\d+\s+\d+\s+obj\b/g);
    if (objMatches) objectCount = objMatches.length;
  }

  // The page tree root carries the largest /Count value.
  let pageCount: number | null = null;
  const countMatches = Array.from(both.matchAll(/\/Count\s+(\d+)/g));
  if (countMatches.length > 0) {
    const largest = Math.max(...countMatches.map(m => Number(m[1])));
    if (Number.isFinite(largest)) pageCount = largest;
  }

  return {
    pdfVersion: versionMatch ? versionMatch[1] : null,
    fileSize,
    pageCount,
    pageCountApprox: true,
    isEncrypted: /\/Encrypt[\s/<[]/.test(both) ? true : complete ? false : null,
    isLinearized: /\/Linearized/.test(headText),
    objectCount,
    hasAcroForm: /\/AcroForm[\s/<[]/.test(both) ? true : complete ? false : null,
    producer: matchLiteralString(both, 'Producer'),
    creator: matchLiteralString(both, 'Creator'),
    source: complete ? 'scan' : 'scan-partial',
  };
}

/** Refine scan results with pdf-lib. Small files only; failures are ignored. */
async function refineWithPdfLib(
  bytes: Uint8Array,
  base: PdfSafeMetadata
): Promise<PdfSafeMetadata> {
  try {
    const { PDFDocument, PDFName } = await import('pdf-lib');
    const doc = await PDFDocument.load(bytes, {
      ignoreEncryption: true,
      updateMetadata: false,
      throwOnInvalidObject: false,
    });

    const isEncrypted = doc.isEncrypted === true ? true : base.isEncrypted ?? false;

    let hasAcroForm = base.hasAcroForm;
    try {
      hasAcroForm = doc.catalog.get(PDFName.of('AcroForm')) !== undefined;
    } catch {
      // keep the scanned value
    }

    let objectCount = base.objectCount;
    try {
      objectCount = doc.context.enumerateIndirectObjects().length;
    } catch {
      // keep the scanned value
    }

    // On an encrypted document the Info strings are ciphertext, so the scanned
    // values are more honest than pdf-lib's decoded-but-garbled ones.
    // NOTE: only Producer/Creator are ever read. Title/Author/Subject/Keywords
    // are user data and are intentionally not touched.
    let producer = base.producer;
    let creator = base.creator;
    if (!isEncrypted) {
      producer = sanitizeSoftwareName(doc.getProducer()) ?? producer;
      creator = sanitizeSoftwareName(doc.getCreator()) ?? creator;
    }

    return {
      ...base,
      pageCount: doc.getPageCount(),
      pageCountApprox: false,
      isEncrypted,
      hasAcroForm,
      objectCount,
      producer,
      creator,
      source: 'pdf-lib',
    };
  } catch {
    return base;
  }
}

const readSlice = async (blob: Blob, start: number, end: number): Promise<Uint8Array> =>
  new Uint8Array(await blob.slice(start, end).arrayBuffer());

async function extract(input: PdfInput): Promise<PdfSafeMetadata> {
  if (isBlobLike(input)) {
    const size = input.size;
    if (size <= MAX_FULL_PARSE_BYTES) {
      const bytes = await readSlice(input, 0, size);
      return refineWithPdfLib(bytes, scanBytes(bytes, bytes, size, true));
    }
    // Large file: read only the header and the trailer region.
    const head = await readSlice(input, 0, HEAD_BYTES);
    const tail = await readSlice(input, Math.max(0, size - TAIL_BYTES), size);
    return scanBytes(head, tail, size, false);
  }

  const bytes = isBufferViewLike(input)
    ? asBytes(input)
    : new Uint8Array(input as ArrayBuffer);
  const size = bytes.byteLength;
  if (size <= MAX_FULL_PARSE_BYTES) {
    return refineWithPdfLib(bytes, scanBytes(bytes, bytes, size, true));
  }
  const head = bytes.subarray(0, HEAD_BYTES);
  const tail = bytes.subarray(Math.max(0, size - TAIL_BYTES));
  return scanBytes(head, tail, size, false);
}

/**
 * Extract safe structural metadata from a PDF. Returns `null` instead of
 * throwing for anything unusable — a malformed PDF, a detached ArrayBuffer, a
 * missing browser API or an extraction that takes too long.
 */
export async function extractPdfSafeMetadata(input: unknown): Promise<PdfSafeMetadata | null> {
  try {
    if (!input || typeof input !== 'object') return null;
    if (!isBlobLike(input) && !isArrayBufferLike(input) && !isBufferViewLike(input)) {
      return null;
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<null>(resolve => {
      timer = setTimeout(() => resolve(null), EXTRACT_TIMEOUT_MS);
    });

    try {
      return await Promise.race([
        extract(input as PdfInput).catch(() => null),
        timeout,
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  } catch {
    return null;
  }
}

/**
 * Render metadata as a compact `key=value;` breadcrumb, matching the existing
 * convention in this codebase (e.g. `mode=advanced_sorted;files=2;pages=61`).
 * Unknown fields are omitted; an approximate page count is prefixed with `~`.
 */
export function formatPdfSafeMetadata(meta: PdfSafeMetadata | null | undefined): string {
  if (!meta) return '';
  try {
    const parts: string[] = [];
    const push = (key: string, value: string | number | boolean | null) => {
      if (value === null || value === undefined || value === '') return;
      parts.push(`${key}=${value}`);
    };

    push('pdfVersion', meta.pdfVersion);
    push('fileSize', meta.fileSize);
    if (meta.pageCount !== null) {
      push('pages', meta.pageCountApprox ? `~${meta.pageCount}` : meta.pageCount);
    }
    push('encrypted', meta.isEncrypted);
    push('linearized', meta.isLinearized);
    if (meta.objectCount !== null) push('objects', `~${meta.objectCount}`);
    push('acroForm', meta.hasAcroForm);
    push('producer', meta.producer);
    push('creator', meta.creator);
    push('metaSource', meta.source);

    return parts.join(';');
  } catch {
    return '';
  }
}

/**
 * Convenience wrapper for the error reporter: never throws, always resolves to
 * a breadcrumb string (empty when nothing could be determined).
 */
export async function describePdfForErrorReport(input: unknown): Promise<string> {
  try {
    return formatPdfSafeMetadata(await extractPdfSafeMetadata(input));
  } catch {
    return '';
  }
}
