"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * LeadScrollList
 * --------------
 * Scroll container for the grouped lead cards.
 *
 * `scrollable` drives three things at once: the scroll class on the list,
 * the `anim-ready` gate, and (at the call site) whether the two edge
 * gradients render. When false — a single-card section — the container is
 * `overflow-visible` with no height cap, no `anim-ready`, and no view()
 * animation: i.e. a plain card.
 */
export function LeadScrollList({
  children,
  labelledBy,
  scrollable,
}: {
  children: ReactNode;
  labelledBy: string;
  scrollable: boolean;
}) {
  const [animReady, setAnimReady] = useState(false);

  useEffect(() => {
    // No scroll → no view() timeline → skip the RAF gate entirely.
    if (!scrollable) return;
    let r2 = 0;
    const r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => setAnimReady(true));
    });
    return () => {
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
    };
  }, [scrollable]);

  return (
    <div
      className={[
        "p-4 flex flex-col gap-4",
        // Single card: no cap, no scroll, no gutter, no track.
        scrollable
          ? "lead-scroll-list max-h-[850px] overflow-y-auto"
          : "overflow-visible",
        scrollable && animReady ? "anim-ready" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      tabIndex={scrollable ? 0 : -1}
      role="list"
      aria-label={labelledBy}
    >
      {children}
    </div>
  );
}
