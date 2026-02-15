'use client';

import { MethodItem } from './MethodItem';
import type { CompressionOptions, MethodResult } from '@/lib/types';
import { motion } from 'framer-motion';
import {
  Package, Eraser, Image as ImageIcon, Settings2, Minimize2, Palette, FileImage, Square, Layers,
  Bookmark, Link2, Newspaper, Globe, EyeOff, Hash, Trash2, FileText, MessageSquare, Code, Copy, Type,
  Paperclip, Boxes, Archive, Recycle, SplitSquareHorizontal, ScanEye,
  SlidersHorizontal,
} from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import { useState, useMemo, useCallback } from 'react';
import { usePdf } from '@/context/PdfContext';
export interface MethodConfig {
  key: keyof CompressionOptions;
  label: string;
  description: string;
  impact: string;
  icon: React.ElementType;
  hasSettings?: boolean;
  warning?: string;
}

type RiskLevel = 'safe' | 'medium' | 'high';

// Methods organized by risk level - how much harm/loss they cause to the file

const SAFE_METHODS: MethodConfig[] = [
  {
    key: 'useObjectStreams',
    label: 'Object Streams',
    description: 'Optimize PDF internal structure',
    impact: 'No visual or functional change. Reorganizes internal data for smaller size.',
    icon: Package,
  },
  {
    key: 'stripMetadata',
    label: 'Strip Metadata',
    description: 'Remove basic document info',
    impact: 'Removes author, title, and creation date. No effect on content.',
    icon: Eraser,
  },
  {
    key: 'deepCleanMetadata',
    label: 'Deep Clean Metadata',
    description: 'Remove XMP, tags, hidden data',
    impact: 'Removes extended metadata streams. No visible change to the document.',
    icon: Trash2,
  },
  {
    key: 'compressContentStreams',
    label: 'Compress Streams',
    description: 'Optimize content encoding',
    impact: 'Re-encodes page data more efficiently. Zero quality loss.',
    icon: Archive,
  },
  {
    key: 'removeOrphanObjects',
    label: 'Remove Orphans',
    description: 'Clean dead objects',
    impact: 'Removes unreferenced internal objects. No effect on visible content.',
    icon: Recycle,
  },
  {
    key: 'removeDuplicateResources',
    label: 'Deduplicate',
    description: 'Merge duplicate images',
    impact: 'Merges exact duplicate resources. No quality change whatsoever.',
    icon: Copy,
  },
  {
    key: 'removeThumbnails',
    label: 'Remove Thumbnails',
    description: 'Delete page previews',
    impact: 'Removes embedded thumbnails. Viewers regenerate them automatically.',
    icon: FileImage,
  },
  {
    key: 'removeJavaScript',
    label: 'Remove JavaScript',
    description: 'Strip scripts (security)',
    impact: 'Removes embedded scripts. Improves security, no visual change.',
    icon: Code,
  },
  {
    key: 'removeArticleThreads',
    label: 'Remove Article Threads',
    description: 'Delete reading order',
    impact: 'Removes rarely-used reading order metadata. No visible change.',
    icon: Newspaper,
  },
  {
    key: 'removeWebCaptureInfo',
    label: 'Remove Web Capture',
    description: 'Delete web source info',
    impact: 'Removes web capture origin data. No visible change.',
    icon: Globe,
  },
  {
    key: 'removeColorProfiles',
    label: 'Remove ICC Profiles',
    description: 'Strip color profiles',
    impact: 'Strips ICC color profiles. Colors render fine using standard sRGB.',
    icon: Palette,
  },
  {
    key: 'removeUnusedFonts',
    label: 'Remove Unused Fonts',
    description: 'Delete unreferenced fonts',
    impact: 'Removes fonts not used by any text. No visible change.',
    icon: Type,
  },
  {
    key: 'inlineToXObject',
    label: 'Inline to XObject',
    description: 'Convert inline images',
    impact: 'Converts inline images to reusable objects. No quality change.',
    icon: Boxes,
  },
];

