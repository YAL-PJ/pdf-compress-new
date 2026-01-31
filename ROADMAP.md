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

### 2.3 Grayscale Conversion 🔲
- [ ] Convert color images to grayscale
- [ ] Optional toggle (some users need color)
- [ ] Preview before/after

### 2.4 PNG to JPEG Conversion 🔲
- [ ] Detect PNG images without transparency
- [ ] Convert to JPEG (much smaller for photos)
- [ ] Preserve PNGs that need transparency

### 2.5 Monochrome/1-bit Conversion 🔲
- [ ] Convert images to 1-bit black & white
- [ ] Ideal for line art, signatures, text scans
- [ ] Massive savings (60-90%)
- [ ] Warning: destroys grayscale/color

### 2.6 Remove Alpha Channels 🔲
- [ ] Detect images with unused alpha channels
- [ ] Strip alpha where background is solid
- [ ] Flatten transparency to white/color background

### 2.7 Inline Image to XObject 🔲
- [ ] Detect inline images in content streams
- [ ] Convert to XObject references (more efficient)
- [ ] Enables deduplication across pages

### 2.8 Remove Color Profiles (ICC) 🔲
- [ ] Strip embedded ICC color profiles
- [ ] Can save significant space on print-ready PDFs
- [ ] Option to preserve for print workflows

### 2.6 CMYK to RGB Conversion 🔲
- [ ] Convert CMYK images to RGB
- [ ] Smaller color space = smaller files
- [ ] Warning: only for screen use, not print

### 2.7 Duplicate Resource Removal 🔲
- [ ] Detect duplicate images across pages
- [ ] Detect duplicate fonts
- [ ] Merge identical resources into single reference

### 2.8 Remove Embedded Thumbnails 🔲
- [ ] PDFs often contain preview thumbnails
- [ ] These are redundant (readers generate their own)
- [ ] Safe to remove

### 2.9 Embedded File/Attachment Removal 🔲
- [ ] Detect embedded attachments
- [ ] Option to strip attachments
- [ ] Show attachment list with sizes

### 2.10 Form Flattening 🔲
- [ ] Flatten interactive form fields to static content
- [ ] Removes form field definitions
- [ ] Reduces complexity and size

### 2.11 Annotation Flattening 🔲
- [ ] Flatten comments, highlights, drawings
- [ ] Option to preserve vs flatten
- [ ] Bakes annotations into page content

### 2.12 Remove JavaScript/Actions 🔲
- [ ] Strip embedded JavaScript
- [ ] Remove action triggers (on open, on print, etc.)
- [ ] Security benefit + size reduction

### 2.13 Remove Bookmarks/Outlines 🔲
- [ ] Strip navigation bookmarks
- [ ] Usually small savings
- [ ] Option to preserve

### 2.14 Remove Named Destinations 🔲
- [ ] Strip internal link targets
- [ ] Only if document doesn't need internal navigation

### 2.15 Remove Article Threads 🔲
- [ ] Strip article flow definitions
- [ ] Rarely used in modern PDFs

### 2.16 Remove Web Capture Info 🔲
- [ ] Strip web capture metadata
- [ ] Present in PDFs created from web pages

### 2.17 Remove Hidden Layers 🔲
- [ ] Detect optional content groups (layers)
- [ ] Remove layers marked as hidden
- [ ] Option to flatten all layers

### 2.18 Remove Page Labels 🔲
- [ ] Strip custom page numbering
- [ ] Small savings

### 2.19 Metadata Deep Clean 🔲
- [ ] Remove XMP metadata (more thorough than basic)
- [ ] Remove document info dictionary
- [ ] Remove custom metadata fields
- [ ] Remove creation/modification software info
- [ ] Remove piece info / private application data

### 2.20 Content Stream Compression 🔲
- [ ] Apply Flate compression to uncompressed streams
- [ ] Re-compress poorly compressed streams
- [ ] Optimize compression level

### 2.21 Rebuild PDF Structure 🔲
- [ ] Remove incremental save data (rebuilds from scratch)
- [ ] Remove orphan/dead objects
- [ ] Optimize object numbering
- [ ] Clean cross-reference table

### 2.22 Remove Alternate Content 🔲
- [ ] Remove alternate images (high/low res pairs)
- [ ] Remove print-only content
- [ ] Remove screen-only content

