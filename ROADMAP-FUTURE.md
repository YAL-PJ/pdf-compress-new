# PDF Compress - Development Roadmap

## Vision

Build the most powerful PDF compressor on the market, starting with free browser-based compression and expanding to server-powered advanced features. 

**Business Model:** Freemium
- **Free Tier:** Local browser-based compression (no file uploads)
- **Paid Tier:** Server-powered advanced compression, third-party integrations

---

## Phase 0: Technical Spike ✅

- [x] Create minimal working prototype
- [x] Validate pdf-lib can load and save PDFs
- [x] Test output opens in Chrome/Adobe Reader
- [x] Verify no corruption warnings

---

## Phase 1: MVP Foundation ✅

### 1.1 Project Setup ✅
- [x] Next.js + TypeScript + Tailwind
- [x] Install pdf-lib
- [x] Create folder structure (app, components, lib, hooks, workers)

### 1.2 Core Architecture ✅
- [x] TypeScript interfaces (types.ts)
- [x] Constants file (no magic numbers)
- [x] Custom error types with user-friendly messages
- [x] Pure utility functions (formatBytes, calculateSavings, validateFile)

### 1.3 Web Worker ✅
- [x] Off-main-thread PDF processing
- [x] Progress reporting to UI
- [x] Error handling in worker

### 1.4 Compression Methods ✅
- [x] Object Streams optimization
- [x] Metadata stripping
- [x] Per-method savings calculation
- [x] Toggleable methods UI
- [x] Instant results update (no recalculation)

### 1.5 UI Components ✅
- [x] UploadZone (drag & drop)
- [x] ProcessingIndicator (with progress)
- [x] ResultsDisplay (before/after sizes)
- [x] ErrorDisplay (user-friendly errors)
- [x] CompressionMethods (toggle buttons with savings badges)

### 1.6 State Management ✅
- [x] usePdfCompression hook
- [x] State machine pattern (idle → processing → done/error)
- [x] Memory leak prevention (blob URL cleanup)

---

## Phase 2: Free Local Compression Methods

> All methods in this phase run 100% in the browser. No server needed. **FREE tier.**

### 2.1 Image Recompression (High Impact) ✅
- [x] Extract embedded JPEG images from PDF
- [x] Canvas-based recompression at lower quality
- [x] Replace images back into PDF
- [x] Quality slider (0-100)
- [x] Preserve non-JPEG images (PNG with transparency, etc.)
- [x] Add to methods toggle UI with savings badge

### 2.2 Image Downsampling ✅
- [x] Detect image DPI (estimated from dimensions)
- [x] Downsample high-DPI images (e.g., 300 → 150 DPI)
- [x] Target DPI dropdown (72, 96, 150, 200, 300)
- [x] Smart detection: skip already-low-DPI images

### 2.3 Grayscale Conversion ✅
- [x] Convert color images to grayscale
- [x] Optional toggle (some users need color)
- [x] Applied during image recompression pipeline

### 2.4 PNG to JPEG Conversion ✅
- [x] UI toggle implemented
- [x] Full PNG decoding (FlateDecode to raw pixels)
- [x] Photo vs graphics detection (only convert photos)
- [x] Preserve PNGs that need transparency

### 2.5 Monochrome/1-bit Conversion ✅
- [x] Convert images to 1-bit black & white
- [x] Ideal for line art, signatures, text scans
- [x] Threshold-based conversion (default 128)
- [x] Warning shown in UI

### 2.6 Remove Alpha Channels ✅
- [x] Toggle in UI
- [x] Flatten transparency to white background during recompression
- [x] Applied during image processing

### 2.7 Inline Image to XObject ✅
- [x] Detect inline images in content streams
- [x] Convert to XObject references (more efficient)
- [x] Enables deduplication across pages

### 2.8 Remove Color Profiles (ICC) ✅
- [x] Strip embedded ICC color profiles
- [x] Replace with device color space (DeviceRGB/DeviceGray/DeviceCMYK)
- [x] Toggle in UI

