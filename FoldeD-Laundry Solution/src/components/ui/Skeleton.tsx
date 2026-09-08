import React from 'react';
import { cn } from '../../utils/cn';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular' | 'card';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'none';
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className,
  variant = 'text',
  width,
  height,
  animation = 'pulse',
  ...props
}) => {
  const baseStyles = 'bg-slate-200 dark:bg-slate-700 rounded overflow-hidden';
  
  const variantStyles = {
    text: 'h-4 rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-xl',
    card: 'rounded-2xl',
  };

  const animationStyles = {
    pulse: 'animate-pulse',
    wave: 'animate-[shimmer_1.5s_infinite]',
    none: '',
  };

  return (
    <div
      className={cn(
        baseStyles,
        variantStyles[variant],
        animationStyles[animation],
        className
      )}
      style={{
        width,
        height,
        ...props.style,
      } as React.CSSProperties}
      {...props}
    />
  );
};

// Pre-built skeleton components for common patterns
export const SkeletonText: React.FC<{
  lines?: number;
  className?: string;
  width?: string | number;
}> = ({ lines = 3, className, width }) => (
  <div className={cn('space-y-2', className)}>
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton
        key={i}
        variant="text"
        width={i === lines - 1 && width ? width : undefined}
        className={i === lines - 1 && width ? 'w-3/4' : undefined}
      />
    ))}
  </div>
);

export const SkeletonCard: React.FC<{
  className?: string;
  hasImage?: boolean;
  hasAction?: boolean;
}> = ({ className, hasImage = true, hasAction = true }) => (
  <div className={cn('bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 p-5 space-y-4 animate-pulse', className)}>
    {hasImage && (
      <Skeleton variant="rectangular" className="w-full h-40" />
    )}
    <SkeletonText lines={2} width="60%" />
    <div className="flex items-center justify-between pt-2">
      <Skeleton variant="text" width="40%" />
      {hasAction && <Skeleton variant="rectangular" width="80px" height="36px" />}
    </div>
  </div>
);

export const SkeletonServiceCard: React.FC<{
  className?: string;
}> = ({ className }) => (
  <div className={cn('p-5 rounded-2xl border border-slate-200/80 bg-white dark:bg-slate-800 dark:border-slate-700/80 animate-pulse space-y-4', className)}>
    <div className="flex items-start justify-between">
      <div className="flex items-center gap-3">
        <Skeleton variant="circular" width="40" height="40" />
        <div className="flex-1 space-y-1">
          <Skeleton variant="text" width="60%" />
          <Skeleton variant="text" width="80%" />
        </div>
      </div>
      <Skeleton variant="text" width="60px" height="24px" />
    </div>
    <Skeleton variant="text" width="100%" />
    <div className="flex items-center justify-between pt-2">
      <Skeleton variant="text" width="50%" />
      <Skeleton variant="text" width="80px" height="24px" />
    </div>
  </div>
);

export const SkeletonOrderCard: React.FC<{
  className?: string;
}> = ({ className }) => (
  <div className={cn('p-6 border border-slate-200/80 bg-white dark:bg-slate-800 dark:border-slate-700/80 rounded-2xl animate-pulse space-y-4', className)}>
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Skeleton variant="text" width="80px" height="20px" />
        <Skeleton variant="text" width="60px" height="20px" />
      </div>
      <Skeleton variant="text" width="100px" height="24px" />
    </div>
    <Skeleton variant="text" width="70%" />
    <Skeleton variant="text" width="50%" />
    <div className="flex items-center justify-between pt-2 border-t border-slate-200/70">
      <Skeleton variant="text" width="60px" />
      <Skeleton variant="text" width="80px" height="24px" />
    </div>
  </div>
);

export const SkeletonAddressCard: React.FC<{
  className?: string;
}> = ({ className }) => (
  <div className={cn('p-4 rounded-xl border border-slate-200/80 bg-white dark:bg-slate-800 dark:border-slate-700/80 animate-pulse space-y-2', className)}>
    <div className="flex items-center gap-3">
      <Skeleton variant="circular" width="32" height="32" />
      <div className="flex-1 space-y-1">
        <Skeleton variant="text" width="40%" />
        <Skeleton variant="text" width="80%" />
      </div>
      <Skeleton variant="circular" width="28" height="28" />
    </div>
    <Skeleton variant="text" width="70%" />
    <Skeleton variant="text" width="40%" />
  </div>
);

export const SkeletonDashboardStats: React.FC<{
  count?: number;
  className?: string;
}> = ({ count = 4, className }) => (
  <div className={cn('grid grid-cols-2 lg:grid-cols-4 gap-4', className)}>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 p-5 animate-pulse space-y-2">
        <div className="flex items-center justify-between">
          <Skeleton variant="text" width="60%" />
          <Skeleton variant="circular" width="36" height="36" />
        </div>
        <Skeleton variant="text" width="40%" height="32px" />
        <Skeleton variant="text" width="50%" />
      </div>
    ))}
  </div>
);

export const SkeletonProgressBar: React.FC<{
  steps?: number;
  className?: string;
}> = ({ steps = 5, className }) => (
  <div className={cn('space-y-4', className)}>
    <div className="flex items-center gap-2">
      {Array.from({ length: steps }).map((_, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <Skeleton variant="circular" width="32" height="32" />
          <Skeleton variant="text" width="60px" />
        </div>
      ))}
    </div>
    <Skeleton variant="rectangular" height="4" className="w-full" />
  </div>
);

