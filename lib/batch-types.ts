
import { PdfError } from '@/lib/errors';
import { CompressionAnalysis } from '@/lib/types';

export type FileStatus = 'queued' | 'processing' | 'done' | 'error';

export interface BatchFileItem {
    id: string;
    originalFile: File;
    status: FileStatus;
    progress: number; // 0-100
    analysis?: CompressionAnalysis;
    error?: PdfError;
}
