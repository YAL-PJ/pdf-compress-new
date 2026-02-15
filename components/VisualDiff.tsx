'use client';

import { useState, useRef, useCallback, useLayoutEffect } from 'react';
import { GripVertical, ChevronLeft, ChevronRight } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

interface VisualDiffProps {
  originalImageSrc: string;
  compressedImageSrc: string;
  className?: string;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export const VisualDiff = ({
  originalImageSrc,
  compressedImageSrc,
  className,
  currentPage,
  totalPages,
  onPageChange,
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
     PAGE NAVIGATION
  ========================= */
  const goToPrevPage = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  }, [currentPage, onPageChange]);

  const goToNextPage = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  }, [currentPage, totalPages, onPageChange]);

  /* =========================
     RENDER
  ========================= */
  return (
    <div className="space-y-2">
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

        {/* LEFT ARROW */}
        {totalPages > 1 && (
          <button
            onClick={goToPrevPage}
            disabled={currentPage <= 1}
            className={twMerge(
              'absolute left-2 top-1/2 -translate-y-1/2 z-30 w-8 h-8 rounded-full bg-white/90 shadow-md flex items-center justify-center transition-all',
              currentPage <= 1
                ? 'opacity-30 cursor-not-allowed'
                : 'opacity-0 group-hover:opacity-100 hover:bg-white hover:scale-110 cursor-pointer'
            )}
            onMouseDown={(e) => e.stopPropagation()}
            aria-label="Previous page"
          >
            <ChevronLeft className="w-5 h-5 text-slate-700" />
          </button>
        )}

        {/* RIGHT ARROW */}
        {totalPages > 1 && (
          <button
            onClick={goToNextPage}
            disabled={currentPage >= totalPages}
            className={twMerge(
              'absolute right-2 top-1/2 -translate-y-1/2 z-30 w-8 h-8 rounded-full bg-white/90 shadow-md flex items-center justify-center transition-all',
              currentPage >= totalPages
                ? 'opacity-30 cursor-not-allowed'
                : 'opacity-0 group-hover:opacity-100 hover:bg-white hover:scale-110 cursor-pointer'
            )}
            onMouseDown={(e) => e.stopPropagation()}
            aria-label="Next page"
          >
            <ChevronRight className="w-5 h-5 text-slate-700" />
          </button>
        )}

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

      {/* PAGE INDICATOR BAR */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={(e) => goToPrevPage(e)}
            disabled={currentPage <= 1}
            className={twMerge(
              'p-1 rounded hover:bg-slate-100 transition-colors',
              currentPage <= 1 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-500 hover:text-slate-700'
            )}
            aria-label="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1 px-2">
            {totalPages <= 10 ? (
              // Show individual page dots for <= 10 pages
              Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={(e) => {
                    e.stopPropagation();
                    onPageChange(page);
                  }}
                  className={twMerge(
                    'w-2 h-2 rounded-full transition-all',
                    page === currentPage
                      ? 'bg-slate-800 scale-125'
                      : 'bg-slate-300 hover:bg-slate-400'
                  )}
                  aria-label={`Go to page ${page}`}
                  aria-current={page === currentPage ? 'true' : undefined}
                />
              ))
            ) : (
              // Show page number for > 10 pages
              <span className="text-xs font-medium text-slate-600 tabular-nums">
                Page {currentPage} of {totalPages}
              </span>
            )}
          </div>

          <button
            onClick={(e) => goToNextPage(e)}
            disabled={currentPage >= totalPages}
            className={twMerge(
              'p-1 rounded hover:bg-slate-100 transition-colors',
              currentPage >= totalPages ? 'text-slate-300 cursor-not-allowed' : 'text-slate-500 hover:text-slate-700'
            )}
            aria-label="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
