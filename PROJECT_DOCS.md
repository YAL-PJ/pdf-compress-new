# PDF Compress - Project Documentation

## Vision

**Goal:** Build the most powerful PDF compressor on the market.

**Strategy:** Start with excellent free browser-based compression, then expand to server-powered advanced features and third-party integrations.

**Business Model:** Freemium
- **Free Tier:** 100% browser-based, no file uploads, unlimited use
- **Paid Tier:** Server-powered compression, OCR, advanced algorithms, API access

---

## Why This Approach?

1. **Free tier builds trust** — Users see we don't touch their files
2. **Free tier is the funnel** — Great free product → paid conversions
3. **Server unlocks power** — Some compression methods need real compute
4. **Third-party APIs** — OCR, AI features that can't run in browser

---

## Tech Stack

### Current (Free Tier)
| Layer | Technology |
|-------|------------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| PDF Processing | pdf-lib |
| Threading | Web Workers |

### Planned (Paid Tier)
| Layer | Technology |
|-------|------------|
| Backend | Next.js API Routes / Node.js |
| Queue | Bull + Redis |
| Storage | S3 (temporary file storage) |
| PDF Processing | Ghostscript, MuPDF, QPDF |
| Image Processing | Sharp, MozJPEG, PNGQuant |
| OCR | Google Cloud Vision / Tesseract |
| Auth | NextAuth.js / Clerk |
| Payments | Stripe |
| Database | PostgreSQL (users, usage tracking) |

---

## Project Structure

```
pdf-compress/
├── app/
│   ├── page.tsx              # Main compression tool
│   ├── layout.tsx            # Root layout
│   ├── globals.css           # Global styles
│   ├── pricing/              # (future) Pricing page
│   ├── dashboard/            # (future) User dashboard
│   └── api/                  # (future) Server endpoints
│       ├── compress/         # Upload & compress endpoint
│       ├── auth/             # Authentication
│       └── webhooks/         # Stripe webhooks
│
├── components/
│   ├── index.ts              # Barrel exports
│   ├── UploadZone.tsx        # Drag & drop file input
│   ├── CompressionMethods.tsx # Toggle buttons for methods
│   ├── ProcessingIndicator.tsx # Loading state with progress
│   ├── ResultsDisplay.tsx    # Shows before/after sizes
│   └── ErrorDisplay.tsx      # User-friendly error messages
│
├── hooks/
│   └── usePdfCompression.ts  # Main state management hook
│
├── lib/
│   ├── types.ts              # TypeScript interfaces
│   ├── constants.ts          # App constants
│   ├── errors.ts             # Custom error types
│   ├── utils.ts              # Pure utility functions
│   └── pdf-processor.ts      # Core PDF compression logic
│
├── workers/
│   └── pdf.worker.ts         # Web Worker for browser processing
│
├── server/                   # (future) Server-side processing
│   ├── queue.ts              # Job queue management
│   ├── processors/           # Compression processors
│   │   ├── ghostscript.ts
│   │   ├── mozjpeg.ts
│   │   └── ocr.ts
│   └── storage.ts            # Temporary file storage
│
├── ROADMAP.md                # Development roadmap
└── PROJECT_DOCS.md           # This file
```

---

## Architecture

### Free Tier (Browser-Only)

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  User drops │────▶│ usePdfCompr- │────▶│ Web Worker  │
│  PDF file   │     │ ession hook  │     │ (pdf.worker)│
└─────────────┘     └──────────────┘     └─────────────┘
                           │                    │
                           │                    ▼
                           │             ┌─────────────┐
                           │             │pdf-processor│
                           │             │  (pdf-lib)  │
                           │             └─────────────┘
                           │                    │
                           ▼                    │
                    ┌──────────────┐            │
                    │ Results +    │◀───────────┘
                    │ Download     │   
                    └──────────────┘
                    
         🔒 Files NEVER leave the browser
```

### Paid Tier (Server-Powered)

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  User drops │────▶│ Upload to    │────▶│ S3 Temp     │
│  PDF file   │     │ API endpoint │     │ Storage     │
└─────────────┘     └──────────────┘     └─────────────┘
                                                │
                                                ▼
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│ Download    │◀────│ Processing   │◀────│ Job Queue   │
│ Result      │     │ Complete     │     │ (Bull/Redis)│
└─────────────┘     └──────────────┘     └─────────────┘
                                                │
                    ┌───────────────────────────┼───────────────────────────┐
                    │                           │                           │
                    ▼                           ▼                           ▼
             ┌─────────────┐            ┌─────────────┐            ┌─────────────┐
             │ Ghostscript │            │ MozJPEG     │            │ OCR API     │
             │ Processor   │            │ Processor   │            │ (Google)    │
             └─────────────┘            └─────────────┘            └─────────────┘
             
         🔐 Files encrypted, auto-deleted after processing
```

---

## Compression Methods

### Free Tier (Browser) — 28+ Methods

