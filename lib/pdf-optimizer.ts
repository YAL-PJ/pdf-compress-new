/**
 * PDF Optimizer
 * Handles PDF structure optimization including orphan removal and alternate content removal.
 * Phase 2 implementation: 2.4, 2.5
 */

import {
  PDFDocument,
  PDFName,
  PDFDict,
  PDFArray,
  PDFRef,
  PDFStream,
  PDFRawStream,
  PDFObject,
  PDFContext,
} from 'pdf-lib';

// ============================================================================
// Types
// ============================================================================

export interface OrphanRemovalResult {
  orphansRemoved: number;
  savedBytes: number;
}

export interface AlternateContentResult {
  alternatesRemoved: number;
  printOnlyRemoved: number;
  screenOnlyRemoved: number;
  savedBytes: number;
}

// ============================================================================
// 2.4 Rebuild PDF Structure - Orphan Object Removal
// ============================================================================

/**
 * Remove orphan/unreferenced objects from PDF.
 * Orphan objects are objects not reachable from the document catalog.
 * This also cleans up incremental save remnants.
 */
export const removeOrphanObjects = async (
  pdfDoc: PDFDocument,
  onProgress?: (message: string, percent?: number) => void
): Promise<OrphanRemovalResult> => {
  const result: OrphanRemovalResult = {
    orphansRemoved: 0,
    savedBytes: 0,
  };

  const context = pdfDoc.context;

  onProgress?.('Analyzing object references...', 0);

  // Build set of all referenced objects starting from catalog
  const referencedRefs = new Set<string>();
  const catalog = pdfDoc.catalog;

  // Recursively collect all referenced objects
  collectReferences(catalog, context, referencedRefs);

  // Also include trailer references
  const trailerDict = context.trailerInfo;
  if (trailerDict.Root) {
    collectReferences(trailerDict.Root, context, referencedRefs);
  }
  if (trailerDict.Info) {
    collectReferences(trailerDict.Info, context, referencedRefs);
  }

  onProgress?.('Identifying orphan objects...', 50);

  // Find all objects and identify orphans
  const allRefs = Array.from(context.enumerateIndirectObjects());
  const orphanRefs: PDFRef[] = [];

  for (const [ref, obj] of allRefs) {
    const refStr = `${ref.objectNumber}-${ref.generationNumber}`;
    if (!referencedRefs.has(refStr)) {
      orphanRefs.push(ref);

      // Estimate size of orphan
      if (obj instanceof PDFRawStream || obj instanceof PDFStream) {
        const bytes = obj instanceof PDFRawStream ? obj.contents : obj.getContents();
        if (bytes) {
          result.savedBytes += bytes.length + 50; // +50 for dictionary overhead
        }
      } else if (obj instanceof PDFDict) {
        result.savedBytes += estimateDictSize(obj);
      } else {
        result.savedBytes += 20; // Minimal object overhead
      }

      result.orphansRemoved++;
    }
  }

  onProgress?.(`Found ${result.orphansRemoved} orphan objects`, 75);

  // Remove orphan objects by replacing with null
  // pdf-lib will clean these up on save
  for (const ref of orphanRefs) {
    try {
      context.delete(ref);
    } catch {
      // Object may already be deleted or protected
    }
  }

  onProgress?.('Orphan removal complete', 100);

  return result;
};

/**
 * Recursively collect all referenced objects from a starting point
 */
function collectReferences(
  obj: PDFObject | undefined,
  context: PDFContext,
  refs: Set<string>,
  visited: Set<string> = new Set()
): void {
  if (!obj) return;

  if (obj instanceof PDFRef) {
    const refStr = `${obj.objectNumber}-${obj.generationNumber}`;
    if (visited.has(refStr)) return;
    visited.add(refStr);
    refs.add(refStr);

    // Lookup and recurse
    const resolved = context.lookup(obj);
    if (resolved) {
      collectReferences(resolved, context, refs, visited);
    }
    return;
  }

  if (obj instanceof PDFDict) {
    const entries = obj.entries();
    for (const [, value] of entries) {
      collectReferences(value, context, refs, visited);
    }
    return;
  }

  if (obj instanceof PDFArray) {
    for (let i = 0; i < obj.size(); i++) {
      collectReferences(obj.get(i), context, refs, visited);
    }
    return;
  }

  if (obj instanceof PDFStream || obj instanceof PDFRawStream) {
    collectReferences(obj.dict, context, refs, visited);
    return;
  }
}

