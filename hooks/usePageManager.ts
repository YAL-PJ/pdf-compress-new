
import { useState, useCallback, useEffect, useRef } from 'react';

export interface PageState {
    index: number; // 1-based original index
    isDeleted: boolean;
    rotation: number; // 0, 90, 180, 270
}

// Helper to create initial page state array
const createInitialPages = (count: number): PageState[] =>
    Array.from({ length: count }, (_, i) => ({
        index: i + 1,
        isDeleted: false,
        rotation: 0,
    }));

export const usePageManager = (initialPageCount: number) => {
    const [pages, setPages] = useState<PageState[]>(() => createInitialPages(initialPageCount));
    const isFirstRender = useRef(true);

    // Reset pages when initialPageCount changes (new file loaded)
    // This effect intentionally sets state to sync with prop changes - this is a valid pattern
    // for "derived state that needs to be editable" use case (see React docs on controlling state)
    useEffect(() => {
        // Skip the first render since state is already initialized
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional prop-to-state sync
        setPages(createInitialPages(initialPageCount));
    }, [initialPageCount]);

    const toggleDelete = useCallback((pageIndex: number) => {
        setPages(prev => prev.map(p =>
            p.index === pageIndex ? { ...p, isDeleted: !p.isDeleted } : p
        ));
    }, []);

    const rotatePage = useCallback((pageIndex: number) => {
        setPages(prev => prev.map(p =>
            p.index === pageIndex ? { ...p, rotation: (p.rotation + 90) % 360 } : p
        ));
    }, []);

    // Reorder pages: move page from one position to another
    const reorderPages = useCallback((fromPosition: number, toPosition: number) => {
        if (fromPosition === toPosition) return;

        setPages(prev => {
            const newPages = [...prev];
            const [movedPage] = newPages.splice(fromPosition, 1);
            newPages.splice(toPosition, 0, movedPage);
            return newPages;
        });
    }, []);

    // Move page up/down by one position (for keyboard navigation)
    const movePage = useCallback((pageIndex: number, direction: 'up' | 'down') => {
        setPages(prev => {
            const currentPosition = prev.findIndex(p => p.index === pageIndex);
            if (currentPosition === -1) return prev;

            const newPosition = direction === 'up'
                ? Math.max(0, currentPosition - 1)
                : Math.min(prev.length - 1, currentPosition + 1);

            if (currentPosition === newPosition) return prev;

            const newPages = [...prev];
            const [movedPage] = newPages.splice(currentPosition, 1);
            newPages.splice(newPosition, 0, movedPage);
            return newPages;
        });
    }, []);

    const activePages = pages.filter(p => !p.isDeleted);

    return {
        pages,
        activePages,
        toggleDelete,
        rotatePage,
        reorderPages,
        movePage,
    };
};
