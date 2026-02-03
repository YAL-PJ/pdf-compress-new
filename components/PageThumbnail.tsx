'use client';

import { useEffect, useState, useRef } from 'react';
import { renderPageToImage } from '@/lib/pdf-renderer';
import { Loader2, Trash2, RotateCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { twMerge } from 'tailwind-merge';

interface PageThumbnailProps {
    file: File;
    pageIndex: number; // 1-based index
    onToggleDelete: (index: number) => void;
    onRotate?: (index: number) => void;
    isDeleted?: boolean;
    rotation?: number; // 0, 90, 180, 270
}

export const PageThumbnail = ({
    file,
    pageIndex,
    onToggleDelete,
    onRotate,
    isDeleted = false,
    rotation = 0
}: PageThumbnailProps) => {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const isMounted = useRef(true);

    useEffect(() => {
        isMounted.current = true;

        const loadThumbnail = async () => {
            try {
                // Use lower scale for thumbnails to save memory
                const url = await renderPageToImage(file, pageIndex, 0.5);
                if (isMounted.current) {
                    setImageUrl(url);
                    setIsLoading(false);
                }
            } catch (err) {
                console.error(`Failed to generate thumbnail for page ${pageIndex}`, err);
                if (isMounted.current) setIsLoading(false);
            }
        };

        // Simple Intersection Observer to lazy load?
        // For now, simpler: just load. Optimizations can be added if performance lags.
        loadThumbnail();

        return () => {
            isMounted.current = false;
            if (imageUrl) URL.revokeObjectURL(imageUrl);
        };
    }, [file, pageIndex]);

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className={twMerge(
                "relative group aspect-[3/4] rounded-lg shadow-sm border transition-all duration-200 overflow-hidden",
                isDeleted
                    ? "border-red-200 bg-red-50 opacity-60 grayscale"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-md"
            )}
        >
            {/* Loading State */}
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
                </div>
            )}

            {/* Image */}
            {imageUrl && !isLoading && (
                <img
                    src={imageUrl}
                    alt={`Page ${pageIndex}`}
                    className={twMerge(
                        "w-full h-full object-contain transition-transform duration-300",
                        rotation > 0 && `rotate-${rotation}` // Tailwind needs safelist or inline style for dynamic values
                    )}
                    style={{ transform: `rotate(${rotation}deg)` }}
                />
            )}

            {/* Page Number Badge */}
            <div className="absolute bottom-2 left-2 bg-slate-900/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded backdrop-blur-sm">
                {pageIndex}
            </div>

            {/* Deleted Overlay */}
            {isDeleted && (
                <div className="absolute inset-0 flex items-center justify-center bg-red-50/50 backdrop-blur-[1px]">
                    <div className="bg-red-100 text-red-600 rounded-full p-2 border border-red-200">
                        <Trash2 className="w-5 h-5" />
                    </div>
                </div>
            )}

            {/* Hover Actions */}
            <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/10 transition-colors flex items-start justify-end p-2 opacity-0 group-hover:opacity-100">
                <div className="flex flex-col gap-2">
                    <button
                        onClick={() => onToggleDelete(pageIndex)}
                        className={twMerge(
                            "p-1.5 rounded-full shadow-sm transition-all hover:scale-110 active:scale-95",
                            isDeleted
                                ? "bg-slate-700 text-white hover:bg-slate-600" // Restore button
                                : "bg-white text-red-500 hover:text-red-600"   // Delete button
                        )}
                        title={isDeleted ? "Restore page" : "Delete page"}
                    >
                        {isDeleted ? <RotateCw className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                    </button>

                    {onRotate && !isDeleted && (
                        <button
                            onClick={() => onRotate(pageIndex)}
                            className="p-1.5 bg-white text-slate-700 rounded-full shadow-sm hover:text-blue-600 hover:scale-110 active:scale-95 transition-all"
                            title="Rotate 90°"
                        >
                            <RotateCw className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>
        </motion.div>
    );
};
