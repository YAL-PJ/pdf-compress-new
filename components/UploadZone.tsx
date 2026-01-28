'use client';

import { useCallback, useState, useId } from 'react';

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
      // Reset input so same file can be selected again
      e.target.value = '';
    },
    [handleFile]
  );

  const baseStyles = `
    border-2 border-dashed rounded-xl p-12 text-center
    transition-all duration-200 ease-out
  `;

  const stateStyles = disabled
    ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-50'
    : isDragOver
    ? 'border-blue-500 bg-blue-50 scale-[1.02]'
    : 'border-gray-300 bg-white hover:border-blue-400 cursor-pointer';

  return (
    <label
      htmlFor={inputId}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`${baseStyles} ${stateStyles} block`}
    >
      <input
        id={inputId}
        type="file"
        accept=".pdf,application/pdf"
        onChange={handleInputChange}
        disabled={disabled}
        className="sr-only"
        aria-describedby={`${inputId}-description`}
      />
      
      <div className="text-4xl mb-4" aria-hidden="true">
        📄
      </div>
      
      <p className="text-gray-700 font-medium">
        Drop a PDF here or click to select
      </p>
      
      <p 
        id={`${inputId}-description`}
        className="text-gray-500 text-sm mt-2"
      >
        Your file never leaves your browser
      </p>
    </label>
  );
};

