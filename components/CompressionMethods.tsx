'use client';

import type { CompressionOptions, MethodResult, ImageCompressionSettings } from '@/lib/types';
import { formatBytes } from '@/lib/utils';
import { IMAGE_COMPRESSION } from '@/lib/constants';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Eraser, Image as ImageIcon, Check, Settings2 } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

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
  };
  baselineOverhead: number;
  isUpdating?: boolean;
}

export const CompressionMethods = ({
  options,
  onChange,
  disabled = false,
  methodResults,
  imageSettings,
  onImageSettingsChange,
  imageStats,
  baselineOverhead,
  isUpdating = false,
}: CompressionMethodsProps) => {

  const toggleMethod = (key: keyof CompressionOptions) => {
    if (disabled) return;
    onChange({ ...options, [key]: !options[key] });
  };

  const getMethodResult = (key: keyof CompressionOptions) => {
    return methodResults?.find(r => r.key === key);
  };

  const firstEnabledIndex = Object.keys(options).findIndex(k => options[k as keyof CompressionOptions]);

  const methods = [
    {
      key: 'useObjectStreams' as const,
      label: 'Object Streams',
      description: 'Optimize PDF structure',
      icon: Package,
    },
    {
      key: 'stripMetadata' as const,
      label: 'Strip Metadata',
      description: 'Remove hidden data',
      icon: Eraser,
    },
    {
      key: 'recompressImages' as const,
      label: 'Compress Images',
      description: 'Reduce image quality',
      icon: ImageIcon,
      hasSettings: true,
    },
  ];

  const handleQualityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const quality = parseInt(e.target.value, 10);
    onImageSettingsChange({ ...imageSettings, quality });
  };

  return (
    <div className="bg-white border rounded-lg shadow-sm w-full lg:max-w-xs h-fit self-start sticky top-8">
      <div className="p-4 border-b bg-slate-50/50">
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
          <Settings2 className="w-4 h-4" />
          Settings
        </h2>
      </div>

      <div className="p-2 space-y-1">
        {methods.map((method, index) => {
          const isEnabled = options[method.key];
          const result = getMethodResult(method.key);
          const Icon = method.icon;

          let displayBytes = 0;
          if (result) {
            displayBytes = result.savedBytes;
            // Apply overhead tax logic same as before (if needed for perfect math, but usually raw savedBytes is enough per method for display)
            // For simplicity in this list view, we just show what the method saved directly, 
            // but to match the total we might need to distribute the overhead. 
            // Let's keep it simple: Show the raw saving attributed to this method.
            // If we really want to match the "Total Saved" exactly, we'd need to subtract overhead from the first method.
            if (isEnabled && index === firstEnabledIndex) {
              displayBytes -= baselineOverhead;
            }
          }

          return (
            <div key={method.key}>
              <button
                onClick={() => toggleMethod(method.key)}
                disabled={disabled}
                className={twMerge(
                  "w-full flex items-center gap-3 p-3 rounded-md text-left transition-all duration-200 border",
                  "focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-1",
                  isEnabled
                    ? "bg-slate-900 border-slate-900 text-white"
                    : "bg-white border-transparent hover:bg-slate-50 text-slate-600",
                  disabled && "opacity-50 cursor-not-allowed"
                )}
              >
                <div className={twMerge(
                  "flex items-center justify-center",
                  isEnabled ? "text-white" : "text-slate-400"
                )}>
                  <Icon className="w-5 h-5" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm leading-none flex justify-between">
                    <span>{method.label}</span>
                    {/* Per-Method Savings Badge */}
                    {isEnabled && displayBytes > 0 && (
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-100 px-1.5 py-0.5 rounded ml-2">
                        -{formatBytes(displayBytes)}
                      </span>
                    )}
                  </div>
                  <div className={twMerge(
                    "text-xs mt-1 truncate",
                    isEnabled ? "text-slate-300" : "text-slate-500"
                  )}>
                    {method.description}
                  </div>
                </div>

                <div className={twMerge(
                  "w-5 h-5 rounded border flex items-center justify-center transition-colors",
                  isEnabled
                    ? "bg-white border-white text-slate-900"
                    : "bg-transparent border-slate-300 text-transparent"
                )}>
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              </button>

              {/* Specific Settings for Images */}
              <AnimatePresence>
                {method.hasSettings && isEnabled && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-3 pb-3 pt-2">
                      <div className="bg-slate-50 border rounded p-3 space-y-3">
                        {/* Image Stats Restoration */}
                        {imageStats && (
                          <div className="text-[10px] text-slate-500 bg-white p-2 rounded border mb-2 grid grid-cols-2 gap-2">
                            <div>
                              <div className="font-bold text-slate-700">{imageStats.totalImages}</div>
                              <div>Images Found</div>
                            </div>
                            <div>
                              <div className="font-bold text-slate-700">{imageStats.jpegCount}</div>
                              <div>Optimizable (JPEG)</div>
                            </div>
                          </div>
                        )}

                        <div className="flex justify-between items-center text-xs font-medium text-slate-700">
                          <span>Image Quality</span>
                          <span className="font-mono bg-white px-1.5 py-0.5 rounded border text-slate-900">
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
                          className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-900"
                        />
                        {isUpdating && (
                          <div className="text-[10px] uppercase font-bold text-slate-500 animate-pulse text-center">
                            Updating Preview...
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
};