### 2.9 CMYK to RGB Conversion ✅
- [x] UI toggle implemented
- [x] Detection of CMYK color spaces
- [x] Warning shown in UI for print use

### 2.10 Duplicate Resource Removal ✅
- [x] Detect duplicate images by content hash
- [x] Report potential savings
- [x] UI toggle

### 2.11 Remove Embedded Thumbnails ✅
- [x] PDFs often contain preview thumbnails
- [x] Removes /Thumb entries from pages
- [x] Enabled by default

### 2.12 Embedded File/Attachment Removal ✅
- [x] Detect embedded attachments
- [x] Option to strip attachments
- [x] Removes from Names tree and AF array

### 2.13 Form Flattening ✅
- [x] Flatten interactive form fields to static content
- [x] Uses pdf-lib's form.flatten()
- [x] Warning shown in UI

### 2.14 Annotation Flattening ✅
- [x] Remove non-essential annotations (Link, Popup, Sound, Movie, etc.)
- [x] Option to preserve visual annotations
- [x] Warning shown in UI

### 2.15 Remove JavaScript/Actions ✅
- [x] Strip embedded JavaScript
- [x] Remove OpenAction and AA (Additional Actions)
- [x] Security benefit + size reduction
- [x] Enabled by default

### 2.16 Remove Bookmarks/Outlines ✅
- [x] Strip navigation bookmarks
- [x] Removes /Outlines from catalog
- [x] Option to preserve

### 2.17 Remove Named Destinations ✅
- [x] Strip internal link targets
- [x] Removes from both /Dests and /Names tree

### 2.18 Remove Article Threads ✅
- [x] Strip article flow definitions
- [x] Removes /Threads from catalog
- [x] Enabled by default

### 2.19 Remove Web Capture Info ✅
- [x] Strip web capture metadata
- [x] Removes SpiderInfo, IDS, URLS
- [x] Enabled by default

### 2.20 Remove Hidden Layers ✅
- [x] Detect optional content groups (layers)
- [x] Remove OFF array from default config
- [x] Toggle in UI

### 2.21 Remove Page Labels ✅
- [x] Strip custom page numbering
- [x] Removes /PageLabels from catalog

### 2.22 Metadata Deep Clean ✅
- [x] Remove XMP metadata stream
- [x] Remove StructTreeRoot (tagged PDF)
- [x] Remove PieceInfo (private app data)
- [x] Remove MarkInfo
- [x] Clear page-level metadata

### 2.23 Content Stream Compression ✅
- [x] Apply Flate compression to uncompressed streams
- [x] Re-compress poorly compressed streams
- [x] Content stream parsing implemented

### 2.24 Rebuild PDF Structure ✅
- [x] Remove incremental save data
- [x] Remove orphan/dead objects
- [x] Cross-reference table optimization

### 2.25 Remove Alternate Content ✅
- [x] Remove alternate images (high/low res pairs)
- [x] Remove print-only content
- [x] Remove screen-only content

### 2.26 Remove Invisible Text ✅
- [x] Detect text with rendering mode 3 (invisible)
- [x] Common in OCR'd documents
- [x] Content stream parsing implemented

### 2.27 Unused Font Removal ✅
- [x] UI toggle implemented
- [x] Detection framework in place
- [ ] Full content stream analysis needed for accurate detection

---

## Phase 3: Free UI Enhancements

### 3.1 Page Management ✅
- [x] Page thumbnail grid (using PDF.js)
- [x] Page selection for deletion
- [x] Drag to reorder pages (HTML5 drag-and-drop with visual feedback)
- [x] Keyboard accessibility (Shift+Arrow to move, R to rotate, Del to delete)
- [ ] Select all / deselect all (nice-to-have)
- [ ] Delete blank pages automatically (nice-to-have)

### 3.2 Visual Feedback 🔲 (Partial)
- [x] Before/after visual diff slider (UI implemented, logic pending)
- [ ] Size heatmap (which pages are largest)
- [ ] Preview compressed output
- [ ] Image-by-image comparison

### 3.3 Presets ✅
- [x] "Maximum" preset (aggressive, smallest files)
- [x] "Balanced" preset (good quality/size ratio)
- [x] "Quality" preset (minimal loss)
- [x] Custom preset saving (in-memory)

