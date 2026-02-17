'use client';

import { useState, useCallback, useRef, KeyboardEvent } from 'react';
import { PageThumbnail } from './PageThumbnail';
import { usePageManager, PageState } from '@/hooks/usePageManager';
import { estimatePageSizes } from '@/lib/page-operations';
import { LayoutGrid, GripVertical, ChevronDown, ChevronUp, Calculator, Loader2 } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

interface PageGridProps {
    file: File;
    pageCount: number;
    className?: string;
    // Optional: accept external state (for lifted state pattern)
    pages?: PageState[];
    onToggleDelete?: (pageIndex: number) => void;
    onToggleKeepOriginal?: (pageIndex: number) => void;
    onRotate?: (pageIndex: number) => void;
    onReorder?: (fromPosition: number, toPosition: number) => void;
    onMovePage?: (pageIndex: number, direction: 'up' | 'down') => void;
    // Page preview selection
    selectedPreviewPage?: number;
    onSelectPreviewPage?: (pageIndex: number) => void;
    // Compressed PDF blob for savings estimation
    compressedBlob?: Blob;
}

export const PageGrid = ({
    file,
    pageCount,
    className,
    pages: externalPages,
    onToggleDelete: externalToggleDelete,
    onToggleKeepOriginal: externalToggleKeepOriginal,
    onRotate: externalRotate,
    onReorder: externalReorder,
    onMovePage: externalMovePage,
    selectedPreviewPage,
    onSelectPreviewPage,
    compressedBlob,
}: PageGridProps) => {
    const PREVIEW_LIMIT = 8;

    // Use internal state if external state not provided
    const internal = usePageManager(pageCount);

    // Use external state if provided, otherwise use internal
    const pages = externalPages ?? internal.pages;

    // Preview collapse state
    const [showAll, setShowAll] = useState(false);

    // Savings calculator state
    const [pageSizes, setPageSizes] = useState<Map<number, number> | null>(null);
    const [isCalculating, setIsCalculating] = useState(false);
    const [calcError, setCalcError] = useState(false);

    // Reset savings when blob changes (recompression)
    const prevBlobRef = useRef<Blob | undefined>(undefined);
    if (compressedBlob !== prevBlobRef.current) {
        prevBlobRef.current = compressedBlob;
        if (pageSizes) {
            setPageSizes(null);
            setCalcError(false);
        }
    }

    const handleCalculateSavings = useCallback(async () => {
        if (!compressedBlob || isCalculating) return;
        setIsCalculating(true);
        setCalcError(false);
        try {
            const sizes = await estimatePageSizes(compressedBlob);
            setPageSizes(sizes);
        } catch (err) {
            console.error('Failed to estimate page sizes:', err);
            setCalcError(true);
        } finally {
            setIsCalculating(false);
        }
    }, [compressedBlob, isCalculating]);
    const hasMorePages = pages.length > PREVIEW_LIMIT;
    const visiblePages = showAll || !hasMorePages ? pages : pages.slice(0, PREVIEW_LIMIT);
    const toggleDelete = externalToggleDelete ?? internal.toggleDelete;
    const toggleKeepOriginal = externalToggleKeepOriginal ?? internal.toggleKeepOriginal;
    const rotatePage = externalRotate ?? internal.rotatePage;
    const reorderPages = externalReorder ?? internal.reorderPages;
    const movePage = externalMovePage ?? internal.movePage;

    // Drag state
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
    const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
    const gridRef = useRef<HTMLDivElement>(null);

    // Handle drag start
    const handleDragStart = useCallback((e: React.DragEvent, position: number) => {
        setDraggedIndex(position);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(position));

        // Add a slight delay to show the drag preview
        if (e.currentTarget instanceof HTMLElement) {
            e.currentTarget.style.opacity = '0.5';
        }
    }, []);

    // Handle drag end
    const handleDragEnd = useCallback((e: React.DragEvent) => {
        setDraggedIndex(null);
        setDropTargetIndex(null);

        if (e.currentTarget instanceof HTMLElement) {
            e.currentTarget.style.opacity = '1';
        }
    }, []);

    // Handle drag over
    const handleDragOver = useCallback((e: React.DragEvent, position: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        if (draggedIndex !== null && draggedIndex !== position) {
            setDropTargetIndex(position);
        }
    }, [draggedIndex]);

    // Handle drag leave
    const handleDragLeave = useCallback(() => {
        setDropTargetIndex(null);
    }, []);

    // Handle drop
    const handleDrop = useCallback((e: React.DragEvent, toPosition: number) => {
        e.preventDefault();

        const fromPosition = parseInt(e.dataTransfer.getData('text/plain'), 10);

        if (!isNaN(fromPosition) && fromPosition !== toPosition) {
            reorderPages(fromPosition, toPosition);
        }

        setDraggedIndex(null);
        setDropTargetIndex(null);
    }, [reorderPages]);

    // Focus management helper
    const focusItemAtPosition = useCallback((targetPosition: number) => {
        setFocusedIndex(targetPosition);
        const grid = gridRef.current;
        if (grid) {
            const items = grid.querySelectorAll('[data-page-item]');
            const item = items[targetPosition] as HTMLElement | undefined;
            item?.focus();
        }
    }, []);

    // Keyboard navigation for reordering
    const handleKeyDown = useCallback((e: KeyboardEvent, position: number, pageIndex: number) => {
        switch (e.key) {
            case 'ArrowLeft':
            case 'ArrowUp':
                e.preventDefault();
                if (e.shiftKey || e.ctrlKey || e.metaKey) {
                    // Move page up in order
                    movePage(pageIndex, 'up');
                } else {
                    // Navigate focus to previous item
                    const prevIndex = Math.max(0, position - 1);
                    focusItemAtPosition(prevIndex);
                }
                break;
            case 'ArrowRight':
            case 'ArrowDown':
                e.preventDefault();
                if (e.shiftKey || e.ctrlKey || e.metaKey) {
                    // Move page down in order
                    movePage(pageIndex, 'down');
                } else {
                    // Navigate focus to next item
                    const nextIndex = Math.min(pages.length - 1, position + 1);
                    focusItemAtPosition(nextIndex);
                }
                break;
            case 'Home':
                e.preventDefault();
                focusItemAtPosition(0);
                break;
            case 'End':
                e.preventDefault();
                focusItemAtPosition(pages.length - 1);
                break;
            case 'Delete':
            case 'Backspace':
                e.preventDefault();
                toggleDelete(pageIndex);
                break;
            case 'r':
            case 'R':
                e.preventDefault();
                rotatePage(pageIndex);
                break;
        }
    }, [movePage, pages.length, toggleDelete, rotatePage, focusItemAtPosition]);

    return (
        <div className={className}>
            <div className="flex items-center gap-2 mb-4 text-slate-700 font-medium flex-wrap">
                <LayoutGrid className="w-5 h-5" />
                <h3>Page Manager</h3>
                <span className="text-sm text-slate-600 font-normal ml-auto flex items-center gap-2">
                    {pages.filter(p => !p.isDeleted).length} of {pageCount} pages selected
                    {compressedBlob && (
                        <button
                            onClick={handleCalculateSavings}
                            disabled={isCalculating}
                            className={twMerge(
                                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all",
                                pageSizes
                                    ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                                    : "bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 hover:border-blue-300",
                                isCalculating && "opacity-70 cursor-wait"
                            )}
                            title={pageSizes ? "Savings calculated — delete large pages to reduce file size" : "Estimate how much each page contributes to file size"}
                        >
                            {isCalculating ? (
                                <>
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    Calculating...
                                </>
                            ) : pageSizes ? (
                                <>
                                    <Calculator className="w-3 h-3" />
                                    Savings Shown
                                </>
                            ) : (
                                <>
                                    <Calculator className="w-3 h-3" />
                                    Calculate Savings
                                </>
                            )}
                        </button>
                    )}
                </span>
            </div>
            {calcError && (
                <p className="text-xs text-red-500 mb-3">Failed to calculate page sizes. Please try again.</p>
            )}

            {/* Instructions */}
            <p className="text-xs text-slate-500 mb-3">
                Click a page to preview it • Drag to reorder • <kbd className="px-1 py-0.5 bg-slate-100 rounded text-[10px]">Shift</kbd>+<kbd className="px-1 py-0.5 bg-slate-100 rounded text-[10px]">Arrow</kbd> to move • <kbd className="px-1 py-0.5 bg-slate-100 rounded text-[10px]">R</kbd> to rotate • <kbd className="px-1 py-0.5 bg-slate-100 rounded text-[10px]">Del</kbd> to toggle delete
            </p>

            <div
                ref={gridRef}
                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4"
                role="listbox"
                aria-label="PDF pages"
            >
                {visiblePages.map((page, position) => (
                    <div
                        key={page.index}
                        data-page-item
                        tabIndex={focusedIndex === position ? 0 : -1}
                        role="option"
                        aria-selected={focusedIndex === position}
                        aria-label={`Page ${page.index}${page.isDeleted ? ', marked for deletion' : ''}${page.keepOriginal ? ', keeping original' : ''}${page.rotation > 0 ? `, rotated ${page.rotation} degrees` : ''}`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, position)}
                        onDragEnd={handleDragEnd}
                        onDragOver={(e) => handleDragOver(e, position)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, position)}
                        onKeyDown={(e) => handleKeyDown(e, position, page.index)}
                        onFocus={() => setFocusedIndex(position)}
                        className={twMerge(
                            "relative cursor-grab active:cursor-grabbing outline-none rounded-lg transition-all duration-200",
                            draggedIndex === position && "opacity-50 scale-95",
                            dropTargetIndex === position && "ring-2 ring-blue-500 ring-offset-2",
                            focusedIndex === position && "ring-2 ring-slate-400 ring-offset-1"
                        )}
                    >
                        {/* Drag handle indicator */}
                        <div className="absolute top-1 left-1 z-10 p-1 rounded bg-slate-900/90 text-white opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity">
                            <GripVertical className="w-3 h-3" />
                        </div>

                        {/* Drop indicator line */}
                        {dropTargetIndex === position && draggedIndex !== null && (
                            <div className={twMerge(
                                "absolute z-20 bg-blue-500 rounded-full",
                                draggedIndex < position
                                    ? "right-0 top-0 bottom-0 w-1 translate-x-2"
                                    : "left-0 top-0 bottom-0 w-1 -translate-x-2"
                            )} />
                        )}

                        <div
                            onClick={() => onSelectPreviewPage?.(page.index)}
                            className={twMerge(
                                "relative",
                                onSelectPreviewPage && "cursor-pointer",
                                selectedPreviewPage === page.index && "ring-2 ring-emerald-500 ring-offset-1 rounded-lg"
                            )}
                        >
                            <PageThumbnail
                                file={file}
                                pageIndex={page.index}
                                isDeleted={page.isDeleted}
                                keepOriginal={page.keepOriginal}
                                rotation={page.rotation}
                                onToggleDelete={toggleDelete}
                                onToggleKeepOriginal={toggleKeepOriginal}
                                onRotate={rotatePage}
                                estimatedSize={pageSizes?.get(page.index)}
                            />
                            {selectedPreviewPage === page.index && (
                                <div className="absolute -top-1 -left-1 bg-emerald-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full z-10 shadow-sm">
                                    Preview
                                </div>
                            )}
                        </div>

                        {/* Position indicator */}
                        <div className="absolute top-1 right-1 bg-slate-900/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded backdrop-blur-sm">
                            #{position + 1}
                        </div>
                    </div>
                ))}
            </div>

            {hasMorePages && (
                <button
                    onClick={() => setShowAll(prev => !prev)}
                    className="mt-4 w-full py-2.5 flex items-center justify-center gap-2 text-sm font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
                >
                    {showAll ? (
                        <>
                            <ChevronUp className="w-4 h-4" />
                            Show fewer pages
                        </>
                    ) : (
                        <>
                            <ChevronDown className="w-4 h-4" />
                            Show all {pages.length} pages ({pages.length - PREVIEW_LIMIT} more)
                        </>
                    )}
                </button>
            )}
        </div>
    );
};
