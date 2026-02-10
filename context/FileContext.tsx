'use client';

import { createContext, useContext, useState, useMemo, ReactNode } from 'react';

interface FileContextType {
    file: File | null;
    setFile: (file: File | null) => void;
}

const FileContext = createContext<FileContextType | null>(null);

export const useFile = () => {
    const context = useContext(FileContext);
    if (!context) {
        throw new Error('useFile must be used within a FileProvider');
    }
    return context;
};

export const FileProvider = ({ children }: { children: ReactNode }) => {
    const [file, setFile] = useState<File | null>(null);

    // Memoize to prevent unnecessary re-renders of all consumers
    // setFile from useState is stable, so file is the only real dependency
    const value = useMemo(() => ({ file, setFile }), [file]);

    return (
        <FileContext.Provider value={value}>
            {children}
        </FileContext.Provider>
    );
};
