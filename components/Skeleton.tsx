'use client';

import { twMerge } from 'tailwind-merge';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'none';
}

/**
 * Skeleton loading component for better perceived performance.
 * Displays placeholder content while actual content is loading.
 */
export const Skeleton = ({
  className,
  variant = 'text',
  width,
  height,
  animation = 'pulse',
}: SkeletonProps) => {
  const baseClasses = 'bg-slate-200';

  const variantClasses = {
    text: 'rounded h-4 w-full',
    circular: 'rounded-full',
    rectangular: 'rounded-none',
    rounded: 'rounded-lg',
  };

  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/90 before:to-transparent',
    none: '',
  };

  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      className={twMerge(
        baseClasses,
        variantClasses[variant],
        animationClasses[animation],
        className
      )}
      style={style}
      aria-hidden="true"
      role="presentation"
    />
  );
};

/**
 * Pre-built skeleton for upload zone area
 */
export const UploadZoneSkeleton = () => (
  <div className="w-full aspect-[2/1] min-h-[350px] rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 animate-pulse flex flex-col items-center justify-center gap-6 p-8">
    <Skeleton variant="rounded" width={64} height={64} />
    <div className="space-y-2 w-48">
      <Skeleton variant="text" className="h-6 mx-auto" />
      <Skeleton variant="text" className="h-4 w-3/4 mx-auto" />
    </div>
    <Skeleton variant="rounded" width={150} height={32} />
  </div>
);

/**
 * Pre-built skeleton for page thumbnails
 */
export const PageThumbnailSkeleton = () => (
  <div className="aspect-[3/4] rounded-lg bg-slate-100 animate-pulse relative">
    <div className="absolute inset-0 flex items-center justify-center">
      <Skeleton variant="rectangular" className="w-full h-full" />
    </div>
    <div className="absolute top-1 right-1">
      <Skeleton variant="rounded" width={28} height={20} />
    </div>
  </div>
);

/**
 * Pre-built skeleton for page grid
 */
export const PageGridSkeleton = ({ count = 6 }: { count?: number }) => (
  <div className="space-y-4">
    <div className="flex items-center gap-2">
      <Skeleton variant="rounded" width={20} height={20} />
      <Skeleton variant="text" width={120} height={20} />
    </div>
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <PageThumbnailSkeleton key={i} />
      ))}
    </div>
  </div>
);

/**
 * Pre-built skeleton for compression methods panel
 */
export const CompressionMethodsSkeleton = () => (
  <div className="bg-white border rounded-lg p-4 space-y-4">
    <Skeleton variant="text" width={180} height={24} />
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton variant="rounded" width={40} height={24} />
          <Skeleton variant="text" className="flex-1" height={16} />
        </div>
      ))}
    </div>
  </div>
);

/**
 * Pre-built skeleton for results display
 */
export const ResultsDisplaySkeleton = () => (
  <div className="bg-white border rounded-lg p-6 space-y-6">
    <div className="flex items-center justify-between">
      <div className="space-y-2">
        <Skeleton variant="text" width={200} height={28} />
        <Skeleton variant="text" width={150} height={16} />
      </div>
      <Skeleton variant="rounded" width={120} height={44} />
    </div>
    <div className="grid grid-cols-3 gap-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="p-4 bg-slate-50 rounded-lg">
          <Skeleton variant="text" width="60%" height={14} className="mb-2" />
          <Skeleton variant="text" width="80%" height={24} />
        </div>
      ))}
    </div>
    <PageGridSkeleton count={4} />
  </div>
);