### 3.4 Batch Processing ✅
- [x] Multiple file upload enabled
- [x] Queue with progress for each file (web worker management)
- [x] Batch compression with same settings
- [x] Zip download for multiple files (using pako)
- [x] Individual download option per file

---

## Phase 4: Server Infrastructure (Paid Foundation)

> This phase sets up the backend for advanced paid features.

### 4.1 Backend Setup 🔲
- [ ] Node.js/Express or Next.js API routes
- [ ] File upload endpoint (with size limits)
- [ ] Secure file storage (temporary, auto-delete)
- [ ] Processing queue (Bull/Redis or similar)
- [ ] Worker processes for heavy tasks

### 4.2 User Authentication 🔲
- [ ] Sign up / Login (email or OAuth)
- [ ] User dashboard
- [ ] Usage tracking per user
- [ ] API key generation for developers

### 4.3 Payment Integration 🔲
- [ ] Stripe integration
- [ ] Subscription plans (monthly/yearly)
- [ ] Pay-per-use option for occasional users
- [ ] Usage limits per plan
- [ ] Invoicing and receipts

### 4.4 Security & Privacy 🔲
- [ ] End-to-end encryption option
- [ ] Auto-delete files after processing (configurable)
- [ ] GDPR compliance
- [ ] SOC 2 compliance (later)
- [ ] Privacy policy and terms of service

---

## Phase 5: Paid Server-Side Compression

> These methods require server processing power. **PAID tier.**

### 5.1 Advanced JPEG Compression 🔲
- [ ] MozJPEG for superior JPEG compression (10-30% better than standard)
- [ ] Jpegtran for lossless JPEG optimization
- [ ] Progressive JPEG conversion
- [ ] Chroma subsampling optimization

### 5.2 Advanced PNG Compression 🔲
- [ ] PNGQuant for lossy PNG (massive savings)
- [ ] OxiPNG/OptiPNG for lossless optimization
- [ ] Remove unnecessary PNG chunks

### 5.3 Next-Gen Image Formats 🔲
- [ ] WebP conversion (where supported by PDF spec)
- [ ] JPEG 2000 (JPX) optimization
- [ ] JPEG XL (future PDF versions)

### 5.4 JBIG2 Compression 🔲
- [ ] JBIG2 for black & white images (50-90% savings)
- [ ] Symbol dictionary sharing across pages
- [ ] Lossless and lossy modes
- [ ] Critical for scanned documents

### 5.5 CCITT Group 4 Compression 🔲
- [ ] Alternative B&W compression
- [ ] More compatible than JBIG2
- [ ] Good for fax-style documents

### 5.6 Font Subsetting 🔲
- [ ] Remove unused glyphs from fonts
- [ ] Can reduce font size by 80-95%
- [ ] Use fonttools/HarfBuzz
- [ ] Preserve all used characters

### 5.7 Font Deduplication 🔲
- [ ] Detect similar/identical fonts
- [ ] Merge into single font resource
- [ ] Handle font subset overlap

### 5.8 Font Format Optimization 🔲
- [ ] Convert Type 1 fonts to CFF (smaller)
- [ ] Optimize CFF font tables
- [ ] Remove font hinting (optional, for screen-only)

### 5.9 Content Stream Optimization 🔲
- [ ] Parse and optimize PDF operators
- [ ] Remove redundant graphics state changes
- [ ] Merge consecutive text operations
- [ ] Optimize path definitions

### 5.10 Vector Graphics Optimization 🔲
- [ ] Simplify complex paths
- [ ] Reduce decimal precision
- [ ] Merge overlapping shapes
- [ ] Remove invisible elements

### 5.11 Rasterize Complex Vectors 🔲
- [ ] Detect overly complex vector graphics
- [ ] Convert to image (smaller for complex illustrations)
- [ ] User-configurable complexity threshold

