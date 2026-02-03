
import { useState, useCallback } from 'react';

export interface PageState {
    index: number; // 1-based original index
    isDeleted: boolean;
    rotation: number; // 0, 90, 180, 270
}

export const usePageManager = (initialPageCount: number) => {
    const [pages, setPages] = useState<PageState[]>(() =>
        Array.from({ length: initialPageCount }, (_, i) => ({
            index: i + 1,
            isDeleted: false,
            rotation: 0,
        }))
    );

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

    const activePages = pages.filter(p => !p.isDeleted);

    return {
        pages,
        activePages,
        toggleDelete,
        rotatePage,
    };
};
