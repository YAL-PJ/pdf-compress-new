'use client';

interface ProcessingIndicatorProps {
  fileName: string;
  progress: string;
  progressPercent?: number;  // NEW - for progress bar
}

export const ProcessingIndicator = ({ 
  fileName, 
  progress,
  progressPercent,
}: ProcessingIndicatorProps) => {
  const showProgressBar = progressPercent !== undefined && progressPercent >= 0;

  return (
    <div 
      className="bg-white rounded-xl p-12 text-center"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="relative w-16 h-16 mx-auto mb-6">
        <div className="absolute inset-0 border-4 border-blue-100 rounded-full" />
        <div className="absolute inset-0 border-4 border-transparent border-t-blue-600 rounded-full animate-spin" />
      </div>

      <p className="text-gray-800 font-medium mb-2">{progress}</p>

      {/* Progress bar - NEW */}
      {showProgressBar && (
        <div className="w-full max-w-xs mx-auto mb-4">
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-600 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
              role="progressbar"
              aria-valuenow={progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">{progressPercent}%</p>
        </div>
      )}
      
      {fileName && (
        <p className="text-gray-500 text-sm truncate max-w-xs mx-auto">{fileName}</p>
      )}
    </div>
  );
};
