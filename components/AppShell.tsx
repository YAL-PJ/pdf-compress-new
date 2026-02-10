'use client';

import { ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { FileProvider, useFile } from '@/context/FileContext';

// Lazy load the heavy app view
const PdfApp = dynamic(() => import('@/components/PdfApp').then(m => m.PdfApp), {
    ssr: false, // App view is client-interaction heavy, no need for server HTML
    loading: () => (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
        </div>
    )
});

// Inner component that consumes context
const AppContent = ({ children }: { children: ReactNode }) => {
    const { file, setFile } = useFile();

    if (file) {
        return (
            <PdfApp
                initialFile={file}
                onReset={() => setFile(null)}
            />
        );
    }

    return <>{children}</>;
};

// Main Export -> Wraps content in provider
export const AppShell = ({ children }: { children: ReactNode }) => {
    return (
        <FileProvider>
            <AppContent>{children}</AppContent>
        </FileProvider>
    );
};
