'use client';

import type { CompressionOptions, MethodResult } from '@/lib/types';
import { formatBytes } from '@/lib/utils';

interface MethodConfig {
  key: keyof CompressionOptions;
  label: string;
  description: string;
  icon: string;
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
];

interface CompressionMethodsProps {
  options: CompressionOptions;
  onChange: (options: CompressionOptions) => void;
  disabled?: boolean;
  /** Individual method savings (shown after analysis) */
  methodResults?: MethodResult[];
}

export const CompressionMethods = ({
  options,
  onChange,
  disabled = false,
  methodResults,
}: CompressionMethodsProps) => {
  const toggleMethod = (key: keyof CompressionOptions) => {
    if (disabled) return;
    onChange({
      ...options,
      [key]: !options[key],
    });
  };

  const getMethodResult = (key: keyof CompressionOptions): MethodResult | undefined => {
    return methodResults?.find(r => r.key === key);
  };

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-700 mb-3">
        Compression Methods
      </h2>
      
      <div className="space-y-2">
        {METHODS.map((method) => {
          const isEnabled = options[method.key];
          const result = getMethodResult(method.key);
          
          return (
            <button
              key={method.key}
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
              `}
              role="switch"
              aria-checked={isEnabled}
              aria-label={`${method.label}: ${isEnabled ? 'enabled' : 'disabled'}`}
            >
              {/* Icon */}
              <span className="text-xl flex-shrink-0" aria-hidden="true">
                {method.icon}
              </span>
              
              {/* Text content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`font-medium text-sm ${isEnabled ? 'text-blue-900' : 'text-gray-700'}`}>
                    {method.label}
                  </span>
                  
                  {/* Savings badge */}
                  {result && result.savedBytes > 0 && (
                    <span className={`
                      text-xs px-1.5 py-0.5 rounded-full font-medium
                      ${isEnabled 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-gray-200 text-gray-500'
                      }
                    `}>
                      -{formatBytes(result.savedBytes)}
                    </span>
                  )}
                  
                  {result && result.savedBytes <= 0 && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400">
                      ~0
                    </span>
                  )}
                </div>
                <div
                  className={`
                    text-xs max-h-0 overflow-hidden opacity-0 transition-all duration-150
                    group-hover:max-h-24 group-hover:opacity-100 group-hover:overflow-visible
                    group-focus-visible:max-h-24 group-focus-visible:opacity-100 group-focus-visible:overflow-visible
                    ${isEnabled ? 'text-blue-700' : 'text-gray-500'}
                  `}
                >
                  {method.description}
                </div>
              </div>
              
              {/* Toggle indicator */}
              <div
                className={`
                  w-10 h-6 rounded-full p-1 transition-colors duration-200 flex-shrink-0
                  ${isEnabled ? 'bg-blue-500' : 'bg-gray-300'}
                `}
                aria-hidden="true"
              >
                <div
                  className={`
                    w-4 h-4 rounded-full bg-white shadow-sm
                    transition-transform duration-200
                    ${isEnabled ? 'translate-x-4' : 'translate-x-0'}
                  `}
                />
              </div>
            </button>
          );
        })}
      </div>
      
      {/* Warning if all methods disabled */}
      {!Object.values(options).some(Boolean) && (
        <p className="mt-3 text-xs text-amber-600 flex items-center gap-1">
          <span aria-hidden="true">⚠️</span>
          No compression methods selected
        </p>
      )}
    </div>
  );
};