**Image Optimization (10 methods):**
| Method | Savings | Description |
|--------|---------|-------------|
| Image Recompression | 30-70% | Re-encode JPEGs at lower quality |
| Image Downsampling | 50-75% | Reduce DPI (300→150) |
| Grayscale Conversion | 20-40% | Convert color to grayscale |
| Monochrome (1-bit) | 60-90% | B&W for line art/text scans |
| PNG to JPEG | 30-60% | Convert photos to JPEG |
| Remove Alpha Channels | 5-20% | Strip unused transparency |
| Remove ICC Profiles | 1-10% | Strip color profiles |
| CMYK to RGB | 10-25% | Smaller color space |
| Remove Thumbnails | 1-5% | Strip preview images |
| Inline to XObject | 0-5% | More efficient image storage |

**Structure Cleanup (12 methods):**
| Method | Savings | Description |
|--------|---------|-------------|
| Object Streams | 5-20% | Better object packaging |
| Strip Metadata | 1-5% | Remove author, dates |
| Deep Metadata Clean | 1-5% | XMP, custom fields, piece info |
| Remove Bookmarks | 0-2% | Strip navigation |
| Remove JavaScript | 0-1% | Strip scripts/actions |
| Remove Named Destinations | 0-1% | Strip link targets |
| Remove Article Threads | 0-1% | Strip flow definitions |
| Remove Page Labels | 0-1% | Strip custom numbering |
| Remove Web Capture Info | 0-1% | Strip web metadata |
| Rebuild PDF | 2-10% | Remove incremental saves |
| Remove Orphan Objects | 1-5% | Clean dead references |
| Content Stream Compress | 5-15% | Better Flate compression |

**Interactive & Layers (4 methods):**
| Method | Savings | Description |
|--------|---------|-------------|
| Flatten Forms | 5-15% | Convert forms to static |
| Flatten Annotations | 5-15% | Bake in comments/highlights |
| Remove/Flatten Layers | 0-10% | Merge optional content |
| Remove Alternate Content | 0-20% | Strip print/screen variants |

**Resources (2 methods):**
| Method | Savings | Description |
|--------|---------|-------------|
| Duplicate Removal | 5-30% | Merge identical resources |
| Remove Unused Fonts | 0-10% | Strip unreferenced fonts |

### Paid Tier (Server) — 19 Methods

**Advanced Image (7 methods):**
| Method | Savings | Description |
|--------|---------|-------------|
| MozJPEG | 10-30% extra | Superior JPEG encoder |
| Guetzli | 20-40% extra | Slow but highest quality |
| PNGQuant | 40-70% | Lossy PNG compression |
| OxiPNG | 5-15% | Lossless PNG optimization |
| JBIG2 | 50-90% | B&W image compression |
| CCITT Group 4 | 30-50% | Alternative B&W compression |
| JPEG 2000 | 10-30% | Better at low quality |

**Font Optimization (3 methods):**
| Method | Savings | Description |
|--------|---------|-------------|
| Font Subsetting | 5-80% | Remove unused glyphs |
| Font Deduplication | 5-15% | Merge similar fonts |
| Type1 to CFF | 10-30% | Convert to smaller format |

**Content Optimization (4 methods):**
| Method | Savings | Description |
|--------|---------|-------------|
| Content Stream Optimize | 5-10% | Remove redundant operators |
| Vector Simplification | 5-20% | Simplify paths |
| Transparency Flatten | 5-20% | Flatten transparency |
| Rasterize Complex Vectors | varies | Convert to images |

**PDF Engines (3 methods):**
| Method | Savings | Description |
|--------|---------|-------------|
| QPDF | 5-15% | Structure optimization |
| Ghostscript | 20-70% | Industry-standard processing |
| MuPDF | varies | Fast processing engine |

**Third-Party (2 methods):**
| Method | Savings | Description |
|--------|---------|-------------|
| OCR + Remove Images | 80-95% | Replace scans with text |
| AI Compression | 10-40% | Content-aware optimization |

---

## Feature Tiers

| Feature | Free | Pro ($9/mo) | Business ($29/mo) |
|---------|------|-------------|-------------------|
| Browser compression | ✅ | ✅ | ✅ |
| All local methods | ✅ | ✅ | ✅ |
| Server compression | ❌ | ✅ | ✅ |
| OCR integration | ❌ | ✅ | ✅ |
| Files per month | Unlimited | 100 | 500 |
| Max file size | 100MB | 500MB | 2GB |
| API access | ❌ | ❌ | ✅ |
| Priority processing | ❌ | ❌ | ✅ |

---

## Key Concepts

### 1. Method Independence

Each compression method is calculated independently:
- Baseline size (no compression)
- Each method's savings measured vs baseline
- UI sums enabled methods for estimated result

This allows instant UI toggling without recalculation.

### 2. Free/Paid Detection

```typescript
interface CompressionMethod {
  key: string;
  label: string;
  tier: 'free' | 'pro' | 'business';
  processor: 'browser' | 'server';
}
```

