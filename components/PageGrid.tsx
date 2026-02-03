'use client';

import { PageThumbnail } from './PageThumbnail';
import { usePageManager } from '@/hooks/usePageManager';
import { LayoutGrid } from 'lucide-react';

interface PageGridProps {
    file: File;
    pageCount: number;
    className?: string;
}

export const PageGrid = ({ file, pageCount, className }: PageGridProps) => {
    const { pages, toggleDelete, rotatePage } = usePageManager(pageCount);

    return (
        <div className={className}>
            <div className="flex items-center gap-2 mb-4 text-slate-700 font-medium">
                <LayoutGrid className="w-5 h-5" />
                <h3>Page Manager</h3>
                <span className="text-sm text-slate-400 font-normal ml-auto">
                    {pages.filter(p => !p.isDeleted).length} of {pageCount} pages selected
                </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {pages.map((page) => (
                    <PageThumbnail
                        key={page.index}
                        file={file}
                        pageIndex={page.index}
                        isDeleted={page.isDeleted}
                        rotation={page.rotation}
                        onToggleDelete={toggleDelete}
                        onRotate={rotatePage}
                    />
                ))}
            </div>
        </div>
    );
};
