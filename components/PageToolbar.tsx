/**
 * components/PageToolbar.tsx
 *
 * Standalone per-page toolbar — completely independent from NavBar.
 *
 * This is the "separate toolbar" pattern. Each page renders its own
 * <PageToolbar> below the NavBar. There is no shared context involved.
 *
 * Visual result:
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │  NavBar                                                          │
 *   └─────────────────────────────────────────────────────────────────┘
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │  [Page title]  [action1]  [action2]  ────────────  [info badge] │  ← PageToolbar
 *   └─────────────────────────────────────────────────────────────────┘
 *
 * When to use which pattern:
 *   NavbarExtension (hanging board) → toolbar is visually PART of the header,
 *                                     e.g. search + filter that always show
 *   PageToolbar (this component)   → toolbar is clearly BELOW the header,
 *                                     e.g. page title + contextual action row
 *
 * Usage:
 *   <PageToolbar
 *     title="Orders"
 *     subtitle="34 orders"
 *     left={[
 *       <Button key="create">+ Create</Button>,
 *       <Button key="refresh">Refresh</Button>
 *     ]}
 *     right={
 *       <Badge>High priority: 3</Badge>
 *     }
 *   />
 */

'use client';

import React, { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PageToolbarProps {
  /** Page title shown on the left. */
  title?: string;
  /** Small subtitle / count badge next to the title. */
  subtitle?: string;
  /** Nodes rendered after the title on the left side. */
  left?: ReactNode[];
  /** Nodes rendered on the right side. */
  right?: ReactNode;
  /** Extra class names for the toolbar container. */
  className?: string;
  /** Set false to hide the bottom border. Default: true */
  bordered?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PageToolbar({
  title,
  subtitle,
  left,
  right,
  className,
  bordered = true,
}: PageToolbarProps) {
  return (
    <div
      className={cn(
        'w-full bg-white dark:bg-gray-900 px-4 md:px-8 py-2.5',
        'flex items-center justify-between gap-3 flex-wrap',
        bordered && 'border-b border-gray-200 dark:border-gray-700',
        'shadow-sm',
        className
      )}
    >
      {/* Left: title + left nodes */}
      <div className="flex items-center gap-3 flex-wrap">
        {title && (
          <div className="flex items-baseline gap-2">
            <h2 className="text-base font-bold text-gray-800 dark:text-white leading-none">
              {title}
            </h2>
            {subtitle && (
              <span className="text-xs text-gray-400 font-medium leading-none">
                {subtitle}
              </span>
            )}
          </div>
        )}
        {left?.map((node, i) => (
          <React.Fragment key={i}>{node}</React.Fragment>
        ))}
      </div>

      {/* Right */}
      {right && (
        <div className="flex items-center gap-2 flex-wrap">
          {right}
        </div>
      )}
    </div>
  );
}