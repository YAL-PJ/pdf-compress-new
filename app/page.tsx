'use client';

import Link from 'next/link';
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  Zap,
  FileDown,
  Lock,
  Settings,
  Layers,
  ArrowRight,
  Check,
  ChevronDown,
} from 'lucide-react';

import {
  UploadZone,
  ResultsDisplay,
  ProcessingIndicator,
  ErrorDisplay,
  CompressionMethods,
  PresetSelector,
  BatchUploadZone,
  FileQueueList,
} from '@/components';

import { Footer } from '@/components/landing/Footer';

import { useBatchCompression } from '@/hooks/useBatchCompression';
import { usePdfCompression } from '@/hooks/usePdfCompression';
import { usePageManager } from '@/hooks/usePageManager';

import {
  DEFAULT_COMPRESSION_OPTIONS,
  DEFAULT_IMAGE_SETTINGS,
  CompressionOptions,
  ImageCompressionSettings,
} from '@/lib/types';

import {
  trackFileUpload,
  trackCompressionCompleted,
  trackBatchStarted,
  trackPresetSelected,
} from '@/lib/analytics';

/* =========================
   STATIC LANDING DATA
========================= */

const features = [
  { icon: Shield, title: '100% Private', description: 'Your files never leave your browser.' },
  { icon: Zap, title: 'Lightning Fast', description: 'WebAssembly + Web Workers.' },
  { icon: FileDown, title: 'Up to 90% Smaller', description: '24+ compression methods.' },
  { icon: Settings, title: 'Full Control', description: 'Presets or fine-tuned settings.' },
  { icon: Layers, title: 'Page Management', description: 'Reorder, rotate, delete pages.' },
  { icon: Lock, title: 'No Sign-up Required', description: 'No accounts, no limits.' },
];

const steps = [
  { number: '1', title: 'Upload PDF', description: 'Drag & drop or browse.' },
  { number: '2', title: 'Choose Compression', description: 'Preset or custom.' },
  { number: '3', title: 'Download', description: 'Instant results.' },
];

/* =========================
   HOME COMPONENT
========================= */

export default function Home() {
  const { state, processFile, reset } = usePdfCompression();

  const [options, setOptions] = useState<CompressionOptions>(DEFAULT_COMPRESSION_OPTIONS);
  const [imageSettings, setImageSettings] = useState<ImageCompressionSettings>(DEFAULT_IMAGE_SETTINGS);
  const [isBatchMode, setIsBatchMode] = useState(false);

  const prevSettingsRef = useRef(DEFAULT_IMAGE_SETTINGS);

  const {
    queue,
    isProcessing: isBatchProcessing,
    stats: batchStats,
    addFiles,
    removeFile,
    clearQueue,
    startProcessing: startBatchProcessing,
  } = useBatchCompression();

  const pageCount = state.status === 'done' ? state.analysis.pageCount : 0;
  const { pages, toggleDelete, rotatePage, reorderPages, movePage } =
    usePageManager(pageCount);

  /* =========================
     HANDLERS
  ========================= */

  const handleFileSelect = useCallback((file: File) => {
    trackFileUpload(file.size / 1024 / 1024, false);
    prevSettingsRef.current = imageSettings;
    processFile(file, { imageSettings, options });
  }, [processFile, imageSettings, options]);

  const handleReset = useCallback(() => {
    reset();
    setOptions(DEFAULT_COMPRESSION_OPTIONS);
    setImageSettings(DEFAULT_IMAGE_SETTINGS);
    prevSettingsRef.current = DEFAULT_IMAGE_SETTINGS;
  }, [reset]);

  const handlePresetSelect = useCallback((o: CompressionOptions, s: ImageCompressionSettings) => {
    setOptions(o);
    setImageSettings(s);
    trackPresetSelected(s.quality <= 60 ? 'maximum' : 'recommended');
  }, []);

  const showLanding =
    state.status === 'idle' && !isBatchMode && queue.length === 0;

  /* =========================
     LANDING VIEW
  ========================= */

  if (showLanding) {
    return (
      <main className="bg-slate-50">
        {/* HERO */}
        <section className="py-24 text-center max-w-6xl mx-auto px-4">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
            <Lock className="w-4 h-4" /> Files never leave your browser
          </span>

          <h1 className="mt-6 text-5xl font-extrabold">
            Compress PDFs <span className="text-blue-600">Without Uploading</span>
          </h1>

          <p className="mt-6 text-xl text-slate-600 max-w-2xl mx-auto">
            Professional client-side PDF compression. 24+ methods. 100% private.
          </p>

          <div className="mt-10">
            <button
              onClick={() => { }}
              className="px-8 py-4 bg-slate-900 text-white rounded-lg font-bold"
            >
              Scroll to upload ↓
            </button>
          </div>

          <div className="mt-12 max-w-xl mx-auto">
            <UploadZone onFileSelect={handleFileSelect} />
          </div>
        </section>

        {/* FEATURES */}
        <section className="py-24 bg-white">
          <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-8 px-4">
            {features.map(f => (
              <div key={f.title} className="p-6 rounded-xl border">
                <f.icon className="w-8 h-8 mb-3" />
                <h3 className="font-bold">{f.title}</h3>
                <p className="text-slate-600">{f.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="py-24 bg-slate-50">
          <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-8 px-4 text-center">
            {steps.map(s => (
              <div key={s.number}>
                <div className="w-12 h-12 rounded-full bg-slate-900 text-white mx-auto mb-4 flex items-center justify-center font-bold">
                  {s.number}
                </div>
                <h3 className="font-bold">{s.title}</h3>
                <p className="text-slate-600">{s.description}</p>
              </div>
            ))}
          </div>
        </section>

        <Footer />
      </main>
    );
  }

  /* =========================
     APP VIEW
  ========================= */

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 max-w-7xl mx-auto">
      <AnimatePresence>
        {(state.status === 'idle' || isBatchMode) && (
          <UploadZone onFileSelect={handleFileSelect} />
        )}

        {state.status === 'processing' && (
          <ProcessingIndicator
            fileName={state.fileName}
            progress={state.progress}
            progressPercent={state.progressPercent}
          />
        )}

        {state.status === 'done' && (
          <ResultsDisplay
            originalSize={state.analysis.originalSize}
            compressedSize={state.analysis.baselineSize}
            pageCount={state.analysis.pageCount}
            blob={state.analysis.fullBlob}
            originalFile={state.originalFile}
            originalFileName={state.fileName}
            onReset={handleReset}
            pages={pages}
            onToggleDeletePage={toggleDelete}
            onRotatePage={rotatePage}
            onReorderPages={reorderPages}
            onMovePage={movePage}
          />
        )}

        {state.status === 'error' && (
          <ErrorDisplay error={state.error} onReset={handleReset} />
        )}
      </AnimatePresence>

      <Footer />
    </main>
  );
}