/**
 * Estimate byte size of a dictionary
 */
function estimateDictSize(dict: PDFDict): number {
  let size = 10; // Base dict overhead << >>
  const entries = dict.entries();
  for (const [key, value] of entries) {
    size += key.toString().length + 2;
    size += estimateValueSize(value);
  }
  return size;
}

/**
 * Estimate byte size of a PDF value
 */
function estimateValueSize(value: PDFObject): number {
  if (value instanceof PDFRef) {
    return 10; // "X Y R"
  }
  if (value instanceof PDFName) {
    return value.toString().length;
  }
  if (value instanceof PDFArray) {
    let size = 4; // [ ]
    for (let i = 0; i < value.size(); i++) {
      size += estimateValueSize(value.get(i)) + 1;
    }
    return size;
  }
  if (value instanceof PDFDict) {
    return estimateDictSize(value);
  }
  return 5; // Default for numbers, strings, etc
}

// ============================================================================
// 2.5 Remove Alternate Content
// ============================================================================

/**
 * Remove alternate content from PDF:
 * - Alternate images (high/low res pairs)
 * - Print-only content
 * - Screen-only content
 */
export const removeAlternateContent = async (
  pdfDoc: PDFDocument,
  onProgress?: (message: string, percent?: number) => void
): Promise<AlternateContentResult> => {
  const result: AlternateContentResult = {
    alternatesRemoved: 0,
    printOnlyRemoved: 0,
    screenOnlyRemoved: 0,
    savedBytes: 0,
  };

  const context = pdfDoc.context;
  const pages = pdfDoc.getPages();

  onProgress?.('Scanning for alternate content...', 0);

  // Process each page
  for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
    const page = pages[pageIdx];
    const pageDict = page.node;

    // Remove alternate images from XObjects
    const resources = pageDict.get(PDFName.of('Resources'));
    if (resources instanceof PDFDict) {
      const xobjects = resources.get(PDFName.of('XObject'));
      if (xobjects instanceof PDFDict) {
        const alternateResult = removeAlternateImages(xobjects, context);
        result.alternatesRemoved += alternateResult.removed;
        result.savedBytes += alternateResult.savedBytes;
      }
    }

    // Remove print/screen-only content from Optional Content Groups
    const ocResult = removeOptionalContent(pageDict, context);
    result.printOnlyRemoved += ocResult.printOnly;
    result.screenOnlyRemoved += ocResult.screenOnly;
    result.savedBytes += ocResult.savedBytes;

    const progress = Math.round(((pageIdx + 1) / pages.length) * 100);
    onProgress?.(`Processed ${pageIdx + 1}/${pages.length} pages`, progress);
  }

  // Process document-level alternate content
  const catalog = pdfDoc.catalog;

  // Remove OCProperties print/screen intents
  const ocProps = catalog.get(PDFName.of('OCProperties'));
  if (ocProps instanceof PDFDict) {
    const ocResult = processOCProperties(ocProps, context);
    result.printOnlyRemoved += ocResult.printOnly;
    result.screenOnlyRemoved += ocResult.screenOnly;
    result.savedBytes += ocResult.savedBytes;
  }

  // Remove Alternates from document catalog
  const names = catalog.get(PDFName.of('Names'));
  if (names instanceof PDFDict) {
    const alternates = names.get(PDFName.of('AlternatePresentations'));
    if (alternates) {
      const altSize = estimateValueSize(alternates);
      names.delete(PDFName.of('AlternatePresentations'));
      result.alternatesRemoved++;
      result.savedBytes += altSize;
    }
  }

  return result;
};

