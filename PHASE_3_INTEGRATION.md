# Phase 3 Integration Guide

This guide explains how to integrate the newly built Phase 3 UI components into the main application once Phase 2 is complete.

## 1. Visual Diff Slider (Phase 3.2)

**Location:** `app/page.tsx` inside `ResultsDisplay` or right below it.

**Integration:**
1. Import the component and renderer:
   ```tsx
   import { VisualDiff } from '@/components';
   import { renderPageToImage } from '@/lib/pdf-renderer';
   ```
2. Generate image URLs for the original and compressed files. ideally inside a `useEffect` in `ResultsDisplay`:
   ```tsx
   const [diffImages, setDiffImages] = useState<{original: string, compressed: string} | null>(null);

   useEffect(() => {
     const generatePreviews = async () => {
       if (!originalFile || !compressedBlob) return;
       // Render page 1 of both
       const original = await renderPageToImage(originalFile, 1);
       const compressed = await renderPageToImage(new File([compressedBlob], "preview.pdf"), 1);
       setDiffImages({ original, compressed });
     };
     generatePreviews();
   }, [originalFile, compressedBlob]);
   ```
3. Render the component:
   ```tsx
   {diffImages && (
     <div className="mt-8">
       <h3 className="text-sm font-semibold text-slate-700 mb-3">Quality Comparison</h3>
       <VisualDiff 
         originalImageSrc={diffImages.original} 
         compressedImageSrc={diffImages.compressed} 
       />
     </div>
   )}
   ```

---

## 2. Page Management Grid (Phase 3.1)

**Location:** `app/page.tsx` (Sidebar or separate "Edit" tab).

**Integration:**
1. Import the component:
   ```tsx
   import { PageGrid } from '@/components';
   ```
2. Render it when a file is selected (`state.status !== 'idle'`):
   ```tsx
   {state.originalFile && (
     <div className="mt-8 border-t pt-8">
       <PageGrid 
         file={state.originalFile} 
         pageCount={state.analysis?.pageCount || 0} 
       />
     </div>
   )}
   ```
3. **Connecting Logic (Future):**
   The `PageGrid` uses `usePageManager` internally. To actually *apply* the deletions/rotations to the PDF:
   - Lift the state up: Move `usePageManager` to `page.tsx`.
   - Pass `pages` state to `PageGrid`.
   - Pass `pages` state to the compression worker (update `processFile` to accept a `pages` argument).

---

## 3. Batch Processing (Phase 3.4)

**Location:** `app/page.tsx` (Main Content Area).

**Integration:**
1. Import components:
   ```tsx
   import { BatchUploadZone, FileQueueList } from '@/components';
   import { useBatchCompression } from '@/hooks/useBatchCompression';
   ```
2. Replace the single `UploadZone` with a conditional render:
   ```tsx
   const { queue, addFiles, removeFile } = useBatchCompression();
   const [isBatchMode, setIsBatchMode] = useState(false); // Toggle UI if needed

   // In your render:
   {state.status === 'idle' && (
     <BatchUploadZone onFilesSelect={addFiles} />
   )}
   
   <FileQueueList queue={queue} onRemove={removeFile} />
   ```
3. **Connecting Logic (Future):**
   - You need to create a loop in `useEffect` that watches the `queue`.
   - Pick the next 'queued' item.
   - Call `processFile` on it.
   - Update the item status to 'done' when the worker finishes.

---

## 4. Presets (Phase 3.3)

**Status:** ✅ **Already Integrated!**
The `PresetSelector` is already live in `page.tsx` and fully functional. No further action needed.