const MEDIUM_METHODS: MethodConfig[] = [
  {
    key: 'recompressImages',
    label: 'Compress Images',
    description: 'Re-encode at lower quality',
    impact: 'Lossy recompression. Minor quality reduction depending on quality setting.',
    icon: ImageIcon,
    hasSettings: true,
  },
  {
    key: 'downsampleImages',
    label: 'Downsample',
    description: 'Reduce image resolution',
    impact: 'Lowers image DPI. Images may look slightly less sharp when zoomed in.',
    icon: Minimize2,
    hasSettings: true,
  },
  {
    key: 'pngToJpeg',
    label: 'PNG to JPEG',
    description: 'Convert photos to JPEG',
    impact: 'Converts lossless PNGs to lossy JPEG. Slight quality loss, transparency removed.',
    icon: FileImage,
  },
  {
    key: 'removeAlphaChannels',
    label: 'Remove Alpha',
    description: 'Flatten transparency',
    impact: 'Flattens transparent areas to white. Transparent overlays will change.',
    icon: Layers,
  },
  {
    key: 'cmykToRgb',
    label: 'CMYK to RGB',
    description: 'Convert print colors',
    impact: 'Converts CMYK colors to RGB. Not suitable for professional printing.',
    icon: Palette,
    warning: 'Not for print use',
  },
  {
    key: 'removeBookmarks',
    label: 'Remove Bookmarks',
    description: 'Delete navigation',
    impact: 'Removes table-of-contents navigation. Readers lose bookmark sidebar.',
    icon: Bookmark,
  },
  {
    key: 'removeNamedDestinations',
    label: 'Remove Destinations',
    description: 'Delete internal links',
    impact: 'Removes internal link targets. Cross-references within the PDF will break.',
    icon: Link2,
  },
  {
    key: 'removePageLabels',
    label: 'Remove Page Labels',
    description: 'Delete custom numbering',
    impact: 'Removes custom page labels (e.g. "i, ii, iii"). Pages show numeric index only.',
    icon: Hash,
  },
  {
    key: 'removeAttachments',
    label: 'Remove Attachments',
    description: 'Delete embedded files',
    impact: 'Deletes all files embedded in the PDF. Attached spreadsheets, images, etc. are lost.',
    icon: Paperclip,
  },
  {
    key: 'removeAlternateContent',
    label: 'Remove Alternates',
    description: 'Remove print/screen-only',
    impact: 'Removes alternate image versions. May affect print or screen-optimized rendering.',
    icon: SplitSquareHorizontal,
  },
  {
    key: 'removeHiddenLayers',
    label: 'Remove Hidden Layers',
    description: 'Delete hidden content',
    impact: 'Permanently deletes hidden layers. Content on those layers cannot be recovered.',
    icon: EyeOff,
  },
];

const HIGH_METHODS: MethodConfig[] = [
  {
    key: 'convertToGrayscale',
    label: 'Grayscale',
    description: 'Convert colors to gray tones',
    impact: 'All color information is permanently removed. The entire document becomes grayscale.',
    icon: Palette,
    warning: 'Removes all color',
  },
  {
    key: 'convertToMonochrome',
    label: 'Monochrome',
    description: '1-bit black & white',
    impact: 'Extreme quality reduction. All content becomes pure black or white — no shading.',
    icon: Square,
    warning: 'Best for text/line art only',
  },
  {
    key: 'flattenForms',
    label: 'Flatten Forms',
    description: 'Convert forms to static',
    impact: 'All form fields become non-editable. Users can no longer fill in the PDF.',
    icon: FileText,
    warning: 'Makes forms non-editable',
  },
  {
    key: 'flattenAnnotations',
    label: 'Flatten Annotations',
    description: 'Merge comments into pages',
    impact: 'Comments and annotations are permanently baked in. Cannot be edited or removed.',
    icon: MessageSquare,
    warning: 'Cannot undo',
  },
  {
    key: 'removeInvisibleText',
    label: 'Remove Invisible Text',
    description: 'Strip hidden OCR text',
    impact: 'Removes searchable text layer from scanned pages. PDF becomes non-searchable.',
    icon: ScanEye,
    warning: 'Breaks text search & accessibility',
  },
];

const ALL_METHODS = [...SAFE_METHODS, ...MEDIUM_METHODS, ...HIGH_METHODS];

// Separate adjustable methods (with settings panels) from simple toggles
const ADJUSTABLE_METHODS = ALL_METHODS.filter(m => m.hasSettings);

