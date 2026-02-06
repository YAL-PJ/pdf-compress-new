'use client';

import type { CompressionOptions, MethodResult, ImageCompressionSettings } from '@/lib/types';
import { formatBytes } from '@/lib/utils';
import { IMAGE_COMPRESSION, DPI_OPTIONS } from '@/lib/constants';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package,
  Eraser,
  Image as ImageIcon,
  Check,
  Settings2,
  Minimize2,
  Palette,
  FileImage,
  Square,
  Layers,
  Bookmark,
  Link2,
  Newspaper,
  Globe,
  EyeOff,
  Hash,
  Trash2,
  FileText,
  MessageSquare,
  Code,
  Copy,
  Type,
  Paperclip,
  ChevronDown,
  ChevronRight,
  Boxes,
  Archive,
  Recycle,
  SplitSquareHorizontal,
  ScanEye,
} from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import { useState } from 'react';

interface CompressionMethodsProps {
  options: CompressionOptions;
  onChange: (options: CompressionOptions) => void;
  disabled?: boolean;
  methodResults?: MethodResult[];
  imageSettings: ImageCompressionSettings;
  onImageSettingsChange: (settings: ImageCompressionSettings) => void;
  imageStats?: {
    totalImages: number;
    jpegCount: number;
    pngCount: number;
    otherCount: number;
    highDpiCount: number;
  };
  baselineOverhead?: number; // Reserved for future use
  isUpdating?: boolean;
}