UI shows lock icons on paid methods. Clicking prompts upgrade.

### 3. Server Processing Flow

1. User uploads file → S3 presigned URL
2. API creates job in Bull queue
3. Worker picks up job, runs processors
4. Result uploaded to S3
5. User notified via polling/websocket
6. Files auto-deleted after 24h (configurable)

### 4. Security Model

- **Free tier:** Files never leave browser (true privacy)
- **Paid tier:** 
  - Files encrypted at rest
  - Auto-deleted after processing
  - No file content logging
  - GDPR compliant

---

## How to Run

### Development (Free Tier Only)

```bash
npm install
npm run dev
```

Open http://localhost:3000

### Development (With Server Features)

```bash
# Start Redis (for job queue)
docker run -d -p 6379:6379 redis

# Set environment variables
cp .env.example .env.local
# Edit .env.local with your API keys

# Start dev server
npm run dev
```

### Production

```bash
npm run build
npm start
```

---

## Adding a New Compression Method

### 1. Define the Method

In `lib/types.ts`:
```typescript
export interface CompressionOptions {
  // ... existing
  newMethod: boolean;
}

export interface MethodConfig {
  key: keyof CompressionOptions;
  label: string;
  description: string;
  icon: string;
  tier: 'free' | 'pro' | 'business';
  processor: 'browser' | 'server';
}
```

### 2. Implement the Logic

**For browser methods** (`lib/pdf-processor.ts`):
```typescript
// In analyzePdf function
const newMethodBytes = await applyNewMethod(pdfDoc);
const newMethodSaved = baselineSize - newMethodBytes.byteLength;
```

**For server methods** (`server/processors/new-method.ts`):
```typescript
export async function processNewMethod(
  inputPath: string, 
  outputPath: string,
  options: NewMethodOptions
): Promise<ProcessResult> {
  // Call external binary or API
}
```

### 3. Add to UI

In `components/CompressionMethods.tsx`:
```typescript
const METHODS: MethodConfig[] = [
  // ... existing
  {
    key: 'newMethod',
    label: 'New Method',
    description: 'What this does',
    icon: '🆕',
    tier: 'free', // or 'pro' or 'business'
    processor: 'browser', // or 'server'
  },
];
```

### 4. Handle Tier Restrictions

```typescript
const handleMethodToggle = (method: MethodConfig) => {
  if (method.tier !== 'free' && !userHasPlan(method.tier)) {
    showUpgradeModal(method.tier);
    return;
  }
  // ... toggle logic
};
```

---

## Third-Party Integrations

### OCR (Planned)

| Provider | Pros | Cons |
|----------|------|------|
| Google Cloud Vision | High accuracy, 1000 free/mo | Cost at scale |
| AWS Textract | Good for forms | Complex pricing |
| Tesseract (self-hosted) | Free, private | Lower accuracy |

### Cloud Storage (Planned)

| Provider | Use Case |
|----------|----------|
| Google Drive | Import/export user files |
| Dropbox | Import/export user files |
| S3 | Our temporary storage |

---

## Revenue Projections

| Metric | Target (Year 1) |
|--------|-----------------|
| Free users | 100,000 |
| Conversion rate | 2% |
| Paid users | 2,000 |
| ARPU | $15/mo |
| MRR | $30,000 |

---

## Current Status

**Completed:** Phase 0, Phase 1 (MVP with 2 free methods), Phase 2.1 (Image Recompression)
**Current:** Phase 2 (Adding more free browser methods)
**Next milestone:** Image Downsampling (2.2)

### Implemented Methods (3 total)
| Method | Savings | Status |
|--------|---------|--------|
| Object Streams | 5-20% | ✅ Done |
| Strip Metadata | 1-5% | ✅ Done |
| Image Recompression | 30-70% | ✅ Done |

See `ROADMAP.md` for detailed task tracking.

---

## Team Onboarding Checklist

- [ ] Read this document
- [ ] Read ROADMAP.md
- [ ] Run the app locally
- [ ] Test with various PDFs
- [ ] Understand the state machine in `usePdfCompression.ts`
- [ ] Understand Web Worker communication
- [ ] Review pdf-lib documentation
- [ ] (If working on paid features) Set up local Redis

---

## Resources

### PDF Processing
- [pdf-lib Documentation](https://pdf-lib.js.org/)
- [PDF.js](https://mozilla.github.io/pdf.js/) (for rendering/thumbnails)
- [Ghostscript](https://www.ghostscript.com/)
- [QPDF](https://qpdf.readthedocs.io/)

### Infrastructure
- [Bull Queue](https://docs.bullmq.io/)
- [Stripe Docs](https://stripe.com/docs)
- [NextAuth.js](https://next-auth.js.org/)

### Competitors to Study
- iLovePDF
- SmallPDF
- Adobe Acrobat Online
- PDF24

---

## Questions?

1. Check `ROADMAP.md` for what's planned
2. Check code comments for implementation details
3. The highest-impact next step is **Image Downsampling** (DPI reduction)
