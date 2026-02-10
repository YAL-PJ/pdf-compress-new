'use client';

import { MethodItem } from './MethodItem';
import type { CompressionOptions, ImageCompressionSettings, MethodResult } from '@/lib/types';
import { formatBytes } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package, Eraser, Image as ImageIcon, Check, Settings2, Minimize2, Palette, FileImage, Square, Layers,
  Bookmark, Link2, Newspaper, Globe, EyeOff, Hash, Trash2, FileText, MessageSquare, Code, Copy, Type,
  Paperclip, ChevronDown, ChevronRight, Boxes, Archive, Recycle, SplitSquareHorizontal, ScanEye,
} from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import { useState, useMemo, useCallback } from 'react';
import { usePdf } from '@/context/PdfContext';
export interface MethodConfig {
  key: keyof CompressionOptions;
  label: string;
  description: string;
  icon: React.ElementType;
  hasSettings?: boolean;
  warning?: string;
}

interface MethodCategory {
  name: string;
  methods: MethodConfig[];
  defaultExpanded?: boolean;
}

// Static config - defined at module level to avoid recreating on every render
const BASIC_METHOD_KEYS: ReadonlySet<keyof CompressionOptions> = new Set([
  'useObjectStreams',
  'stripMetadata',
  'recompressImages',
  'downsampleImages',
  'pngToJpeg',
  'removeThumbnails',
  'removeDuplicateResources',
  'removeJavaScript',
  'compressContentStreams',
  'removeOrphanObjects',
]);

const CATEGORIES: MethodCategory[] = [
  {
    name: 'Structure',
    defaultExpanded: true,
    methods: [
      {
        key: 'useObjectStreams',
        label: 'Object Streams',
        description: 'Optimize PDF internal structure',
        icon: Package,
      },
      {
        key: 'stripMetadata',
        label: 'Strip Metadata',
        description: 'Remove basic document info',
        icon: Eraser,
      },
      {
        key: 'deepCleanMetadata',
        label: 'Deep Clean Metadata',
        description: 'Remove XMP, tags, hidden data',
        icon: Trash2,
      },
    ],
  },
  {
    name: 'Images',
    defaultExpanded: true,
    methods: [
      {
        key: 'recompressImages',
        label: 'Compress Images',
        description: 'Re-encode at lower quality',
        icon: ImageIcon,
        hasSettings: true,
      },
      {
        key: 'downsampleImages',
        label: 'Downsample',
        description: 'Reduce image resolution',
        icon: Minimize2,
        hasSettings: true,
      },
      {
        key: 'convertToGrayscale',
        label: 'Grayscale',
        description: 'Convert colors to gray tones',
        icon: Palette,
        warning: 'Removes color information',
      },
      {
        key: 'convertToMonochrome',
        label: 'Monochrome',
        description: '1-bit black & white',
        icon: Square,
        warning: 'Best for text/line art only',
      },
      {
        key: 'pngToJpeg',
        label: 'PNG to JPEG',
        description: 'Convert photos to JPEG',
        icon: FileImage,
      },
      {
        key: 'removeAlphaChannels',
        label: 'Remove Alpha',
        description: 'Flatten transparency',
        icon: Layers,
      },
      {
        key: 'removeColorProfiles',
        label: 'Remove ICC Profiles',
        description: 'Strip color profiles',
        icon: Palette,
      },
      {
        key: 'cmykToRgb',
        label: 'CMYK to RGB',
        description: 'Convert print colors',
        icon: Palette,
        warning: 'Not for print use',
      },
    ],
  },
  {
    name: 'Resources',
    methods: [
      {
        key: 'removeThumbnails',
        label: 'Remove Thumbnails',
        description: 'Delete page previews',
        icon: FileImage,
      },
      {
        key: 'removeDuplicateResources',
        label: 'Deduplicate',
        description: 'Merge duplicate images',
        icon: Copy,
      },
      {
        key: 'removeUnusedFonts',
        label: 'Remove Unused Fonts',
        description: 'Delete unreferenced fonts',
        icon: Type,
      },
      {
        key: 'removeAttachments',
        label: 'Remove Attachments',
        description: 'Delete embedded files',
        icon: Paperclip,
      },
    ],
  },
  {
    name: 'Interactive',
    methods: [
      {
        key: 'flattenForms',
        label: 'Flatten Forms',
        description: 'Convert forms to static',
        icon: FileText,
        warning: 'Makes forms non-editable',
      },
      {
        key: 'flattenAnnotations',
        label: 'Flatten Annotations',
        description: 'Merge comments into pages',
        icon: MessageSquare,
        warning: 'Cannot undo',
      },
    ],
  },
  {
    name: 'Cleanup',
    methods: [
      {
        key: 'removeJavaScript',
        label: 'Remove JavaScript',
        description: 'Strip scripts (security)',
        icon: Code,
      },
      {
        key: 'removeBookmarks',
        label: 'Remove Bookmarks',
        description: 'Delete navigation',
        icon: Bookmark,
      },
      {
        key: 'removeNamedDestinations',
        label: 'Remove Destinations',
        description: 'Delete internal links',
        icon: Link2,
      },
      {
        key: 'removeArticleThreads',
        label: 'Remove Article Threads',
        description: 'Delete reading order',
        icon: Newspaper,
      },
      {
        key: 'removeWebCaptureInfo',
        label: 'Remove Web Capture',
        description: 'Delete web source info',
        icon: Globe,
      },
      {
        key: 'removeHiddenLayers',
        label: 'Remove Hidden Layers',
        description: 'Delete hidden content',
        icon: EyeOff,
      },
      {
        key: 'removePageLabels',
        label: 'Remove Page Labels',
        description: 'Delete custom numbering',
        icon: Hash,
      },
    ],
  },
  {
    name: 'Advanced',
    methods: [
      {
        key: 'compressContentStreams',
        label: 'Compress Streams',
        description: 'Optimize content encoding',
        icon: Archive,
      },
      {
        key: 'removeOrphanObjects',
        label: 'Remove Orphans',
        description: 'Clean dead objects',
        icon: Recycle,
      },
      {
        key: 'inlineToXObject',
        label: 'Inline to XObject',
        description: 'Convert inline images',
        icon: Boxes,
      },
      {
        key: 'removeAlternateContent',
        label: 'Remove Alternates',
        description: 'Remove print/screen-only',
        icon: SplitSquareHorizontal,
      },
      {
        key: 'removeInvisibleText',
        label: 'Remove Invisible Text',
        description: 'Strip hidden OCR text',
        icon: ScanEye,
        warning: 'May affect searchability',
      },
    ],
  },
];

