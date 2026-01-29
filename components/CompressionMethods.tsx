'use client';

import type { CompressionOptions, MethodResult, ImageCompressionSettings } from '@/lib/types';
import { formatBytes } from '@/lib/utils';
import { IMAGE_COMPRESSION } from '@/lib/constants';

interface MethodConfig {
  key: keyof CompressionOptions;
  label: string;
  description: string;
  icon: string;
  hasSettings?: boolean;
}

const METHODS: MethodConfig[] = [
  {
    key: 'useObjectStreams',
    label: 'Object Streams',
    description: 'Combine PDF objects into compressed streams',
    icon: '📦',
  },
  {
    key: 'stripMetadata',
    label: 'Strip Metadata',
    description: 'Remove title, author, dates, and other metadata',
    icon: '🧹',
  },
  {
    key: 'recompressImages',  // NEW
    label: 'Recompress Images',
    description: 'Re-encode JPEG images at lower quality for smaller files',
    icon: '🖼️',
    hasSettings: true,
  },
];

interface CompressionMethodsProps {
  options: CompressionOptions;
  onChange: (options: CompressionOptions) => void;
  disabled?: boolean;
  methodResults?: MethodResult[];
  imageSettings: ImageCompressionSettings;  // NEW
  onImageSettingsChange: (settings: ImageCompressionSettings) => void;  // NEW
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

  const getMethodResult = (key: keyof CompressionOptions): MethodResult | undefined => {
    return methodResults?.find(r => r.key === key);
  };

  const handleQualityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const quality = parseInt(e.target.value, 10);
    onImageSettingsChange({ ...imageSettings, quality });
  };

  const getQualityLabel = (quality: number): string => {
    if (quality <= 50) return 'Low';
    if (quality <= 75) return 'Medium';
    if (quality <= 85) return 'High';
    return 'Very High';
  };

  // Calculate the index of the first enabled method
  const firstEnabledIndex = METHODS.findIndex(m => options[m.key]);

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-700 mb-3">
        Compression Methods
      </h2>

      <div className="space-y-2">
        {METHODS.map((method, index) => {
          const isEnabled = options[method.key];
          const result = getMethodResult(method.key);
          const showImageSettings = method.key === 'recompressImages' && isEnabled;

          let displayBytes = 0;
          if (result) {
            // Start with raw savings from baseline
            displayBytes = result.savedBytes;

            // Logic: The "first" enabled method pays the "baseline overhead" tax.
            // If this method is enabled and is the first one, subtract overhead.
            if (isEnabled && index === firstEnabledIndex) {
              displayBytes -= baselineOverhead;
            }
            // If this method is DISABLED, we want to show what it WOULD save if enabled.
            // If enabling it would make it the first/primary (index < currentFirst), it would pay the tax.
            else if (!isEnabled) {
              if (firstEnabledIndex === -1 || index < firstEnabledIndex) {
                displayBytes -= baselineOverhead;
              }
            }
          }

          return (
            <div key={method.key}>
              <button
                onClick={() => toggleMethod(method.key)}
                disabled={disabled}
                className={`
                  group w-full flex items-center gap-3 p-3 rounded-lg text-left
                  transition-all duration-150 ease-out
                  ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                  ${isEnabled
                    ? 'bg-blue-50 border-2 border-blue-500'
                    : 'bg-gray-50 border-2 border-transparent hover:border-gray-300'
                  }
                  ${showImageSettings ? 'rounded-b-none' : ''}
                `}
                role="switch"
                aria-checked={isEnabled}
              >
                <span className="text-xl flex-shrink-0">{method.icon}</span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium text-sm ${isEnabled ? 'text-blue-900' : 'text-gray-700'}`}>
                      {method.label}
                    </span>

                    {(() => {
                      if (!result) return null;

                      if (displayBytes > 0) {
                        return (
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium
                            ${isEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                            -{formatBytes(displayBytes)}
                          </span>
                        );
                      }

                      if (displayBytes < 0) {
                        // Negative savings (bloat) - arguably shouldn't happen often if tool is good, but needed for accuracy
                        return (
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                            +{formatBytes(Math.abs(displayBytes))}
                          </span>
                        );
                      }

                      return (
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400">~0</span>
                      );
                    })()}

                    {method.key === 'recompressImages' && (
                      <>
                        {isUpdating ? (
                          <span className="text-xs text-blue-600 flex items-center gap-1 animate-pulse">
                            <span className="inline-block w-2 h-2 bg-blue-500 rounded-full animate-bounce" />
                            Optimizing...
                          </span>
                        ) : (
                          result?.details && (
                            <span className="text-xs text-gray-500">
                              ({result.details.imagesProcessed} optimized)
                            </span>
                          )
                        )}
                      </>
                    )}
                  </div>
                  <div className={`text-xs max-h-0 overflow-hidden opacity-0 transition-all duration-150
                    group-hover:max-h-24 group-hover:opacity-100
                    ${isEnabled ? 'text-blue-700' : 'text-gray-500'}`}>
                    {method.description}
                  </div>
                </div>

                <div className={`w-10 h-6 rounded-full p-1 transition-colors duration-200 flex-shrink-0
                  ${isEnabled ? 'bg-blue-500' : 'bg-gray-300'}`}>
                  <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200
                    ${isEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
              </button>

              {/* Quality Slider - NEW */}
              {showImageSettings && (
                <div className="bg-blue-50 border-2 border-t-0 border-blue-500 rounded-b-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="image-quality" className="text-xs font-medium text-blue-900">
                      Quality: {imageSettings.quality}% ({getQualityLabel(imageSettings.quality)})
                    </label>
                  </div>
                  <input
                    id="image-quality"
                    type="range"
                    min={IMAGE_COMPRESSION.MIN_QUALITY}
                    max={IMAGE_COMPRESSION.MAX_QUALITY}
                    value={imageSettings.quality}
                    onChange={handleQualityChange}
                    disabled={disabled}
                    className="w-full h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <div className="flex justify-between text-xs text-blue-700">
                    <span>Smaller</span>
                    <span>Better Quality</span>
                  </div>

                  {imageStats && imageStats.totalImages > 0 && (
                    <div className="mt-2 pt-2 border-t border-blue-200">
                      <p className="text-xs text-blue-800">
                        📊 Found {imageStats.totalImages} images ({imageStats.jpegCount} JPEG)
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!Object.values(options).some(Boolean) && (
        <p className="mt-3 text-xs text-amber-600 flex items-center gap-1">
          <span>⚠️</span> No compression methods selected
        </p>
      )}
    </div>
  );
};
