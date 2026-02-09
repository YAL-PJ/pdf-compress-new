'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

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

    return (
        <FileContext.Provider value={{ file, setFile }}>
            {children}
        </FileContext.Provider>
    );
};