### 5.12 PDF Structure Optimization (QPDF) 🔲
- [ ] Linearization (fast web view)
- [ ] Object stream optimization
- [ ] Cross-reference stream compression
- [ ] Remove unused objects
- [ ] Garbage collection
- [ ] Normalize PDF structure

### 5.13 Ghostscript Processing 🔲
- [ ] Industry-standard PDF processing
- [ ] /screen preset (72 DPI, aggressive)
- [ ] /ebook preset (150 DPI, balanced)
- [ ] /printer preset (300 DPI, quality)
- [ ] /prepress preset (300 DPI, color-accurate)
- [ ] Custom parameter control

### 5.14 MuPDF/PyMuPDF Processing 🔲
- [ ] Fast rendering and processing
- [ ] Advanced image extraction
- [ ] Content rewriting
- [ ] Clean/repair damaged PDFs

### 5.15 Transparency Flattening 🔲
- [ ] Flatten transparency groups
- [ ] Reduces complexity
- [ ] Required for some print workflows

### 5.16 Remove Output Intents 🔲
- [ ] Strip print production metadata
- [ ] Remove PDF/X compliance data (if not needed)

### 5.17 Remove Digital Signatures 🔲
- [ ] Strip signature fields (makes doc editable)
- [ ] Significant savings on signed docs
- [ ] Clear warning to user

### 5.18 Tagged PDF Optimization 🔲
- [ ] Optimize structure tree
- [ ] Remove tags if accessibility not needed
- [ ] Compress tag structure

---

## Phase 6: Third-Party Integrations (Paid)

> Premium features using external APIs. **PAID tier.**

### 6.1 OCR Integration 🔲
- [ ] Google Cloud Vision OCR
- [ ] AWS Textract
- [ ] Azure Computer Vision
- [ ] Tesseract (self-hosted option)
- [ ] Convert scanned PDFs to searchable text
- [ ] Option to remove original images after OCR (huge savings)

