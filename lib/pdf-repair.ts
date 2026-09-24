/**
 * Recovery for PDFs whose catalog or page tree is broken.
 *
 * pdf-lib gives up on these files, but Acrobat and pdf.js open them by
 * rebuilding the page tree, so users see a perfectly good document that we
 * then call "corrupted". Two real failure shapes from the Errors tab:
 *
 *   - the catalog's /Pages is missing or points at an object that does not
 *     exist -> "Expected instance of PDFDict, but got instance of undefined"
 *     the first time anything touches the pages;
 *   - there is no usable /Root and no /Type /Catalog object at all ->
 *     "Cannot read properties of undefined (reading 'Pages')" inside load().
 *
 * The repair only runs after pdf-lib has already failed on the page tree, so
 * a healthy PDF never goes through it.
 */

import {
  PDFDocument,
  PDFParser,
  PDFCatalog,
  PDFPageTree,
  PDFArray,
  PDFDict,
  PDFName,
  PDFNumber,
  PDFRef,
  ParseSpeeds,
  type PDFContext,
  type LoadOptions,
} from 'pdf-lib';

const TYPE = PDFName.of('Type');
const CATALOG = PDFName.of('Catalog');
const PAGES = PDFName.of('Pages');
const PAGE = PDFName.of('Page');
const PARENT = PDFName.of('Parent');
const COUNT = PDFName.of('Count');

/** The two messages pdf-lib produces when it cannot find the page tree. */
export const isBrokenPageTreeError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return (
    message.includes("reading 'Pages'") ||
    /Expected instance of \w+, but got instance of undefined/.test(message)
  );
};

const hasUsablePageTree = (context: PDFContext): boolean => {
  const root = context.trailerInfo.Root ? context.lookup(context.trailerInfo.Root) : undefined;
  return root instanceof PDFDict && root.lookup(PAGES) instanceof PDFDict;
};

/**
 * Point the document at a usable page tree, creating a catalog if needed.
 * Returns false when there is nothing to recover (no page objects at all).
 */
export const repairPageTree = (context: PDFContext): boolean => {
  if (hasUsablePageTree(context)) return false;

  let treeRoot: { ref: PDFRef; count: number } | undefined;
  const leaves: PDFRef[] = [];

  for (const [ref, object] of context.enumerateIndirectObjects()) {
    if (!(object instanceof PDFDict)) continue;
    const type = object.lookup(TYPE);
    if (type === PAGES && !object.has(PARENT)) {
      // An orphaned subtree can also lack /Parent; the real root is the
      // largest one.
      const count = object.lookup(COUNT);
      const n = count instanceof PDFNumber ? count.asNumber() : 0;
      if (!treeRoot || n > treeRoot.count) treeRoot = { ref, count: n };
    } else if (type === PAGE) {
      leaves.push(ref);
    }
  }

  let pagesRef: PDFRef;
  if (treeRoot) {
    pagesRef = treeRoot.ref;
  } else if (leaves.length) {
    // No page tree survived: rebuild a flat one in object order, which is
    // the order producers almost always write pages in.
    leaves.sort((a, b) => a.objectNumber - b.objectNumber || a.generationNumber - b.generationNumber);
    // pdf-lib only walks trees built from its own node classes.
    const tree = PDFPageTree.withContext(context);
    tree.set(PDFName.of('Kids'), context.obj(leaves) as PDFArray);
    tree.set(COUNT, PDFNumber.of(leaves.length));
    pagesRef = context.register(tree);
    for (const leaf of leaves) {
      (context.lookup(leaf) as PDFDict).set(PARENT, pagesRef);
    }
  } else {
    return false;
  }

  const root = context.trailerInfo.Root ? context.lookup(context.trailerInfo.Root) : undefined;
  if (root instanceof PDFDict && root.lookup(TYPE) === CATALOG) {
    root.set(PAGES, pagesRef);
  } else {
    context.trailerInfo.Root = context.register(PDFCatalog.withContextAndPages(context, pagesRef));
  }
  return true;
};

// PDFDocument's constructor is private in the typings but is exactly what
// PDFDocument.load() calls once parsing is done.
type PDFDocumentCtor = new (
  context: PDFContext,
  ignoreEncryption: boolean,
  updateMetadata: boolean,
) => PDFDocument;

/**
 * PDFDocument.load(), plus page-tree recovery for the two failure shapes
 * above. Every other error is rethrown untouched.
 */
export const loadPdfDocumentWithRepair = async (
  bytes: ArrayBuffer | Uint8Array,
  options: LoadOptions = {},
): Promise<PDFDocument> => {
  let failure: unknown;
  try {
    const doc = await PDFDocument.load(bytes, options);
    // A catalog without a usable /Pages loads fine and only fails later, on
    // first page access — so check before handing the document out.
    if (hasUsablePageTree(doc.context)) return doc;
    failure = new Error('Expected instance of PDFDict, but got instance of undefined');
  } catch (error) {
    if (!isBrokenPageTreeError(error)) throw error;
    failure = error;
  }

  const context = await PDFParser.forBytesWithOptions(
    bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes),
    options.parseSpeed ?? ParseSpeeds.Slow,
    options.throwOnInvalidObject ?? false,
    options.capNumbers ?? false,
  ).parseDocument();
  if (!repairPageTree(context)) throw failure;

  return new (PDFDocument as unknown as PDFDocumentCtor)(
    context,
    options.ignoreEncryption ?? false,
    options.updateMetadata ?? true,
  );
};