/**
 * Remove alternate images from XObject dictionary
 * Alternates are stored in /Alternates array of image XObjects
 */
function removeAlternateImages(
  xobjects: PDFDict,
  context: PDFContext
): { removed: number; savedBytes: number } {
  let removed = 0;
  let savedBytes = 0;

  const entries = xobjects.entries();

  for (const [name, ref] of entries) {
    if (!(ref instanceof PDFRef)) continue;

    const obj = context.lookup(ref);
    if (!(obj instanceof PDFRawStream) && !(obj instanceof PDFStream)) continue;

    const dict = obj.dict;
    const subtype = dict.get(PDFName.of('Subtype'));
    if (!(subtype instanceof PDFName) || subtype.toString() !== '/Image') continue;

    // Check for Alternates array
    const alternates = dict.get(PDFName.of('Alternates'));
    if (alternates instanceof PDFArray) {
      // Calculate size of alternates
      for (let i = 0; i < alternates.size(); i++) {
        const altDict = alternates.get(i);
        if (altDict instanceof PDFDict) {
          const altImage = altDict.get(PDFName.of('Image'));
          if (altImage instanceof PDFRef) {
            const altObj = context.lookup(altImage);
            if (altObj instanceof PDFRawStream || altObj instanceof PDFStream) {
              const bytes = altObj instanceof PDFRawStream
                ? altObj.contents
                : altObj.getContents();
              savedBytes += bytes.length;
              removed++;

              // Delete the alternate image object
              try {
                context.delete(altImage);
              } catch {
                // May already be deleted
              }
            }
          }
        }
      }

      // Remove Alternates array from image dict
      dict.delete(PDFName.of('Alternates'));
    }

    // Check for OPI (Open Prepress Interface) - often contains alternate versions
    const opi = dict.get(PDFName.of('OPI'));
    if (opi) {
      savedBytes += estimateValueSize(opi);
      dict.delete(PDFName.of('OPI'));
      removed++;
    }
  }

  return { removed, savedBytes };
}

/**
 * Remove print-only and screen-only Optional Content from page
 */
function removeOptionalContent(
  pageDict: PDFDict,
  context: PDFContext
): { printOnly: number; screenOnly: number; savedBytes: number } {
  let printOnly = 0;
  let screenOnly = 0;
  let savedBytes = 0;

  // Check for Optional Content Groups in page resources
  const resources = pageDict.get(PDFName.of('Resources'));
  if (!(resources instanceof PDFDict)) {
    return { printOnly, screenOnly, savedBytes };
  }

  const properties = resources.get(PDFName.of('Properties'));
  if (!(properties instanceof PDFDict)) {
    return { printOnly, screenOnly, savedBytes };
  }

  const entries = properties.entries();
  const toRemove: PDFName[] = [];

  for (const [name, ref] of entries) {
    if (!(ref instanceof PDFRef)) continue;

    const ocg = context.lookup(ref);
    if (!(ocg instanceof PDFDict)) continue;

    const type = ocg.get(PDFName.of('Type'));
    if (!(type instanceof PDFName) || type.toString() !== '/OCG') continue;

    // Check Usage dict for Print/View intents
    const usage = ocg.get(PDFName.of('Usage'));
    if (!(usage instanceof PDFDict)) continue;

    // Check for Print-only (PrintState: ON, ViewState: OFF)
    const print = usage.get(PDFName.of('Print'));
    const view = usage.get(PDFName.of('View'));

    if (print instanceof PDFDict) {
      const printState = print.get(PDFName.of('PrintState'));
      if (printState instanceof PDFName) {
        if (printState.toString() === '/ON') {
          // Check if view is OFF
          if (view instanceof PDFDict) {
            const viewState = view.get(PDFName.of('ViewState'));
            if (viewState instanceof PDFName && viewState.toString() === '/OFF') {
              // This is print-only content
              toRemove.push(name as PDFName);
              printOnly++;
              savedBytes += estimateValueSize(ref);
            }
          }
        }
      }
    }

    // Check for Screen-only (ViewState: ON, PrintState: OFF)
    if (view instanceof PDFDict) {
      const viewState = view.get(PDFName.of('ViewState'));
      if (viewState instanceof PDFName && viewState.toString() === '/ON') {
        if (print instanceof PDFDict) {
          const printState = print.get(PDFName.of('PrintState'));
          if (printState instanceof PDFName && printState.toString() === '/OFF') {
            // This is screen-only content
            toRemove.push(name as PDFName);
            screenOnly++;
            savedBytes += estimateValueSize(ref);
          }
        }
      }
    }
  }

  // Remove identified OCGs from properties
  for (const name of toRemove) {
    properties.delete(name);
  }

  return { printOnly, screenOnly, savedBytes };
}

