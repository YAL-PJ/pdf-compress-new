'use client';

import { useCallback, useState, useId } from 'react';
import { motion } from 'framer-motion';
import { FileUp, File, ArrowUp } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

interface UploadZoneProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
}

export const UploadZone = ({ onFileSelect, disabled = false }: UploadZoneProps) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputId = useId();

  const handleFile = useCallback(
    (file: File | undefined) => {
      if (file && !disabled) {
        onFileSelect(file);
      }
    },
    [disabled, onFileSelect]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) {
        setIsDragOver(true);
      }
    },
    [disabled]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      handleFile(e.dataTransfer.files[0]);
    },
    [handleFile]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFile(e.target.files?.[0]);
      e.target.value = '';
    },
    [handleFile]
  );

  return (
    <div className="w-full">
      <motion.label
        layout
        htmlFor={inputId}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ scale: disabled ? 1 : 1.005 }}
        whileTap={{ scale: disabled ? 1 : 0.99 }}
        className={twMerge(
          "relative group cursor-pointer flex flex-col items-center justify-center",
          "w-full aspect-[2/1] min-h-[350px] rounded-lg", // Sharper radius (lg = 0.5rem or 0.375 from globals)
          "border-2 border-dashed transition-all duration-200",
          disabled
            ? "border-slate-200 bg-slate-50 cursor-not-allowed opacity-60"
            : isDragOver
              ? "border-slate-900 bg-slate-50 scale-[1.01]" // High contrast active state
              : "border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50/50"
        )}
      >
        <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)] -z-10" />

        <input
          id={inputId}
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleInputChange}
          disabled={disabled}
          className="sr-only"
        />

        <div className="flex flex-col items-center gap-6 p-8 text-center">
          <motion.div
            animate={isDragOver ? { y: -5 } : { y: 0 }}
            className={twMerge(
              "w-16 h-16 rounded-lg flex items-center justify-center transition-colors duration-200 border",
              isDragOver
                ? "bg-slate-900 border-slate-900 text-white"
                : "bg-white border-slate-200 text-slate-700 group-hover:border-slate-300 group-hover:shadow-sm"
            )}
          >
            {isDragOver ? <ArrowUp className="w-8 h-8" /> : <FileUp className="w-8 h-8" />}
          </motion.div>

          <div className="space-y-2">
            <h3 className="text-xl font-bold text-slate-900 tracking-tight">
              {isDragOver ? "Drop file to upload" : "Upload PDF"}
            </h3>
            <p className="text-slate-500 max-w-xs mx-auto text-sm">
              <span className="font-semibold text-slate-700">Click to browse</span> or drag and drop your file here
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-50/80 px-3 py-1.5 rounded border border-slate-100">
            <File className="w-3.5 h-3.5" />
            <span>PDF ONLY</span>
            <span className="text-slate-300">|</span>
            <span>MAX 50MB</span>
          </div>
        </div>

        {/* Technical Corner Markers - Replacing soft accents */}
        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-slate-200 m-2 transition-colors group-hover:border-slate-400" />
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-slate-200 m-2 transition-colors group-hover:border-slate-400" />
        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-slate-200 m-2 transition-colors group-hover:border-slate-400" />
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-slate-200 m-2 transition-colors group-hover:border-slate-400" />

      </motion.label>
    </div>
  );
};