// Pre-compute the basic filtered view since both inputs are static
const BASIC_CATEGORIES = CATEGORIES
  .map(cat => ({
    ...cat,
    methods: cat.methods.filter(m => BASIC_METHOD_KEYS.has(m.key)),
  }))
  .filter(cat => cat.methods.length > 0);


export const CompressionMethods = () => {
  const {
    options,
    setOptions,
    imageSettings,
    setImageSettings,
    analysis,
    isProcessing,
    isUpdating
  } = usePdf();

  const disabled = isProcessing && !isUpdating;
  const methodResults = analysis?.methodResults;
  const imageStats = analysis?.imageStats;

  // O(1) lookup instead of O(n) Array.find per method per render
  const methodResultsMap = useMemo(() => {
    const map = new Map<string, MethodResult>();
    if (methodResults) {
      for (const r of methodResults) {
        map.set(r.key, r);
      }
    }
    return map;
  }, [methodResults]);

  const [activeTab, setActiveTab] = useState<'basic' | 'advanced'>('basic');

  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    'Structure': true,
    'Images': true,
    'Resources': false,
    'Interactive': false,
    'Cleanup': false,
    'Advanced': false,
  });

  const toggleCategory = useCallback((category: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category],
    }));
  }, []);

  const getMethodResult = useCallback((key: keyof CompressionOptions) => {
    return methodResultsMap.get(key);
  }, [methodResultsMap]);

  // Handle special toggles with method interdependency logic
  const handleMethodToggle = useCallback((key: keyof CompressionOptions) => {
    if (key === 'downsampleImages') {
      const newEnabled = !options[key];
      const newOptions = newEnabled
        ? { ...options, [key]: newEnabled, recompressImages: true }
        : { ...options, [key]: newEnabled };
      setOptions(newOptions);
      setImageSettings({ ...imageSettings, enableDownsampling: newEnabled });
    } else if (key === 'convertToGrayscale' || key === 'convertToMonochrome') {
      const newEnabled = !options[key];
      const otherKey = key === 'convertToGrayscale' ? 'convertToMonochrome' : 'convertToGrayscale';
      const newOptions = newEnabled
        ? { ...options, [key]: true, [otherKey]: false, recompressImages: true }
        : { ...options, [key]: false };
      setOptions(newOptions);
    } else if (key === 'recompressImages' && options[key]) {
      setOptions({
        ...options,
        [key]: false,
        downsampleImages: false,
        convertToGrayscale: false,
        convertToMonochrome: false,
      });
      setImageSettings({ ...imageSettings, enableDownsampling: false });
    } else {
      if (disabled) return;
      setOptions({ ...options, [key]: !options[key] });
    }
  }, [options, disabled, setOptions, imageSettings, setImageSettings]);

  const getCategoryStats = useCallback((category: MethodCategory) => {
    const enabled = category.methods.filter(m => options[m.key]).length;
    const total = category.methods.length;
    const savings = category.methods.reduce((sum, m) => {
      const result = methodResultsMap.get(m.key);
      return sum + (options[m.key] && result ? result.savedBytes : 0);
    }, 0);
    return { enabled, total, savings };
  }, [options, methodResultsMap]);

  const displayCategories = activeTab === 'basic' ? BASIC_CATEGORIES : CATEGORIES;

  return (
    <div className="bg-white border rounded-lg shadow-sm w-full lg:max-w-xs h-fit self-start sticky top-8">
      <div className="p-3 border-b bg-slate-50/50">
        <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
          <Settings2 className="w-3.5 h-3.5" />
          Compression Settings
        </h2>
      </div>

      {/* Basic / Advanced tabs */}
      <div className="flex border-b">
        <button
          onClick={() => setActiveTab('basic')}
          className={twMerge(
            "flex-1 px-3 py-2 text-xs font-semibold transition-colors relative",
            activeTab === 'basic'
              ? "text-slate-900"
              : "text-slate-400 hover:text-slate-600"
          )}
        >
          Basic
          {activeTab === 'basic' && (
            <motion.div
              layoutId="settings-tab-indicator"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900"
            />
          )}
        </button>
        <button
          onClick={() => setActiveTab('advanced')}
          className={twMerge(
            "flex-1 px-3 py-2 text-xs font-semibold transition-colors relative",
            activeTab === 'advanced'
              ? "text-slate-900"
              : "text-slate-400 hover:text-slate-600"
          )}
        >
          Advanced
          {activeTab === 'advanced' && (
            <motion.div
              layoutId="settings-tab-indicator"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900"
            />
          )}
        </button>
      </div>

      <div className="p-1.5 space-y-1 max-h-[70vh] overflow-y-auto">
        {activeTab === 'basic' ? (
          // Basic: flat list, no collapsible categories
          <div className="space-y-0.5 p-1">
            {displayCategories.flatMap(cat => cat.methods).map(method => (
              <MethodItem
                key={method.key}
                method={method}
                isEnabled={options[method.key]}
                disabled={disabled}
                result={getMethodResult(method.key)}
                onToggle={handleMethodToggle}
                imageSettings={imageSettings}
                onImageSettingsChange={setImageSettings}
                imageStats={imageStats}
              />
            ))}
          </div>
        ) : (
          // Advanced: full categorized collapsible view
          displayCategories.map((category) => {
            const stats = getCategoryStats(category);
            const isExpanded = expandedCategories[category.name];

            return (
              <div key={category.name} className="border rounded">
                <button
                  onClick={() => toggleCategory(category.name)}
                  className="w-full flex items-center justify-between p-2 text-left hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-600" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                    )}
                    <span className="text-xs font-bold text-slate-800">{category.name}</span>
                    <span className="text-[10px] text-slate-600">
                      {stats.enabled}/{stats.total}
                    </span>
                  </div>
                  {stats.savings > 0 && (
                    <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">
                      -{formatBytes(stats.savings)}
                    </span>
                  )}
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="p-1.5 pt-0 space-y-0.5">
                        {category.methods.map(method => (
                          <MethodItem
                            key={method.key}
                            method={method}
                            isEnabled={options[method.key]}
                            disabled={disabled}
                            result={getMethodResult(method.key)}
                            onToggle={handleMethodToggle}
                            imageSettings={imageSettings}
                            onImageSettingsChange={setImageSettings}
                            imageStats={imageStats}
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}
      </div>

      {isUpdating && (
        <div className="p-2 border-t">
          <div className="text-[10px] uppercase font-bold text-slate-700 animate-pulse text-center">
            Updating Preview...
          </div>
        </div>
      )}
    </div>
  );
};
