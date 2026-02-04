'use client';

import { useState, useRef, useCallback, useLayoutEffect } from 'react';
import { GripVertical } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

interface VisualDiffProps {
    originalImageSrc: string;
    compressedImageSrc: string;
    className?: string;
}

export const VisualDiff = ({ originalImageSrc, compressedImageSrc, className }: VisualDiffProps) => {
    const [isResizing, setIsResizing] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const [sliderPosition, setSliderPosition] = useState(50); // %
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

    // Track container size in state to avoid ref access during render
    useLayoutEffect(() => {
        const updateSize = () => {
            if (containerRef.current) {
                setContainerSize({
                    width: containerRef.current.offsetWidth,
                    height: containerRef.current.offsetHeight,
                });
            }
        };

        updateSize();

        // Update on resize
        const resizeObserver = new ResizeObserver(updateSize);
        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }

        return () => resizeObserver.disconnect();
    }, []);

    const handleMouseMove = useCallback((e: React.MouseEvent | MouseEvent) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const offsetX = e.clientX - rect.left;
        const percent = Math.max(0, Math.min(100, (offsetX / rect.width) * 100));
        setSliderPosition(percent);
    }, []);

    const handleMouseDown = useCallback(() => {
        setIsResizing(true);

        const onMouseMove = (e: MouseEvent) => {
            if (!containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            const offsetX = e.clientX - rect.left;
            const percent = Math.max(0, Math.min(100, (offsetX / rect.width) * 100));
            setSliderPosition(percent);
        };

        const onMouseUp = () => {
            setIsResizing(false);
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }, []);

    // Allow clicking on the track to jump
    const handleContainerClick = (e: React.MouseEvent) => {
        handleMouseMove(e);
    };

    return (
        <div
            className={twMerge("relative w-full aspect-[4/3] sm:aspect-[16/10] bg-slate-100 rounded-lg overflow-hidden border border-slate-200 select-none group", className)}
            ref={containerRef}
            onMouseDown={handleContainerClick}
        >
            {/* Background: Compressed (After) */}
            <img
                src={compressedImageSrc}
                alt="Compressed result"
                className="absolute inset-0 w-full h-full object-contain pointer-events-none"
            />
            <div className="absolute bottom-3 right-3 bg-slate-900/80 text-white text-[10px] font-bold px-2 py-1 rounded backdrop-blur-sm z-10 pointer-events-none">
                COMPRESSED
            </div>

            {/* Foreground: Original (Before) - Clipped */}
            <div
                className="absolute inset-y-0 left-0 overflow-hidden border-r border-white/50 bg-slate-100"
                style={{ width: `${sliderPosition}%` }}
            >
                <img
                    src={originalImageSrc}
                    alt="Original source"
                    className="absolute inset-0 w-full h-full object-contain max-w-none pointer-events-none"
                    style={{
                        width: containerSize.width || '100%',
                        height: containerSize.height || '100%'
                    }}
                />
                <div className="absolute bottom-3 left-3 bg-white/90 text-slate-900 text-[10px] font-bold px-2 py-1 rounded backdrop-blur-sm shadow-sm z-10 pointer-events-none">
                    ORIGINAL
                </div>
            </div>

            {/* Slider Handle */}
            <div
                className="absolute inset-y-0 w-1 bg-white cursor-ew-resize z-20 group-hover:bg-emerald-400 transition-colors"
                style={{ left: `${sliderPosition}%` }}
                onMouseDown={(e) => {
                    e.stopPropagation();
                    handleMouseDown();
                }}
            >
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center cursor-ew-resize hover:scale-110 transition-transform">
                    <GripVertical className="w-4 h-4 text-slate-400" />
                </div>
            </div>

            {/* Hover hint */}
            <div className={twMerge(
                "absolute top-4 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs px-2 py-1 rounded-full backdrop-blur transition-opacity pointer-events-none",
                isResizing ? "opacity-0" : "opacity-0 group-hover:opacity-100"
            )}>
                Drag to compare
            </div>
        </div>
    );
};
