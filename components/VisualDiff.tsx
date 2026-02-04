'use client';

import { useState, useRef, useCallback, useLayoutEffect } from 'react';
import { GripVertical } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

interface VisualDiffProps {
  originalImageSrc: string;
  compressedImageSrc: string;
  className?: string;
}

export const VisualDiff = ({
  originalImageSrc,
  compressedImageSrc,
  className,
}: VisualDiffProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const [isResizing, setIsResizing] = useState(false);
  const [sliderPosition, setSliderPosition] = useState(50); // %
  const [containerSize, setContainerSize] = useState({
    width: 0,
    height: 0,
  });

  /* =========================
     SIZE TRACKING (BEST OF BOTH)
  ========================= */
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      setContainerSize({
        width: container.offsetWidth,
        height: container.offsetHeight,
      });
    };

    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  /* =========================
     SLIDER LOGIC
  ========================= */
  const updateSliderFromClientX = useCallback((clientX: number) => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const offsetX = clientX - rect.left;
    const percent = Math.max(0, Math.min(100, (offsetX / rect.width) * 100));
    setSliderPosition(percent);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => updateSliderFromClientX(e.clientX),
    [updateSliderFromClientX]
  );

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);

  const handleMouseDown = useCallback(() => {
    setIsResizing(true);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove, handleMouseUp]);

  // Click anywhere to jump slider
  const handleContainerClick = (e: React.MouseEvent) => {
    updateSliderFromClientX(e.clientX);
  };

  /* =========================
     RENDER
  ========================= */
  return (
    <div
      ref={containerRef}
      onMouseDown={handleContainerClick}
      className={twMerge(
        'relative w-full aspect-[4/3] sm:aspect-[16/10] bg-slate-100 rounded-lg overflow-hidden border border-slate-200 select-none group',
        className
      )}
    >
      {/* AFTER */}
      <img
        src={compressedImageSrc}
        alt="Compressed result"
        className="absolute inset-0 w-full h-full object-contain pointer-events-none"
      />
      <div className="absolute bottom-3 right-3 bg-slate-900/80 text-white text-[10px] font-bold px-2 py-1 rounded backdrop-blur-sm z-10 pointer-events-none">
        COMPRESSED
      </div>

      {/* BEFORE (CLIPPED) */}
      <div
        className="absolute inset-y-0 left-0 overflow-hidden border-r-2 border-slate-400 bg-slate-100"
        style={{ width: `${sliderPosition}%` }}
      >
        <img
          src={originalImageSrc}
          alt="Original source"
          className="absolute inset-0 object-contain max-w-none pointer-events-none"
          style={{
            width: containerSize.width || '100%',
            height: containerSize.height || '100%',
          }}
        />
        <div className="absolute bottom-3 left-3 bg-white/90 text-slate-900 text-[10px] font-bold px-2 py-1 rounded backdrop-blur-sm shadow-sm z-10 pointer-events-none">
          ORIGINAL
        </div>
      </div>

      {/* SLIDER HANDLE */}
      <div
        className="absolute inset-y-0 w-1 bg-white cursor-ew-resize z-20 group-hover:bg-emerald-400 transition-colors"
        style={{ left: `${sliderPosition}%` }}
        onMouseDown={(e) => {
          e.stopPropagation();
          handleMouseDown();
        }}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center cursor-ew-resize hover:scale-110 transition-transform">
          <GripVertical className="w-4 h-4 text-slate-600" />
        </div>
      </div>

      {/* HOVER HINT */}
      <div
        className={twMerge(
          'absolute top-4 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs px-2 py-1 rounded-full backdrop-blur transition-opacity pointer-events-none',
          isResizing ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'
        )}
      >
        Drag to compare
      </div>
    </div>
  );
};
