"use client";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";

// Dynamically import Threads with no SSR
const Threads = dynamic(() => import("@/components/ui/Threads"), {
  ssr: false,
  loading: () => null,
});

export interface LoadingProps {
  title?: string;
  subtitle?: string;
  showProgress?: boolean;
  blurEffect?: boolean;
  className?: string;
  amplitude?: number;
  distance?: number;
}

export default function Loading({
  title = "Loading Experience",
  subtitle = "Please wait a moment",
  showProgress = true,
  blurEffect = true,
  className,
  amplitude = 0.5,
  distance = 0.01,
}: LoadingProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <div
      className={cn(
        "relative flex h-screen w-full items-center justify-center overflow-hidden bg-background",
        className
      )}
    >
      {/* Background Thread Engine */}
      {isMounted && (
        <div className="absolute inset-0 z-0 opacity-40 transition-opacity duration-1000">
          <Threads
            amplitude={amplitude}
            distance={distance}
            enableMouseInteraction={false}
          />
        </div>
      )}

      {/* Fallback background */}
      {!isMounted && (
        <div className="absolute inset-0 z-0 opacity-20">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary/5 animate-pulse" />
        </div>
      )}

      {/* Main Content Container */}
      <div className="relative z-10 flex flex-col items-center px-6 text-center">

        {/* The "Core" Symbol with slow-spin */}
        <div className="relative mb-6">
          <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
          <div className="relative h-16 w-16 animate-slow-spin rounded-full border-2 border-dashed border-primary/50 p-2">
            <div className="h-full w-full rounded-full bg-primary shadow-[0_0_20px_rgba(var(--primary),0.5)]" />
          </div>
        </div>

        {/* Text Section */}
        <div className="space-y-2">
          <h2 className="bg-gradient-to-b from-foreground to-foreground/50 bg-clip-text text-2xl font-bold tracking-tighter text-transparent">
            {title}
          </h2>
          <p className="text-sm font-medium text-muted-foreground/80 tracking-wide">
            {subtitle}
          </p>
        </div>

        {/* Progress Bar with shimmer-slide */}
        {showProgress && (
          <div className="mt-10 h-[2px] w-40 overflow-hidden rounded-full bg-muted/30">
            <div className="h-full w-full bg-gradient-to-r from-transparent via-primary to-transparent animate-shimmer-slide" />
          </div>
        )}
      </div>

      {/* Decorative Vignette */}
      {blurEffect && (
        <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(var(--background),0.8)_100%)]" />
      )}
    </div>
  );
}