export const SkeletonTable: React.FC<{
  rows?: number;
  columns?: number;
  className?: string;
}> = ({ rows = 5, columns = 4, className }) => (
  <div className={cn('space-y-3', className)}>
    {/* Header */}
    <div className="flex gap-4 px-4 py-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl animate-pulse">
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton key={i} variant="text" width={`${100 / columns}%`} />
      ))}
    </div>
    {/* Rows */}
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <div key={rowIndex} className="flex gap-4 px-4 py-3 border-b border-slate-200/70 dark:border-slate-700/70 animate-pulse">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} variant="text" width={`${100 / columns}%`} />
        ))}
      </div>
    ))}
  </div>
);

export const SkeletonBookingForm: React.FC<{
  className?: string;
}> = ({ className }) => (
  <div className={cn('bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 p-6 sm:p-8 animate-pulse space-y-6', className)}>
    {/* Service Selection Grid */}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <SkeletonServiceCard />
      <SkeletonServiceCard />
    </div>
    
    {/* Weight Slider */}
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Skeleton variant="text" width="40%" />
        <Skeleton variant="text" width="80px" height="48px" />
      </div>
      <Skeleton variant="rectangular" height="4" className="w-full" />
      <div className="flex flex-wrap gap-2">
        <Skeleton variant="text" width="100px" height="32px" />
        <Skeleton variant="text" width="120px" height="32px" />
        <Skeleton variant="text" width="110px" height="32px" />
        <Skeleton variant="text" width="100px" height="32px" />
      </div>
    </div>

    {/* Alterations Grid */}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="p-3.5 rounded-xl border border-slate-200/80 bg-white dark:bg-slate-800 dark:border-slate-700/80 flex items-center justify-between animate-pulse">
          <div className="space-y-1 max-w-[200px]">
            <Skeleton variant="text" width="80%" />
            <Skeleton variant="text" width="100%" />
            <Skeleton variant="text" width="60%" />
          </div>
          <div className="flex items-center gap-1.5">
            <Skeleton variant="circular" width="24" height="24" />
            <Skeleton variant="text" width="20px" />
            <Skeleton variant="circular" width="24" height="24" />
          </div>
        </div>
      ))}
    </div>

    {/* Schedule Section */}
    <div className="space-y-4">
      <Skeleton variant="text" width="40%" />
      <div className="grid grid-cols-3 gap-3">
        <Skeleton variant="text" width="100%" height="48px" />
        <Skeleton variant="text" width="100%" height="48px" />
        <Skeleton variant="text" width="100%" height="48px" />
      </div>
      <Skeleton variant="text" width="40%" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton variant="text" width="100%" height="48px" />
        <Skeleton variant="text" width="100%" height="48px" />
        <Skeleton variant="text" width="100%" height="48px" />
        <Skeleton variant="text" width="100%" height="48px" />
      </div>
      <Skeleton variant="rectangular" height="56px" className="w-full" />
    </div>

    {/* Address Selection */}
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <Skeleton variant="text" width="50%" />
        <Skeleton variant="text" width="80px" height="36px" />
      </div>
      <Skeleton variant="rectangular" height="48px" className="w-full" />
      <SkeletonAddressCard />
      <SkeletonAddressCard />
    </div>

    {/* Price Breakdown */}
    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 space-y-3 dark:bg-slate-800/50 dark:border-slate-700/80">
      <div className="grid grid-cols-2 gap-3">
        <Skeleton variant="text" width="100%" height="48px" />
        <Skeleton variant="text" width="100%" height="48px" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex justify-between items-center text-xs">
            <Skeleton variant="text" width="60%" />
            <Skeleton variant="text" width="80px" />
          </div>
        ))}
      </div>
      <div className="pt-3 border-t border-slate-200/60 flex justify-between items-baseline">
        <Skeleton variant="text" width="50%" />
        <Skeleton variant="text" width="100px" height="40px" />
      </div>
    </div>

    {/* Coupon & Payment */}
    <div className="space-y-4">
      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 animate-pulse space-y-3 dark:bg-slate-800/50 dark:border-slate-700/80">
        <div className="flex items-center gap-2">
          <Skeleton variant="circular" width="24" height="24" />
          <Skeleton variant="text" width="50%" />
        </div>
        <div className="flex gap-2">
          <Skeleton variant="text" width="100%" height="40px" />
          <Skeleton variant="text" width="80px" height="40px" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Skeleton variant="rectangular" height="120px" className="w-full" />
        <Skeleton variant="rectangular" height="120px" className="w-full" />
        <Skeleton variant="rectangular" height="120px" className="w-full" />
      </div>

      {/* Trust Badges */}
      <div className="grid grid-cols-3 gap-2">
        <Skeleton variant="rectangular" height="64px" className="w-full" />
        <Skeleton variant="rectangular" height="64px" className="w-full" />
        <Skeleton variant="rectangular" height="64px" className="w-full" />
      </div>
    </div>

    {/* Navigation Controls */}
    <div className="pt-8 border-t border-slate-200/70 flex items-center justify-between">
      <Skeleton variant="text" width="80px" height="40px" />
      <Skeleton variant="text" width="120px" height="48px" />
    </div>
  </div>
);