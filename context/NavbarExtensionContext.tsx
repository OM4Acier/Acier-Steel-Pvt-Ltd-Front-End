/**
 * context/NavbarExtensionContext.tsx
 *
 * Hanging board — lets pages inject a toolbar strip inside the NavBar shadow.
 *
 * ─── Why the previous version was broken ───────────────────────────────────
 * useNavbarExtension() stored the content in a ref and ran useEffect with []
 * (empty deps). That means:
 *   1. Content was set once on mount and never updated when JSX changed.
 *   2. If the page hadn't finished hydrating before the effect ran, the slot
 *      received null and never retried.
 *   3. React Strict Mode double-invokes effects, clearing the content.
 *
 * ─── Fix: use a rendered component instead of a hook ──────────────────────
 * <NavbarExtension> is a component that renders null but syncs its children
 * into context on every render via useLayoutEffect (synchronous, before paint).
 * React handles the children update naturally — no ref juggling, no deps array.
 *
 * Usage:
 *   // In any page — renders nothing, just registers the content
 *   <NavbarExtension>
 *     <SearchBar value={q} onChange={setQ} />
 *     <FilterToggle />
 *   </NavbarExtension>
 *
 *   // In NavBar — renders whatever the current page registered
 *   <NavbarExtensionSlot />
 *
 * Cleanup:
 *   When the page unmounts, <NavbarExtension> unmounts too and its
 *   useLayoutEffect cleanup clears the slot automatically.
 */

'use client';

import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useLayoutEffect,
  useState,
} from 'react';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface ExtensionCtx {
  content:      ReactNode;
  setContent:   (node: ReactNode) => void;
  clearContent: () => void;
}

const Ctx = createContext<ExtensionCtx | null>(null);

// ---------------------------------------------------------------------------
// Provider — mount once in app/(app)/layout.tsx
// ---------------------------------------------------------------------------

export function NavbarExtensionProvider({ children }: { children: ReactNode }) {
  const [content, setContentState] = useState<ReactNode>(null);
  const setContent   = useCallback((n: ReactNode) => setContentState(n), []);
  const clearContent = useCallback(() => setContentState(null), []);

  return (
    <Ctx.Provider value={{ content, setContent, clearContent }}>
      {children}
    </Ctx.Provider>
  );
}

// ---------------------------------------------------------------------------
// <NavbarExtension>
//
// Render this component anywhere in a page tree.
// It renders null itself but syncs its children into the slot.
//
// useLayoutEffect (not useEffect):
//   Runs synchronously after DOM mutations, before the browser paints.
//   This prevents the one-frame flash where the slot appears empty.
// ---------------------------------------------------------------------------

export function NavbarExtension({ children }: { children: ReactNode }) {
  const ctx = useContext(Ctx);

  useLayoutEffect(() => {
    if (!ctx) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(
          '[NavbarExtension] No NavbarExtensionProvider found in the tree. ' +
          'Wrap app/(app)/layout.tsx with <NavbarExtensionProvider>.'
        );
      }
      return;
    }

    // Set content on every render of the parent (children may have changed)
    ctx.setContent(children);

    // Clear when this component unmounts (page navigation)
    return () => ctx.clearContent();
  }); // ← no deps array: re-syncs on every render of the parent

  return null; // renders nothing itself
}

// ---------------------------------------------------------------------------
// <NavbarExtensionSlot>
//
// Render this inside NavBar where the hanging board should appear.
// Returns null when no page has registered content.
// ---------------------------------------------------------------------------

export function NavbarExtensionSlot() {
  const ctx = useContext(Ctx);
  if (!ctx?.content) return null;

  return (
    <div className="absolute inset-x-0 top-full z-20 pointer-events-none">
      <div className="max-w-screen-3xl mx-auto px-4 md:px-8 flex justify-end">
        <div className="
          pointer-events-auto mt-2
          flex items-center gap-4 px-5 py-2
          bg-white/79 dark:bg-gray-950/45 backdrop-blur-2xl
          border border-white/40 dark:border-white/10
          rounded-2xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)]
          text-sm font-medium text-gray-700 dark:text-gray-200
          animate-in fade-in slide-in-from-right-4 duration-500 ease-out
        ">
          {ctx.content}
        </div>
      </div>
    </div>
  );
}
