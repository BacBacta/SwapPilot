"use client";

import { cn } from "@/lib/cn";

/* ========================================
   SKELETON BASE
   ======================================== */
interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-lg bg-sp-surface3",
        className
      )}
    />
  );
}

/* ========================================
   QUOTE SKELETON
   Single quote card loading state
   ======================================== */
export function QuoteSkeleton() {
  return (
    <div className="rounded-2xl border border-sp-border bg-sp-surface p-4">
      <div className="flex items-center justify-between">
        {/* Provider info */}
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
        
        {/* Output amount */}
        <div className="text-right space-y-2">
          <Skeleton className="h-5 w-28 ml-auto" />
          <Skeleton className="h-3 w-20 ml-auto" />
        </div>
      </div>
      
      {/* Details row */}
      <div className="mt-4 flex items-center justify-between border-t border-sp-border pt-4">
        <div className="flex gap-4">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-14" />
        </div>
        <Skeleton className="h-8 w-20 rounded-lg" />
      </div>
    </div>
  );
}

/* ========================================
   QUOTES LIST SKELETON
   Multiple quotes loading state
   ======================================== */
interface QuotesListSkeletonProps {
  count?: number;
}

export function QuotesListSkeleton({ count = 3 }: QuotesListSkeletonProps) {
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-24" />
      </div>
      
      {/* Quote cards */}
      {Array.from({ length: count }).map((_, i) => (
        <QuoteSkeleton key={i} />
      ))}
    </div>
  );
}

/* ========================================
   TOKEN INPUT SKELETON
   ======================================== */
export function TokenInputSkeleton() {
  return (
    <div className="rounded-2xl border border-sp-border bg-sp-surface2 p-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-10 w-32" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-6 w-16" />
        </div>
      </div>
      <div className="mt-2 flex justify-between">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}

/* ========================================
   SWAP INTERFACE SKELETON
   Full swap interface loading state
   ======================================== */
export function SwapInterfaceSkeleton() {
  return (
    <div className="w-full max-w-md mx-auto space-y-4">
      {/* Token inputs */}
      <TokenInputSkeleton />
      
      {/* Swap button placeholder */}
      <div className="flex justify-center -my-2 relative z-10">
        <Skeleton className="h-10 w-10 rounded-xl" />
      </div>
      
      <TokenInputSkeleton />
      
      {/* Route preview */}
      <div className="rounded-2xl border border-sp-border bg-sp-surface p-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-6 rounded-full" />
          <Skeleton className="h-1 flex-1" />
          <Skeleton className="h-6 w-6 rounded-full" />
          <Skeleton className="h-1 flex-1" />
          <Skeleton className="h-6 w-6 rounded-full" />
        </div>
      </div>
      
      {/* Swap button */}
      <Skeleton className="h-14 w-full rounded-2xl" />
    </div>
  );
}

/* ========================================
   PRICE SKELETON
   Inline price loading
   ======================================== */
export function PriceSkeleton({ width = "w-16" }: { width?: string }) {
  return <Skeleton className={`h-4 ${width} inline-block`} />;
}

/* ========================================
   TABLE ROW SKELETON
   ======================================== */
export function TableRowSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <div className="flex items-center gap-4 py-3 border-b border-sp-border">
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton 
          key={i} 
          className={`h-4 ${i === 0 ? 'w-32' : 'flex-1'}`} 
        />
      ))}
    </div>
  );
}

/* ========================================
   CARD SKELETON
   ======================================== */
export function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-sp-border bg-sp-surface p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-12 w-12 rounded-xl" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
      <Skeleton className="h-20 w-full" />
      <div className="flex gap-2">
        <Skeleton className="h-8 flex-1 rounded-lg" />
        <Skeleton className="h-8 flex-1 rounded-lg" />
      </div>
    </div>
  );
}
