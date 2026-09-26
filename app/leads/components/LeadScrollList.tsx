"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * LeadScrollList
 * --------------
 * Scroll container for the grouped lead cards. It owns the `anim-ready`
 * class gate that defers the scroll-driven CSS animations until after the
 * first layout commit, so Chrome resolves the view() timelines against final
 * scrollport metrics instead of stale first-paint ones.
 */
export function LeadScrollList({
  children,
  labelledBy,
}: {
  children: ReactNode;
  labelledBy: string;
}) {
  const [animReady, setAnimReady] = useState(false);

  useEffect(() => {
    // Double RAF: wait for the layout commit + timeline initialisation
    // before the CSS animation attaches. Without this, view() resolves
    // against stale scrollport metrics and the top card snaps to 0%.
    let r2 = 0;
    const r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => setAnimReady(true));
    });
    return () => {
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
    };
  }, []);

  return (
    <div
      className={`max-h-[850px] overflow-y-auto p-4 flex flex-col gap-4 ${
        animReady ? "anim-ready" : ""
      }`}
      tabIndex={0}
      role="list"
      aria-label={labelledBy}
    >
      {children}
    </div>
  );
}