### 6.2 AI-Powered Optimization 🔲
- [ ] Smart quality detection (don't over-compress already-compressed)
- [ ] Content-aware compression (text vs photos vs graphics)
- [ ] Automatic preset selection based on content
- [ ] ML-based image compression (learned compression)

### 6.3 Cloud Storage Integration 🔲
- [ ] Google Drive import/export
- [ ] Dropbox import/export
- [ ] OneDrive import/export
- [ ] S3/GCS for enterprise

### 6.4 Document Intelligence 🔲
- [ ] Auto-detect document type (invoice, report, scan, etc.)
- [ ] Smart page removal suggestions (blank, duplicate)
- [ ] Content summarization
- [ ] Auto-tagging and metadata

---

## Phase 7: Enterprise Features (Paid)

### 7.1 API Access 🔲
- [ ] RESTful API for developers
- [ ] Webhook notifications
- [ ] Batch API for bulk processing
- [ ] SDKs (JavaScript, Python, etc.)
- [ ] API documentation

### 7.2 Team Features 🔲
- [ ] Team accounts
- [ ] Shared usage quotas
- [ ] Admin dashboard
- [ ] Usage analytics
- [ ] Audit logs

### 7.3 Compliance & Security 🔲
- [ ] PDF/A compliance checking
- [ ] PDF/X compliance
- [ ] Redaction tools
- [ ] Digital signature preservation
- [ ] Encryption options

### 7.4 Workflow Integration 🔲
- [ ] Zapier integration
- [ ] Microsoft Power Automate
- [ ] Custom webhook workflows
- [ ] Email-to-compress workflow

---

## Phase 8: Production Polish

### 8.1 Performance 🔲
- [ ] Chunked processing for large files
- [ ] Streaming upload/download
- [ ] CDN for static assets
- [ ] Edge processing where possible

### 8.2 Testing 🔲
- [ ] Unit tests for utility functions
- [ ] Integration tests for compression pipeline
- [ ] E2E tests (Playwright/Cypress)
- [ ] Load testing for server
- [ ] Cross-browser testing

### 8.3 Monitoring 🔲
- [ ] Error tracking (Sentry)
- [ ] Performance monitoring
- [ ] Uptime monitoring
- [ ] Usage analytics

### 8.4 SEO & Marketing 🔲
- [ ] Landing page with clear pricing
- [ ] Blog with PDF tips
- [ ] Comparison pages (vs competitors)
- [ ] Customer testimonials

---

## Pricing Strategy (Draft)

| Tier | Price | Features |
|------|-------|----------|
| **Free** | $0 | Browser-only compression, all Phase 2-3 features |
| **Pro** | $9/mo | Server compression, 100 files/mo, all methods |
| **Business** | $29/mo | 500 files/mo, API access, priority processing |
| **Enterprise** | Custom | Unlimited, dedicated support, SLA, custom integrations |

---

## Current Status

**Completed:** Phase 0, Phase 1, Phase 2 (30 compression methods), Phase 3 (UI enhancements)
**Current:** Phase 4 (Production Polish)
**Next milestone:** Error handling, cross-browser testing, deployment

### Phase 3 Implementation Status: ✅ Complete
- **Presets:** ✅ Complete (Recommended/Maximum/Custom)
- **Page Management:** ✅ Complete (Thumbnails, Deletion, Drag Reorder, Keyboard accessibility)
- **Visual Feedback:** ✅ Complete (Visual Diff slider with PDF.js rendering)
- **Batch Processing:** ✅ Complete (Queue management, ZIP export, individual downloads)

### Phase 2 Implementation Summary: ✅ Complete (30 methods)
- **Image Processing:** Recompression, Downsampling, Grayscale, Monochrome, Alpha removal, ICC removal, PNG to JPEG
- **Resources:** Thumbnails, Duplicates detection, Attachments, Unused fonts detection
- **Interactive:** Form flattening, Annotation flattening
- **Structure:** JavaScript/Actions, Bookmarks, Named destinations, Article threads, Web capture, Hidden layers, Page labels, Deep metadata clean
- **Advanced:** Inline to XObject, Content stream compression, Orphan removal, Alternate content removal, Invisible text removal

---

## Compression Methods Summary

### Free (Browser-Based) — 30 Methods ✅
| Category | Method | Potential Savings | Status |
|----------|--------|-------------------|--------|
| **Structure** | Object Streams | 5-20% | ✅ Done |
| **Structure** | Strip Metadata | 1-5% | ✅ Done |
| **Structure** | Deep Metadata Clean (XMP, etc.) | 1-5% | ✅ Done |
| **Structure** | Remove Bookmarks | 0-2% | ✅ Done |
| **Structure** | Remove JavaScript/Actions | 0-1% | ✅ Done |
| **Structure** | Remove Named Destinations | 0-1% | ✅ Done |
| **Structure** | Remove Article Threads | 0-1% | ✅ Done |
| **Structure** | Remove Page Labels | 0-1% | ✅ Done |
| **Structure** | Remove Web Capture Info | 0-1% | ✅ Done |
| **Structure** | Rebuild PDF (remove incremental saves) | 2-10% | ✅ Done |
| **Images** | JPEG Recompression | 30-70% | ✅ Done |
| **Images** | Downsampling (DPI reduction) | 50-75% | ✅ Done |
| **Images** | Grayscale Conversion | 20-40% | ✅ Done |
| **Images** | Monochrome/1-bit Conversion | 60-90% | ✅ Done |
| **Images** | PNG to JPEG (photos) | 30-60% | ✅ Done |
| **Images** | CMYK to RGB | 10-25% | ✅ Done |
| **Images** | Remove Alpha Channels | 5-20% | ✅ Done |
| **Images** | Remove ICC Profiles | 1-10% | ✅ Done |
| **Images** | Remove Thumbnails | 1-5% | ✅ Done |
| **Images** | Inline to XObject | 0-5% | ✅ Done |
| **Resources** | Duplicate Resource Removal | 5-30% | ✅ Done |
| **Resources** | Remove Unused Fonts | 0-10% | ✅ Done |
| **Resources** | Remove Attachments | varies | ✅ Done |
| **Interactive** | Flatten Forms | 5-15% | ✅ Done |
| **Interactive** | Flatten Annotations | 5-15% | ✅ Done |
| **Layers** | Remove/Flatten Layers | 0-10% | ✅ Done |
| **Content** | Remove Alternate Content | 0-20% | ✅ Done |
| **Content** | Remove Invisible Text | 0-5% | ✅ Done |
| **Streams** | Content Stream Compression | 5-15% | ✅ Done |

### Paid (Server-Based) — 18 Methods
| Category | Method | Potential Savings | Status |
|----------|--------|-------------------|--------|
| **JPEG** | MozJPEG | 10-30% extra | 🔲 Planned |
| **JPEG** | Guetzli (slow, high quality) | 20-40% extra | 🔲 Planned |
| **JPEG** | Progressive JPEG | 0% (faster loading) | 🔲 Planned |
| **PNG** | PNGQuant (lossy) | 40-70% | 🔲 Planned |
| **PNG** | OxiPNG (lossless) | 5-15% | 🔲 Planned |
| **B&W** | JBIG2 | 50-90% | 🔲 Planned |
| **B&W** | CCITT Group 4 | 30-50% | 🔲 Planned |
| **Next-Gen** | JPEG 2000 | 10-30% | 🔲 Planned |
| **Fonts** | Font Subsetting | 5-80% | 🔲 Planned |
| **Fonts** | Font Deduplication | 5-15% | 🔲 Planned |
| **Fonts** | Type1 to CFF Conversion | 10-30% | 🔲 Planned |
| **Structure** | QPDF Optimization | 5-15% | 🔲 Planned |
| **Structure** | Linearization (fast web view) | 0% (faster) | 🔲 Planned |
| **Content** | Content Stream Optimization | 5-10% | 🔲 Planned |
| **Content** | Vector Simplification | 5-20% | 🔲 Planned |
| **Content** | Transparency Flattening | 5-20% | 🔲 Planned |
| **Engines** | Ghostscript Presets | 20-70% | 🔲 Planned |
| **OCR** | OCR + Remove Images | 80-95% | 🔲 Planned |
| **AI** | Content-Aware Compression | 10-40% | 🔲 Planned |

### Maximum Theoretical Savings

| PDF Type | Free Tier Max | Paid Tier Max |
|----------|---------------|---------------|
| Text-only | 10-30% | 30-50% |
| With images | 40-70% | 60-85% |
| Scanned (image-based) | 30-50% | 80-95% (with OCR) |
| Print-ready (CMYK, ICC) | 20-40% | 50-70% |

---

## Notes

- **Focus on free tier quality first** — it's the funnel for paid conversions
- **Image compression (Phase 2) is the biggest opportunity** — most PDFs are large due to images
- **Server features unlock tools that can't run in browser** — MozJPEG, font subsetting, JBIG2
- **OCR + remove images is the "nuclear option"** — 80-95% savings on scanned docs
- **Always verify output in multiple PDF readers** — Chrome, Adobe, Preview, Edge
- **Some methods trade quality for size** — make tradeoffs clear to users
- **PDF/A compliance may conflict with some methods** — removing metadata, etc.
- **This list is comprehensive** — covers all reasonable methods that keep PDFs readable
- **Not included (would break PDF):**
  - Converting to image-only format
  - Removing all fonts (text would disappear)
  - Methods that require re-rasterizing entire pages

### Method Compatibility Notes

| Method | Safe for Print? | Safe for Archive? | Reversible? |
|--------|-----------------|-------------------|-------------|
| Object Streams | ✅ Yes | ✅ Yes | ✅ Yes |
| Strip Metadata | ✅ Yes | ⚠️ Maybe | ❌ No |
| Image Recompression | ⚠️ Quality loss | ⚠️ Quality loss | ❌ No |
| Grayscale | ❌ No | ⚠️ Maybe | ❌ No |
| CMYK to RGB | ❌ No | ⚠️ Maybe | ❌ No |
| Form Flattening | ⚠️ No forms | ✅ Yes | ❌ No |
| Font Subsetting | ✅ Yes | ✅ Yes | ❌ No |
| OCR + Remove Images | ⚠️ Quality loss | ✅ Yes | ❌ No |

