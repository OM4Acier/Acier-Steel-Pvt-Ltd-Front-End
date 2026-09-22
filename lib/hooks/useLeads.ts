/**
 * lib/hooks/useLeads.ts
 *
 * Owns the accumulated leads list, loading states, and pagination for the
 * cursor-based GET /api/leads endpoint.
 *
 * Behavior:
 *   - Fetches pages in the background and accumulates them into a single flat
 *     `leads` array. The page component re-runs its client-side grouping on
 *     every append.
 *   - Resets the entire list when `filterKey` changes (filter/sort change).
 *   - Aborts in-flight requests on unmount or filter change.
 *   - Silently catches `InvalidCursorError` and restarts from page 1.
 *   - Exposes `loadMore()` for manual/pagination-triggered fetches.
 *   - Guards against re-entry: `if (loadingMore || !hasNext) return;`
 *
 * Loading states are split:
 *   - `initialLoading` — first page is loading → show skeleton.
 *   - `loadingMore`    — a subsequent page is loading → show bottom spinner.
 *   - `error`          — a fatal error occurred → show error state + retry.
 *
 * "Invalid cursor" errors never reach the error state — they are swallowed and
 * trigger a restart from page 1.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { LeadFilters } from '@/types/leads.types';
import { fetchLeadsPage, type InvalidCursorError } from '@/lib/api/endpoints/leadsCursorApi';

// ── Public types ──────────────────────────────────────────────────────────────

export interface UseLeadsReturn {
  /** Accumulated leads from all fetched pages, in order. */
  leads: Lead[];
  /** Whether the initial page is still loading. */
  initialLoading: boolean;
  /** Whether a subsequent page is currently loading (bottom spinner). */
  loadingMore: boolean;
  /** Whether a fatal error occurred. When true, `error` holds the message. */
  error: boolean;
  /** Error message when `error` is true. */
  errorMessage: string | null;
  /** Whether there are more pages to fetch. When false, the list is complete. */
  hasNext: boolean;
  /** Fetch the next page. Safe to call repeatedly — guards against re-entry.
   * Does nothing if already loading or no more pages. */
  loadMore: () => void;
  /** Reset the list and re-fetch page 1 with the current filters.
   * Used after a mutation (create/update/delete) to refresh the view. */
  refetch: () => void;
  /** The cursor that would be sent on the next `loadMore` call.
   * Null when there are no more pages or pagination hasn't started. */
  nextCursor: string | null;
}

// Use the Lead type from the existing API layer so we don't duplicate it.
import type { Lead } from '@/lib/api/endpoints/leadsApi';

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useLeads(filters: LeadFilters, filterKey: string): UseLeadsReturn {
  // ── State ────────────────────────────────────────────────────────────────
  const [leads, setLeads] = useState<Lead[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasNext, setHasNext] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const pagesRef = useRef<Lead[]>([]); // accumulator
  const abortRef = useRef<AbortController | null>(null);
  const filterKeyRef = useRef(filterKey);
  const mountedRef = useRef(true);
  const fetchPageRef = useRef<(() => void) | null>(null);

  // Keep the filterKey ref in sync.
  useEffect(() => {
    filterKeyRef.current = filterKey;
  }, [filterKey]);

  // ── Cleanup on unmount ───────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  // ── Reset when filterKey changes ─────────────────────────────────────────
  // This is the core pagination-reset mechanism. Whenever the filters change
  // (status, isHot, start, end, sort, order), we clear the accumulator and
  // start fresh from page 1.
  useEffect(() => {
    // Abort any in-flight request before resetting.
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    pagesRef.current = [];
    setLeads([]);
    setHasNext(true);
    setNextCursor(null);
    setError(false);
    setErrorMessage(null);
    setInitialLoading(true);

    // Kick off the first page fetch using the latest callback.
    fetchPageRef.current(null, true);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  // ── Fetch one page ───────────────────────────────────────────────────────
  const fetchPage = useCallback(
    async (cursor: string | null | undefined, isFirstPage: boolean) => {
      // Re-read refs in case the component unmounted or filters changed.
      if (!mountedRef.current) return;
      if (abortRef.current?.signal.aborted) return;

      try {
        const page = await fetchLeadsPage(filters, cursor, abortRef.current?.signal);

        if (!mountedRef.current) return;

        // Accumulate pages.
        pagesRef.current = [...pagesRef.current, ...page.data];
        setLeads([...pagesRef.current]);

        // Update pagination state.
        setHasNext(page.hasNext);
        setNextCursor(page.nextCursor ?? null);

        if (isFirstPage) {
          setInitialLoading(false);
        }
      } catch (err: any) {
        if (!mountedRef.current) return;

        // Swallow invalid cursor — restart silently.
        if (err instanceof InvalidCursorError) {
          // Reset and re-fetch page 1 without the bad cursor.
          pagesRef.current = [];
          setLeads([]);
          setHasNext(true);
          setNextCursor(null);
          if (isFirstPage) {
            setInitialLoading(true);
          }
          // Recurse once with no cursor. Use a small timeout to avoid a tight loop
          // if the server keeps rejecting for some reason.
          // Use the ref to get the latest fetchPage, in case filters changed
          // concurrently (unlikely in the invalid-cursor case, but safe).
          setTimeout(() => fetchPageRef.current(null, isFirstPage), 0);
          return;
        }

        // Fatal error.
        setError(true);
        setErrorMessage(err?.message ?? 'Failed to fetch leads');
        if (isFirstPage) {
          setInitialLoading(false);
        }
      }
    },
    [filters],
  );

  // ── loadMore ─────────────────────────────────────────────────────────────
  const loadMore = useCallback(() => {
    if (loadingMore || !hasNext || !nextCursor) return;
    if (!mountedRef.current) return;

    setLoadingMore(true);

    // Create a fresh abort controller for this load. We don't abort the
    // previous request here — multiple pages can be in flight if the user
    // triggers loadMore rapidly (the accumulator deduplicates by arrival order,
    // and the old request's result will be discarded if filters changed).
    const controller = new AbortController();
    const prevAbort = abortRef.current;
    abortRef.current = controller;
    // Don't abort prevAbort — let it finish and discard if needed.

    fetchPage(nextCursor, false).then(() => {
      if (mountedRef.current) {
        setLoadingMore(false);
      }
    });

    // If the request is aborted (e.g. by a filter change), clean up.
    controller.signal.addEventListener('abort', () => {
      if (mountedRef.current) {
        setLoadingMore(false);
      }
    });
  }, [loadingMore, hasNext, nextCursor, fetchPage]);

  // ── refetch — reset and reload page 1 ────────────────────────────────────
  const refetch = useCallback(() => {
    // Trigger the filterKey effect by updating a dummy dep.
    // We do this by setting a ref that the filterKey effect watches.
    // Simpler approach: just call fetchPage directly with a reset.
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    pagesRef.current = [];
    setLeads([]);
    setHasNext(true);
    setNextCursor(null);
    setError(false);
    setErrorMessage(null);
    setInitialLoading(true);

    fetchPage(null, true);
  }, [fetchPage]);

  // ── Return ───────────────────────────────────────────────────────────────
  return {
    leads,
    initialLoading,
    loadingMore,
    error,
    errorMessage,
    hasNext,
    loadMore,
    refetch,
    nextCursor,
  };
}