/**
 * Process document-level OCProperties to remove print/screen intents
 */
function processOCProperties(
  ocProps: PDFDict,
  context: PDFContext
): { printOnly: number; screenOnly: number; savedBytes: number } {
  let printOnly = 0;
  let screenOnly = 0;
  let savedBytes = 0;

  // Process OCGs array
  const ocgs = ocProps.get(PDFName.of('OCGs'));
  if (ocgs instanceof PDFArray) {
    const toRemove: number[] = [];

    for (let i = 0; i < ocgs.size(); i++) {
      const ref = ocgs.get(i);
      if (!(ref instanceof PDFRef)) continue;

      const ocg = context.lookup(ref);
      if (!(ocg instanceof PDFDict)) continue;

      // Check Intent
      const intent = ocg.get(PDFName.of('Intent'));
      if (intent instanceof PDFName) {
        const intentStr = intent.toString();
        if (intentStr === '/Print') {
          toRemove.push(i);
          printOnly++;
          savedBytes += 50;
        } else if (intentStr === '/View') {
          // Screen-only if no Print intent
          const usage = ocg.get(PDFName.of('Usage'));
          if (usage instanceof PDFDict) {
            const print = usage.get(PDFName.of('Print'));
            if (!print) {
              toRemove.push(i);
              screenOnly++;
              savedBytes += 50;
            }
          }
        }
      }

      // Check for print/view in Intent array
      if (intent instanceof PDFArray) {
        let hasPrint = false;
        let hasView = false;

        for (let j = 0; j < intent.size(); j++) {
          const intentItem = intent.get(j);
          if (intentItem instanceof PDFName) {
            if (intentItem.toString() === '/Print') hasPrint = true;
            if (intentItem.toString() === '/View') hasView = true;
          }
        }

        // If only Print intent, it's print-only
        if (hasPrint && !hasView) {
          toRemove.push(i);
          printOnly++;
          savedBytes += 50;
        }
      }
    }

    // Remove from array (reverse order to maintain indices)
    for (let i = toRemove.length - 1; i >= 0; i--) {
      ocgs.remove(toRemove[i]);
    }
  }

  // Process Default configuration
  const defaultConfig = ocProps.get(PDFName.of('D'));
  if (defaultConfig instanceof PDFDict) {
    // Remove AS (auto-state) entries for print/view
    const as = defaultConfig.get(PDFName.of('AS'));
    if (as instanceof PDFArray) {
      const toRemove: number[] = [];

      for (let i = 0; i < as.size(); i++) {
        const asDict = as.get(i);
        if (!(asDict instanceof PDFDict)) continue;

        const event = asDict.get(PDFName.of('Event'));
        if (event instanceof PDFName) {
          const eventStr = event.toString();
          if (eventStr === '/Print' || eventStr === '/View') {
            toRemove.push(i);
            savedBytes += 30;
          }
        }
      }

      for (let i = toRemove.length - 1; i >= 0; i--) {
        as.remove(toRemove[i]);
      }
    }
  }

  return { printOnly, screenOnly, savedBytes };
}
