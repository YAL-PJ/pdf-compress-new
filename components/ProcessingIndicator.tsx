'use client';

interface ProcessingIndicatorProps {
  fileName: string;
  progress: string;
}

export const ProcessingIndicator = ({ 
  fileName, 
  progress 
}: ProcessingIndicatorProps) => {
  return (
    <div 
      className="bg-white rounded-xl p-12 text-center"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {/* Animated spinner */}
      <div className="relative w-16 h-16 mx-auto mb-6">
        <div className="absolute inset-0 border-4 border-blue-100 rounded-full" />
        <div className="absolute inset-0 border-4 border-transparent border-t-blue-600 rounded-full animate-spin" />
      </div>

      <p className="text-gray-800 font-medium mb-2">
        {progress}
      </p>
      
      <p className="text-gray-500 text-sm truncate max-w-xs mx-auto">
        {fileName}
      </p>
    </div>
  );
};