interface MethodConfig {
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

export const CompressionMethods = ({
  options,
  onChange,
  disabled = false,
  methodResults,
  imageSettings,
  onImageSettingsChange,
  imageStats,
  baselineOverhead: _baselineOverhead,
  isUpdating = false,
}: CompressionMethodsProps) => {

  const [activeTab, setActiveTab] = useState<'basic' | 'advanced'>('basic');

  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    'Structure': true,
    'Images': true,
    'Resources': false,
    'Interactive': false,
    'Cleanup': false,
    'Advanced': false,
  });

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  const toggleMethod = (key: keyof CompressionOptions) => {
    if (disabled) return;
    onChange({ ...options, [key]: !options[key] });
  };

  const getMethodResult = (key: keyof CompressionOptions) => {
    return methodResults?.find(r => r.key === key);
  };

  const handleQualityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const quality = parseInt(e.target.value, 10);
    onImageSettingsChange({ ...imageSettings, quality });
  };

  const handleDpiChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const targetDpi = parseInt(e.target.value, 10);
    onImageSettingsChange({ ...imageSettings, targetDpi });
  };

  // Handle special toggles
  const handleMethodToggle = (key: keyof CompressionOptions) => {
    if (key === 'downsampleImages') {
      const newEnabled = !options[key];
      const newOptions = newEnabled
        ? { ...options, [key]: newEnabled, recompressImages: true }
        : { ...options, [key]: newEnabled };
      onChange(newOptions);
      onImageSettingsChange({ ...imageSettings, enableDownsampling: newEnabled });
    } else if (key === 'convertToGrayscale' || key === 'convertToMonochrome') {
      // Grayscale/monochrome require recompressImages and are mutually exclusive
      const newEnabled = !options[key];
      const otherKey = key === 'convertToGrayscale' ? 'convertToMonochrome' : 'convertToGrayscale';
      const newOptions = newEnabled
        ? { ...options, [key]: true, [otherKey]: false, recompressImages: true }
        : { ...options, [key]: false };
      onChange(newOptions);
    } else if (key === 'recompressImages' && options[key]) {
      // Disabling recompressImages also disables downsample, grayscale, monochrome
      onChange({
        ...options,
        [key]: false,
        downsampleImages: false,
        convertToGrayscale: false,
        convertToMonochrome: false,
      });
      onImageSettingsChange({ ...imageSettings, enableDownsampling: false });
    } else {
      toggleMethod(key);
    }
  };

  const renderMethod = (method: MethodConfig) => {
    const isEnabled = options[method.key];
    const result = getMethodResult(method.key);
    const Icon = method.icon;
    const displayBytes = result?.savedBytes ?? 0;

    return (
      <div key={method.key}>
        <button
          onClick={() => handleMethodToggle(method.key)}
          disabled={disabled}
          className={twMerge(
            "w-full flex items-center gap-2 p-2 rounded text-left transition-all duration-200",
            "focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-1",
            isEnabled
              ? "bg-slate-900 text-white"
              : "bg-white hover:bg-slate-50 text-slate-700",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <div className={twMerge(
            "flex items-center justify-center",
            isEnabled ? "text-white" : "text-slate-600"
          )}>
            <Icon className="w-4 h-4" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="font-medium text-xs leading-none flex justify-between items-center">
              <span className="truncate">{method.label}</span>
              {isEnabled && displayBytes > 0 && (
                <span className="text-[9px] bg-emerald-500/20 text-emerald-200 px-1 py-0.5 rounded ml-1 flex-shrink-0">
                  -{formatBytes(displayBytes)}
                </span>
              )}
            </div>
            <div className={twMerge(
              "text-[10px] mt-0.5 truncate",
              isEnabled ? "text-slate-300" : "text-slate-600"
            )}>
              {method.description}
            </div>
          </div>

          <div className={twMerge(
            "w-4 h-4 rounded border flex items-center justify-center transition-colors flex-shrink-0",
            isEnabled
              ? "bg-white border-white text-slate-900"
              : "bg-transparent border-slate-400 text-transparent"
          )}>
            <Check className="w-3 h-3 stroke-[3]" />
          </div>
        </button>

        {/* Settings panel for image compression */}
        <AnimatePresence>
          {method.key === 'recompressImages' && method.hasSettings && isEnabled && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="px-2 pb-2 pt-1">
                <div className="bg-slate-50 border rounded p-2 space-y-2">
                  {imageStats && (
                    <div className="text-[9px] text-slate-600 bg-white p-1.5 rounded border grid grid-cols-2 gap-1">
                      <div>
                        <div className="font-bold text-slate-800">{imageStats.totalImages}</div>
                        <div>Images</div>
                      </div>
                      <div>
                        <div className="font-bold text-slate-800">{imageStats.jpegCount}</div>
                        <div>JPEG</div>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-800">
                    <span>Quality</span>
                    <span className="font-mono bg-white px-1 py-0.5 rounded border border-slate-300 text-slate-900">
                      {imageSettings.quality}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={IMAGE_COMPRESSION.MIN_QUALITY}
                    max={IMAGE_COMPRESSION.MAX_QUALITY}
                    step={5}
                    value={imageSettings.quality}
                    onChange={handleQualityChange}
                    disabled={disabled}
                    className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-900"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Settings panel for downsampling */}
        <AnimatePresence>
          {method.key === 'downsampleImages' && method.hasSettings && isEnabled && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="px-2 pb-2 pt-1">
                <div className="bg-slate-50 border rounded p-2 space-y-2">
                  {imageStats && (
                    <div className="text-[9px] text-slate-600 bg-white p-1.5 rounded border grid grid-cols-2 gap-1">
                      <div>
                        <div className="font-bold text-slate-800">{imageStats.jpegCount}</div>
                        <div>JPEG</div>
                      </div>
                      <div>
                        <div className="font-bold text-amber-700">{imageStats.highDpiCount}</div>
                        <div>High-DPI</div>
                      </div>
                    </div>
                  )}

                  <div className="text-[10px] font-medium text-slate-700">Target DPI</div>
                  <select
                    value={imageSettings.targetDpi}
                    onChange={handleDpiChange}
                    disabled={disabled}
                    className="w-full text-xs bg-white border rounded px-1.5 py-1 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  >
                    {DPI_OPTIONS.PRESETS.map((preset) => (
                      <option key={preset.value} value={preset.value}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  // Count enabled methods per category
  const getCategoryStats = (category: MethodCategory) => {
    const enabled = category.methods.filter(m => options[m.key]).length;
    const total = category.methods.length;
    const savings = category.methods.reduce((sum, m) => {
      const result = getMethodResult(m.key);
      return sum + (options[m.key] && result ? result.savedBytes : 0);
    }, 0);
    return { enabled, total, savings };
  };

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
            {displayCategories.flatMap(cat => cat.methods).map(renderMethod)}
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
                        {category.methods.map(renderMethod)}
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