### 2.23 Remove Invisible Text 🔲
- [ ] Detect text with rendering mode 3 (invisible)
- [ ] Option to remove hidden text layers
- [ ] Common in OCR'd documents

### 2.24 Unused Font Removal 🔲
- [ ] Detect fonts not referenced by any page
- [ ] Remove completely unused font resources
- [ ] Different from subsetting (that's paid)

---

## Phase 3: Free UI Enhancements

### 3.1 Page Management 🔲
- [ ] Page thumbnail grid (using PDF.js)
- [ ] Page selection for deletion
- [ ] Drag to reorder pages
- [ ] Select all / deselect all
- [ ] Delete blank pages automatically

### 3.2 Visual Feedback 🔲
- [ ] Before/after visual diff slider
- [ ] Size heatmap (which pages are largest)
- [ ] Preview compressed output
- [ ] Image-by-image comparison

### 3.3 Presets 🔲
- [ ] "Maximum" preset (aggressive, smallest files)
- [ ] "Balanced" preset (good quality/size ratio)
- [ ] "Quality" preset (minimal loss)
- [ ] Custom preset saving (localStorage)

### 3.4 Batch Processing 🔲
- [ ] Multiple file upload
- [ ] Queue with progress for each file
- [ ] Batch compression with same settings
- [ ] Zip download for multiple files

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

**Completed:** Phase 0, Phase 1, Phase 2.1 (Image Recompression), Phase 2.2 (Image Downsampling)
**Current:** Phase 2 (Free Local Methods)
**Next milestone:** Grayscale Conversion (2.3)

---

## Compression Methods Summary

### Free (Browser-Based) — 24 Methods
| Category | Method | Potential Savings | Status |
|----------|--------|-------------------|--------|
| **Structure** | Object Streams | 5-20% | ✅ Done |
| **Structure** | Strip Metadata | 1-5% | ✅ Done |
| **Structure** | Deep Metadata Clean (XMP, etc.) | 1-5% | 🔲 Planned |
| **Structure** | Remove Bookmarks | 0-2% | 🔲 Planned |
| **Structure** | Remove JavaScript/Actions | 0-1% | 🔲 Planned |
| **Structure** | Remove Named Destinations | 0-1% | 🔲 Planned |
| **Structure** | Remove Article Threads | 0-1% | 🔲 Planned |
| **Structure** | Remove Page Labels | 0-1% | 🔲 Planned |
| **Structure** | Remove Web Capture Info | 0-1% | 🔲 Planned |
| **Structure** | Rebuild PDF (remove incremental saves) | 2-10% | 🔲 Planned |
| **Images** | JPEG Recompression | 30-70% | ✅ Done |
| **Images** | Downsampling (DPI reduction) | 50-75% | ✅ Done |
| **Images** | Grayscale Conversion | 20-40% | 🔲 Planned |
| **Images** | Monochrome/1-bit Conversion | 60-90% | 🔲 Planned |
| **Images** | PNG to JPEG (photos) | 30-60% | 🔲 Planned |
| **Images** | CMYK to RGB | 10-25% | 🔲 Planned |
| **Images** | Remove Alpha Channels | 5-20% | 🔲 Planned |
| **Images** | Remove ICC Profiles | 1-10% | 🔲 Planned |
| **Images** | Remove Thumbnails | 1-5% | 🔲 Planned |
| **Images** | Inline to XObject | 0-5% | 🔲 Planned |
| **Resources** | Duplicate Resource Removal | 5-30% | 🔲 Planned |
| **Resources** | Remove Unused Fonts | 0-10% | 🔲 Planned |
| **Resources** | Remove Attachments | varies | 🔲 Planned |
| **Interactive** | Flatten Forms | 5-15% | 🔲 Planned |
| **Interactive** | Flatten Annotations | 5-15% | 🔲 Planned |
| **Layers** | Remove/Flatten Layers | 0-10% | 🔲 Planned |
| **Content** | Remove Alternate Content | 0-20% | 🔲 Planned |
| **Content** | Remove Invisible Text | 0-5% | 🔲 Planned |
| **Streams** | Content Stream Compression | 5-15% | 🔲 Planned |

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