const SAFE_TOGGLE_METHODS = SAFE_METHODS.filter(m => !m.hasSettings);
const MEDIUM_TOGGLE_METHODS = MEDIUM_METHODS.filter(m => !m.hasSettings);
const HIGH_TOGGLE_METHODS = HIGH_METHODS.filter(m => !m.hasSettings);


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
  const pdfFeatures = analysis?.pdfFeatures;

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

  const [activeTab, setActiveTab] = useState<RiskLevel>('medium');

  const getMethodResult = useCallback((key: keyof CompressionOptions) => {
    return methodResultsMap.get(key);
  }, [methodResultsMap]);

  // Check if a method is not applicable (the PDF doesn't have the relevant feature)
  const getMethodNotApplicable = useCallback((key: keyof CompressionOptions): string | undefined => {
    if (!pdfFeatures) return undefined; // Still loading, don't show indicators yet
    switch (key) {
      // Image methods
      case 'recompressImages':
      case 'downsampleImages':
      case 'convertToGrayscale':
      case 'convertToMonochrome':
        return !pdfFeatures.hasImages ? 'No images found' : undefined;
      case 'pngToJpeg':
        return !pdfFeatures.hasPngImages ? 'No PNG images' : undefined;
      case 'removeAlphaChannels':
        return !pdfFeatures.hasAlphaImages ? 'No transparent images' : undefined;
      case 'removeColorProfiles':
        return !pdfFeatures.hasIccProfiles ? 'No ICC profiles' : undefined;
      case 'cmykToRgb':
        return !pdfFeatures.hasCmykImages ? 'No CMYK images' : undefined;
      // Structure/cleanup methods
      case 'removeJavaScript':
        return !pdfFeatures.hasJavaScript ? 'No JavaScript found' : undefined;
      case 'removeBookmarks':
        return !pdfFeatures.hasBookmarks ? 'No bookmarks found' : undefined;
      case 'removeNamedDestinations':
        return !pdfFeatures.hasNamedDestinations ? 'No destinations found' : undefined;
      case 'removeArticleThreads':
        return !pdfFeatures.hasArticleThreads ? 'No article threads' : undefined;
      case 'removeWebCaptureInfo':
        return !pdfFeatures.hasWebCaptureInfo ? 'No web capture info' : undefined;
      case 'removeHiddenLayers':
        return !pdfFeatures.hasHiddenLayers ? 'No hidden layers' : undefined;
      case 'removePageLabels':
        return !pdfFeatures.hasPageLabels ? 'No page labels' : undefined;
      case 'flattenForms':
        return !pdfFeatures.hasForms ? 'No forms found' : undefined;
      case 'flattenAnnotations':
        return !pdfFeatures.hasAnnotations ? 'No annotations found' : undefined;
      case 'removeAttachments':
        return !pdfFeatures.hasAttachments ? 'No attachments found' : undefined;
      case 'removeThumbnails':
        return !pdfFeatures.hasThumbnails ? 'No thumbnails found' : undefined;
      default:
        return undefined;
    }
  }, [pdfFeatures]);

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

  const getTabMethods = useCallback((tab: RiskLevel): MethodConfig[] => {
    switch (tab) {
      case 'safe': return SAFE_TOGGLE_METHODS;
      case 'medium': return MEDIUM_TOGGLE_METHODS;
      case 'high': return HIGH_TOGGLE_METHODS;
    }
  }, []);

  const getTabStats = useCallback((tab: RiskLevel) => {
    const methods = getTabMethods(tab);
    const enabled = methods.filter(m => options[m.key]).length;
    const total = methods.length;
    return { enabled, total };
  }, [options, getTabMethods]);

  return (
    <div className="bg-white border rounded-lg shadow-sm w-full lg:max-w-xs h-fit self-start sticky top-8">
      <div className="p-3 border-b bg-slate-50/50">
        <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
          <Settings2 className="w-3.5 h-3.5" />
          Compression Settings
        </h2>
      </div>

      {/* Adjustable Settings - always visible, separate from tabs */}
      <div className="border-b">
        <div className="flex items-center gap-2 p-2 bg-slate-50/80">
          <SlidersHorizontal className="w-3.5 h-3.5 text-slate-600" />
          <span className="text-xs font-bold text-slate-800">Adjustable Settings</span>
          <span className="text-[10px] text-slate-500">Fine-tune values</span>
        </div>
        <div className="p-1.5 space-y-0.5">
          {ADJUSTABLE_METHODS.map(method => (
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
              notApplicable={getMethodNotApplicable(method.key)}
            />
          ))}
        </div>
      </div>

      {/* Risk-level tabs */}
      <div className="flex border-b">
        {([
          { key: 'safe' as RiskLevel, label: 'Safe', color: 'text-emerald-700' },
          { key: 'medium' as RiskLevel, label: 'Medium', color: 'text-amber-700' },
          { key: 'high' as RiskLevel, label: 'High', color: 'text-red-700' },
        ]).map(tab => {
          const stats = getTabStats(tab.key);
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={twMerge(
                "flex-1 px-2 py-2 text-xs font-semibold transition-colors relative",
                activeTab === tab.key
                  ? tab.color
                  : "text-slate-400 hover:text-slate-600"
              )}
            >
              <span>{tab.label}</span>
              <span className="ml-1 text-[9px] opacity-70">{stats.enabled}/{stats.total}</span>
              {activeTab === tab.key && (
                <motion.div
                  layoutId="settings-tab-indicator"
                  className={twMerge(
                    "absolute bottom-0 left-0 right-0 h-0.5",
                    tab.key === 'safe' && "bg-emerald-600",
                    tab.key === 'medium' && "bg-amber-500",
                    tab.key === 'high' && "bg-red-500",
                  )}
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="p-1.5 space-y-0.5 max-h-[70vh] overflow-y-auto">
        {getTabMethods(activeTab).map(method => (
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
            notApplicable={getMethodNotApplicable(method.key)}
          />
        ))}
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
