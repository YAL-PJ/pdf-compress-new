'use client';

import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

interface ProcessingIndicatorProps {
  fileName: string;
  progress: string;
  progressPercent?: number;
}

export const ProcessingIndicator = ({
  fileName,
  progress,
  progressPercent,
}: ProcessingIndicatorProps) => {
  const showProgressBar = progressPercent !== undefined && progressPercent >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass-panel rounded-3xl p-12 text-center w-full max-w-lg mx-auto"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="relative mb-8 inline-block">
        <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
        <div className="relative bg-white p-4 rounded-2xl shadow-lg ring-1 ring-slate-100">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
        </div>
      </div>

      <h3 className="text-xl font-semibold text-slate-900 mb-2">
        {progress}
      </h3>

      {fileName && (
        <p className="text-slate-500 text-sm truncate max-w-xs mx-auto mb-8 font-medium">
          {fileName}
        </p>
      )}

      {/* Progress bar */}
      {showProgressBar && (
        <div className="w-full max-w-xs mx-auto space-y-2">
          <div className="h-3 bg-slate-100 rounded-full overflow-hidden ring-1 ring-slate-200/50">
            <motion.div
              className="h-full bg-primary rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ ease: "linear" }}
              role="progressbar"
              aria-valuenow={progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="w-full h-full opacity-30 bg-[length:10px_10px] bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)] animate-[progress-stripe_1s_linear_infinite]" />
            </motion.div>
          </div>
          <p className="text-xs font-semibold text-primary text-right">{progressPercent}%</p>
        </div>
      )}
    </motion.div>
  );
};
